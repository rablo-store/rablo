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
