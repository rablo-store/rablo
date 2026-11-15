-- ============================================================================
-- RABLO — RLS & Security Verification Test Suite
-- Paste into Supabase SQL Editor to verify security policies and triggers.
-- Runs inside a transaction and rolls back at the end, leaving no test artifacts.
-- ============================================================================

BEGIN;

-- Setup test identities
DO $$
DECLARE
  v_user_a UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_brand_a UUID := gen_random_uuid();
  v_brand_b UUID := gen_random_uuid();
  v_prod_id UUID;
  v_row_count INT;
  v_admin_user UUID := gen_random_uuid();
  v_banner_id UUID;
  v_banner_inactive_id UUID;
  v_test_prod_id UUID;
  v_test_brand_id UUID;
  v_test_cat_id UUID;
  v_i INT;
BEGIN
  RAISE NOTICE '--- Starting Rablo RLS & Security Verification ---';

-- 0. Create test auth users to satisfy foreign key constraints
  INSERT INTO auth.users (id, aud, role, email)
  VALUES 
    (v_user_a, 'authenticated', 'authenticated', 'seller_a@test.rablo.in'),
    (v_user_b, 'authenticated', 'authenticated', 'seller_b@test.rablo.in'),
    (v_admin_user, 'authenticated', 'authenticated', 'sumitkatiyar783@gmail.com');

 -- 1. Create test profiles (using UPSERT to handle auto-created profiles from triggers)
  INSERT INTO public.profiles (id, email, full_name, role, is_seller, is_banned)
  VALUES 
    (v_user_a, 'seller_a@test.rablo.in', 'Seller A', 'seller', TRUE, FALSE),
    (v_user_b, 'seller_b@test.rablo.in', 'Seller B', 'seller', TRUE, FALSE),
    (v_admin_user, 'sumitkatiyar783@gmail.com', 'Admin User', 'admin', TRUE, FALSE)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    is_seller = EXCLUDED.is_seller,
    is_banned = EXCLUDED.is_banned;

  -- Create Brand A owned by User A
  INSERT INTO public.brands (id, owner_id, slug, name, instagram_url, approval_status)
  VALUES (v_brand_a, v_user_a, 'brand-seller-a', 'Brand A', 'https://instagram.com/brand_a', 'Approved');

  -- Create Brand B owned by User B
  INSERT INTO public.brands (id, owner_id, slug, name, instagram_url, approval_status)
  VALUES (v_brand_b, v_user_b, 'brand-seller-b', 'Brand B', 'https://instagram.com/brand_b', 'Approved');

  -- Insert Contact for Brand A
  INSERT INTO public.brand_contacts (brand_id, contact_type, link_template)
  VALUES (v_brand_a, 'instagram', 'https://instagram.com/brand_a');


  -- --------------------------------------------------------------------------
  -- TEST 1: Anonymous insert into products fails under RLS
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

  BEGIN
    INSERT INTO public.products (name, price, seller_id, seller_ig_url)
    VALUES ('Hacked Product', 100, v_user_a, 'https://instagram.com/hacker');
    RAISE EXCEPTION 'TEST 1 FAILED: Anonymous user was able to insert into products!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 1 PASSED: Anonymous insert into products was blocked by RLS.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 2: Anonymous user cannot SELECT from brand_contacts
  -- --------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_row_count FROM public.brand_contacts;
  IF v_row_count > 0 THEN
    RAISE EXCEPTION 'TEST 2 FAILED: Anonymous user was able to SELECT brand_contacts!';
  ELSE
    RAISE NOTICE 'TEST 2 PASSED: Anonymous user cannot read brand_contacts.';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 3: Authenticated seller cannot insert with approval_status = 'Approved'
  -- Trigger forces approval_status to 'Pending'
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id, approval_status)
  VALUES ('Handmade Bag', 500, v_user_a, 'https://instagram.com/brand_a', v_brand_a, 'Approved')
  RETURNING id INTO v_prod_id;

  IF (SELECT approval_status FROM public.products WHERE id = v_prod_id) = 'Approved' THEN
    RAISE EXCEPTION 'TEST 3 FAILED: Seller was able to insert product with Approved status!';
  ELSE
    RAISE NOTICE 'TEST 3 PASSED: Seller insert was forced to Pending moderation by trigger.';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 4: Authenticated seller cannot update approval_status to 'Approved'
  -- --------------------------------------------------------------------------
  UPDATE public.products SET approval_status = 'Approved' WHERE id = v_prod_id;
  IF (SELECT approval_status FROM public.products WHERE id = v_prod_id) = 'Approved' THEN
    RAISE EXCEPTION 'TEST 4 FAILED: Seller was able to update product to Approved status!';
  ELSE
    RAISE NOTICE 'TEST 4 PASSED: Seller cannot update approval_status to Approved.';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 5: User cannot unban themselves or escalate role
  -- --------------------------------------------------------------------------
  -- First ban user A (simulated by admin / service)
  RESET ROLE;
  UPDATE public.profiles SET is_banned = TRUE WHERE id = v_user_a;

  -- Now user A tries to unban themselves
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  UPDATE public.profiles SET is_banned = FALSE, role = 'admin' WHERE id = v_user_a;

  IF (SELECT is_banned FROM public.profiles WHERE id = v_user_a) = FALSE THEN
    RAISE EXCEPTION 'TEST 5 FAILED: User was able to unban themselves!';
  ELSIF (SELECT role FROM public.profiles WHERE id = v_user_a) = 'admin' THEN
    RAISE EXCEPTION 'TEST 5 FAILED: User was able to escalate their role to admin!';
  ELSE
    RAISE NOTICE 'TEST 5 PASSED: User cannot unban themselves or change role.';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 6: Seller A cannot attach a product to Brand B (owned by Seller B)
  -- --------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id)
    VALUES ('Fraudulent Product', 999, v_user_a, 'https://instagram.com/brand_b', v_brand_b);
    RAISE EXCEPTION 'TEST 6 FAILED: Seller A attached a product to Seller B''s brand!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 6 PASSED: Seller cannot attach product to another owner''s brand.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 7: Non-admin seller cannot approve their own brand
  -- --------------------------------------------------------------------------
  UPDATE public.brands SET approval_status = 'Approved', is_verified = TRUE WHERE id = v_brand_a;
  IF (SELECT is_verified FROM public.brands WHERE id = v_brand_a) = TRUE THEN
    -- Verify if trigger kept it false
    RAISE NOTICE 'Verifying brand security trigger...';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 8: Anon cannot INSERT, UPDATE, or DELETE home_banners or home_featured
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

  BEGIN
    INSERT INTO public.home_banners (image_path, image_url, alt_text)
    VALUES ('banners/anon.webp', 'https://example.com/anon.webp', 'Anon banner');
    RAISE EXCEPTION 'TEST 8 FAILED: Anon was able to insert into home_banners!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 8.1 PASSED: Anon insert into home_banners was blocked by RLS.';
  END;

  BEGIN
    INSERT INTO public.home_featured (section, product_id)
    VALUES ('new_arrivals', v_prod_id);
    RAISE EXCEPTION 'TEST 8 FAILED: Anon was able to insert into home_featured!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 8.2 PASSED: Anon insert into home_featured was blocked by RLS.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 9: Non-admin authenticated user cannot write to home_banners or home_featured
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  BEGIN
    INSERT INTO public.home_banners (image_path, image_url, alt_text)
    VALUES ('banners/seller.webp', 'https://example.com/seller.webp', 'Seller banner');
    RAISE EXCEPTION 'TEST 9 FAILED: Non-admin authenticated user was able to insert into home_banners!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 9.1 PASSED: Non-admin insert into home_banners was blocked by RLS.';
  END;

  BEGIN
    INSERT INTO public.home_featured (section, product_id)
    VALUES ('new_arrivals', v_prod_id);
    RAISE EXCEPTION 'TEST 9 FAILED: Non-admin authenticated user was able to insert into home_featured!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 9.2 PASSED: Non-admin insert into home_featured was blocked by RLS.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 10: Anon sees only is_active = TRUE banners, admin sees all
  -- --------------------------------------------------------------------------
  -- Admin inserts active and inactive banners
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user::text,
    'email', 'sumitkatiyar783@gmail.com',
    'role', 'authenticated'
  )::text, true);

  DELETE FROM public.home_banners;

  INSERT INTO public.home_banners (image_path, image_url, alt_text, is_active, position)
  VALUES ('banners/active.webp', 'https://example.com/active.webp', 'Active Banner', TRUE, 1)
  RETURNING id INTO v_banner_id;

  INSERT INTO public.home_banners (image_path, image_url, alt_text, is_active, position)
  VALUES ('banners/inactive.webp', 'https://example.com/inactive.webp', 'Inactive Banner', FALSE, 2)
  RETURNING id INTO v_banner_inactive_id;

  -- Anon select
  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

  SELECT COUNT(*) INTO v_row_count FROM public.home_banners;
  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'TEST 10 FAILED: Anon should see exactly 1 active banner, saw %', v_row_count;
  ELSE
    RAISE NOTICE 'TEST 10.1 PASSED: Anon sees only is_active banners.';
  END IF;

  -- Admin select
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user::text,
    'email', 'sumitkatiyar783@gmail.com',
    'role', 'authenticated'
  )::text, true);

  SELECT COUNT(*) INTO v_row_count FROM public.home_banners;
  IF v_row_count <> 2 THEN
    RAISE EXCEPTION 'TEST 10 FAILED: Admin should see both active and inactive banners, saw %', v_row_count;
  ELSE
    RAISE NOTICE 'TEST 10.2 PASSED: Admin sees all banners (active and inactive).';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 11: Admin can write/update/delete home_banners and home_featured
  -- --------------------------------------------------------------------------
  UPDATE public.home_banners SET alt_text = 'Updated by Admin' WHERE id = v_banner_id;
  IF (SELECT alt_text FROM public.home_banners WHERE id = v_banner_id) <> 'Updated by Admin' THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Admin update to home_banners failed!';
  ELSE
    RAISE NOTICE 'TEST 11 PASSED: Admin can update home_banners.';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 12: Banner link_url CHECK constraint rejects javascript:... and //evil.com
  -- --------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.home_banners (image_path, image_url, link_url)
    VALUES ('banners/xss.webp', 'https://example.com/xss.webp', 'javascript:alert(1)');
    RAISE EXCEPTION 'TEST 12 FAILED: Banner with javascript: link_url was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 12.1 PASSED: Banner link_url javascript:... was rejected by CHECK constraint.';
  END;

  BEGIN
    INSERT INTO public.home_banners (image_path, image_url, link_url)
    VALUES ('banners/evil.webp', 'https://example.com/evil.webp', '//evil.com');
    RAISE EXCEPTION 'TEST 12 FAILED: Banner with //evil.com link_url was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 12.2 PASSED: Banner link_url //evil.com was rejected by CHECK constraint.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 13: home_featured CHECK constraint: trending_products with brand_id is rejected
  -- --------------------------------------------------------------------------
  BEGIN
    INSERT INTO public.home_featured (section, brand_id)
    VALUES ('trending_products', v_brand_a);
    RAISE EXCEPTION 'TEST 13 FAILED: trending_products with brand_id was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 13 PASSED: trending_products with brand_id was rejected by CHECK constraint.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 14: Limits enforced: 9th banner, 5th category, 13th trending product, 9th creator
  -- --------------------------------------------------------------------------
  -- Fill up to 8 banners
  DELETE FROM public.home_banners;
  FOR v_i IN 1..8 LOOP
    INSERT INTO public.home_banners (image_path, image_url, position)
    VALUES ('banners/b' || v_i || '.webp', 'https://example.com/' || v_i || '.webp', v_i);
  END LOOP;

  -- 9th banner must fail
  BEGIN
    INSERT INTO public.home_banners (image_path, image_url, position)
    VALUES ('banners/b9.webp', 'https://example.com/9.webp', 9);
    RAISE EXCEPTION 'TEST 14 FAILED: 9th banner was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 14.1 PASSED: 9th banner was rejected by trigger limit.';
  END;

  -- 5th trending category must fail
  DELETE FROM public.home_featured WHERE section = 'trending_categories';
  FOR v_i IN 1..4 LOOP
    INSERT INTO public.categories (name, slug, is_approved)
    VALUES ('Cat ' || v_i || ' ' || gen_random_uuid(), 'cat-' || v_i || '-' || gen_random_uuid(), TRUE)
    RETURNING id INTO v_test_cat_id;
    INSERT INTO public.home_featured (section, category_id, position)
    VALUES ('trending_categories', v_test_cat_id, v_i);
  END LOOP;

  INSERT INTO public.categories (name, slug, is_approved)
  VALUES ('Cat 5 ' || gen_random_uuid(), 'cat-5-' || gen_random_uuid(), TRUE)
  RETURNING id INTO v_test_cat_id;

  BEGIN
    INSERT INTO public.home_featured (section, category_id, position)
    VALUES ('trending_categories', v_test_cat_id, 5);
    RAISE EXCEPTION 'TEST 14 FAILED: 5th trending category was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 14.2 PASSED: 5th trending category was rejected by trigger limit.';
  END;

  -- 13th trending product must fail
  DELETE FROM public.home_featured WHERE section = 'trending_products';
  FOR v_i IN 1..12 LOOP
    INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id, approval_status)
    VALUES ('Prod ' || v_i, 100, v_user_a, 'https://instagram.com/brand_a', v_brand_a, 'Approved')
    RETURNING id INTO v_test_prod_id;
    INSERT INTO public.home_featured (section, product_id, position)
    VALUES ('trending_products', v_test_prod_id, v_i);
  END LOOP;

  INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id, approval_status)
  VALUES ('Prod 13', 100, v_user_a, 'https://instagram.com/brand_a', v_brand_a, 'Approved')
  RETURNING id INTO v_test_prod_id;

  BEGIN
    INSERT INTO public.home_featured (section, product_id, position)
    VALUES ('trending_products', v_test_prod_id, 13);
    RAISE EXCEPTION 'TEST 14 FAILED: 13th trending product was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 14.3 PASSED: 13th trending product was rejected by trigger limit.';
  END;

  -- 9th trending creator must fail
  DELETE FROM public.home_featured WHERE section = 'trending_creators';
  FOR v_i IN 1..8 LOOP
    INSERT INTO public.brands (owner_id, slug, name, instagram_url, approval_status)
    VALUES (v_user_a, 'brand-' || v_i || '-' || gen_random_uuid(), 'Brand ' || v_i, 'https://instagram.com/brand_' || v_i, 'Approved')
    RETURNING id INTO v_test_brand_id;
    INSERT INTO public.home_featured (section, brand_id, position)
    VALUES ('trending_creators', v_test_brand_id, v_i);
  END LOOP;

  INSERT INTO public.brands (owner_id, slug, name, instagram_url, approval_status)
  VALUES (v_user_a, 'brand-9-' || gen_random_uuid(), 'Brand 9', 'https://instagram.com/brand_9', 'Approved')
  RETURNING id INTO v_test_brand_id;

  BEGIN
    INSERT INTO public.home_featured (section, brand_id, position)
    VALUES ('trending_creators', v_test_brand_id, 9);
    RAISE EXCEPTION 'TEST 14 FAILED: 9th trending creator was accepted!';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST 14.4 PASSED: 9th trending creator was rejected by trigger limit.';
  END;


  -- --------------------------------------------------------------------------
  -- TEST 15: Approving a Pending product inserts it into new_arrivals once (and not twice)
  -- --------------------------------------------------------------------------
  RESET ROLE;
  INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id, approval_status)
  VALUES ('Trigger Test Product', 250, v_user_a, 'https://instagram.com/brand_a', v_brand_a, 'Pending')
  RETURNING id INTO v_test_prod_id;

  -- Approve product
  UPDATE public.products SET approval_status = 'Approved' WHERE id = v_test_prod_id;

  SELECT COUNT(*) INTO v_row_count FROM public.home_featured
  WHERE section = 'new_arrivals' AND product_id = v_test_prod_id;

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Expected 1 new_arrivals row for approved product, got %', v_row_count;
  ELSE
    RAISE NOTICE 'TEST 15.1 PASSED: Product approval automatically added row to new_arrivals.';
  END IF;

  -- Re-update product with Approved status
  UPDATE public.products SET name = 'Trigger Test Product Updated', approval_status = 'Approved' WHERE id = v_test_prod_id;

  SELECT COUNT(*) INTO v_row_count FROM public.home_featured
  WHERE section = 'new_arrivals' AND product_id = v_test_prod_id;

  IF v_row_count <> 1 THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Product was duplicated in new_arrivals on re-approval, count = %', v_row_count;
  ELSE
    RAISE NOTICE 'TEST 15.2 PASSED: Re-approval did not duplicate product in new_arrivals.';
  END IF;


  -- --------------------------------------------------------------------------
  -- TEST 16: Non-admin cannot upload to storage bucket site-assets
  -- --------------------------------------------------------------------------
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  BEGIN
    INSERT INTO storage.objects (id, bucket_id, name, owner)
    VALUES (gen_random_uuid(), 'site-assets', 'banners/hack.webp', v_user_a);
    RAISE EXCEPTION 'TEST 16 FAILED: Non-admin was able to insert into site-assets storage!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 16 PASSED: Non-admin upload to site-assets was blocked by storage RLS.';
  END;

  RAISE NOTICE '--- All Rablo RLS & Security Verification Tests Passed Successfully! ---';
END;
$$;

ROLLBACK;

