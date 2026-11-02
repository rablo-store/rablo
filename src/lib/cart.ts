/**
 * RABLO — Cart Operations
 * Handles add/remove/fetch cart items and the 5-click removal rule.
 */

import { supabase, isSupabaseConfigured } from './supabase';

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  click_count: number;
  added_at: string;
  // Joined product data
  product?: {
    id: string;
    name: string;
    description: string;
    price: number;
    thumbnail_url: string;
    seller_ig_url: string;
    product_ig_url: string;
    seller?: {
      full_name: string;
      instagram_url: string;
    };
  };
}

/** Fetch all cart items for the current user, with product details */
export async function getCartItems(): Promise<CartItem[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products (
          id, name, description, price, thumbnail_url,
          seller_ig_url, product_ig_url,
          seller:profiles!products_seller_id_fkey ( full_name, instagram_url )
        )
      `)
      .eq('user_id', session.user.id)
      .order('added_at', { ascending: false });

    if (error) {
      console.warn('Rablo: Cart items with nested join failed, trying fallback select:', error);
      const { data: fallback, error: fallbackError } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products (*)
        `)
        .eq('user_id', session.user.id)
        .order('added_at', { ascending: false });

      if (fallbackError) {
        console.error('Rablo: Fallback cart fetch error:', fallbackError);
        return [];
      }
      return (fallback || []) as CartItem[];
    }
    return (data || []) as CartItem[];
  } catch (err) {
    console.error('Rablo: Error fetching cart:', err);
    return [];
  }
}

/** Add a product to the cart */
export async function addToCart(productId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { success: false, error: 'Database not configured' };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false, error: 'Please sign in to save items to your cart' };

    // Defensively ensure profile exists before cart insertion
    const userEmail = session.user.email || '';
    const userName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'Shopper';
    const userAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '';

    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email: userEmail,
        full_name: userName,
        avatar_url: userAvatar,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (profileError) {
        console.warn('Rablo: Profile upsert for cart warning:', profileError);
      }
    } catch (profErr) {
      console.warn('Rablo: Profile upsert for cart exception:', profErr);
    }

    const { error } = await supabase
      .from('cart_items')
      .upsert(
        { user_id: session.user.id, product_id: productId, click_count: 0 },
        { onConflict: 'user_id,product_id' }
      );

    if (error) {
      if (error.code === '23505') return { success: true }; // Already in cart
      console.error('Rablo: Cart insert error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('Rablo: addToCart unexpected error:', err);
    return { success: false, error: err.message || 'Could not add item to cart.' };
  }
}

/** Remove a product from the cart */
export async function removeFromCart(cartItemId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);
    return !error;
  } catch {
    return false;
  }
}

/** Get cart count for the current user */
export async function getCartCount(): Promise<number> {
  if (!isSupabaseConfigured || !supabase) return 0;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 0;

    const { count, error } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

/**
 * Track an outbound IG link click for a cart item.
 * Calls Supabase RPC to increment click_count.
 * Returns { deleted: true } if the item was auto-removed (5-click rule).
 */
export async function trackCartClick(cartItemId: string): Promise<{ click_count: number; deleted: boolean }> {
  if (!isSupabaseConfigured || !supabase) return { click_count: 0, deleted: false };
  try {
    const { data, error } = await supabase.rpc('increment_cart_click', {
      p_cart_item_id: cartItemId,
    });

    if (error) {
      console.error('Rablo: Click tracking error:', error);
      return { click_count: 0, deleted: false };
    }

    return {
      click_count: data?.click_count || 0,
      deleted: data?.deleted === true,
    };
  } catch {
    return { click_count: 0, deleted: false };
  }
}

/** Check if a product is in the user's cart */
export async function isInCart(productId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    const { data } = await supabase
      .from('cart_items')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('product_id', productId)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}
