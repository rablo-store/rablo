-- =====================================================================
-- RABLO: CATEGORY IMAGES & STORAGE CONFIGURATION FIX
-- Run this script in your Supabase Project -> SQL Editor
-- =====================================================================

-- 1. Ensure the is_admin() function exists and checks admin email
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com'
$$;

-- 2. Add image_url column to public.categories if not already present
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 3. Enable Row Level Security on public.categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 4. Clean up any existing category policies
DROP POLICY IF EXISTS "categories_select_approved" ON public.categories;
DROP POLICY IF EXISTS "categories_select_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_seller" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;

-- 5. Define comprehensive RLS policies for public.categories
-- Anyone can view approved categories; admin can view all
CREATE POLICY "categories_select_approved" ON public.categories
  FOR SELECT USING (
    is_approved = TRUE
    OR public.is_admin()
    OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Authenticated sellers can request categories, admin can create directly
CREATE POLICY "categories_insert_admin" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    OR auth.uid() IS NOT NULL
  );

-- Admin can update category fields (image_url, name, slug, is_approved)
CREATE POLICY "categories_update_admin" ON public.categories
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  )
  WITH CHECK (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- Admin can delete categories
CREATE POLICY "categories_delete_admin" ON public.categories
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
  );

-- 6. Ensure 'site-assets' storage bucket exists for category and site images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-assets',
  'site-assets',
  TRUE,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- 7. Ensure storage policies on storage.objects for 'site-assets'
DROP POLICY IF EXISTS "site_assets_public_read" ON storage.objects;
DROP POLICY IF EXISTS "site_assets_read" ON storage.objects;
CREATE POLICY "site_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');

DROP POLICY IF EXISTS "site_assets_admin_insert" ON storage.objects;
CREATE POLICY "site_assets_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-assets'
    AND (
      public.is_admin()
      OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    )
  );

DROP POLICY IF EXISTS "site_assets_admin_update" ON storage.objects;
CREATE POLICY "site_assets_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site-assets'
    AND (
      public.is_admin()
      OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    )
  )
  WITH CHECK (
    bucket_id = 'site-assets'
    AND (
      public.is_admin()
      OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    )
  );

DROP POLICY IF EXISTS "site_assets_admin_delete" ON storage.objects;
CREATE POLICY "site_assets_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'site-assets'
    AND (
      public.is_admin()
      OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    )
  );

-- 8. Also ensure 'product-images' bucket allows admin category image uploads as fallback
DROP POLICY IF EXISTS "product_images_category_admin_insert" ON storage.objects;
CREATE POLICY "product_images_category_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND name LIKE 'categories/%'
    AND (
      public.is_admin()
      OR (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    )
  );

-- 9. Rename 'Phone Covers' to 'Mobile Accessories' and seed core categories
UPDATE public.categories
SET name = 'Mobile Accessories',
    slug = 'mobile-accessories',
    image_url = '/categories/mobile-accessories.webp',
    is_approved = TRUE
WHERE slug = 'phone-covers' OR name = 'Phone Covers';

INSERT INTO public.categories (id, name, slug, is_approved, image_url)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Crochet', 'crochet', TRUE, '/categories/crochet.webp'),
  ('c0000000-0000-0000-0000-000000000002', 'Art & Prints', 'art', TRUE, '/categories/art-and-prints.webp'),
  ('c0000000-0000-0000-0000-000000000003', 'Mobile Accessories', 'mobile-accessories', TRUE, '/categories/mobile-accessories.webp'),
  ('c0000000-0000-0000-0000-000000000004', 'Jewellery', 'jewelry', TRUE, '/categories/jewellery.webp'),
  ('c0000000-0000-0000-0000-000000000005', 'Clothing & Apparel', 'clothing', TRUE, '/categories/clothing-and-apparel.webp'),
  ('c0000000-0000-0000-0000-000000000006', 'Home & Decor', 'home-decor', TRUE, '/categories/home-and-decor.webp')
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  is_approved = TRUE,
  image_url = COALESCE(public.categories.image_url, EXCLUDED.image_url);

-- 10. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';

