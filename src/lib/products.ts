/**
 * RABLO — Product Query Operations
 * Fetch, filter, and manage products from Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { validateInstagramOwnership, canonicalizeInstagramUrl } from './instagram';

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
  thumbnail_url: string | null;
  gallery_urls: string[];
  approval_status: 'Pending' | 'Approved' | 'Rejected';
  rejection_feedback: string | null;
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string; slug: string };
  seller?: { full_name: string; avatar_url: string; instagram_url: string };
  bulk_orders?: boolean;
  international_export?: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_approved: boolean;
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
  };
}

/** Fetch approved products with optional category filter */
export async function getApprovedProducts(categorySlug?: string): Promise<Product[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const isFiltered = Boolean(categorySlug && categorySlug !== 'all');
    const categoryJoin = isFiltered
      ? 'category:categories!inner( id, name, slug )'
      : 'category:categories( id, name, slug )';

    let query = supabase
      .from('products')
      .select(`
        *,
        ${categoryJoin},
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
      // Resilient fallback query if join or relationship has custom naming
      const { data: fallback, error: fallbackError } = await supabase
        .from('products')
        .select('*')
        .eq('approval_status', 'Approved')
        .order('created_at', { ascending: false });

      if (fallbackError) {
        console.error('Rablo: Products fallback fetch error:', fallbackError);
        return [];
      }
      return ((fallback || []) as Product[]).map(enrichProductWithOptions);
    }

    return ((data || []) as Product[]).map(enrichProductWithOptions);
  } catch (err) {
    console.error('Rablo: Error fetching approved products:', err);
    return [];
  }
}

/** Fetch a single product by ID */
export async function getProductById(id: string): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
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

      return fallback ? enrichProductWithOptions(fallback as Product) : null;
    }
    return enrichProductWithOptions(data as Product);
  } catch {
    return null;
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
    return (data || []) as Category[];
  } catch {
    return [];
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
  thumbnail_url?: string;
  gallery_urls?: string[];
  bulk_orders?: boolean;
  international_export?: boolean;
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
        thumbnail_url: product.thumbnail_url || null,
        gallery_urls: product.gallery_urls || [],
        seller_id: session.user.id,
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
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    let query = supabase
      .from('products')
      .select(`
        *,
        category:categories ( id, name, slug ),
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
      if (fallbackError) return [];
      return ((fallback || []) as Product[]).map(enrichProductWithOptions);
    }
    return ((data || []) as Product[]).map(enrichProductWithOptions);
  } catch {
    return [];
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
  let cleaned = urlOrHandle.trim();
  cleaned = cleaned.replace(/\/+$/, '');
  const match = cleaned.match(/(?:instagram\.com\/|@)?([a-zA-Z0-9._]+)/);
  if (match && match[1]) {
    const handle = match[1];
    if (handle !== 'p' && handle !== 'reel' && handle !== 'tv') {
      return `@${handle}`;
    }
  }
  return cleaned.startsWith('@') ? cleaned : `@${cleaned}`;
}

