/**
 * RABLO — Product Query Operations
 * Fetch, filter, and manage products from Supabase.
 */

import { supabase, isSupabaseConfigured } from './supabase';

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
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_approved: boolean;
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
      .order('created_at', { ascending: false })
      .limit(1000);

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
        .order('created_at', { ascending: false })
        .limit(1000);

      if (fallbackError) {
        console.error('Rablo: Products fallback fetch error:', fallbackError);
        return [];
      }
      return (fallback || []) as Product[];
    }

    return (data || []) as Product[];
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

      return (fallback as Product) || null;
    }
    return data as Product;
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
      return (fallback || []) as Product[];
    }
    return (data || []) as Product[];
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
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Database not configured' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false, error: 'User session not found. Please sign in again.' };

    // Defensively ensure creator profile exists before product insertion
    const userEmail = session.user.email || '';
    const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Instagram Creator';
    const userAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';

    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email: userEmail,
        full_name: userName,
        avatar_url: userAvatar,
        instagram_url: product.seller_ig_url,
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

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: product.name,
        description: product.description,
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
      return (fallback || []) as Product[];
    }
    return (data || []) as Product[];
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
