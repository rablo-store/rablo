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


