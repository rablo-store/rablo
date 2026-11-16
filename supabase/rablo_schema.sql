-- ============================================================================
-- RABLO — Complete Database Schema, RLS Security & Showcase Seed Script
-- Instagram Marketing & Discovery Catalog Platform
-- Run this entire script in Supabase SQL Editor. It is idempotent and safe to re-run.
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. PROFILES TABLE
-- We remove hard FK constraint to auth.users so that seed creators can be populated,
-- while auth triggers still automatically sync real Google OAuth users!
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  instagram_url TEXT,
  is_banned BOOLEAN DEFAULT FALSE,
  is_seller BOOLEAN DEFAULT FALSE,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'seller', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop old foreign key constraint if it was created previously
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Enforce 1 Instagram account per 1 email address uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS unique_profile_instagram_url ON public.profiles (lower(trim(instagram_url))) WHERE instagram_url IS NOT NULL AND instagram_url <> '';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

-- Anyone can read non-banned profiles or their own profile
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (COALESCE(is_banned, FALSE) = FALSE OR auth.uid() = id);

-- Superadmin can view all profiles including banned ones
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Users can insert their own profile on signup
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Prevent non-admins from changing is_banned, role on profiles
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

-- Superadmin can update any profile (e.g. ban/unban, promote)
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Trigger: Automatically sync profile when user signs in via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    CASE WHEN LOWER(NEW.email) = 'sumitkatiyar783@gmail.com' THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), public.profiles.avatar_url),
    role = CASE WHEN LOWER(EXCLUDED.email) = 'sumitkatiyar783@gmail.com' THEN 'admin' ELSE public.profiles.role END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Clean up profile if auth.users row is deleted
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();


-- ============================================================================
-- 2. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_approved" ON public.categories;
DROP POLICY IF EXISTS "categories_select_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_seller" ON public.categories;
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;

CREATE POLICY "categories_select_approved" ON public.categories
  FOR SELECT USING (is_approved = TRUE);

CREATE POLICY "categories_select_admin" ON public.categories
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

CREATE POLICY "categories_insert_seller" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "categories_update_admin" ON public.categories
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

CREATE POLICY "categories_delete_admin" ON public.categories
  FOR DELETE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Seed initial catalog categories
INSERT INTO public.categories (id, name, slug, is_approved, image_url) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Crochet', 'crochet', TRUE, '/categories/crochet.webp'),
  ('c0000000-0000-0000-0000-000000000002', 'Art & Prints', 'art', TRUE, '/categories/art-and-prints.webp'),
  ('c0000000-0000-0000-0000-000000000003', 'Mobile Accessories', 'mobile-accessories', TRUE, '/categories/mobile-accessories.webp'),
  ('c0000000-0000-0000-0000-000000000004', 'Jewellery', 'jewelry', TRUE, '/categories/jewellery.webp'),
  ('c0000000-0000-0000-0000-000000000005', 'Clothing & Apparel', 'clothing', TRUE, '/categories/clothing-and-apparel.webp'),
  ('c0000000-0000-0000-0000-000000000006', 'Home & Decor', 'home-decor', TRUE, '/categories/home-and-decor.webp'),
  ('c0000000-0000-0000-0000-000000000007', 'Stickers & Stationery', 'stickers', TRUE, NULL),
  ('c0000000-0000-0000-0000-000000000008', 'Ceramics & Pottery', 'pottery', TRUE, NULL),
  ('c0000000-0000-0000-0000-000000000009', 'Accessories', 'accessories', TRUE, NULL),
  ('c0000000-0000-0000-0000-000000000010', 'Handmade Bags', 'handmade-bags', TRUE, NULL)
ON CONFLICT (name) DO UPDATE SET is_approved = TRUE, slug = EXCLUDED.slug, image_url = COALESCE(EXCLUDED.image_url, public.categories.image_url);


-- ============================================================================
-- 3. BRANDS & BRAND_CONTACTS TABLES (Brand Store Architecture)
-- ============================================================================
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

DROP POLICY IF EXISTS "brands_insert_own" ON public.brands
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

-- Brand Contacts RLS (requires authentication to see contact details)
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


-- ============================================================================
-- 4. PRODUCTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_ig_url TEXT NOT NULL,
  product_ig_url TEXT,
  contact_link TEXT,
  thumbnail_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_status TEXT DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
  rejection_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent column check for existing databases
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS contact_link TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

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

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_approved" ON public.products;
DROP POLICY IF EXISTS "products_select_own" ON public.products;
DROP POLICY IF EXISTS "products_select_admin" ON public.products;
DROP POLICY IF EXISTS "products_insert_seller" ON public.products;
DROP POLICY IF EXISTS "products_update_own" ON public.products;
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
DROP POLICY IF EXISTS "products_delete_own" ON public.products;
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;

-- Public can see Approved products as long as the creator is not banned
CREATE POLICY "products_select_approved" ON public.products
  FOR SELECT USING (
    approval_status = 'Approved'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE profiles.id = products.seller_id AND profiles.is_banned = TRUE
    )
  );

-- Creators can see all of their own listings
CREATE POLICY "products_select_own" ON public.products
  FOR SELECT USING (auth.uid() = seller_id);

-- Superadmin can see all listings
CREATE POLICY "products_select_admin" ON public.products
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Authenticated creators can upload products (brand_id must belong to seller)
CREATE POLICY "products_insert_seller" ON public.products
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id
    AND (
      brand_id IS NULL OR EXISTS (
        SELECT 1 FROM public.brands WHERE brands.id = products.brand_id AND brands.owner_id = auth.uid()
      )
    )
  );

-- Creators can update their own listings (brand_id must belong to seller)
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

-- Admin can moderate (approve/reject) any product
CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Creators can delete their own products
CREATE POLICY "products_delete_own" ON public.products
  FOR DELETE USING (auth.uid() = seller_id);

-- Admin can delete any product
CREATE POLICY "products_delete_admin" ON public.products
  FOR DELETE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Trigger: Prevent non-admins from altering approval_status or rejection_feedback
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


-- ============================================================================
-- 4. CART_ITEMS TABLE (Lead Cart & 5-Click Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  click_count INTEGER DEFAULT 0 CHECK (click_count >= 0),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT cart_items_user_product_key UNIQUE(user_id, product_id)
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_select_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_insert_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_update_own" ON public.cart_items;
DROP POLICY IF EXISTS "cart_delete_own" ON public.cart_items;

CREATE POLICY "cart_select_own" ON public.cart_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cart_insert_own" ON public.cart_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cart_update_own" ON public.cart_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cart_delete_own" ON public.cart_items
  FOR DELETE USING (auth.uid() = user_id);


-- ============================================================================
-- 5. CATEGORY_REQUESTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.category_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.category_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cat_req_select_own" ON public.category_requests;
DROP POLICY IF EXISTS "cat_req_select_admin" ON public.category_requests;
DROP POLICY IF EXISTS "cat_req_insert" ON public.category_requests;
DROP POLICY IF EXISTS "cat_req_update_admin" ON public.category_requests;

CREATE POLICY "cat_req_select_own" ON public.category_requests
  FOR SELECT USING (auth.uid() = requested_by);

CREATE POLICY "cat_req_select_admin" ON public.category_requests
  FOR SELECT USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

CREATE POLICY "cat_req_insert" ON public.category_requests
  FOR INSERT WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "cat_req_update_admin" ON public.category_requests
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );


-- ============================================================================
-- 6. RPC FUNCTIONS (5-Click Rule & User Moderation)
-- ============================================================================

-- Increments outbound IG click count and auto-deletes the item on the 5th click
CREATE OR REPLACE FUNCTION public.increment_cart_click(p_cart_item_id UUID)
RETURNS JSON AS $$
DECLARE
  v_new_count INTEGER;
  v_deleted BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cart_items WHERE id = p_cart_item_id AND user_id = auth.uid()
  ) THEN
    RETURN json_build_object('error', 'Not found or not authorized');
  END IF;

  UPDATE public.cart_items
  SET click_count = click_count + 1
  WHERE id = p_cart_item_id AND user_id = auth.uid()
  RETURNING click_count INTO v_new_count;

  IF v_new_count >= 5 THEN
    DELETE FROM public.cart_items WHERE id = p_cart_item_id;
    v_deleted := TRUE;
  END IF;

  RETURN json_build_object(
    'click_count', v_new_count,
    'deleted', v_deleted
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ban user and wipe active listings (Admin only)
CREATE OR REPLACE FUNCTION public.ban_user(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  IF (auth.jwt() ->> 'email') != 'sumitkatiyar783@gmail.com' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.profiles SET is_banned = TRUE, updated_at = NOW() WHERE id = p_user_id;

  DELETE FROM public.products WHERE seller_id = p_user_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'banned', TRUE,
    'products_deleted', v_deleted_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unban user (Admin only)
CREATE OR REPLACE FUNCTION public.unban_user(p_user_id UUID)
RETURNS JSON AS $$
BEGIN
  IF (auth.jwt() ->> 'email') != 'sumitkatiyar783@gmail.com' THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  UPDATE public.profiles SET is_banned = FALSE, updated_at = NOW() WHERE id = p_user_id;
  RETURN json_build_object('unbanned', TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Product Save Counts (Aggregated saves for approved products; keeps cart_items private)
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


-- ============================================================================
-- 7. SUPABASE STORAGE BUCKET: product-images
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "product_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "product_images_select" ON storage.objects;
DROP POLICY IF EXISTS "product_images_update" ON storage.objects;
DROP POLICY IF EXISTS "product_images_delete" ON storage.objects;

-- Authenticated users can upload into product-images (isolated to their own user directory)
CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access for images
CREATE POLICY "product_images_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Authenticated users can update images in their own user directory
CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete images in their own user directory
CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 8. SHOWCASE SEED DATA (Verified Creators & Approved Products)
-- Gives your catalog immediate, breathtaking visual life!
-- ============================================================================

-- 8.1 Seed Curated Verified Creator Profiles
INSERT INTO public.profiles (id, email, full_name, avatar_url, instagram_url, is_banned, is_seller, role)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'ananya.crochet@demo.rablo.in',
    'Ananya Roy',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/knotandthread.in',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'kabir.mitti@demo.rablo.in',
    'Kabir Mittal',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/studiomitti.pottery',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'meera.cases@demo.rablo.in',
    'Meera Nambiar',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/wildflower.cases',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000004',
    'tanvi.prints@demo.rablo.in',
    'Tanvi Desai',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/parchmentandpetals',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000005',
    'rohan.loom@demo.rablo.in',
    'Rohan Sen',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/artisanloom.in',
    FALSE,
    TRUE,
    'seller'
  )
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  instagram_url = EXCLUDED.instagram_url,
  is_seller = TRUE;

-- 8.2 Seed Curated Approved Creations
INSERT INTO public.products (
  id, name, description, price, stock,
  category_id, seller_id, seller_ig_url, product_ig_url, contact_link,
  thumbnail_url, gallery_urls, approval_status
)
VALUES
  (
    'p0000000-0000-0000-0000-000000000001',
    'Lavender Granny Square Crochet Tote',
    'Hand-crocheted using 100% breathable organic milk cotton yarn. Features reinforced straps, pastel lavender and cream squares, and sturdy interior lining. Custom color palettes available via DM.',
    1299.00,
    6,
    'c0000000-0000-0000-0000-000000000001', -- Crochet
    '00000000-0000-0000-0000-000000000001',
    'https://instagram.com/knotandthread.in',
    'https://instagram.com/p/DB123456789',
    'https://wa.me/919876543210?text=Hi%2C%20inquiring%20about%20the%20Lavender%20Granny%20Square%20Crochet%20Tote%20on%20Rablo',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000002',
    'Ribbed Ceramic Matcha Bowl & Whisk Stand',
    'Wheel-thrown stoneware bowl with a soft speckled ivory glaze and tactile tactile thumb indentation for whisking. Lead-free, microwave and dishwasher safe. Crafted in our Delhi studio.',
    1450.00,
    4,
    'c0000000-0000-0000-0000-000000000008', -- Ceramics & Pottery
    '00000000-0000-0000-0000-000000000002',
    'https://instagram.com/studiomitti.pottery',
    'https://instagram.com/p/DB234567890',
    'https://wa.me/919876543212?text=Hi%2C%20inquiring%20about%20the%20Ribbed%20Ceramic%20Matcha%20Bowl%20on%20Rablo',
    'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000003',
    'Wild Daisy Real Pressed Flower Phone Case',
    'Naturally hand-pressed real white daisies and golden baby''s breath encased in crystal-clear archival resin with shockproof bumper edges. Made for all iPhone & Samsung Galaxy models.',
    799.00,
    12,
    'c0000000-0000-0000-0000-000000000003', -- Phone Covers
    '00000000-0000-0000-0000-000000000003',
    'https://instagram.com/wildflower.cases',
    'https://instagram.com/p/DB345678901',
    'https://wa.me/919876543214?text=Hi%2C%20inquiring%20about%20the%20Wild%20Daisy%20Phone%20Case%20on%20Rablo',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000004',
    'Botanical Fern & Eucalyptus Fine Art Print (A4)',
    'Original watercolor and botanical ink illustration printed on 300 GSM archival textured cotton rag paper with fade-resistant pigment inks. Signed and numbered by the artist.',
    650.00,
    15,
    'c0000000-0000-0000-0000-000000000002', -- Art & Prints
    '00000000-0000-0000-0000-000000000004',
    'https://instagram.com/parchmentandpetals',
    'https://instagram.com/p/DB456789012',
    'https://wa.me/919876543216?text=Hi%2C%20inquiring%20about%20Botanical%20Art%20Prints%20on%20Rablo',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000005',
    'Freshwater Baroque Pearl & Glass Bead Choker',
    'Handmade asymmetric necklace featuring genuine freshwater baroque pearls, Japanese seed beads, and 18K gold-plated hypoallergenic lobster clasp. Waterproof and tarnish-resistant.',
    899.00,
    8,
    'c0000000-0000-0000-0000-000000000004', -- Jewelry
    '00000000-0000-0000-0000-000000000003',
    'https://instagram.com/wildflower.cases',
    'https://instagram.com/p/DB567890123',
    'https://wa.me/919876543213?text=Hi%2C%20inquiring%20about%20the%20Freshwater%20Baroque%20Pearl%20Choker%20on%20Rablo',
    'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000006',
    'Raw Slub Linen Relaxed Resort Shirt',
    'Pure hand-spun linen shirt with shell button placket, drop-shoulder relaxed silhouette, and French seams. Pre-washed for an effortless drape and lived-in softness.',
    1850.00,
    5,
    'c0000000-0000-0000-0000-000000000005', -- Clothing & Apparel
    '00000000-0000-0000-0000-000000000005',
    'https://instagram.com/artisanloom.in',
    'https://instagram.com/p/DB678901234',
    'https://wa.me/919876543210?text=Hi%2C%20inquiring%20about%20the%20Raw%20Slub%20Linen%20Shirt%20on%20Rablo',
    'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000007',
    'Lavender & Clary Sage Hand-Poured Bubble Candle',
    'Sculptural geometric bubble candle made from 100% natural organic soy wax and pure essential oils. Clean, smoke-free burn with calming herbal aroma notes for slow living spaces.',
    499.00,
    20,
    'c0000000-0000-0000-0000-000000000006', -- Home Decor
    '00000000-0000-0000-0000-000000000001',
    'https://instagram.com/knotandthread.in',
    'https://instagram.com/p/DB789012345',
    'https://wa.me/919876543211?text=Hi%2C%20inquiring%20about%20the%20Lavender%20Bubble%20Candle%20on%20Rablo',
    'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'p0000000-0000-0000-0000-000000000008',
    'Hand-Woven Natural Jute & Leather Bucket Bag',
    'Handcrafted by generational artisans in Rajasthan. Features braided natural jute body, tan vegetable-tanned leather handle, drawstring inner canvas pouch, and brass hardware.',
    1350.00,
    7,
    'c0000000-0000-0000-0000-000000000010', -- Handmade Bags
    '00000000-0000-0000-0000-000000000005',
    'https://instagram.com/artisanloom.in',
    'https://instagram.com/p/DB890123456',
    'https://wa.me/919876543215?text=Hi%2C%20inquiring%20about%20the%20Hand-Woven%20Jute%20Bag%20on%20Rablo',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  category_id = EXCLUDED.category_id,
  seller_id = EXCLUDED.seller_id,
  seller_ig_url = EXCLUDED.seller_ig_url,
  contact_link = EXCLUDED.contact_link,
  thumbnail_url = EXCLUDED.thumbnail_url,
  approval_status = 'Approved';

-- ============================================================================
-- 9. IDEMPOTENT BACKFILL: SELLERS & PRODUCTS -> BRANDS & BRAND_CONTACTS
-- ============================================================================
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


-- =====================================================================
-- HOME PAGE CURATION (admin-controlled banners + featured sections)
-- Idempotent. Requires public.is_admin() (defined below only if missing).
-- =====================================================================

-- 0. Admin helper (same admin identity as the existing RLS policies in rablo_schema.sql)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com' $$;

-- 1. Banners (hero slider images)
CREATE TABLE IF NOT EXISTS public.home_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_path TEXT NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '' CHECK (char_length(alt_text) <= 160),
  link_url TEXT CHECK (link_url IS NULL OR link_url ~ '^/([^/]|$)' OR link_url ~ '^https://'),
  focal_x SMALLINT NOT NULL DEFAULT 50 CHECK (focal_x BETWEEN 0 AND 100),
  focal_y SMALLINT NOT NULL DEFAULT 50 CHECK (focal_y BETWEEN 0 AND 100),
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Featured items for the 4 curated sections
CREATE TABLE IF NOT EXISTS public.home_featured (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL CHECK (section IN ('trending_products','new_arrivals','trending_creators','trending_categories')),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT home_featured_one_ref CHECK (
    (section IN ('trending_products','new_arrivals') AND product_id IS NOT NULL AND brand_id IS NULL AND category_id IS NULL)
    OR (section = 'trending_creators' AND brand_id IS NOT NULL AND product_id IS NULL AND category_id IS NULL)
    OR (section = 'trending_categories' AND category_id IS NOT NULL AND product_id IS NULL AND brand_id IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS home_featured_uq_product ON public.home_featured (section, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS home_featured_uq_brand ON public.home_featured (section, brand_id) WHERE brand_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS home_featured_uq_category ON public.home_featured (section, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS home_featured_section_idx ON public.home_featured (section, position, created_at DESC);
CREATE INDEX IF NOT EXISTS home_banners_order_idx ON public.home_banners (position, created_at);

-- 3. Limits enforced in the database (trending products 12, creators 8, categories 4, banners 8)
CREATE OR REPLACE FUNCTION public.home_enforce_limits() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap INTEGER; cur INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'home_banners' THEN
    SELECT COUNT(*) INTO cur FROM public.home_banners;
    IF cur >= 8 THEN RAISE EXCEPTION 'Maximum of 8 banners reached' USING ERRCODE = '23514'; END IF;
  ELSE
    cap := CASE NEW.section WHEN 'trending_products' THEN 12 WHEN 'trending_creators' THEN 8 WHEN 'trending_categories' THEN 4 ELSE NULL END;
    IF cap IS NOT NULL THEN
      SELECT COUNT(*) INTO cur FROM public.home_featured WHERE section = NEW.section;
      IF cur >= cap THEN RAISE EXCEPTION 'Section % is full (max %)', NEW.section, cap USING ERRCODE = '23514'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_home_banners_limit ON public.home_banners;
CREATE TRIGGER tr_home_banners_limit BEFORE INSERT ON public.home_banners
  FOR EACH ROW EXECUTE FUNCTION public.home_enforce_limits();
DROP TRIGGER IF EXISTS tr_home_featured_limit ON public.home_featured;
CREATE TRIGGER tr_home_featured_limit BEFORE INSERT ON public.home_featured
  FOR EACH ROW EXECUTE FUNCTION public.home_enforce_limits();

-- 4. Newly approved products are added to "new_arrivals" automatically.
--    Admin can still remove them from the section or add any other approved product by hand.
CREATE OR REPLACE FUNCTION public.home_add_new_arrival() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.approval_status = 'Approved'
     AND (TG_OP = 'INSERT' OR OLD.approval_status IS DISTINCT FROM 'Approved') THEN
    INSERT INTO public.home_featured (section, product_id)
    VALUES ('new_arrivals', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tr_products_new_arrival ON public.products;
CREATE TRIGGER tr_products_new_arrival AFTER INSERT OR UPDATE OF approval_status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.home_add_new_arrival();

-- 5. RLS
ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.home_featured ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS home_banners_select_active ON public.home_banners;
CREATE POLICY home_banners_select_active ON public.home_banners FOR SELECT USING (is_active = TRUE OR public.is_admin());
DROP POLICY IF EXISTS home_banners_admin_write ON public.home_banners;
CREATE POLICY home_banners_admin_write ON public.home_banners FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Rows only hold ids; the app joins to products/brands/categories, whose own RLS hides anything unapproved.
DROP POLICY IF EXISTS home_featured_select_all ON public.home_featured;
CREATE POLICY home_featured_select_all ON public.home_featured FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS home_featured_admin_write ON public.home_featured;
CREATE POLICY home_featured_admin_write ON public.home_featured FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. Backfill: show the 8 newest approved products as New Arrivals so the section is not empty at launch.
INSERT INTO public.home_featured (section, product_id)
SELECT 'new_arrivals', p.id FROM public.products p
WHERE p.approval_status = 'Approved'
ORDER BY p.created_at DESC
LIMIT 8
ON CONFLICT DO NOTHING;

-- 7. Storage bucket for site images (public read, ONLY the admin can write/delete)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-assets', 'site-assets', TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS site_assets_read ON storage.objects;
CREATE POLICY site_assets_read ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
DROP POLICY IF EXISTS site_assets_admin_insert ON storage.objects;
CREATE POLICY site_assets_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());
DROP POLICY IF EXISTS site_assets_admin_update ON storage.objects;
CREATE POLICY site_assets_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin()) WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());
DROP POLICY IF EXISTS site_assets_admin_delete ON storage.objects;
CREATE POLICY site_assets_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin());
