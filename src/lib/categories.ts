/**
 * RABLO — Category Management & 1:1 Image Operations
 * Provides data access, 1:1 image uploading to Supabase Storage,
 * and high-resolution category resolution across the store.
 */

import { supabase, isSupabaseConfigured } from './supabase.ts';
import { cropAndResizeToSquareWebp } from './imageResize.ts';
import type { CategoryWithCount } from './products.ts';

export interface CategoryAdminItem extends CategoryWithCount {
  requested_by?: string | null;
  created_at?: string;
}

/**
 * High-resolution 1:1 default category images provided for core categories.
 * Stored in /categories/ as clean, modern WebP assets.
 */
export const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  'art': '/categories/art-and-prints.webp',
  'art-and-prints': '/categories/art-and-prints.webp',
  'clothing': '/categories/clothing-and-apparel.webp',
  'clothing-and-apparel': '/categories/clothing-and-apparel.webp',
  'crochet': '/categories/crochet.webp',
  'home-decor': '/categories/home-and-decor.webp',
  'home-and-decor': '/categories/home-and-decor.webp',
  'jewelry': '/categories/jewellery.webp',
  'jewellery': '/categories/jewellery.webp',
  'mobile-accessories': '/categories/mobile-accessories.webp',
  'phone-covers': '/categories/mobile-accessories.webp',
};

/**
 * Normalizes legacy slugs (e.g. phone-covers -> mobile-accessories)
 */
export function normalizeCategorySlug(rawSlug: string): string {
  const s = (rawSlug || '').toLowerCase().trim();
  if (s === 'phone-covers') return 'mobile-accessories';
  return s;
}

/**
 * Normalizes legacy names (e.g. Phone Covers -> Mobile Accessories)
 */
export function normalizeCategoryName(rawName: string): string {
  const n = (rawName || '').trim();
  if (n.toLowerCase() === 'phone covers') return 'Mobile Accessories';
  if (n.toLowerCase() === 'home decor') return 'Home & Decor';
  if (n.toLowerCase() === 'jewelry') return 'Jewellery';
  return n;
}

/**
 * Resolves the 1:1 image URL for a category, using custom uploaded image_url
 * when available, falling back to high-resolution default image assets.
 */
export function getCategoryImageUrl(cat: {
  slug?: string;
  name?: string;
  image_url?: string | null;
}): string | null {
  if (cat.image_url && cat.image_url.trim()) {
    return cat.image_url.trim();
  }

  const slug = (cat.slug || '').toLowerCase().trim();
  if (DEFAULT_CATEGORY_IMAGES[slug]) {
    return DEFAULT_CATEGORY_IMAGES[slug];
  }

  const name = (cat.name || '').toLowerCase().trim();
  if (name.includes('art') || name.includes('print')) return DEFAULT_CATEGORY_IMAGES['art'];
  if (name.includes('cloth') || name.includes('apparel')) return DEFAULT_CATEGORY_IMAGES['clothing'];
  if (name.includes('crochet') || name.includes('knit')) return DEFAULT_CATEGORY_IMAGES['crochet'];
  if (name.includes('home') || name.includes('decor')) return DEFAULT_CATEGORY_IMAGES['home-decor'];
  if (name.includes('jewel') || name.includes('gem')) return DEFAULT_CATEGORY_IMAGES['jewellery'];
  if (name.includes('phone') || name.includes('mobile') || name.includes('cover') || name.includes('case')) {
    return DEFAULT_CATEGORY_IMAGES['mobile-accessories'];
  }

  return null;
}

/**
 * Fetch all categories with product counts and resolved images for the Admin Dashboard.
 */
export async function listCategoriesForAdmin(): Promise<{
  data: CategoryAdminItem[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { data: [], error: 'Database not configured' };
  }

  try {
    const { data: catRows, error: catErr } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (catErr) {
      return { data: [], error: catErr.message };
    }

    // Product counts per category
    const { data: prodRows } = await supabase
      .from('products')
      .select('category_id')
      .eq('approval_status', 'Approved');

    const countMap: Record<string, number> = {};
    for (const p of prodRows || []) {
      if (p.category_id) {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1;
      }
    }

    const categories: CategoryAdminItem[] = (catRows || []).map((c: any) => {
      const normalizedName = normalizeCategoryName(c.name);
      const normalizedSlug = normalizeCategorySlug(c.slug);
      const resolvedImg = getCategoryImageUrl({
        slug: normalizedSlug,
        name: normalizedName,
        image_url: c.image_url,
      });

      return {
        id: c.id,
        name: normalizedName,
        slug: normalizedSlug,
        is_approved: Boolean(c.is_approved),
        image_url: resolvedImg,
        requested_by: c.requested_by,
        created_at: c.created_at,
        product_count: countMap[c.id] || 0,
      };
    });

    return { data: categories, error: null };
  } catch (err) {
    return {
      data: [],
      error: err instanceof Error ? err.message : 'Failed to fetch categories',
    };
  }
}

/**
 * Upload a 1:1 image for a category into Supabase Storage 'site-assets' bucket.
 * Crops to a 1:1 center square and converts to high-resolution WebP (1000x1000 max).
 */
export async function uploadCategory1to1Image(
  file: File | Blob,
  categoryId: string
): Promise<{
  publicUrl: string | null;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { publicUrl: null, error: 'Database not configured' };
  }

  // Allowed formats
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (file.type && !allowedTypes.includes(file.type)) {
    return {
      publicUrl: null,
      error: 'Invalid file format. Please upload JPEG, PNG, or WebP.',
    };
  }

  // Max 5 MB
  if (file.size > 5 * 1024 * 1024) {
    return {
      publicUrl: null,
      error: 'Image file size exceeds the 5 MB limit.',
    };
  }

  let squareWebpBlob: Blob;
  try {
    squareWebpBlob = await cropAndResizeToSquareWebp(file, 1000, 0.90);
  } catch (resizeErr) {
    return {
      publicUrl: null,
      error: `Failed to process 1:1 image: ${resizeErr instanceof Error ? resizeErr.message : 'Unknown error'}`,
    };
  }

  const filePath = `categories/${categoryId}-${Date.now()}.webp`;

  const { error: uploadErr } = await supabase.storage
    .from('site-assets')
    .upload(filePath, squareWebpBlob, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadErr) {
    // If site-assets bucket is restricted or uncreated, fallback to product-images or data URL
    const { error: fallbackErr } = await supabase.storage
      .from('product-images')
      .upload(`categories/${filePath}`, squareWebpBlob, {
        contentType: 'image/webp',
        upsert: true,
      });

    if (fallbackErr) {
      let msg = uploadErr.message || fallbackErr.message;
      if (msg.includes('Bucket not found') || msg.includes('row-level security') || msg.includes('policy')) {
        msg = `Supabase Storage error: The "site-assets" storage bucket or upload policy is missing. Please run the SQL migration in Supabase SQL Editor. (${msg})`;
      }
      return { publicUrl: null, error: msg };
    }

    const { data: pubData } = supabase.storage
      .from('product-images')
      .getPublicUrl(`categories/${filePath}`);

    return { publicUrl: pubData.publicUrl, error: null };
  }

  const { data: pubData } = supabase.storage
    .from('site-assets')
    .getPublicUrl(filePath);

  return { publicUrl: pubData.publicUrl, error: null };
}

function notifyCategoriesUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rablo:categories-updated'));
    try {
      const channel = new BroadcastChannel('rablo:events');
      channel.postMessage({ type: 'rablo:categories-updated' });
      channel.close();
    } catch {
      // BroadcastChannel unsupported or restricted
    }
  }
}

/**
 * Update category details (name, slug, image_url) in the database.
 */
export async function updateCategory(
  categoryId: string,
  updates: {
    name?: string;
    slug?: string;
    image_url?: string | null;
    is_approved?: boolean;
  }
): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.slug !== undefined) payload.slug = updates.slug.trim().toLowerCase();
    if (updates.image_url !== undefined) payload.image_url = updates.image_url;
    if (updates.is_approved !== undefined) payload.is_approved = updates.is_approved;

    const { error } = await supabase
      .from('categories')
      .update(payload)
      .eq('id', categoryId);

    if (error) {
      // If column image_url does not exist yet in DB
      if (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('image_url'))) {
        return {
          success: false,
          error: 'The "image_url" column is missing from table "categories" in Supabase. Please run the SQL migration in your Supabase SQL Editor.',
        };
      }
      return { success: false, error: error.message };
    }

    notifyCategoriesUpdated();

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update category',
    };
  }
}

/**
 * Create a new approved category (Admin creation).
 */
export async function createCategory(data: {
  name: string;
  slug?: string;
  image_url?: string | null;
}): Promise<{
  data: CategoryAdminItem | null;
  error: string | null;
}> {
  const name = data.name?.trim();
  if (!name) {
    return { data: null, error: 'Category name is required' };
  }

  const slug = (
    data.slug?.trim() ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  ).toLowerCase();

  if (!slug) {
    return { data: null, error: 'Valid category slug is required' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: 'Database not configured' };
  }

  try {
    const payload: Record<string, any> = {
      name,
      slug,
      is_approved: true,
    };
    if (data.image_url) {
      payload.image_url = data.image_url;
    }

    const { data: inserted, error } = await supabase
      .from('categories')
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST204' || error.code === '42703' || (error.message && error.message.includes('image_url'))) {
        return {
          data: null,
          error: 'The "image_url" column is missing from table "categories" in Supabase. Please run the SQL migration in your Supabase SQL Editor.',
        };
      }
      return { data: null, error: error.message };
    }

    notifyCategoriesUpdated();

    return {
      data: {
        ...inserted,
        image_url: inserted.image_url || data.image_url || getCategoryImageUrl(inserted),
        product_count: 0,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Failed to create category',
    };
  }
}

/**
 * Delete a category (Admin operation).
 * Unlinks products (via DB ON DELETE SET NULL) and removes from curated sections.
 */
export async function deleteCategory(categoryId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Database not configured' };
  }

  try {
    // 1. Delete from home_featured if featured in trending_categories
    await supabase
      .from('home_featured')
      .delete()
      .eq('section', 'trending_categories')
      .eq('category_id', categoryId);

    // 2. Unlink any products currently pointing to this category
    await supabase
      .from('products')
      .update({ category_id: null })
      .eq('category_id', categoryId);

    // 3. Delete category row
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    notifyCategoriesUpdated();

    return { success: true, error: null };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete category',
    };
  }
}
