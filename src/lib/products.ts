/**
 * RABLO — Product Query Operations
 * Fetch, filter, and manage products from Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { validateInstagramOwnership, canonicalizeInstagramUrl, normalizeInstagramUsername } from './instagram';
import type { Brand } from './brands';
import { getCategoryImageUrl, normalizeCategoryName, normalizeCategorySlug } from './categories';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: string | null;
  seller_id: string;
  seller_ig_url: string;
  product_ig_url: string | null;
  contact_link?: string | null;
  thumbnail_url: string | null;
  gallery_urls: string[];
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  rejection_feedback: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; slug: string };
  seller?: { full_name: string; avatar_url: string; instagram_url: string };
  brand_id?: string | null;
  brand?: Pick<Brand, 'id' | 'slug' | 'name' | 'logo_url' | 'instagram_url' | 'is_verified' | 'creator_type'> | null;
  attributes?: Record<string, any>;
  bulk_orders?: boolean;
  international_export?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_approved: boolean;
  image_url?: string | null;
}

const META_TAG_REGEX = /<!--rablo_options:(\{.*?\})-->/;

export function parseProductOptions(desc: string | undefined): { bulk_orders: boolean; international_export: boolean } {
  if (!desc) return { bulk_orders: false, international_export: false };
  const match = desc.match(META_TAG_REGEX);
  if (!match) return { bulk_orders: false, international_export: false };
  try {
    const parsed = JSON.parse(match[1]);
    return {
      bulk_orders: Boolean(parsed.bulk_orders ?? parsed.bulk),
      international_export: Boolean(parsed.international_export ?? parsed.intl),
    };
  } catch {
    return { bulk_orders: false, international_export: false };
  }
}

export function getCleanDescription(desc: string | undefined): string {
  if (!desc) return '';
  return desc.replace(META_TAG_REGEX, '').trim();
}

export function formatDescriptionWithOptions(
  description: string,
  bulkOrders?: boolean,
  internationalExport?: boolean
): string {
  const clean = getCleanDescription(description);
  if (!bulkOrders && !internationalExport) return clean;
  const meta = JSON.stringify({
    bulk_orders: Boolean(bulkOrders),
    international_export: Boolean(internationalExport),
  });
  return `${clean}\n\n<!--rablo_options:${meta}-->`;
}

export function enrichProductWithOptions(product: Product): Product {
  if (!product) return product;
  const options = parseProductOptions(product.description);
  return {
    ...product,
    description: getCleanDescription(product.description),
    bulk_orders: product.bulk_orders ?? options.bulk_orders,
    international_export: product.international_export ?? options.international_export,
    contact_link: product.contact_link ? normalizeContactLink(product.contact_link) : null,
  };
}

/** Normalize WhatsApp numbers, wa.me links, Instagram links, and arbitrary HTTPS URLs */
export function normalizeContactLink(link?: string | null): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed) return null;

  // Phone number WhatsApp link e.g. +91 9876543210 or 9876543210
  const digitsOnly = trimmed.replace(/[\s\-()]/g, '');
  if (/^\+?\d{10,15}$/.test(digitsOnly)) {
    const num = digitsOnly.startsWith('+') ? digitsOnly.slice(1) : digitsOnly;
    return `https://wa.me/${num}`;
  }

  if (trimmed.startsWith('wa.me/')) {
    return `https://${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

/** Check if a URL targets WhatsApp */
export function isWhatsAppLink(url?: string | null): boolean {
  if (!url) return false;
  return /wa\.me|whatsapp\.com/i.test(url);
}

/**
 * Check if demo/dummy data should be displayed.
 * Only allowed when import.meta.env.DEV is true AND PUBLIC_USE_DEMO_DATA === 'true'.
 * Default is strictly OFF so fake data never reaches real users.
 */
export function isDemoDataEnabled(): boolean {
  const isDev = Boolean(
    (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')
  );
  const useDemo = Boolean(
    (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_USE_DEMO_DATA === 'true') ||
    (typeof process !== 'undefined' && process.env?.PUBLIC_USE_DEMO_DATA === 'true')
  );
  return isDev && useDemo;
}

/** Retrieve list of dummy product IDs deleted by admin */
export function getDeletedDummyIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const json = localStorage.getItem('rablo:deleted_dummy_ids');
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

/** Curated Showcase Dummy Products matching the Design Board */
export const DESIGN_BOARD_DUMMY_PRODUCTS: Product[] = [
  {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Crochet Daisy Tote Bag',
    description: 'A beautiful hand-crocheted tote bag with daisy pattern. Perfect for daily use, college or casual outings. Handcrafted from 100% breathable organic milk cotton yarn with reinforced handles.',
    price: 899,
    stock: 15,
    category_id: 'c0000000-0000-0000-0000-000000000001',
    seller_id: '00000000-0000-0000-0000-000000000010',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/p/DA_crochet_tote',
    contact_link: 'https://wa.me/919876543210?text=Hi%20Nia%2C%20I%20am%20inquiring%20about%20the%20Crochet%20Daisy%20Tote%20Bag%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    gallery_urls: [
      'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    ],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000001', name: 'Crochet', slug: 'crochet' },
    seller: { full_name: 'Nia Sharma', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/crochetbynia' },
    brand_id: 'b0000000-0000-0000-0000-000000000001',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000001',
      slug: 'crochetbynia',
      name: 'crochet by Nia',
      logo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/crochetbynia',
      is_verified: true,
      creator_type: 'individual',
    },
    attributes: {
      Material: 'Cotton Yarn',
      Size: '14" (H) × 12" (W)',
      Type: 'Handmade',
      Availability: 'Made to Order (3-5 days)',
    },
    bulk_orders: true,
    international_export: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000002',
    name: 'Scented Soy Candle',
    description: 'Hand-poured 100% natural organic soy wax candle with botanical essential oils. Clean, smokeless 45-hour burn time with comforting amber vanilla notes.',
    price: 599,
    stock: 25,
    category_id: 'c0000000-0000-0000-0000-000000000006',
    seller_id: '00000000-0000-0000-0000-000000000011',
    seller_ig_url: 'https://instagram.com/thecandlelab',
    product_ig_url: 'https://instagram.com/p/DA_candle_lab',
    contact_link: 'https://wa.me/919876543211?text=Hi%2C%20I%20would%20like%20to%20order%20the%20Scented%20Soy%20Candle%20from%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T09:00:00.000Z',
    updated_at: '2026-11-06T09:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000006', name: 'Home Decor', slug: 'home-decor' },
    seller: { full_name: 'The Candle Lab', avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/thecandlelab' },
    brand_id: 'b0000000-0000-0000-0000-000000000002',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000002',
      slug: 'thecandlelab',
      name: 'The Candle Lab',
      logo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/thecandlelab',
      is_verified: true,
      creator_type: 'small_brand',
    },
    attributes: {
      Material: 'Organic Soy Wax',
      Size: '250g / 8.8 oz',
      Type: 'Small-Batch Hand Poured',
      Availability: 'In Stock',
    },
    bulk_orders: true,
    international_export: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000003',
    name: 'Handmade Ceramic Mug Set',
    description: 'Wheel-thrown speckled stoneware coffee mug with playful tactile red heart glaze. Dishwasher and microwave safe studio pottery crafted with love.',
    price: 699,
    stock: 10,
    category_id: 'c0000000-0000-0000-0000-000000000008',
    seller_id: '00000000-0000-0000-0000-000000000012',
    seller_ig_url: 'https://instagram.com/mudandmuse',
    product_ig_url: 'https://instagram.com/p/DA_ceramic_mug',
    contact_link: 'https://wa.me/919876543212?text=Hi%2C%20I%20am%20interested%20in%20the%20Handmade%20Ceramic%20Mug%20Set%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T08:00:00.000Z',
    updated_at: '2026-11-06T08:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000008', name: 'Ceramics & Pottery', slug: 'pottery' },
    seller: { full_name: 'Mud & Muse Pottery', avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/mudandmuse' },
    brand_id: 'b0000000-0000-0000-0000-000000000003',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000003',
      slug: 'mudandmuse',
      name: 'Mud & Muse Pottery',
      logo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/mudandmuse',
      is_verified: true,
      creator_type: 'individual',
    },
    attributes: {
      Material: 'Stoneware Clay',
      Size: '350ml Mug',
      Type: 'Wheel-Thrown Studio Pottery',
      Availability: 'Made to Order (5-7 days)',
    },
    bulk_orders: false,
    international_export: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000004',
    name: 'Flower Beaded Hoop Earrings',
    description: 'Delicate hand-woven glass seed bead daisy earrings with 18K gold-plated hypoallergenic hoops. Feather-light for all-day comfortable wear.',
    price: 349,
    stock: 30,
    category_id: 'c0000000-0000-0000-0000-000000000004',
    seller_id: '00000000-0000-0000-0000-000000000013',
    seller_ig_url: 'https://instagram.com/beadwithlove',
    product_ig_url: 'https://instagram.com/p/DA_beaded_earrings',
    contact_link: 'https://wa.me/919876543213?text=Hi%2C%20I%20want%20to%20buy%20the%20Flower%20Beaded%20Earrings%20from%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T07:00:00.000Z',
    updated_at: '2026-11-06T07:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000004', name: 'Jewelry', slug: 'jewelry' },
    seller: { full_name: 'Bead With Love', avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/beadwithlove' },
    brand_id: 'b0000000-0000-0000-0000-000000000004',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000004',
      slug: 'beadwithlove',
      name: 'Bead with Love',
      logo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/beadwithlove',
      is_verified: false,
      creator_type: 'individual',
    },
    attributes: {
      Material: 'Glass Seed Beads & 18K Gold Plated Hoops',
      Size: '25mm Diameter',
      Type: 'Handmade Beaded Jewelry',
      Availability: 'In Stock',
    },
    bulk_orders: true,
    international_export: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000005',
    name: 'Aesthetic Wave Pattern Phone Case',
    description: 'Impact-resistant dual-layer protective case featuring custom matcha-cream undulating wavy line art. Raised bezel protection for camera lenses.',
    price: 499,
    stock: 18,
    category_id: 'c0000000-0000-0000-0000-000000000003',
    seller_id: '00000000-0000-0000-0000-000000000014',
    seller_ig_url: 'https://instagram.com/casecove',
    product_ig_url: 'https://instagram.com/p/DA_phone_case',
    contact_link: 'https://wa.me/919876543214?text=Hi%2C%20inquiring%20about%20the%20Aesthetic%20Wave%20Phone%20Case%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T06:00:00.000Z',
    updated_at: '2026-11-06T06:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000003', name: 'Mobile Accessories', slug: 'mobile-accessories' },
    seller: { full_name: 'Case Cove Studio', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/casecove' },
    bulk_orders: true,
    international_export: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000006',
    name: 'Embroidered Floral Canvas Pouch',
    description: 'Sturdy organic cotton canvas makeup and stationery pouch with hand-embroidered wild daisies and smooth brass zipper closure.',
    price: 589,
    stock: 12,
    category_id: 'c0000000-0000-0000-0000-000000000010',
    seller_id: '00000000-0000-0000-0000-000000000015',
    seller_ig_url: 'https://instagram.com/threadtales',
    product_ig_url: 'https://instagram.com/p/DA_embroidered_pouch',
    contact_link: 'https://wa.me/919876543215?text=Hi%2C%20inquiring%20about%20the%20Embroidered%20Floral%20Canvas%20Pouch%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T05:00:00.000Z',
    updated_at: '2026-11-06T05:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000010', name: 'Handmade Bags', slug: 'handmade-bags' },
    seller: { full_name: 'Thread Tales Studio', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/threadtales' },
    bulk_orders: true,
    international_export: true,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000007',
    name: 'Whimsical Cat & Botanical Sticker Pack (20 Pcs)',
    description: 'Set of 20 die-cut waterproof holographic and matte vinyl stickers. Perfect for laptops, water bottles, journals, and phone cases.',
    price: 199,
    stock: 50,
    category_id: 'c0000000-0000-0000-0000-000000000007',
    seller_id: '00000000-0000-0000-0000-000000000010',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/p/DA_stickers_20',
    contact_link: 'https://wa.me/919876543210?text=Hi%2C%20I%20want%20to%20order%20the%20Sticker%20Pack%20from%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T04:00:00.000Z',
    updated_at: '2026-11-06T04:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000007', name: 'Stickers & Stationery', slug: 'stickers' },
    seller: { full_name: 'Nia Sharma', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/crochetbynia' },
    brand_id: 'b0000000-0000-0000-0000-000000000001',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000001',
      slug: 'crochetbynia',
      name: 'crochet by Nia',
      logo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/crochetbynia',
      is_verified: true,
      creator_type: 'individual',
    },
    bulk_orders: true,
    international_export: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000008',
    name: 'Crochet Pouch',
    description: 'Charming pastel pink hand-crocheted mini pouch featuring 3D floral accents, tactile wooden beads, and a snug button loop closure.',
    price: 499,
    stock: 20,
    category_id: 'c0000000-0000-0000-0000-000000000001',
    seller_id: '00000000-0000-0000-0000-000000000010',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/p/DA_crochet_pouch',
    contact_link: 'https://wa.me/919876543210?text=Hi%20Nia%2C%20I%20am%20inquiring%20about%20the%20Crochet%20Pouch%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T03:00:00.000Z',
    updated_at: '2026-11-06T03:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000001', name: 'Crochet', slug: 'crochet' },
    seller: { full_name: 'Nia Sharma', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/crochetbynia' },
    brand_id: 'b0000000-0000-0000-0000-000000000001',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000001',
      slug: 'crochetbynia',
      name: 'crochet by Nia',
      logo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/crochetbynia',
      is_verified: true,
      creator_type: 'individual',
    },
    attributes: {
      Material: 'Organic Milk Cotton',
      Size: '6" × 5"',
      Type: 'Handmade Crochet',
      Availability: 'In Stock',
    },
    bulk_orders: true,
    international_export: false,
  },
  {
    id: 'd0000000-0000-0000-0000-000000000009',
    name: 'Hair Scrunchie',
    description: 'Soft ruffled waffle-textured crochet hair scrunchie crafted with organic cotton to prevent breakage and frizz.',
    price: 149,
    stock: 40,
    category_id: 'c0000000-0000-0000-0000-000000000001',
    seller_id: '00000000-0000-0000-0000-000000000010',
    seller_ig_url: 'https://instagram.com/crochetbynia',
    product_ig_url: 'https://instagram.com/p/DA_hair_scrunchie',
    contact_link: 'https://wa.me/919876543210?text=Hi%20Nia%2C%20I%20want%20to%20order%20the%20Hair%20Scrunchie%20on%20Rablo',
    thumbnail_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
    gallery_urls: ['https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80'],
    approval_status: 'Approved',
    rejection_feedback: null,
    created_at: '2026-11-06T02:00:00.000Z',
    updated_at: '2026-11-06T02:00:00.000Z',
    category: { id: 'c0000000-0000-0000-0000-000000000001', name: 'Crochet', slug: 'crochet' },
    seller: { full_name: 'Nia Sharma', avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', instagram_url: 'https://instagram.com/crochetbynia' },
    brand_id: 'b0000000-0000-0000-0000-000000000001',
    brand: {
      id: 'b0000000-0000-0000-0000-000000000001',
      slug: 'crochetbynia',
      name: 'crochet by Nia',
      logo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      instagram_url: 'https://instagram.com/crochetbynia',
      is_verified: true,
      creator_type: 'individual',
    },
    attributes: {
      Material: 'Cotton Yarn & Elastic Core',
      Size: 'Standard Scrunchie',
      Type: 'Handmade Accessory',
      Availability: 'In Stock',
    },
    bulk_orders: true,
    international_export: false,
  },
];

/** Fetch approved products with optional category filter */
export async function getApprovedProducts(categorySlug?: string): Promise<Product[]> {
  const isFiltered = Boolean(categorySlug && categorySlug !== 'all');
  const demoActive = isDemoDataEnabled();
  const deletedIds = demoActive ? getDeletedDummyIds() : [];
  const activeDummies = demoActive
    ? DESIGN_BOARD_DUMMY_PRODUCTS.filter((p) => !deletedIds.includes(p.id))
    : [];
  const filteredDummies = isFiltered
    ? activeDummies.filter((p) => p.category?.slug === categorySlug)
    : activeDummies;

  if (!isSupabaseConfigured || !supabase) {
    return filteredDummies;
  }

  try {
    const categoryJoin = isFiltered
      ? 'category:categories!inner( id, name, slug )'
      : 'category:categories( id, name, slug )';

    let query = supabase
      .from('products')
      .select(`
        *,
        ${categoryJoin},
        brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type ),
        seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url )
      `)
      .eq('approval_status', 'Approved')
      .order('created_at', { ascending: false });

    if (isFiltered) {
      query = query.eq('category.slug', categorySlug);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Rablo: Products fetch with join failed, trying fallback select:', error);
      const { data: fallback, error: fallbackError } = await supabase
        .from('products')
        .select('*')
        .eq('approval_status', 'Approved')
        .order('created_at', { ascending: false });

      if (fallbackError || !fallback || fallback.length === 0) {
        return filteredDummies;
      }
      const mappedFallback = ((fallback || []) as Product[]).map(enrichProductWithOptions);
      if (!demoActive) return mappedFallback;
      const existingIds = new Set(mappedFallback.map((r) => r.id));
      const unseededDummies = filteredDummies.filter((d) => !existingIds.has(d.id));
      return [...mappedFallback, ...unseededDummies];
    }

    const results = ((data || []) as Product[]).map(enrichProductWithOptions);
    if (!demoActive) {
      return results;
    }

    if (results.length === 0) {
      return filteredDummies;
    }

    const existingIds = new Set(results.map((r) => r.id));
    const unseededDummies = filteredDummies.filter((d) => !existingIds.has(d.id));
    return [...results, ...unseededDummies];
  } catch (err) {
    console.error('Rablo: Error fetching approved products:', err);
    return filteredDummies;
  }
}

/** Fetch a single product by ID */
export async function getProductById(id: string): Promise<Product | null> {
  const demoActive = isDemoDataEnabled();
  const deletedIds = demoActive ? getDeletedDummyIds() : [];
  const dummyMatch = demoActive
    ? DESIGN_BOARD_DUMMY_PRODUCTS.find((p) => p.id === id)
    : undefined;

  if (dummyMatch && !deletedIds.includes(id)) {
    return enrichProductWithOptions(dummyMatch);
  }

  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
        brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type ),
        seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      // Fallback query if relationship alias fails
      const { data: fallback } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fallback) return enrichProductWithOptions(fallback as Product);
      return dummyMatch ? enrichProductWithOptions(dummyMatch) : null;
    }
    return enrichProductWithOptions(data as Product);
  } catch {
    return dummyMatch ? enrichProductWithOptions(dummyMatch) : null;
  }
}

/** Fetch products by seller */
export async function getSellerProducts(sellerId: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug )
      `)
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Rablo: Seller products with category join failed, trying plain select:', error);
      const { data: fallback, error: fallbackError } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });
      if (fallbackError) return [];
      return ((fallback || []) as Product[]).map(enrichProductWithOptions);
    }
    return ((data || []) as Product[]).map(enrichProductWithOptions);
  } catch {
    return [];
  }
}

/** Fetch all approved categories */
export async function getApprovedCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_approved', true)
      .order('name');

    if (error) return [];
    return ((data || []) as any[]).map((cat) => {
      const normalizedName = normalizeCategoryName(cat.name);
      const normalizedSlug = normalizeCategorySlug(cat.slug);
      return {
        ...cat,
        name: normalizedName,
        slug: normalizedSlug,
        image_url: getCategoryImageUrl({
          name: normalizedName,
          slug: normalizedSlug,
          image_url: cat.image_url,
        }),
      };
    }) as Category[];
  } catch {
    return [];
  }
}

export interface CategoryWithCount extends Category {
  product_count?: number;
}

/** Fetch all approved categories with live approved product counts */
export async function getCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const categories = await getApprovedCategories();
  if (categories.length === 0) return [];

  const demoActive = isDemoDataEnabled();

  if (!isSupabaseConfigured || !supabase) {
    if (demoActive) {
      return categories.map((cat) => ({
        ...cat,
        product_count: DESIGN_BOARD_DUMMY_PRODUCTS.filter((p) => p.category?.slug === cat.slug).length,
      }));
    }
    return categories.map((cat) => ({ ...cat, product_count: 0 }));
  }

  try {
    const { data: prods, error } = await supabase
      .from('products')
      .select('category_id')
      .eq('approval_status', 'Approved');

    if (error || !prods) {
      if (demoActive) {
        return categories.map((cat) => ({
          ...cat,
          product_count: DESIGN_BOARD_DUMMY_PRODUCTS.filter((p) => p.category?.slug === cat.slug).length,
        }));
      }
      return categories.map((cat) => ({ ...cat, product_count: 0 }));
    }

    const countMap: Record<string, number> = {};
    for (const item of prods) {
      if (item.category_id) {
        countMap[item.category_id] = (countMap[item.category_id] || 0) + 1;
      }
    }

    return categories.map((cat) => ({
      ...cat,
      product_count: countMap[cat.id] || 0,
    }));
  } catch (err) {
    console.error('Rablo: Error fetching category counts:', err);
    return categories.map((cat) => ({ ...cat, product_count: 0 }));
  }
}

/** Create a new product (seller) */
export async function createProduct(product: {
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: string | null;
  seller_ig_url: string;
  product_ig_url?: string | null;
  contact_link?: string | null;
  thumbnail_url?: string;
  gallery_urls?: string[];
  bulk_orders?: boolean;
  international_export?: boolean;
  brand_id?: string | null;
  attributes?: Record<string, any>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Database not configured' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false, error: 'User session not found. Please sign in again.' };

    const userEmail = session.user.email || '';
    const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Instagram Creator';
    const userAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';

    // Enforce 1 Instagram account per 1 email address policy
    const igCheck = await validateInstagramOwnership(product.seller_ig_url, session.user.id, userEmail);
    if (!igCheck.isAvailable) {
      return {
        success: false,
        error: igCheck.error || 'This Instagram account is already registered with another email. Each Instagram account can only be used by one email address.'
      };
    }

    const canonicalSellerIgUrl = canonicalizeInstagramUrl(product.seller_ig_url);

    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email: userEmail,
        full_name: userName,
        avatar_url: userAvatar,
        instagram_url: canonicalSellerIgUrl,
        is_seller: true,
        role: (userEmail.toLowerCase() === 'sumitkatiyar783@gmail.com') ? 'admin' : 'seller',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (profileError) {
        console.warn('Rablo: Profile upsert warning:', profileError);
      }
    } catch (profileCatchErr) {
      console.warn('Rablo: Profile upsert exception:', profileCatchErr);
    }

    const formattedDescription = formatDescriptionWithOptions(
      product.description,
      product.bulk_orders,
      product.international_export
    );

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        description: formattedDescription,
        price: product.price,
        stock: product.stock,
        category_id: product.category_id || null,
        seller_ig_url: product.seller_ig_url,
        product_ig_url: product.product_ig_url || null,
        contact_link: product.contact_link ? normalizeContactLink(product.contact_link) : (product.product_ig_url ? normalizeContactLink(product.product_ig_url) : null),
        thumbnail_url: product.thumbnail_url || null,
        gallery_urls: product.gallery_urls || [],
        seller_id: session.user.id,
        brand_id: product.brand_id || null,
        attributes: product.attributes || {},
        approval_status: 'Pending',
      })
      .select('id');

    if (error) {
      console.error('Rablo: Error creating product:', error);
      return { success: false, error: error.message };
    }

    const newId = data?.[0]?.id || 'submitted';
    return { success: true, id: newId };
  } catch (err: any) {
    console.error('Rablo: createProduct unexpected exception:', err);
    return { success: false, error: err.message || 'An unexpected error occurred while saving product.' };
  }
}

/** Update an existing product */
export async function updateProduct(
  id: string,
  updates: Partial<Product>
): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Database not initialized' };
  try {
    const payload: any = { ...updates, updated_at: new Date().toISOString() };
    if (payload.contact_link !== undefined) {
      payload.contact_link = payload.contact_link ? normalizeContactLink(payload.contact_link) : null;
    }
    delete payload.category;
    delete payload.seller;
    delete payload.brand;

    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Delete a product (admin or creator) */
export async function deleteProduct(productId: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const deletedJson = localStorage.getItem('rablo:deleted_dummy_ids') || '[]';
      const deletedIds: string[] = JSON.parse(deletedJson);
      if (!deletedIds.includes(productId)) {
        deletedIds.push(productId);
        localStorage.setItem('rablo:deleted_dummy_ids', JSON.stringify(deletedIds));
      }
    } catch {}
  }

  if (!supabase) return true;
  try {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      console.warn('Rablo: Delete product database warning:', error);
    }
    return true;
  } catch (err) {
    console.warn('Rablo: Delete product exception:', err);
    return true;
  }
}

/** Submit a category request */
export async function requestCategory(name: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Not configured' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false, error: 'Not authenticated' };

    const { error } = await supabase
      .from('category_requests')
      .insert({ name, requested_by: session.user.id });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Fetch all products (admin) */
export async function getAllProducts(status?: string): Promise<Product[]> {
  const demoActive = isDemoDataEnabled();
  const deletedIds = demoActive ? getDeletedDummyIds() : [];
  const activeDummies = demoActive
    ? DESIGN_BOARD_DUMMY_PRODUCTS.filter((p) => !deletedIds.includes(p.id))
    : [];
  const filteredDummies = status
    ? activeDummies.filter((p) => p.approval_status === status)
    : activeDummies;

  if (!isSupabaseConfigured || !supabase) return filteredDummies;
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
        brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type ),
        seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url, email )
      `)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('approval_status', status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Rablo: Admin all products fetch with join failed, trying plain select:', error);
      let fallbackQuery = supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (status) fallbackQuery = fallbackQuery.eq('approval_status', status);
      const { data: fallback, error: fallbackError } = await fallbackQuery;
      if (fallbackError || !fallback || fallback.length === 0) return filteredDummies;
      const mappedFallback = ((fallback || []) as Product[]).map(enrichProductWithOptions);
      if (!demoActive) return mappedFallback;
      const existingIds = new Set(mappedFallback.map((r) => r.id));
      const unseededDummies = filteredDummies.filter((d) => !existingIds.has(d.id));
      return [...mappedFallback, ...unseededDummies];
    }
    const results = ((data || []) as Product[]).map(enrichProductWithOptions);
    if (!demoActive) return results;
    if (results.length === 0) return filteredDummies;
    const existingIds = new Set(results.map((r) => r.id));
    const unseededDummies = filteredDummies.filter((d) => !existingIds.has(d.id));
    return [...results, ...unseededDummies];
  } catch {
    return filteredDummies;
  }
}

/** Approve a product (admin) */
export async function approveProduct(productId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('products')
    .update({ approval_status: 'Approved', rejection_feedback: null, updated_at: new Date().toISOString() })
    .eq('id', productId);
  return !error;
}

/** Reject a product with feedback (admin) */
export async function rejectProduct(productId: string, feedback: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('products')
    .update({ approval_status: 'Rejected', rejection_feedback: feedback, updated_at: new Date().toISOString() })
    .eq('id', productId);
  return !error;
}

/** Format and extract clean Instagram handle (e.g. @username) from URL or handle */
export function extractInstagramHandle(urlOrHandle?: string | null): string {
  if (!urlOrHandle) return '';
  const username = normalizeInstagramUsername(urlOrHandle);
  if (username) return `@${username}`;

  // Fallback for non-standard Instagram links (e.g. /direct/ or raw handles)
  const match = urlOrHandle.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i);
  if (match && match[1]) {
    const h = match[1].replace(/^@/, '');
    if (h && h !== 'p' && h !== 'reel' && h !== 'tv' && h !== 'direct') {
      return `@${h}`;
    }
  }
  const cleaned = urlOrHandle.trim().replace(/^@/, '');
  return cleaned ? `@${cleaned}` : '';
}

