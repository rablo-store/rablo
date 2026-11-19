/**
 * RABLO — Product Query Operations
 * Fetch, filter, and manage products from Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { validateInstagramOwnership, canonicalizeInstagramUrl, normalizeInstagramUsername } from './instagram';
import type { Brand } from './brands';
import { getCategoryImageUrl, normalizeCategoryName, normalizeCategorySlug } from './categories';
import { invalidateHomeCurationCache } from './cacheInvalidation';

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

const META_TAG_REGEX = /<!--(?:rablo|rijlo)_options:(\{.*?\})-->/;

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
  return `${clean}\n\n<!--rijlo_options:${meta}-->`;
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

/** Curated Showcase Dummy Products matching the Design Board - loaded ONLY dynamically when isDemoDataEnabled() */
export async function getDesignBoardDummyProducts(): Promise<Product[]> {
  if (!isDemoDataEnabled()) return [];
  const { DESIGN_BOARD_DUMMY_PRODUCTS } = await import('./dummyProducts');
  return DESIGN_BOARD_DUMMY_PRODUCTS;
}

export const DESIGN_BOARD_DUMMY_PRODUCTS: Product[] = [];

interface ProductCacheItem<T> {
  data: T;
  timestamp: number;
  isError?: boolean;
}
const approvedProductsCache = new Map<string, ProductCacheItem<Product[]>>();
const productDetailCache = new Map<string, ProductCacheItem<Product>>();
let approvedCategoriesCache: ProductCacheItem<Category[]> | null = null;
const PRODUCT_CACHE_TTL = 60 * 1000; // 60s in-memory catalog cache
const PRODUCT_CACHE_ERROR_TTL = 5 * 1000; // 5s in-memory error cache

function isProductCacheValid<T>(entry: ProductCacheItem<T> | null | undefined): entry is ProductCacheItem<T> {
  if (!entry) return false;
  const ttl = entry.isError ? PRODUCT_CACHE_ERROR_TTL : PRODUCT_CACHE_TTL;
  return Date.now() - entry.timestamp < ttl;
}

/** Invalidate catalog in-memory cache upon writes/moderation */
export function clearProductCache(): void {
  approvedProductsCache.clear();
  productDetailCache.clear();
  approvedCategoriesCache = null;
  invalidateHomeCurationCache();
}

/** Fetch approved products with optional category filter */
export async function getApprovedProducts(categorySlug?: string): Promise<Product[]> {
  const isFiltered = Boolean(categorySlug && categorySlug !== 'all');
  const cacheKey = (!categorySlug || categorySlug === 'all') ? '__all__' : categorySlug;
  const cached = approvedProductsCache.get(cacheKey);
  if (isProductCacheValid(cached)) {
    return cached.data;
  }

  const demoActive = isDemoDataEnabled();
  const deletedIds = demoActive ? getDeletedDummyIds() : [];
  const dummyProducts = demoActive ? await getDesignBoardDummyProducts() : [];
  const activeDummies = demoActive
    ? dummyProducts.filter((p) => !deletedIds.includes(p.id))
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
      const isConnectionError = error.message?.includes('internal error') || error.message?.includes('fetch failed');
      let fallback: any = null;
      let fallbackError: any = error;
      if (!isConnectionError) {
        const res = await supabase
          .from('products')
          .select('*')
          .eq('approval_status', 'Approved')
          .order('created_at', { ascending: false });
        fallback = res.data;
        fallbackError = res.error;
      }

      if (fallbackError || !fallback || fallback.length === 0) {
        approvedProductsCache.set(cacheKey, { data: filteredDummies, timestamp: Date.now(), isError: true });
        return filteredDummies;
      }
      const mappedFallback = ((fallback || []) as Product[]).map(enrichProductWithOptions);
      if (!demoActive) {
        approvedProductsCache.set(cacheKey, { data: mappedFallback, timestamp: Date.now(), isError: false });
        return mappedFallback;
      }
      const existingIds = new Set(mappedFallback.map((r) => r.id));
      const unseededDummies = filteredDummies.filter((d) => !existingIds.has(d.id));
      const finalFallback = [...mappedFallback, ...unseededDummies];
      approvedProductsCache.set(cacheKey, { data: finalFallback, timestamp: Date.now(), isError: false });
      return finalFallback;
    }

    const results = ((data || []) as Product[]).map(enrichProductWithOptions);
    let finalOutput = results;
    if (demoActive) {
      if (results.length === 0) {
        finalOutput = filteredDummies;
      } else {
        const existingIds = new Set(results.map((r) => r.id));
        const unseededDummies = filteredDummies.filter((d) => !existingIds.has(d.id));
        finalOutput = [...results, ...unseededDummies];
      }
    }
    approvedProductsCache.set(cacheKey, { data: finalOutput, timestamp: Date.now(), isError: false });
    return finalOutput;
  } catch (err) {
    console.error('Rablo: Error fetching approved products:', err);
    approvedProductsCache.set(cacheKey, { data: filteredDummies, timestamp: Date.now(), isError: true });
    return filteredDummies;
  }
}

/** Fetch a single product by ID */
export async function getProductById(id: string): Promise<Product | null> {
  const cached = productDetailCache.get(id);
  if (isProductCacheValid(cached)) {
    return cached.data;
  }
  const demoActive = isDemoDataEnabled();
  const deletedIds = demoActive ? getDeletedDummyIds() : [];
  let dummyMatch: Product | undefined;
  if (demoActive) {
    const dummyProducts = await getDesignBoardDummyProducts();
    dummyMatch = dummyProducts.find((p) => p.id === id);
  }

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

      if (fallback) {
        const enriched = enrichProductWithOptions(fallback as Product);
        productDetailCache.set(id, { data: enriched, timestamp: Date.now(), isError: false });
        return enriched;
      }
      return dummyMatch ? enrichProductWithOptions(dummyMatch) : null;
    }
    const enriched = enrichProductWithOptions(data as Product);
    productDetailCache.set(id, { data: enriched, timestamp: Date.now(), isError: false });
    return enriched;
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
  if (isProductCacheValid(approvedCategoriesCache)) {
    return approvedCategoriesCache.data;
  }
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_approved', true)
      .order('name');

    if (error) {
      approvedCategoriesCache = { data: [], timestamp: Date.now(), isError: true };
      return [];
    }
    const categories = ((data || []) as any[]).map((cat) => {
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
    approvedCategoriesCache = { data: categories, timestamp: Date.now(), isError: false };
    return categories;
  } catch {
    approvedCategoriesCache = { data: [], timestamp: Date.now(), isError: true };
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
      const dummyProducts = await getDesignBoardDummyProducts();
      return categories.map((cat) => ({
        ...cat,
        product_count: dummyProducts.filter((p) => p.category?.slug === cat.slug).length,
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
        const dummyProducts = await getDesignBoardDummyProducts();
        return categories.map((cat) => ({
          ...cat,
          product_count: dummyProducts.filter((p) => p.category?.slug === cat.slug).length,
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
    clearProductCache();
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
    clearProductCache();
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

  if (!supabase) {
    clearProductCache();
    return true;
  }
  try {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) {
      console.warn('Rablo: Delete product database warning:', error);
    }
    clearProductCache();
    return true;
  } catch (err) {
    console.warn('Rablo: Delete product exception:', err);
    clearProductCache();
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
  const dummyProducts = demoActive ? await getDesignBoardDummyProducts() : [];
  const activeDummies = demoActive
    ? dummyProducts.filter((p) => !deletedIds.includes(p.id))
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
  if (!error) clearProductCache();
  return !error;
}

/** Reject a product with feedback (admin) */
export async function rejectProduct(productId: string, feedback: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('products')
    .update({ approval_status: 'Rejected', rejection_feedback: feedback, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (!error) clearProductCache();
  return !error;
}

export { extractInstagramHandle } from './instagram';

