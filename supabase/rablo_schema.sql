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

-- Users can insert their own profile on signup or seed
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

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
INSERT INTO public.categories (id, name, slug, is_approved) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Crochet', 'crochet', TRUE),
  ('c0000000-0000-0000-0000-000000000002', 'Art & Prints', 'art', TRUE),
  ('c0000000-0000-0000-0000-000000000003', 'Phone Covers', 'phone-covers', TRUE),
  ('c0000000-0000-0000-0000-000000000004', 'Jewelry', 'jewelry', TRUE),
  ('c0000000-0000-0000-0000-000000000005', 'Clothing & Apparel', 'clothing', TRUE),
  ('c0000000-0000-0000-0000-000000000006', 'Home Decor', 'home-decor', TRUE),
  ('c0000000-0000-0000-0000-000000000007', 'Stickers & Stationery', 'stickers', TRUE),
  ('c0000000-0000-0000-0000-000000000008', 'Ceramics & Pottery', 'pottery', TRUE),
  ('c0000000-0000-0000-0000-000000000009', 'Accessories', 'accessories', TRUE),
  ('c0000000-0000-0000-0000-000000000010', 'Handmade Bags', 'handmade-bags', TRUE)
ON CONFLICT (name) DO UPDATE SET is_approved = TRUE, slug = EXCLUDED.slug;


-- ============================================================================
-- 3. PRODUCTS TABLE
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
  thumbnail_url TEXT,
  gallery_urls TEXT[] DEFAULT '{}',
  approval_status TEXT DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
  rejection_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Authenticated creators can upload products
CREATE POLICY "products_insert_seller" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = seller_id OR auth.uid() IS NULL);

-- Creators can update their own listings
CREATE POLICY "products_update_own" ON public.products
  FOR UPDATE USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

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

-- Authenticated users can upload into product-images
CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

-- Public read access for images
CREATE POLICY "product_images_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- Authenticated users can update images
CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images');

-- Authenticated users can delete images
CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images');


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
  category_id, seller_id, seller_ig_url, product_ig_url,
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
  thumbnail_url = EXCLUDED.thumbnail_url,
  approval_status = 'Approved';
