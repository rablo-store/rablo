-- ============================================================================
-- RABLO MIGRATION: Brand Store & Direct Chat Inquiry Feature
-- Date: 2026-11-06
-- Description:
--   1. Adds nullable `contact_link` column to `public.products` table.
--   2. Seeds curated dummy products matching the design board with pre-configured
--      WhatsApp & Instagram contact links.
--   3. All dummy products can be approved, edited, or deleted directly in the Admin
--      Dashboard (/admin) by superadmin (sumitkatiyar783@gmail.com).
-- ============================================================================

-- 1. ADD COLUMN
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS contact_link TEXT;

COMMENT ON COLUMN public.products.contact_link IS 'Custom buyer chat inquiry URL (e.g. WhatsApp wa.me link, Instagram DM, or custom chat link)';

-- 2. SEED SHOWCASE CREATORS FOR DESIGN BOARD DUMMY PRODUCTS
INSERT INTO public.profiles (id, email, full_name, avatar_url, instagram_url, is_banned, is_seller, role)
VALUES
  (
    '00000000-0000-0000-0000-000000000010',
    'nia.crochet@demo.rablo.in',
    'Nia Sharma',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/crochetbynia',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000011',
    'candlelab@demo.rablo.in',
    'The Candle Lab',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/thecandlelab',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000012',
    'mudandmuse@demo.rablo.in',
    'Mud & Muse Pottery',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/mudandmuse',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000013',
    'beadwithlove@demo.rablo.in',
    'Bead With Love',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/beadwithlove',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000014',
    'casecove@demo.rablo.in',
    'Case Cove Studio',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/casecove',
    FALSE,
    TRUE,
    'seller'
  ),
  (
    '00000000-0000-0000-0000-000000000015',
    'threadtales@demo.rablo.in',
    'Thread Tales Studio',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://instagram.com/threadtales',
    FALSE,
    TRUE,
    'seller'
  )
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  avatar_url = EXCLUDED.avatar_url,
  instagram_url = EXCLUDED.instagram_url,
  is_seller = TRUE;

-- 3. SEED DUMMY PRODUCTS FROM THE DESIGN BOARD WITH CONTACT LINKS
INSERT INTO public.products (
  id, name, description, price, stock,
  category_id, seller_id, seller_ig_url, product_ig_url, contact_link,
  thumbnail_url, gallery_urls, approval_status
)
VALUES
  (
    'd0000000-0000-0000-0000-000000000001',
    'Crochet Daisy Tote Bag',
    'A beautiful hand-crocheted tote bag with daisy pattern. Perfect for daily use, college or casual outings. Handcrafted from 100% breathable organic milk cotton yarn with reinforced handles.\n\n<!--rablo_options:{"bulk_orders":true,"international_export":true}-->',
    899.00,
    15,
    'c0000000-0000-0000-0000-000000000001', -- Crochet
    '00000000-0000-0000-0000-000000000010',
    'https://instagram.com/crochetbynia',
    'https://instagram.com/p/DA_crochet_tote',
    'https://wa.me/919876543210?text=Hi%20Nia%2C%20I%20am%20inquiring%20about%20the%20Crochet%20Daisy%20Tote%20Bag%20on%20Rablo',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'd0000000-0000-0000-0000-000000000002',
    'Scented Soy Candle',
    'Hand-poured 100% natural organic soy wax candle with botanical essential oils. Clean, smokeless 45-hour burn time with comforting amber vanilla notes.\n\n<!--rablo_options:{"bulk_orders":true,"international_export":false}-->',
    599.00,
    25,
    'c0000000-0000-0000-0000-000000000006', -- Home Decor
    '00000000-0000-0000-0000-000000000011',
    'https://instagram.com/thecandlelab',
    'https://instagram.com/p/DA_candle_lab',
    'https://wa.me/919876543211?text=Hi%2C%20I%20would%20like%20to%20order%20the%20Scented%20Soy%20Candle%20from%20Rablo',
    'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'd0000000-0000-0000-0000-000000000003',
    'Handmade Ceramic Mug Set',
    'Wheel-thrown speckled stoneware coffee mug with playful tactile red heart glaze. Dishwasher and microwave safe studio pottery crafted with love.\n\n<!--rablo_options:{"bulk_orders":false,"international_export":true}-->',
    699.00,
    10,
    'c0000000-0000-0000-0000-000000000008', -- Ceramics & Pottery
    '00000000-0000-0000-0000-000000000012',
    'https://instagram.com/mudandmuse',
    'https://instagram.com/p/DA_ceramic_mug',
    'https://wa.me/919876543212?text=Hi%2C%20I%20am%20interested%20in%20the%20Handmade%20Ceramic%20Mug%20Set%20on%20Rablo',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'd0000000-0000-0000-0000-000000000004',
    'Flower Beaded Hoop Earrings',
    'Delicate hand-woven glass seed bead daisy earrings with 18K gold-plated hypoallergenic hoops. Feather-light for all-day comfortable wear.\n\n<!--rablo_options:{"bulk_orders":true,"international_export":true}-->',
    349.00,
    30,
    'c0000000-0000-0000-0000-000000000004', -- Jewelry
    '00000000-0000-0000-0000-000000000013',
    'https://instagram.com/beadwithlove',
    'https://instagram.com/p/DA_beaded_earrings',
    'https://wa.me/919876543213?text=Hi%2C%20I%20want%20to%20buy%20the%20Flower%20Beaded%20Earrings%20from%20Rablo',
    'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'd0000000-0000-0000-0000-000000000005',
    'Aesthetic Wave Pattern Phone Case',
    'Impact-resistant dual-layer protective case featuring custom matcha-cream undulating wavy line art. Raised bezel protection for camera lenses.\n\n<!--rablo_options:{"bulk_orders":true,"international_export":false}-->',
    499.00,
    18,
    'c0000000-0000-0000-0000-000000000003', -- Phone Covers
    '00000000-0000-0000-0000-000000000014',
    'https://instagram.com/casecove',
    'https://instagram.com/p/DA_phone_case',
    'https://wa.me/919876543214?text=Hi%2C%20inquiring%20about%20the%20Aesthetic%20Wave%20Phone%20Case%20on%20Rablo',
    'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'd0000000-0000-0000-0000-000000000006',
    'Embroidered Floral Canvas Pouch',
    'Sturdy organic cotton canvas makeup and stationery pouch with hand-embroidered wild daisies and smooth brass zipper closure.\n\n<!--rablo_options:{"bulk_orders":true,"international_export":true}-->',
    589.00,
    12,
    'c0000000-0000-0000-0000-000000000010', -- Handmade Bags
    '00000000-0000-0000-0000-000000000015',
    'https://instagram.com/threadtales',
    'https://instagram.com/p/DA_embroidered_pouch',
    'https://wa.me/919876543215?text=Hi%2C%20inquiring%20about%20the%20Embroidered%20Floral%20Canvas%20Pouch%20on%20Rablo',
    'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  ),
  (
    'd0000000-0000-0000-0000-000000000007',
    'Whimsical Cat & Botanical Sticker Pack (20 Pcs)',
    'Set of 20 die-cut waterproof holographic and matte vinyl stickers. Perfect for laptops, water bottles, journals, and phone cases.\n\n<!--rablo_options:{"bulk_orders":true,"international_export":false}-->',
    199.00,
    50,
    'c0000000-0000-0000-0000-000000000007', -- Stickers & Stationery
    '00000000-0000-0000-0000-000000000010',
    'https://instagram.com/crochetbynia',
    'https://instagram.com/p/DA_stickers_20',
    'https://wa.me/919876543210?text=Hi%2C%20I%20want%20to%20order%20the%20Sticker%20Pack%20from%20Rablo',
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
    ARRAY['https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80'],
    'Approved'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  contact_link = EXCLUDED.contact_link,
  thumbnail_url = EXCLUDED.thumbnail_url,
  approval_status = 'Approved';

