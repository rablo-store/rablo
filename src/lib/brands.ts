/**
 * RABLO — Brand Store Data Layer
 * Operations for Creator Brands, Contacts, and Store Inquiries.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type { Product } from './products';

export interface Brand {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  tagline?: string | null;
  bio?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  instagram_url: string;
  creator_type: 'individual' | 'small_brand';
  is_verified: boolean;
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  rejection_feedback?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandContact {
  brand_id: string;
  contact_type: 'instagram' | 'whatsapp' | 'custom';
  link_template: string;
  message_template?: string | null;
}

export interface BrandWithStats extends Brand {
  product_count?: number;
  save_count?: number;
}

/** Fallback curated showcase brands matching dummy products when DB is offline */
export const SHOWCASE_BRANDS: Brand[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    owner_id: '00000000-0000-0000-0000-000000000010',
    slug: 'crochetbynia',
    name: 'crochet by Nia',
    tagline: 'Crochet Accessories • Handmade with Love',
    bio: 'Self-taught crochet artist crafting slow-made bags, floral accessories and bespoke apparel using natural cotton yarns.',
    logo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    banner_url: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=1200&auto=format&fit=crop&q=80',
    instagram_url: 'https://instagram.com/crochetbynia',
    creator_type: 'individual',
    is_verified: true,
    approval_status: 'Approved',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    owner_id: '00000000-0000-0000-0000-000000000011',
    slug: 'thecandlelab',
    name: 'The Candle Lab',
    tagline: 'Scented Soy Candles & Botanical Wax Melts',
    bio: 'Artisanal soy wax candles hand-poured in small batches in Bangalore with pure organic essential oils.',
    logo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    banner_url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&auto=format&fit=crop&q=80',
    instagram_url: 'https://instagram.com/thecandlelab',
    creator_type: 'small_brand',
    is_verified: true,
    approval_status: 'Approved',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    owner_id: '00000000-0000-0000-0000-000000000012',
    slug: 'mudandmuse',
    name: 'Mud & Muse Pottery',
    tagline: 'Ceramics & Contemporary Tableware',
    bio: 'Wheel-thrown ceramic homeware and sculptural ceramics crafted with earthy clay and food-safe glazes.',
    logo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    banner_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&auto=format&fit=crop&q=80',
    instagram_url: 'https://instagram.com/mudandmuse',
    creator_type: 'individual',
    is_verified: true,
    approval_status: 'Approved',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    owner_id: '00000000-0000-0000-0000-000000000013',
    slug: 'beadwithlove',
    name: 'Bead with Love',
    tagline: 'Handmade Bead Jewellery & Y2K Accessories',
    bio: 'Vibrant beaded necklaces, freshwater pearl earrings and playful charm jewelry handcrafted with precision.',
    logo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
    banner_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&auto=format&fit=crop&q=80',
    instagram_url: 'https://instagram.com/beadwithlove',
    creator_type: 'individual',
    is_verified: false,
    approval_status: 'Approved',
    created_at: '2026-11-06T10:00:00.000Z',
    updated_at: '2026-11-06T10:00:00.000Z',
  },
];

export interface ListApprovedBrandsOptions {
  q?: string;
  sort?: 'new' | 'trending' | 'verified';
}

/**
 * Lists all approved creator brands whose owners are active
 */
export async function listApprovedBrands(
  options: ListApprovedBrandsOptions = {}
): Promise<BrandWithStats[]> {
  const { q, sort = 'trending' } = options;

  if (!isSupabaseConfigured || !supabase) {
    let list = [...SHOWCASE_BRANDS];
    if (q && q.trim()) {
      const query = q.toLowerCase().trim();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.slug.toLowerCase().includes(query) ||
          (b.tagline && b.tagline.toLowerCase().includes(query)) ||
          (b.bio && b.bio.toLowerCase().includes(query))
      );
    }
    if (sort === 'new') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'verified') {
      list.sort((a, b) => Number(b.is_verified) - Number(a.is_verified));
    }
    return list;
  }

  try {
    let query = supabase
      .from('brands')
      .select('*')
      .eq('approval_status', 'Approved');

    if (q && q.trim()) {
      const term = q.trim();
      query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%,tagline.ilike.%${term}%`);
    }

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false });
    } else if (sort === 'verified') {
      query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    } else {
      query = query.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return SHOWCASE_BRANDS;
    }

    return data as BrandWithStats[];
  } catch (err) {
    console.warn('Rablo: Error fetching brands:', err);
    return SHOWCASE_BRANDS;
  }
}

/**
 * Fetch a brand by unique slug
 */
export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const normalizedSlug = slug.toLowerCase().trim().replace(/^@/, '');
  const dummyMatch = SHOWCASE_BRANDS.find((b) => b.slug === normalizedSlug);

  if (!isSupabaseConfigured || !supabase) {
    return dummyMatch || null;
  }

  try {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('slug', normalizedSlug)
      .maybeSingle();

    if (error || !data) {
      return dummyMatch || null;
    }

    return data as Brand;
  } catch {
    return dummyMatch || null;
  }
}

/**
 * Fetch approved products belonging to a brand
 */
export async function getBrandProducts(brandId: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
        brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type )
      `)
      .eq('brand_id', brandId)
      .eq('approval_status', 'Approved')
      .order('created_at', { ascending: false });

    if (error || !data) {
      // Fallback select without joins
      const { data: fallback } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brandId)
        .eq('approval_status', 'Approved')
        .order('created_at', { ascending: false });

      return (fallback || []) as Product[];
    }

    return (data || []) as Product[];
  } catch {
    return [];
  }
}

/**
 * Fetch current user's brand
 */
export async function getMyBrand(): Promise<Brand | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('owner_id', session.user.id)
      .maybeSingle();

    if (error || !data) return null;
    return data as Brand;
  } catch {
    return null;
  }
}

/**
 * Creates a brand for the currently authenticated creator
 */
export async function createBrand(
  brandData: Partial<Brand>
): Promise<{ success: boolean; data?: Brand; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { success: false, error: 'Please sign in to register a brand' };
    }

    const payload = {
      ...brandData,
      owner_id: session.user.id,
      approval_status: 'Pending',
      is_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('brands')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Brand };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create brand' };
  }
}

/**
 * Updates a brand (owner or admin)
 */
export async function updateBrand(
  brandId: string,
  updates: Partial<Brand>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('brands')
      .update(payload)
      .eq('id', brandId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update brand' };
  }
}

/**
 * Upserts a brand's inquiry contact settings
 */
export async function upsertBrandContact(
  contact: BrandContact
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const { error } = await supabase
      .from('brand_contacts')
      .upsert(contact, { onConflict: 'brand_id' });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save contact settings' };
  }
}

/**
 * Fetches contact info for a brand (Requires authentication)
 */
export async function getBrandContact(brandId: string): Promise<BrandContact | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('brand_contacts')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle();

    if (error || !data) return null;
    return data as BrandContact;
  } catch {
    return null;
  }
}

/**
 * Checks if a brand slug is available
 */
export async function checkSlugAvailable(
  slug: string,
  excludeBrandId?: string
): Promise<boolean> {
  const clean = slug.toLowerCase().trim().replace(/^@/, '');
  if (!clean || clean.length < 3 || clean.length > 40) return false;
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(clean)) return false;

  if (!isSupabaseConfigured || !supabase) return true;

  try {
    let query = supabase.from('brands').select('id').eq('slug', clean);
    if (excludeBrandId) {
      query = query.neq('id', excludeBrandId);
    }
    const { data, error } = await query;
    if (error) return true;
    return !data || data.length === 0;
  } catch {
    return true;
  }
}

/**
 * Calls RPC product_save_counts() to get aggregate saves per approved product
 */
export async function getSaveCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || !supabase) return {};

  try {
    const { data, error } = await supabase.rpc('product_save_counts');
    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const row of data as { product_id: string; saves: number }[]) {
      if (row.product_id) {
        counts[row.product_id] = Number(row.saves) || 0;
      }
    }
    return counts;
  } catch {
    return {};
  }
}

// ----------------------------------------------------------------------------
// Admin Brand Moderation Helpers
// ----------------------------------------------------------------------------

export async function getAllBrands(status?: string): Promise<Brand[]> {
  if (!isSupabaseConfigured || !supabase) return SHOWCASE_BRANDS;

  try {
    let query = supabase.from('brands').select('*').order('created_at', { ascending: false });
    if (status) {
      query = query.eq('approval_status', status);
    }
    const { data, error } = await query;
    if (error || !data) return SHOWCASE_BRANDS;
    return data as Brand[];
  } catch {
    return SHOWCASE_BRANDS;
  }
}

export async function approveBrand(brandId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('brands')
      .update({
        approval_status: 'Approved',
        rejection_feedback: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);
    return !error;
  } catch {
    return false;
  }
}

export async function rejectBrand(brandId: string, feedback?: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('brands')
      .update({
        approval_status: 'Rejected',
        rejection_feedback: feedback || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);
    return !error;
  } catch {
    return false;
  }
}

export async function setBrandVerified(brandId: string, isVerified: boolean): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('brands')
      .update({
        is_verified: isVerified,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId);
    return !error;
  } catch {
    return false;
  }
}

