/**
 * RABLO — Home Page Data Layer & Curation Operations
 * Admin-curated banners, featured sections, and infinite pagination.
 * All public methods return typed { data, error } results and never throw.
 */

import { supabase, isSupabaseConfigured } from './supabase.ts';
import type {
  Product,
  Category,
  CategoryWithCount,
} from './products.ts';
import type { Brand, BrandWithStats } from './brands.ts';
import { resizeToWebp } from './imageResize.ts';
import { getCategoryImageUrl, normalizeCategoryName, normalizeCategorySlug } from './categories.ts';

export const HOME_LIMITS = {
  banners: 8,
  trendingProducts: 12,
  newArrivals: 8,
  trendingCreators: 8,
  trendingCategories: 4,
  allProductsPageSize: 8,
  allProductsMax: 48,
} as const;

export interface HomeBanner {
  id: string;
  image_path: string;
  image_url: string;
  alt_text: string;
  link_url: string | null;
  focal_x: number;
  focal_y: number;
  position: number;
  is_active: boolean;
  created_at: string;
}

export type HomeFeaturedSection =
  | 'trending_products'
  | 'new_arrivals'
  | 'trending_creators'
  | 'trending_categories';

export interface HomeFeaturedRow {
  id: string;
  section: HomeFeaturedSection;
  product_id: string | null;
  brand_id: string | null;
  category_id: string | null;
  position: number;
  created_at: string;
}

export interface HomeFeaturedItemAdmin extends HomeFeaturedRow {
  product?: Product | null;
  brand?: Brand | null;
  category?: Category | null;
}

export interface AllProductsPageResult {
  items: Product[];
  hasMore: boolean;
}

function enrichProduct(product: Product): Product {
  if (!product) return product;
  const desc = product.description || '';
  const match = desc.match(/<!--rablo_options:(\{.*?\})-->/);
  let bulk = false;
  let intl = false;
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      bulk = Boolean(parsed.bulk_orders ?? parsed.bulk);
      intl = Boolean(parsed.international_export ?? parsed.intl);
    } catch {}
  }
  const cleanDesc = desc.replace(/<!--rablo_options:(\{.*?\})-->/, '').trim();
  return {
    ...product,
    description: cleanDesc,
    bulk_orders: product.bulk_orders ?? bulk,
    international_export: product.international_export ?? intl,
  };
}

/**
 * Validates whether a banner link_url is safe and matches the database CHECK constraint:
 * link_url IS NULL OR link_url ~ '^/([^/]|$)' OR link_url ~ '^https://'
 */
export function isSafeBannerLink(url?: string | null): boolean {
  if (url === null || url === undefined || url === '') return true;
  const trimmed = url.trim();
  if (trimmed === '') return true;

  // Reject javascript:, data:, vbscript:, and relative protocol // URLs
  if (/^([a-z0-9+.-]+:)/i.test(trimmed) && !trimmed.startsWith('https://')) {
    return false;
  }
  if (trimmed.startsWith('//')) {
    return false;
  }

  // Must match either internal path starting with / or https:// URL
  return /^\/([^/]|$)/.test(trimmed) || /^https:\/\//.test(trimmed);
}

// ============================================================================
// PUBLIC READ OPERATIONS (Never throw; return { data, error })
// ============================================================================

/**
 * Fetch all active banners ordered by position then created_at.
 */
export async function getActiveBanners(): Promise<{
  data: HomeBanner[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('home_banners')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(HOME_LIMITS.banners);

    if (error) {
      console.error('Rablo: Error fetching active banners:', error);
      return { data: [], error: error.message };
    }

    return { data: (data || []) as HomeBanner[], error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching banners';
    console.error('Rablo: Exception in getActiveBanners:', err);
    return { data: [], error: message };
  }
}

/**
 * Fetch admin-curated trending products (max 12).
 * Only returns products currently visible to the public (Approved status).
 */
export async function getTrendingProducts(): Promise<{
  data: Product[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('home_featured')
      .select(`
        id,
        position,
        created_at,
        product:products!inner (
          *,
          category:categories ( id, name, slug ),
          brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type, approval_status ),
          seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url )
        )
      `)
      .eq('section', 'trending_products')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(HOME_LIMITS.trendingProducts);

    if (error) {
      console.error('Rablo: Error fetching trending products:', error);
      return { data: [], error: error.message };
    }

    const items: Product[] = [];
    for (const row of data || []) {
      const prod = (row as any).product;
      if (!prod || prod.approval_status !== 'Approved') continue;
      // If brand is present, ensure brand is approved
      if (prod.brand && prod.brand.approval_status && prod.brand.approval_status !== 'Approved') {
        continue;
      }
      items.push(enrichProduct(prod as Product));
    }

    return { data: items, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching trending products';
    console.error('Rablo: Exception in getTrendingProducts:', err);
    return { data: [], error: message };
  }
}

/**
 * Fetch newest 8 rows of home_featured for section 'new_arrivals' by created_at desc.
 * Only returns approved products.
 */
export async function getNewArrivals(): Promise<{
  data: Product[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('home_featured')
      .select(`
        id,
        position,
        created_at,
        product:products!inner (
          *,
          category:categories ( id, name, slug ),
          brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type, approval_status ),
          seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url )
        )
      `)
      .eq('section', 'new_arrivals')
      .order('created_at', { ascending: false })
      .limit(HOME_LIMITS.newArrivals);

    if (error) {
      console.error('Rablo: Error fetching new arrivals:', error);
      return { data: [], error: error.message };
    }

    const items: Product[] = [];
    for (const row of data || []) {
      const prod = (row as any).product;
      if (!prod || prod.approval_status !== 'Approved') continue;
      if (prod.brand && prod.brand.approval_status && prod.brand.approval_status !== 'Approved') {
        continue;
      }
      items.push(enrichProduct(prod as Product));
    }

    return { data: items, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching new arrivals';
    console.error('Rablo: Exception in getNewArrivals:', err);
    return { data: [], error: message };
  }
}

/**
 * Fetch admin-curated trending creators (max 8) ordered by position.
 * Keeps only approved brands.
 */
export async function getTrendingCreators(): Promise<{
  data: BrandWithStats[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('home_featured')
      .select(`
        id,
        position,
        created_at,
        brand:brands!inner (
          id,
          owner_id,
          slug,
          name,
          tagline,
          bio,
          logo_url,
          banner_url,
          instagram_url,
          creator_type,
          is_verified,
          approval_status,
          created_at,
          updated_at
        )
      `)
      .eq('section', 'trending_creators')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(HOME_LIMITS.trendingCreators);

    if (error) {
      console.error('Rablo: Error fetching trending creators:', error);
      return { data: [], error: error.message };
    }

    const items: BrandWithStats[] = [];
    for (const row of data || []) {
      const brand = (row as any).brand;
      if (!brand || brand.approval_status !== 'Approved') continue;
      items.push(brand as BrandWithStats);
    }

    return { data: items, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching trending creators';
    console.error('Rablo: Exception in getTrendingCreators:', err);
    return { data: [], error: message };
  }
}

/**
 * Fetch admin-curated trending categories (max 4) ordered by position.
 * Keeps only approved categories.
 */
export async function getTrendingCategories(): Promise<{
  data: CategoryWithCount[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('home_featured')
      .select(`
        id,
        position,
        created_at,
        category:categories!inner (
          id,
          name,
          slug,
          is_approved
        )
      `)
      .eq('section', 'trending_categories')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(HOME_LIMITS.trendingCategories);

    if (error) {
      console.error('Rablo: Error fetching trending categories:', error);
      return { data: [], error: error.message };
    }

    const categories: Category[] = [];
    for (const row of data || []) {
      const cat = (row as any).category;
      if (!cat || !cat.is_approved) continue;
      const normalizedName = normalizeCategoryName(cat.name);
      const normalizedSlug = normalizeCategorySlug(cat.slug);
      categories.push({
        ...cat,
        name: normalizedName,
        slug: normalizedSlug,
        image_url: getCategoryImageUrl({
          name: normalizedName,
          slug: normalizedSlug,
          image_url: cat.image_url,
        }),
      });
    }

    if (categories.length === 0) {
      return { data: [], error: null };
    }

    // Aggregate real product counts for these curated categories
    const catIds = categories.map((c) => c.id);
    const { data: prodData } = await supabase
      .from('products')
      .select('category_id')
      .in('category_id', catIds)
      .eq('approval_status', 'Approved');

    const countMap: Record<string, number> = {};
    for (const p of prodData || []) {
      if (p.category_id) {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      }
    }

    const resultWithCounts: CategoryWithCount[] = categories.map((c) => ({
      ...c,
      product_count: countMap[c.id] || 0,
    }));

    return { data: resultWithCounts, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching trending categories';
    console.error('Rablo: Exception in getTrendingCategories:', err);
    return { data: [], error: message };
  }
}

/**
 * All Products: 8 products per page, ordered by created_at desc, id desc (stable).
 * hasMore is false when fewer than 8 came back or when (page + 1) * 8 >= HOME_LIMITS.allProductsMax (48).
 */
export async function getAllProductsPage(page: number): Promise<{
  data: AllProductsPageResult | null;
  error: string | null;
  items: Product[];
  hasMore: boolean;
}> {
  const pageSize = HOME_LIMITS.allProductsPageSize;
  const maxProducts = HOME_LIMITS.allProductsMax;

  if (page < 0 || page * pageSize >= maxProducts) {
    return {
      data: { items: [], hasMore: false },
      items: [],
      hasMore: false,
      error: null,
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      data: { items: [], hasMore: false },
      items: [],
      hasMore: false,
      error: 'Database not configured',
    };
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;

  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
        brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type ),
        seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url )
      `)
      .eq('approval_status', 'Approved')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Rablo: Error fetching all products page:', error);
      return {
        data: null,
        items: [],
        hasMore: false,
        error: error.message,
      };
    }

    const items: Product[] = ((data || []) as Product[]).map(enrichProduct);
    const reachedCap = (page + 1) * pageSize >= maxProducts;
    const hasMore = items.length === pageSize && !reachedCap;

    const payload: AllProductsPageResult = { items, hasMore };
    return {
      data: payload,
      items,
      hasMore,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error fetching all products';
    console.error('Rablo: Exception in getAllProductsPage:', err);
    return {
      data: null,
      items: [],
      hasMore: false,
      error: message,
    };
  }
}

// ============================================================================
// ADMIN WRITE OPERATIONS (Rely on RLS; surface DB error messages)
// ============================================================================

/**
 * List all banners for admin review (both active and inactive).
 */
export async function listAllBanners(): Promise<{
  data: HomeBanner[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('home_banners')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }
    return { data: (data || []) as HomeBanner[], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list banners';
    return { data: [], error: msg };
  }
}

/**
 * Upload banner image to site-assets bucket, resize to max 1920px WebP, and insert row.
 * If the row insert fails, the uploaded storage file is immediately deleted.
 */
export async function uploadBanner(
  file: File,
  altText: string = ''
): Promise<{
  data: HomeBanner | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Database not configured' };
  }

  // Validate mime type
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMime.includes(file.type)) {
    return {
      data: null,
      error: 'Invalid file format. Only JPEG, PNG, and WebP images are allowed.',
    };
  }

  // Validate original file size (max 5 MB)
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      data: null,
      error: 'Image file size exceeds the 5 MB limit.',
    };
  }

  // Check current banner count against database limit
  const { count, error: countErr } = await supabase
    .from('home_banners')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    return { data: null, error: countErr.message };
  }
  if ((count ?? 0) >= HOME_LIMITS.banners) {
    return {
      data: null,
      error: `Maximum of ${HOME_LIMITS.banners} banners reached. Delete an existing banner to add a new one.`,
    };
  }

  let resizedBlob: Blob;
  try {
    resizedBlob = await resizeToWebp(file, 1920, 0.82);
  } catch (resizeErr) {
    return {
      data: null,
      error: `Failed to resize banner image: ${resizeErr instanceof Error ? resizeErr.message : 'Unknown error'}`,
    };
  }

  const bannerId = crypto.randomUUID();
  const imagePath = `banners/${bannerId}.webp`;

  // 1. Upload to storage bucket 'site-assets'
  const { error: uploadError } = await supabase.storage
    .from('site-assets')
    .upload(imagePath, resizedBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    return { data: null, error: uploadError.message };
  }

  // 2. Obtain public URL
  const { data: urlData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(imagePath);
  const imageUrl = urlData.publicUrl;

  // Determine next position
  const { data: posData } = await supabase
    .from('home_banners')
    .select('position')
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = (posData?.[0]?.position ?? -1) + 1;

  // 3. Insert record into home_banners
  const { data: bannerRow, error: insertError } = await supabase
    .from('home_banners')
    .insert({
      id: bannerId,
      image_path: imagePath,
      image_url: imageUrl,
      alt_text: altText.trim().slice(0, 160),
      position: nextPos,
      is_active: true,
      focal_x: 50,
      focal_y: 50,
    })
    .select('*')
    .single();

  if (insertError) {
    // Rollback storage upload if DB insert fails
    await supabase.storage.from('site-assets').remove([imagePath]);
    return { data: null, error: insertError.message };
  }

  return { data: bannerRow as HomeBanner, error: null };
}

/**
 * Update an existing banner's metadata (alt_text, link_url, focal_x, focal_y, is_active).
 */
export async function updateBanner(
  id: string,
  patch: Partial<Pick<HomeBanner, 'alt_text' | 'link_url' | 'focal_x' | 'focal_y' | 'is_active'>>
): Promise<{
  data: HomeBanner | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Database not configured' };
  }

  if (patch.link_url !== undefined && !isSafeBannerLink(patch.link_url)) {
    return {
      data: null,
      error: 'Invalid banner link URL. Must be an internal path (starting with /) or an https:// URL.',
    };
  }

  try {
    const updatePayload: Record<string, any> = {};
    if (patch.alt_text !== undefined) updatePayload.alt_text = patch.alt_text.trim().slice(0, 160);
    if (patch.link_url !== undefined) updatePayload.link_url = patch.link_url ? patch.link_url.trim() : null;
    if (patch.focal_x !== undefined) updatePayload.focal_x = Math.max(0, Math.min(100, Math.round(patch.focal_x)));
    if (patch.focal_y !== undefined) updatePayload.focal_y = Math.max(0, Math.min(100, Math.round(patch.focal_y)));
    if (patch.is_active !== undefined) updatePayload.is_active = Boolean(patch.is_active);

    const { data, error } = await supabase
      .from('home_banners')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as HomeBanner, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update banner';
    return { data: null, error: msg };
  }
}

/**
 * Reorder banners to match the given ordered list of banner IDs.
 */
export async function reorderBanners(orderedIds: string[]): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    for (let index = 0; index < orderedIds.length; index++) {
      const bannerId = orderedIds[index];
      const { error } = await supabase
        .from('home_banners')
        .update({ position: index })
        .eq('id', bannerId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reorder banners';
    return { success: false, error: msg };
  }
}

/**
 * Delete a banner: removes the storage object and removes the row.
 * If storage deletion fails, it logs/reports it but continues to remove the database row.
 */
export async function deleteBanner(id: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // 1. Fetch image path
    const { data: banner } = await supabase
      .from('home_banners')
      .select('image_path')
      .eq('id', id)
      .maybeSingle();

    if (banner?.image_path) {
      const { error: storageError } = await supabase.storage
        .from('site-assets')
        .remove([banner.image_path]);

      if (storageError) {
        console.warn('Rablo: Failed to delete banner storage object:', storageError);
      }
    }

    // 2. Delete database row
    const { error: dbError } = await supabase
      .from('home_banners')
      .delete()
      .eq('id', id);

    if (dbError) {
      return { success: false, error: dbError.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete banner';
    return { success: false, error: msg };
  }
}

// ============================================================================
// ADMIN FEATURED OPERATIONS (Curated sections)
// ============================================================================

/**
 * List all items featured in an admin section with resolved product/brand/category details.
 */
export async function listFeaturedAdmin(section: HomeFeaturedSection): Promise<{
  data: HomeFeaturedItemAdmin[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    let selectClause = `
      id,
      section,
      product_id,
      brand_id,
      category_id,
      position,
      created_at
    `;

    if (section === 'trending_products' || section === 'new_arrivals') {
      selectClause += `,
        product:products (
          id, name, price, approval_status, thumbnail_url,
          category:categories ( id, name, slug ),
          brand:brands ( id, name, slug )
        )
      `;
    } else if (section === 'trending_creators') {
      selectClause += `,
        brand:brands (
          id, slug, name, logo_url, instagram_url, is_verified, approval_status
        )
      `;
    } else if (section === 'trending_categories') {
      selectClause += `,
        category:categories (
          id, name, slug, is_approved
        )
      `;
    }

    const { data, error } = await supabase
      .from('home_featured')
      .select(selectClause)
      .eq('section', section)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data || []) as unknown as HomeFeaturedItemAdmin[], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list featured items';
    return { data: [], error: msg };
  }
}

/**
 * Add an approved item into an admin-curated section.
 */
export async function addFeatured(
  section: HomeFeaturedSection,
  targetId: string
): Promise<{
  data: HomeFeaturedRow | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Database not configured' };
  }

  // Validate section cap
  const cap =
    section === 'trending_products'
      ? HOME_LIMITS.trendingProducts
      : section === 'new_arrivals'
        ? HOME_LIMITS.newArrivals
        : section === 'trending_creators'
          ? HOME_LIMITS.trendingCreators
          : HOME_LIMITS.trendingCategories;

  const { count, error: countErr } = await supabase
    .from('home_featured')
    .select('*', { count: 'exact', head: true })
    .eq('section', section);

  if (countErr) {
    return { data: null, error: countErr.message };
  }

  if (section !== 'new_arrivals' && (count ?? 0) >= cap) {
    return {
      data: null,
      error: `Section ${section} is full (max ${cap}). Remove an existing item before adding a new one.`,
    };
  }

  // Determine next position
  const { data: posData } = await supabase
    .from('home_featured')
    .select('position')
    .eq('section', section)
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = (posData?.[0]?.position ?? -1) + 1;

  const insertPayload: Record<string, any> = {
    section,
    position: nextPos,
  };

  if (section === 'trending_products' || section === 'new_arrivals') {
    insertPayload.product_id = targetId;
  } else if (section === 'trending_creators') {
    insertPayload.brand_id = targetId;
  } else if (section === 'trending_categories') {
    insertPayload.category_id = targetId;
  }

  const { data, error } = await supabase
    .from('home_featured')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error) {
    return { data: null, error: error.message };
  }

  return { data: data as HomeFeaturedRow, error: null };
}

/**
 * Remove an item from an admin-curated section (does not delete the underlying entity).
 */
export async function removeFeatured(
  section: HomeFeaturedSection,
  targetIdOrRowId: string
): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    let orFilter = `id.eq.${targetIdOrRowId}`;
    if (section === 'trending_products' || section === 'new_arrivals') {
      orFilter += `,product_id.eq.${targetIdOrRowId}`;
    } else if (section === 'trending_creators') {
      orFilter += `,brand_id.eq.${targetIdOrRowId}`;
    } else if (section === 'trending_categories') {
      orFilter += `,category_id.eq.${targetIdOrRowId}`;
    }

    const { error } = await supabase
      .from('home_featured')
      .delete()
      .eq('section', section)
      .or(orFilter);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to remove featured item';
    return { success: false, error: msg };
  }
}

/**
 * Reorder items in an admin-curated section by updating positions.
 */
export async function reorderFeatured(
  section: HomeFeaturedSection,
  orderedIds: string[]
): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    for (let index = 0; index < orderedIds.length; index++) {
      const rowId = orderedIds[index];
      const { error } = await supabase
        .from('home_featured')
        .update({ position: index })
        .eq('section', section)
        .eq('id', rowId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to reorder featured items';
    return { success: false, error: msg };
  }
}

/**
 * Search approved products by title/description for adding to trending products.
 * Excludes products already featured in the given section. Limit 10.
 */
export async function searchApprovedProducts(
  q: string,
  section: HomeFeaturedSection = 'trending_products'
): Promise<{
  data: Product[];
  error: string | null;
}> {
  const trimmed = q.trim();
  if (!trimmed) {
    return { data: [], error: null };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    // 1. Get currently featured product IDs in this section
    const { data: featured } = await supabase
      .from('home_featured')
      .select('product_id')
      .eq('section', section)
      .not('product_id', 'is', null);

    const excludedIds = new Set((featured || []).map((f) => f.product_id).filter(Boolean));

    // 2. Query matching approved products
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
        brand:brands ( id, slug, name, logo_url, instagram_url, is_verified, creator_type ),
        seller:profiles!products_seller_id_fkey ( full_name, avatar_url, instagram_url )
      `)
      .eq('approval_status', 'Approved')
      .or(`name.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return { data: [], error: error.message };
    }

    const filtered: Product[] = ((data || []) as Product[])
      .filter((p) => !excludedIds.has(p.id))
      .map(enrichProduct);

    return { data: filtered, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to search approved products';
    return { data: [], error: msg };
  }
}

/**
 * Search approved brands for adding to trending creators.
 * Excludes brands already featured in trending creators. Limit 10.
 */
export async function searchApprovedBrands(
  q: string,
  section: HomeFeaturedSection = 'trending_creators'
): Promise<{
  data: Brand[];
  error: string | null;
}> {
  const trimmed = q.trim();
  if (!trimmed) {
    return { data: [], error: null };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    // 1. Get currently featured brand IDs in this section
    const { data: featured } = await supabase
      .from('home_featured')
      .select('brand_id')
      .eq('section', section)
      .not('brand_id', 'is', null);

    const excludedIds = new Set((featured || []).map((f) => f.brand_id).filter(Boolean));

    // 2. Query matching approved brands
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('approval_status', 'Approved')
      .or(`name.ilike.%${trimmed}%,slug.ilike.%${trimmed}%,tagline.ilike.%${trimmed}%`)
      .order('name', { ascending: true })
      .limit(10);

    if (error) {
      return { data: [], error: error.message };
    }

    const filtered = ((data || []) as Brand[]).filter((b) => !excludedIds.has(b.id));
    return { data: filtered, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to search approved brands';
    return { data: [], error: msg };
  }
}

/**
 * List approved categories for admin curation.
 * Excludes categories already featured in trending categories.
 */
export async function listCategoriesAdmin(
  section: HomeFeaturedSection = 'trending_categories'
): Promise<{
  data: Category[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    // 1. Get currently featured category IDs in this section
    const { data: featured } = await supabase
      .from('home_featured')
      .select('category_id')
      .eq('section', section)
      .not('category_id', 'is', null);

    const excludedIds = new Set((featured || []).map((f) => f.category_id).filter(Boolean));

    // 2. Query all approved categories
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_approved', true)
      .order('name', { ascending: true });

    if (error) {
      return { data: [], error: error.message };
    }

    const filtered = ((data || []) as Category[]).filter((c) => !excludedIds.has(c.id));
    return { data: filtered, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list categories';
    return { data: [], error: msg };
  }
}
