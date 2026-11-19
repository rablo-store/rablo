-- ============================================================================
-- Migration: Disable Automatic Population of New Arrivals
-- ============================================================================
-- All curated homepage sections (Trending Products, New Arrivals, Trending Creators,
-- Trending Categories) are now manually managed by the administrator.
-- Newly approved products are no longer automatically pushed into 'new_arrivals'.
-- Admin adds and removes products/creators to and from their respected sections.
-- ============================================================================

-- 1. Drop the automatic new arrival trigger and its function
DROP TRIGGER IF EXISTS tr_products_new_arrival ON public.products;
DROP FUNCTION IF EXISTS public.home_add_new_arrival();

-- 2. Update home_enforce_limits() to include new_arrivals cap (8 items)
CREATE OR REPLACE FUNCTION public.home_enforce_limits() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cap INTEGER;
  cur INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'home_banners' THEN
    SELECT COUNT(*) INTO cur FROM public.home_banners;
    IF cur >= 8 THEN
      RAISE EXCEPTION 'Maximum of 8 banners reached' USING ERRCODE = '23514';
    END IF;
  ELSE
    cap := CASE NEW.section
      WHEN 'trending_products' THEN 12
      WHEN 'new_arrivals' THEN 8
      WHEN 'trending_creators' THEN 8
      WHEN 'trending_categories' THEN 4
      ELSE NULL
    END;

    IF cap IS NOT NULL THEN
      SELECT COUNT(*) INTO cur FROM public.home_featured WHERE section = NEW.section;
      IF cur >= cap THEN
        RAISE EXCEPTION 'Section % is full (max %)', NEW.section, cap USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

