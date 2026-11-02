import React, { useState, useEffect } from 'react';
import { getCartItems, removeFromCart, trackCartClick, type CartItem } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ShoppingBag, ExternalLink, Trash2, CheckCircle2, MessageCircle } from 'lucide-react';

export const CartView: React.FC = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchCart = async () => {
    setLoading(true);
    try {
      const cartItems = await getCartItems();
      setItems(cartItems);
    } catch (err) {
      console.error('Failed to load cart items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchCart();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        fetchCart();
      } else {
        setItems([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleRemove = async (itemId: string, productName: string) => {
    const success = await removeFromCart(itemId);
    if (success) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
      window.dispatchEvent(new CustomEvent('rablo:cart-updated'));
      setToastMessage(`Removed "${productName}" from your cart.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleInstagramClick = async (item: CartItem) => {
    const targetUrl = item.product?.product_ig_url || item.product?.seller_ig_url;
    if (!targetUrl) return;

    window.open(targetUrl, '_blank', 'noopener,noreferrer');

    try {
      const result = await trackCartClick(item.id);
      if (result.deleted) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        window.dispatchEvent(new CustomEvent('rablo:cart-updated'));
        setToastMessage(`Item "${item.product?.name}" auto-removed after 5 DM visits!`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, click_count: result.click_count } : i))
        );
      }
    } catch (err) {
      console.error('Failed to track click:', err);
    }
  };

  const totalEstimated = items.reduce((sum, item) => sum + (item.product?.price || 0), 0);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-charcoal-500">Loading your saved items...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm">
        <div className="w-12 h-12 rounded-full bg-lavender-100 text-lavender-700 mx-auto flex items-center justify-center mb-4">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-display font-medium text-charcoal-900 mb-2">
          Sign In to Access Your Cart
        </h2>
        <p className="text-xs text-charcoal-600 mb-6 leading-relaxed">
          Connect via Google to save creator leads, review seller profiles, and launch direct DM chats.
        </p>
        <a href="/account?redirect=/cart" className="btn-primary">
          Sign In with Google ↗
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-charcoal-900 text-ivory-100 px-5 py-3 rounded-sm shadow-soft-lg z-50 text-xs font-medium flex items-center gap-2 border border-charcoal-700/50">
          <CheckCircle2 className="w-4 h-4 text-sage-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm">
          <p className="text-base font-display font-medium text-charcoal-900 mb-2">
            Your Lead Cart is Empty
          </p>
          <p className="text-xs text-charcoal-600 max-w-sm mx-auto mb-6 leading-relaxed">
            Discover curated handmade fashion, art, crochet, and crafts in our catalog.
          </p>
          <a href="/catalog" className="btn-primary">
            Explore Catalog ↗
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm">
            <div>
              <h2 className="text-lg font-display font-medium text-charcoal-900">
                Saved Creator Leads ({items.length})
              </h2>
              <p className="text-xs text-charcoal-600">
                Tap "Chat on Instagram" to contact the maker directly (auto-removes at 5 clicks).
              </p>
            </div>
            <div className="sm:text-right">
              <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
                Estimated Total
              </span>
              <span className="text-xl font-bold text-charcoal-900">
                ₹{totalEstimated}
              </span>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-4">
            {items.map((item) => {
              const product = item.product;
              const clicksLeft = Math.max(0, 5 - (item.click_count || 0));

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 bg-ivory-100 border border-charcoal-800/10 rounded-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 shadow-soft"
                >
                  {/* Thumbnail in CUMID art stage */}
                  <div className="w-20 h-20 bg-[#eee9e1] rounded-sm overflow-hidden flex-shrink-0 flex items-center justify-center p-2">
                    {product?.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-charcoal-400 font-serif">✦</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-charcoal-500 mb-1">
                      <span>Seller:</span>
                      <span className="font-semibold text-charcoal-800">
                        {product?.seller?.full_name || 'Verified Creator'}
                      </span>
                    </div>

                    <h3 className="font-display font-medium text-base text-charcoal-900 mb-1 truncate">
                      <a href={`/products/${product?.id || item.product_id}`} className="hover:text-lavender-700">
                        {product?.name || 'Catalog Item'}
                      </a>
                    </h3>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-bold text-charcoal-900">
                        ₹{product?.price || 0}
                      </span>
                      <span className="text-charcoal-400">•</span>
                      <span className="text-[11px] text-charcoal-500 font-mono">
                        {item.click_count || 0}/5 clicks ({clicksLeft} left)
                      </span>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-charcoal-800/10">
                    <button
                      type="button"
                      onClick={() => handleInstagramClick(item)}
                      className="btn-primary py-2.5 px-4 text-xs inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-sage-300" />
                      <span>Chat on Instagram</span>
                      <ExternalLink className="w-3 h-3 opacity-60" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.id, product?.name || 'item')}
                      className="p-2.5 rounded-sm border border-charcoal-800/15 text-charcoal-500 hover:text-red-700 hover:bg-ivory-300 transition-colors"
                      title="Remove from Cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CUMID Info Strip */}
          <div className="p-4 bg-ivory-50 border border-charcoal-800/10 rounded-sm text-xs text-charcoal-600 leading-relaxed">
            <p className="font-semibold text-charcoal-900 mb-1">
              Direct-to-DM Discovery:
            </p>
            <p>
              Rablo is a zero-commission catalog. When you click <strong>Chat on Instagram</strong>, you are redirected to the seller's Instagram DM to discuss customizations, shipping addresses, and direct payments without middleman markups.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartView;
