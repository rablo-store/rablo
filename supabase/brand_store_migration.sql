-- ============================================================================
-- RABLO — Migration: Brand Store Data Model, Security & RLS Hardening (Part 1)
-- Safe and idempotent to run on the live database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SECURITY HARDENING: PROFILES & PRODUCTS POLICIES & TRIGGERS
-- ----------------------------------------------------------------------------

-- 1.1 Disallow anonymous inserts on profiles
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 1.2 Prevent non-admins from changing is_banned, role on profiles
CREATE OR REPLACE FUNCTION public.handle_profile_security()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := (current_user IN ('postgres', 'service_role')) OR (COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com');
  
  IF NOT v_is_admin THEN
    NEW.is_banned := OLD.is_banned;
    NEW.role := OLD.role;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_profile_security ON public.profiles;
CREATE TRIGGER tr_profile_security
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_security();

-- 1.3 Prevent non-admins from altering approval_status or rejection_feedback on products
CREATE OR REPLACE FUNCTION public.handle_product_moderation()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := (current_user IN ('postgres', 'service_role')) OR (COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com');
  
  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_admin THEN
      NEW.approval_status := 'Pending';
      NEW.rejection_feedback := NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT v_is_admin THEN
      NEW.approval_status := OLD.approval_status;
      NEW.rejection_feedback := OLD.rejection_feedback;
    END IF;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_product_moderation ON public.products;
CREATE TRIGGER tr_product_moderation
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_product_moderation();

-- 1.4 Hardened storage policies for 'product-images' (user folder isolation)
DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;

CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ----------------------------------------------------------------------------
-- 2. BRAND STORE TABLES: BRANDS & BRAND_CONTACTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  tagline TEXT CHECK (char_length(tagline) <= 100),
  bio TEXT CHECK (char_length(bio) <= 1000),
  logo_url TEXT,
  banner_url TEXT,
  instagram_url TEXT NOT NULL,
  creator_type TEXT NOT NULL DEFAULT 'individual' CHECK (creator_type IN ('individual','small_brand')),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'Pending' CHECK (approval_status IN ('Pending','Approved','Rejected')),
  rejection_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brand_contacts (
  brand_id UUID PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('instagram','whatsapp','custom')),
  link_template TEXT NOT NULL CHECK (
    char_length(link_template) <= 500 AND
    link_template ~* '^https://(www\.)?(instagram\.com|ig\.me|wa\.me|api\.whatsapp\.com|t\.me|m\.me)/'
  ),
  message_template TEXT CHECK (char_length(message_template) <= 300)
);

-- Extend products with brand_id, attributes
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add check constraint on product_ig_url using the contact host allow-list
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_product_ig_url_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_product_ig_url_check
  CHECK (
    product_ig_url IS NULL OR (
      char_length(product_ig_url) <= 500 AND
      product_ig_url ~* '^https://(www\.)?(instagram\.com|ig\.me|wa\.me|api\.whatsapp\.com|t\.me|m\.me)/'
    )
  ) NOT VALID;

-- ----------------------------------------------------------------------------
-- 3. RLS POLICIES FOR BRANDS & BRAND_CONTACTS
-- ----------------------------------------------------------------------------

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_contacts ENABLE ROW LEVEL SECURITY;

-- Brands RLS
DROP POLICY IF EXISTS "brands_select_approved" ON public.brands;
CREATE POLICY "brands_select_approved" ON public.brands
  FOR SELECT USING (
    approval_status = 'Approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = brands.owner_id AND profiles.is_banned = TRUE
    )
  );

DROP POLICY IF EXISTS "brands_select_own" ON public.brands;
CREATE POLICY "brands_select_own" ON public.brands
  FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "brands_select_admin" ON public.brands;
CREATE POLICY "brands_select_admin" ON public.brands
  FOR SELECT USING ((auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com');

DROP POLICY IF EXISTS "brands_insert_own" ON public.brands;
CREATE POLICY "brands_insert_own" ON public.brands
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id
    AND approval_status = 'Pending'
    AND is_verified = FALSE
  );

DROP POLICY IF EXISTS "brands_update_own" ON public.brands;
CREATE POLICY "brands_update_own" ON public.brands
  FOR UPDATE USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "brands_update_admin" ON public.brands;
CREATE POLICY "brands_update_admin" ON public.brands
  FOR UPDATE USING ((auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com');

DROP POLICY IF EXISTS "brands_delete_admin" ON public.brands;
CREATE POLICY "brands_delete_admin" ON public.brands
  FOR DELETE USING ((auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com');

-- Trigger to guard brand moderation fields from seller tampering
CREATE OR REPLACE FUNCTION public.handle_brand_security()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := (current_user IN ('postgres', 'service_role')) OR (COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com');
  
  IF NOT v_is_admin THEN
    NEW.approval_status := OLD.approval_status;
    NEW.is_verified := OLD.is_verified;
    NEW.rejection_feedback := OLD.rejection_feedback;
  END IF;
  
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_brand_security ON public.brands;
CREATE TRIGGER tr_brand_security
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_brand_security();

-- Brand contacts RLS (Log-in required to read contact links)
DROP POLICY IF EXISTS "brand_contacts_select" ON public.brand_contacts;
CREATE POLICY "brand_contacts_select" ON public.brand_contacts
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.brands
      JOIN public.profiles ON profiles.id = brands.owner_id
      WHERE brands.id = brand_contacts.brand_id
        AND (
          (brands.approval_status = 'Approved' AND COALESCE(profiles.is_banned, FALSE) = FALSE)
          OR brands.owner_id = auth.uid()
          OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
        )
    )
  );

DROP POLICY IF EXISTS "brand_contacts_insert_own" ON public.brand_contacts;
CREATE POLICY "brand_contacts_insert_own" ON public.brand_contacts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_contacts.brand_id
        AND brands.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "brand_contacts_update_own" ON public.brand_contacts;
CREATE POLICY "brand_contacts_update_own" ON public.brand_contacts
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_contacts.brand_id
        AND brands.owner_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_contacts.brand_id
        AND brands.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "brand_contacts_delete_own" ON public.brand_contacts;
CREATE POLICY "brand_contacts_delete_own" ON public.brand_contacts
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.brands
      WHERE brands.id = brand_contacts.brand_id
        AND brands.owner_id = auth.uid()
    )
  );

-- Ensure public.is_admin() helper is defined
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com' $$;

-- Update products RLS to require seller ownership of brand_id and disallow anon insert or insert without brand
DROP POLICY IF EXISTS "products_insert_seller" ON public.products;
CREATE POLICY "products_insert_seller" ON public.products
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      auth.uid() = seller_id
      AND brand_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.brands
        WHERE brands.id = products.brand_id
          AND brands.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "products_update_own" ON public.products;
CREATE POLICY "products_update_own" ON public.products
  FOR UPDATE USING (auth.uid() = seller_id)
  WITH CHECK (
    auth.uid() = seller_id
    AND (
      brand_id IS NULL OR EXISTS (
        SELECT 1 FROM public.brands WHERE brands.id = products.brand_id AND brands.owner_id = auth.uid()
      )
    )
  );


-- ----------------------------------------------------------------------------
-- 4. RPC: product_save_counts()
-- Returns save counts without revealing any user IDs or non-approved products.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.product_save_counts()
RETURNS TABLE (product_id UUID, saves INT) AS $$
BEGIN
  RETURN QUERY
  SELECT c.product_id, COUNT(*)::INT AS saves
  FROM public.cart_items c
  JOIN public.products p ON p.id = c.product_id
  WHERE p.approval_status = 'Approved'
  GROUP BY c.product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.product_save_counts() TO anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. IDEMPOTENT BACKFILL: SILLERS & PRODUCTS -> BRANDS & BRAND_CONTACTS
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  v_base_slug TEXT;
  v_slug TEXT;
  v_counter INT;
  v_brand_id UUID;
  v_has_approved BOOLEAN;
  v_ig_url TEXT;
  v_name TEXT;
BEGIN
  FOR r IN
    SELECT p.id, p.full_name, p.instagram_url
    FROM public.profiles p
    WHERE EXISTS (SELECT 1 FROM public.products pr WHERE pr.seller_id = p.id)
  LOOP
    -- Check if brand already exists for this owner
    SELECT id INTO v_brand_id FROM public.brands WHERE owner_id = r.id;

    IF v_brand_id IS NULL THEN
      -- Generate clean base slug from instagram handle or name or id
      v_base_slug := lower(regexp_replace(
        coalesce(
          nullif(regexp_replace(r.instagram_url, '^https?://(www\.)?instagram\.com/([^/?#]+).*$', '\2'), ''),
          nullif(regexp_replace(r.full_name, '[^a-zA-Z0-9]', '', 'g'), ''),
          'creator'
        ),
        '[^a-z0-9-]', '', 'g'
      ));

      IF length(v_base_slug) < 3 THEN
        v_base_slug := v_base_slug || '-brand';
      END IF;
      v_base_slug := substring(v_base_slug from 1 for 35);
      IF NOT (v_base_slug ~ '^[a-z0-9]') THEN
        v_base_slug := 'c-' || v_base_slug;
      END IF;

      -- De-duplicate slug
      v_slug := v_base_slug;
      v_counter := 1;
      WHILE EXISTS (SELECT 1 FROM public.brands WHERE slug = v_slug) LOOP
        v_counter := v_counter + 1;
        v_slug := substring(v_base_slug from 1 for 35) || '-' || v_counter;
      END LOOP;

      SELECT EXISTS (
        SELECT 1 FROM public.products WHERE seller_id = r.id AND approval_status = 'Approved'
      ) INTO v_has_approved;

      v_name := coalesce(nullif(trim(r.full_name), ''), 'Independent Creator');
      IF length(v_name) < 2 THEN v_name := v_name || ' Shop'; END IF;
      IF length(v_name) > 60 THEN v_name := substring(v_name from 1 for 60); END IF;

      v_ig_url := coalesce(nullif(trim(r.instagram_url), ''), 'https://instagram.com/rablo.in');
      IF NOT (v_ig_url ~* '^https?://') THEN
        v_ig_url := 'https://instagram.com/' || regexp_replace(v_ig_url, '^@', '');
      END IF;

      INSERT INTO public.brands (
        owner_id, slug, name, instagram_url, approval_status, creator_type, is_verified
      ) VALUES (
        r.id,
        v_slug,
        v_name,
        v_ig_url,
        CASE WHEN v_has_approved THEN 'Approved' ELSE 'Pending' END,
        'individual',
        v_has_approved
      )
      RETURNING id INTO v_brand_id;

      -- Create default contact
      INSERT INTO public.brand_contacts (brand_id, contact_type, link_template)
      VALUES (
        v_brand_id,
        'instagram',
        CASE
          WHEN v_ig_url ~* '^https://(www\.)?(instagram\.com|ig\.me)/' THEN
            CASE WHEN v_ig_url LIKE '%/' THEN v_ig_url ELSE v_ig_url || '/' END
          ELSE 'https://instagram.com/rablo.in/'
        END
      )
      ON CONFLICT (brand_id) DO NOTHING;
    END IF;

    -- Update products to point to brand_id
    UPDATE public.products
    SET brand_id = v_brand_id
    WHERE seller_id = r.id AND (brand_id IS NULL OR brand_id != v_brand_id);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. ENHANCE BAN_USER: HIDE BRAND AND SET STATUS TO REJECTED
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
  v_brands_updated INTEGER;
BEGIN
  IF (auth.jwt() ->> 'email') != 'sumitkatiyar783@gmail.com' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.profiles SET is_banned = TRUE, updated_at = NOW() WHERE id = p_user_id;

  -- Banning a user sets their brand store to Rejected
  UPDATE public.brands SET approval_status = 'Rejected', updated_at = NOW() WHERE owner_id = p_user_id;
  GET DIAGNOSTICS v_brands_updated = ROW_COUNT;

  DELETE FROM public.products WHERE seller_id = p_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'banned', TRUE,
    'products_deleted', v_deleted_count,
    'brands_rejected', v_brands_updated
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 8. INSTAGRAM VERIFICATION & ADMIN APPROVAL QUEUE MIGRATION
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add verification & moderation columns to public.brands
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS verification_method TEXT,
  ADD COLUMN IF NOT EXISTS verification_code TEXT,
  ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Sync existing rejection_feedback with rejection_reason if empty
UPDATE public.brands
SET rejection_reason = rejection_feedback
WHERE rejection_reason IS NULL AND rejection_feedback IS NOT NULL;

-- Backfill instagram_handle from existing instagram_url if null
UPDATE public.brands
SET instagram_handle = lower(regexp_replace(regexp_replace(instagram_url, '^https?://(www\.)?instagram\.com/', '', 'i'), '^@', ''))
WHERE instagram_handle IS NULL AND instagram_url IS NOT NULL;

-- Constraints on instagram_handle & verification_method
ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_instagram_handle_format_check;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_instagram_handle_format_check
  CHECK (instagram_handle IS NULL OR instagram_handle ~ '^[a-z0-9._]{1,30}$');

ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_verification_method_check;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_verification_method_check
  CHECK (verification_method IS NULL OR verification_method IN ('bio_code', 'dm'));

-- Ensure approval_status check constraint
ALTER TABLE public.brands
  DROP CONSTRAINT IF EXISTS brands_approval_status_check;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_approval_status_check
  CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'));

-- Unique index: one verified owner per lowercase instagram handle
CREATE UNIQUE INDEX IF NOT EXISTS brands_unique_verified_instagram_handle
  ON public.brands (lower(instagram_handle))
  WHERE is_verified = TRUE;

-- Rate-limit tracking table for verification codes (max 5 per brand per 24 hours)
CREATE TABLE IF NOT EXISTS public.brand_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_verification_codes_brand_created
  ON public.brand_verification_codes (brand_id, created_at DESC);

ALTER TABLE public.brand_verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brand_verification_codes_admin_all" ON public.brand_verification_codes;
CREATE POLICY "brand_verification_codes_admin_all" ON public.brand_verification_codes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Update BEFORE UPDATE trigger to guard brand moderation fields from seller tampering
CREATE OR REPLACE FUNCTION public.handle_brand_security()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := (current_user IN ('postgres', 'service_role'))
                OR (COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com')
                OR (public.is_admin());

  -- Normalise instagram_handle if updated
  IF NEW.instagram_handle IS NOT NULL THEN
    NEW.instagram_handle := lower(regexp_replace(regexp_replace(NEW.instagram_handle, '^https?://(www\.)?instagram\.com/', '', 'i'), '^@', ''));
    NEW.instagram_handle := regexp_replace(NEW.instagram_handle, '/.*$', '');
  END IF;

  IF NOT v_is_admin THEN
    -- Non-admin cannot alter moderation / review fields
    NEW.approval_status := OLD.approval_status;
    NEW.is_verified := OLD.is_verified;
    NEW.rejection_feedback := OLD.rejection_feedback;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.verified_at := OLD.verified_at;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;

    -- Changing instagram_handle by a non-admin resets verification proof
    IF NEW.instagram_handle IS DISTINCT FROM OLD.instagram_handle THEN
      NEW.is_verified := FALSE;
      NEW.verification_method := NULL;
      NEW.verification_code := NULL;
      NEW.verification_code_expires_at := NULL;
      NEW.verification_requested_at := NULL;
      NEW.verified_at := NULL;
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_brand_security ON public.brands;
CREATE TRIGGER tr_brand_security
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.handle_brand_security();

-- SECURITY DEFINER function: start_instagram_verification
CREATE OR REPLACE FUNCTION public.start_instagram_verification(
  p_brand_id UUID,
  p_method TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_handle TEXT;
  v_alphabet TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes BYTEA;
  v_code_suffix TEXT := '';
  v_full_code TEXT;
  v_i INT;
  v_byte INT;
  v_recent_codes_count INT;
BEGIN
  -- Verify caller owns the brand or is admin
  SELECT owner_id, instagram_handle INTO v_owner_id, v_handle
  FROM public.brands
  WHERE id = p_brand_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  IF v_owner_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this brand';
  END IF;

  -- Validate method
  IF p_method NOT IN ('bio_code', 'dm') THEN
    RAISE EXCEPTION 'Invalid verification method. Allowed methods: bio_code, dm';
  END IF;

  -- Validate handle exists
  IF v_handle IS NULL OR trim(v_handle) = '' THEN
    RAISE EXCEPTION 'Please provide a valid Instagram handle before starting verification';
  END IF;

  -- Enforce rate limit: max 5 new codes per brand per 24 hours
  SELECT COUNT(*) INTO v_recent_codes_count
  FROM public.brand_verification_codes
  WHERE brand_id = p_brand_id
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF v_recent_codes_count >= 5 THEN
    RAISE EXCEPTION 'Verification code request limit reached (maximum 5 per 24 hours). Please try again later.';
  END IF;

  -- Generate code: 'RABLO-' plus 6 characters from unambiguous alphabet (no 0, O, 1, I)
  v_bytes := gen_random_bytes(6);
  FOR v_i IN 0..5 LOOP
    v_byte := get_byte(v_bytes, v_i);
    v_code_suffix := v_code_suffix || substr(v_alphabet, (v_byte % 32) + 1, 1);
  END LOOP;
  v_full_code := 'RABLO-' || v_code_suffix;

  -- Record code in rate-limiting table
  INSERT INTO public.brand_verification_codes (brand_id, code, created_at)
  VALUES (p_brand_id, v_full_code, NOW());

  -- Update brand verification state
  UPDATE public.brands
  SET
    verification_method = p_method,
    verification_code = v_full_code,
    verification_code_expires_at = NOW() + INTERVAL '7 days',
    verification_requested_at = NULL,
    updated_at = NOW()
  WHERE id = p_brand_id;

  RETURN v_full_code;
END;
$$;

REVOKE ALL ON FUNCTION public.start_instagram_verification(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_instagram_verification(UUID, TEXT) TO authenticated;

-- SECURITY DEFINER function: request_instagram_review
CREATE OR REPLACE FUNCTION public.request_instagram_review(
  p_brand_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_owner_id UUID;
  v_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Verify caller owns the brand or is admin
  SELECT owner_id, verification_code, verification_code_expires_at
  INTO v_owner_id, v_code, v_expires_at
  FROM public.brands
  WHERE id = p_brand_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Brand not found';
  END IF;

  IF v_owner_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this brand';
  END IF;

  -- Validate code existence and non-expiration
  IF v_code IS NULL OR trim(v_code) = '' THEN
    RAISE EXCEPTION 'Cannot request review: No verification code generated. Please start verification first.';
  END IF;

  IF v_expires_at IS NULL OR v_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Cannot request review: Verification code has expired. Please generate a new code.';
  END IF;

  -- Set verification_requested_at; seller cannot alter is_verified
  UPDATE public.brands
  SET
    verification_requested_at = NOW(),
    updated_at = NOW()
  WHERE id = p_brand_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.request_instagram_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_instagram_review(UUID) TO authenticated;

-- SECURITY DEFINER function: admin_review_brand
CREATE OR REPLACE FUNCTION public.admin_review_brand(
  p_brand_id UUID,
  p_verify BOOLEAN,
  p_approval TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_handle TEXT;
  v_existing_verified_brand UUID;
BEGIN
  -- Verify admin identity
  v_is_admin := (current_user IN ('postgres', 'service_role'))
                OR (COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com')
                OR (public.is_admin());

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can review brands';
  END IF;

  -- Validate approval status
  IF p_approval NOT IN ('Pending', 'Approved', 'Rejected') THEN
    RAISE EXCEPTION 'Invalid approval status. Allowed: Pending, Approved, Rejected';
  END IF;

  -- Rejection reason required when Rejected
  IF p_approval = 'Rejected' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
    RAISE EXCEPTION 'Rejection reason is required when rejecting a brand';
  END IF;

  -- Retrieve brand handle
  SELECT lower(instagram_handle) INTO v_handle
  FROM public.brands
  WHERE id = p_brand_id;

  IF v_handle IS NULL AND p_verify = TRUE THEN
    RAISE EXCEPTION 'Cannot verify a brand without an Instagram handle';
  END IF;

  -- Refuse is_verified = true if handle is already verified on another brand
  IF p_verify = TRUE THEN
    SELECT id INTO v_existing_verified_brand
    FROM public.brands
    WHERE lower(instagram_handle) = v_handle
      AND is_verified = TRUE
      AND id <> p_brand_id
    LIMIT 1;

    IF v_existing_verified_brand IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot verify: Instagram handle @% is already verified on another brand', v_handle;
    END IF;
  END IF;

  -- Update moderation fields
  UPDATE public.brands
  SET
    is_verified = p_verify,
    verified_at = CASE WHEN p_verify THEN COALESCE(verified_at, NOW()) ELSE NULL END,
    approval_status = p_approval,
    reviewed_at = NOW(),
    reviewed_by = auth.uid(),
    rejection_reason = CASE WHEN p_approval = 'Rejected' THEN p_reason ELSE NULL END,
    rejection_feedback = CASE WHEN p_approval = 'Rejected' THEN p_reason ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_brand_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_brand(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_brand(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

-- Public view exposing approved brands with badge info without leaking verification codes
CREATE OR REPLACE VIEW public.approved_brands AS
  SELECT
    id,
    owner_id,
    slug,
    name,
    tagline,
    bio,
    logo_url,
    banner_url,
    instagram_url,
    instagram_handle,
    creator_type,
    is_verified,
    approval_status,
    created_at,
    updated_at
  FROM public.brands
  WHERE approval_status = 'Approved';

GRANT SELECT ON public.approved_brands TO anon, authenticated;



