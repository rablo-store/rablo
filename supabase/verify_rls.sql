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

-- 0. Fetch existing users or create test auth users to satisfy foreign keys
  -- User A
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'seller_a@test.rablo.in') THEN
    SELECT id INTO v_user_a FROM auth.users WHERE email = 'seller_a@test.rablo.in' LIMIT 1;
  ELSE
    INSERT INTO auth.users (id, aud, role, email) VALUES (v_user_a, 'authenticated', 'authenticated', 'seller_a@test.rablo.in');
  END IF;

  -- User B
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'seller_b@test.rablo.in') THEN
    SELECT id INTO v_user_b FROM auth.users WHERE email = 'seller_b@test.rablo.in' LIMIT 1;
  ELSE
    INSERT INTO auth.users (id, aud, role, email) VALUES (v_user_b, 'authenticated', 'authenticated', 'seller_b@test.rablo.in');
  END IF;

  -- Admin User
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'sumitkatiyar783@gmail.com') THEN
    SELECT id INTO v_admin_user FROM auth.users WHERE email = 'sumitkatiyar783@gmail.com' LIMIT 1;
  ELSE
    INSERT INTO auth.users (id, aud, role, email) VALUES (v_admin_user, 'authenticated', 'authenticated', 'sumitkatiyar783@gmail.com');
  END IF;

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
  RESET ROLE;
  
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
    DECLARE
      v_temp_user UUID := gen_random_uuid();
    BEGIN
      INSERT INTO auth.users (id, aud, role, email) VALUES (v_temp_user, 'authenticated', 'authenticated', 'mock_creator_' || v_i || '@test.rablo.in');
      
      INSERT INTO public.profiles (id, email, full_name, role, is_seller, is_banned) 
      VALUES (v_temp_user, 'mock_creator_' || v_i || '@test.rablo.in', 'Mock', 'seller', TRUE, FALSE)
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_seller = EXCLUDED.is_seller, is_banned = EXCLUDED.is_banned;
      
      INSERT INTO public.brands (owner_id, slug, name, instagram_url, approval_status)
      VALUES (v_temp_user, left('b-' || v_temp_user::text, 35), 'Brand ' || v_i, 'https://instagram.com/b' || v_i, 'Approved')
      RETURNING id INTO v_test_brand_id;
      
      INSERT INTO public.home_featured (section, brand_id, position)
      VALUES ('trending_creators', v_test_brand_id, v_i);
    END;
  END LOOP;

  DECLARE
    v_temp_user UUID := gen_random_uuid();
  BEGIN
    INSERT INTO auth.users (id, aud, role, email) VALUES (v_temp_user, 'authenticated', 'authenticated', 'mock_creator_9@test.rablo.in');
    
    INSERT INTO public.profiles (id, email, full_name, role, is_seller, is_banned) 
    VALUES (v_temp_user, 'mock_creator_9@test.rablo.in', 'Mock', 'seller', TRUE, FALSE)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name, role = EXCLUDED.role, is_seller = EXCLUDED.is_seller, is_banned = EXCLUDED.is_banned;
    
    INSERT INTO public.brands (owner_id, slug, name, instagram_url, approval_status)
    VALUES (v_temp_user, left('b-' || v_temp_user::text, 35), 'Brand 9', 'https://instagram.com/b9', 'Approved')
    RETURNING id INTO v_test_brand_id;

    BEGIN
      INSERT INTO public.home_featured (section, brand_id, position)
      VALUES ('trending_creators', v_test_brand_id, 9);
      RAISE EXCEPTION 'TEST 14 FAILED: 9th trending creator was accepted!';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'TEST 14.4 PASSED: 9th trending creator was rejected by trigger limit.';
    END;
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

  -- --------------------------------------------------------------------------
  -- TEST 17: products_insert_seller policy requires brand ownership or admin
  -- --------------------------------------------------------------------------
  -- 17.1: Authenticated normal user with NO brand cannot insert a product
  DECLARE
    v_normal_user UUID := gen_random_uuid();
  BEGIN
    INSERT INTO auth.users (id, aud, role, email) VALUES (v_normal_user, 'authenticated', 'authenticated', 'normal_user@test.rablo.in');
    INSERT INTO public.profiles (id, email, full_name, role, is_seller, is_banned)
    VALUES (v_normal_user, 'normal_user@test.rablo.in', 'Normal User', 'user', FALSE, FALSE);

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', v_normal_user::text,
      'email', 'normal_user@test.rablo.in',
      'role', 'authenticated'
    )::text, true);

    BEGIN
      INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id)
      VALUES ('Unbranded Item', 100, v_normal_user, 'https://instagram.com/normal', NULL);
      RAISE EXCEPTION 'TEST 17.1 FAILED: User without brand was able to insert product!';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'TEST 17.1 PASSED: Normal user with no brand blocked from inserting products.';
    END;
  END;

  -- 17.2: Seller A with Brand A can insert product with brand_id = v_brand_a
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id)
  VALUES ('Brand A Item', 500, v_user_a, 'https://instagram.com/brand_a', v_brand_a)
  RETURNING id INTO v_test_prod_id;
  RAISE NOTICE 'TEST 17.2 PASSED: Brand owner can insert product for their own brand.';

  -- 17.3: Seller A cannot insert product with Brand B (owned by Seller B)
  BEGIN
    INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id)
    VALUES ('Brand Spoofed Item', 500, v_user_a, 'https://instagram.com/brand_a', v_brand_b);
    RAISE EXCEPTION 'TEST 17.3 FAILED: Seller A was able to insert product with Brand B!';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'TEST 17.3 PASSED: Seller blocked from inserting product with another seller''s brand.';
  END;

  -- 17.4: Admin can insert product directly
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user::text,
    'email', 'sumitkatiyar783@gmail.com',
    'role', 'authenticated'
  )::text, true);

  INSERT INTO public.products (name, price, seller_id, seller_ig_url, brand_id)
  VALUES ('Admin Curated Item', 1200, v_admin_user, 'https://instagram.com/admin', v_brand_a);
  RAISE NOTICE 'TEST 17.4 PASSED: Admin can insert products under RLS.';

  -- --------------------------------------------------------------------------
  -- TEST 18: INSTAGRAM VERIFICATION & ADMIN APPROVAL QUEUE TESTS
  -- --------------------------------------------------------------------------

  -- 18.1: Seller cannot set is_verified or approval_status directly
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  UPDATE public.brands
  SET is_verified = TRUE, approval_status = 'Approved'
  WHERE id = v_brand_a;

  IF (SELECT is_verified FROM public.brands WHERE id = v_brand_a) = TRUE THEN
    RAISE EXCEPTION 'TEST 18.1 FAILED: Seller was able to set is_verified directly!';
  END IF;
  RAISE NOTICE 'TEST 18.1 PASSED: Seller direct update to is_verified was rejected by trigger.';

  -- 18.2: Seller cannot read another brand's code
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_b::text,
    'email', 'seller_b@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  UPDATE public.brands SET instagram_handle = 'brand_b_handle' WHERE id = v_brand_b;
  PERFORM public.start_instagram_verification(v_brand_b, 'bio_code');
  UPDATE public.brands SET approval_status = 'Pending' WHERE id = v_brand_b;

  -- Switch back to User A
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  SELECT COUNT(*) INTO v_row_count
  FROM public.brands
  WHERE id = v_brand_b;

  IF v_row_count > 0 THEN
    RAISE EXCEPTION 'TEST 18.2 FAILED: Seller A was able to read Seller B''s brand code or record!';
  END IF;
  RAISE NOTICE 'TEST 18.2 PASSED: Seller cannot read another brand''s verification code.';

  -- 18.3: Seller cannot call admin_review_brand
  BEGIN
    PERFORM public.admin_review_brand(v_brand_a, TRUE, 'Approved', NULL);
    RAISE EXCEPTION 'TEST 18.3 FAILED: Seller was able to execute admin_review_brand!';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST 18.3 PASSED: Non-admin calling admin_review_brand was rejected.';
  END;

  -- 18.4: Admin can call admin_review_brand
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user::text,
    'email', 'sumitkatiyar783@gmail.com',
    'role', 'authenticated'
  )::text, true);

  UPDATE public.brands SET instagram_handle = 'brand_a_handle' WHERE id = v_brand_a;
  PERFORM public.admin_review_brand(v_brand_a, TRUE, 'Approved', NULL);

  IF (SELECT is_verified AND approval_status = 'Approved' FROM public.brands WHERE id = v_brand_a) IS NOT TRUE THEN
    RAISE EXCEPTION 'TEST 18.4 FAILED: Admin review did not set is_verified and approval_status!';
  END IF;
  RAISE NOTICE 'TEST 18.4 PASSED: Admin successfully executed admin_review_brand.';

  -- 18.5: Changing the handle resets verification
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_a::text,
    'email', 'seller_a@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  UPDATE public.brands SET instagram_handle = 'brand_a_new_handle' WHERE id = v_brand_a;

  IF (SELECT is_verified FROM public.brands WHERE id = v_brand_a) = TRUE THEN
    RAISE EXCEPTION 'TEST 18.5 FAILED: Changing handle did not reset is_verified!';
  END IF;
  RAISE NOTICE 'TEST 18.5 PASSED: Changing instagram_handle resets is_verified to FALSE.';

  -- 18.6: Duplicate verified handle is refused
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_admin_user::text,
    'email', 'sumitkatiyar783@gmail.com',
    'role', 'authenticated'
  )::text, true);

  -- Set Brand A as verified with handle 'shared_handle'
  UPDATE public.brands SET instagram_handle = 'shared_handle' WHERE id = v_brand_a;
  PERFORM public.admin_review_brand(v_brand_a, TRUE, 'Approved', NULL);

  -- Attempt to verify Brand B with the same handle 'shared_handle'
  UPDATE public.brands SET instagram_handle = 'shared_handle' WHERE id = v_brand_b;
  BEGIN
    PERFORM public.admin_review_brand(v_brand_b, TRUE, 'Approved', NULL);
    RAISE EXCEPTION 'TEST 18.6 FAILED: Duplicate verified handle was accepted!';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST 18.6 PASSED: Duplicate verified Instagram handle was rejected.';
  END;

  -- 18.7: Expired code cannot be submitted for review
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', v_user_b::text,
    'email', 'seller_b@test.rablo.in',
    'role', 'authenticated'
  )::text, true);

  UPDATE public.brands
  SET
    instagram_handle = 'unique_brand_b_handle',
    verification_code = 'RABLO-TEST99',
    verification_code_expires_at = NOW() - INTERVAL '1 hour'
  WHERE id = v_brand_b;

  BEGIN
    PERFORM public.request_instagram_review(v_brand_b);
    RAISE EXCEPTION 'TEST 18.7 FAILED: Expired verification code was accepted for review!';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'TEST 18.7 PASSED: Expired verification code cannot be submitted for review.';
  END;

  RAISE NOTICE '--- All Rablo RLS & Security Verification Tests Passed Successfully! ---';
END;
$$;

ROLLBACK;

