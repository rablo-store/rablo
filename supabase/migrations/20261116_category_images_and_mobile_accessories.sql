-- =====================================================================
-- CATEGORY IMAGES & MOBILE ACCESSORIES UPDATE
-- Adds 1:1 image_url to categories, renames Phone Covers -> Mobile Accessories,
-- and assigns high-resolution 1:1 modern category images.
-- =====================================================================

-- 1. Add image_url column to public.categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Rename 'Phone Covers' to 'Mobile Accessories' and update image
UPDATE public.categories
SET name = 'Mobile Accessories',
    slug = 'mobile-accessories',
    image_url = '/categories/mobile-accessories.webp'
WHERE slug = 'phone-covers' OR name = 'Phone Covers';

-- Insert Mobile Accessories if it doesn't exist
INSERT INTO public.categories (id, name, slug, is_approved, image_url)
VALUES ('c0000000-0000-0000-0000-000000000003', 'Mobile Accessories', 'mobile-accessories', TRUE, '/categories/mobile-accessories.webp')
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  image_url = EXCLUDED.image_url,
  is_approved = TRUE;

-- 3. Update high-resolution 1:1 images for requested categories
UPDATE public.categories
SET image_url = '/categories/art-and-prints.webp'
WHERE slug IN ('art', 'art-and-prints') OR name ILIKE '%art%print%';

UPDATE public.categories
SET image_url = '/categories/clothing-and-apparel.webp'
WHERE slug IN ('clothing', 'clothing-and-apparel') OR name ILIKE '%clothing%';

UPDATE public.categories
SET image_url = '/categories/crochet.webp'
WHERE slug = 'crochet' OR name ILIKE '%crochet%';

UPDATE public.categories
SET name = 'Home & Decor',
    image_url = '/categories/home-and-decor.webp'
WHERE slug IN ('home-decor', 'home-and-decor') OR name ILIKE '%home%decor%';

UPDATE public.categories
SET name = 'Jewellery',
    image_url = '/categories/jewellery.webp'
WHERE slug IN ('jewelry', 'jewellery') OR name ILIKE '%jewel%';

-- 4. Admin update policy for categories (allows updating image_url, name, slug)
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;
CREATE POLICY "categories_update_admin" ON public.categories
  FOR UPDATE USING (
    (auth.jwt() ->> 'email') = 'sumitkatiyar783@gmail.com'
    OR (SELECT COALESCE(auth.jwt() ->> 'email', '') = 'sumitkatiyar783@gmail.com')
  );

