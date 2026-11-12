import React, { useState, useEffect } from 'react';
import { getCartItems, removeFromCart, trackCartClick, type CartItem } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { executeContactAction } from '../../lib/useContactAction';
import { extractInstagramHandle } from '../../lib/products';
import { AuthModal } from './AuthModal';
import { ShoppingBag, ExternalLink, Trash2, CheckCircle2, MessageCircle } from 'lucide-react';

export const CartView: React.FC = () => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalData, setAuthModalData] = useState<{
    url?: string;
    creatorName?: string;
    productName?: string;
  }>({});

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

  const handleContactClick = async (item: CartItem) => {
    if (!item.product) return;

    const result = await executeContactAction({
      product: item.product as any,
      sellerName: item.product.seller?.full_name,
      fallbackUrl: item.product.contact_link || item.product.product_ig_url || item.product.seller_ig_url,
      onToast: (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
      },
    });

    if (result.status === 'opened') {
      try {
        const trackRes = await trackCartClick(item.id);
        if (trackRes.deleted) {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          window.dispatchEvent(new CustomEvent('rablo:cart-updated'));
          setToastMessage(`Item "${item.product?.name}" auto-removed after 5 DM visits!`);
          setTimeout(() => setToastMessage(null), 4000);
        } else {
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, click_count: trackRes.click_count } : i))
          );
        }
      } catch (err) {
        console.error('Failed to track click:', err);
      }
    } else if (result.status === 'auth_required') {
      setAuthModalData({
        url: result.url,
        creatorName: item.product.seller?.full_name || 'Verified Creator',
        productName: item.product.name,
      });
      setAuthModalOpen(true);
    }
  };

  const totalEstimated = items.reduce((sum, item) => sum + (item.product?.price || 0), 0);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-2 border-[#9E4A2B] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-[#685950]">Loading your saved items...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-4">
        <div className="w-14 h-14 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-display font-bold text-[#30251F]">
          Sign In to Access Your Lead Cart
        </h2>
        <p className="text-xs text-[#685950] max-w-sm mx-auto leading-relaxed">
          Connect via Google to save artisan creator leads, review seller profiles, and launch direct chats.
        </p>
        <div className="pt-2">
          <a
            href="/account?redirect=/cart"
            className="inline-block px-6 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-soft-sm transition-all"
          >
            Sign In with Google &rarr;
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3 rounded-2xl shadow-soft-lg z-50 text-xs font-medium flex items-center gap-2 border border-[#30251F]/20">
          <CheckCircle2 className="w-4 h-4 text-[#637B58]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen 6 Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#30251F]/10">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#30251F]">
            Your Lead Cart
          </h1>
          <p className="text-xs sm:text-sm text-[#685950] mt-1">
            Saved products to explore and discuss with creators.
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#9E4A2B] border border-[#9E4A2B]/20">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <p className="text-base font-display font-medium text-[#30251F]">
            Your Lead Cart is Empty
          </p>
          <p className="text-xs text-[#685950] max-w-sm mx-auto leading-relaxed">
            Discover curated handmade fashion, art, crochet, and crafts in our catalog.
          </p>
          <a
            href="/catalog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-sm transition-all"
          >
            Explore Products &rarr;
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Items List (Screen 6) */}
          <div className="space-y-3">
            {items.map((item) => {
              const product = item.product;
              const brandSlug = product?.brand?.slug;
              const brandHandle = brandSlug
                ? `@${brandSlug}`
                : extractInstagramHandle(product?.seller_ig_url || product?.seller?.instagram_url) || '@creator';

              const isWhatsApp = Boolean(
                product?.contact_link && /wa\.me|whatsapp\.com/i.test(product.contact_link)
              );
              const contactBtnLabel = isWhatsApp ? 'Chat on WhatsApp' : 'Contact on Instagram';

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-soft-sm hover:shadow-soft transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Thumbnail */}
                    <a
                      href={`/products/${product?.id || item.product_id}`}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-[#EFE9DF] rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center p-1.5 border border-[#30251F]/5 block hover:opacity-90 transition-opacity"
                    >
                      {product?.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <span className="text-[#8A7A70] font-serif text-lg">✦</span>
                      )}
                    </a>

                    {/* Details */}
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-sm sm:text-base text-[#30251F] truncate mb-0.5">
                        <a
                          href={`/products/${product?.id || item.product_id}`}
                          className="hover:text-[#9E4A2B] transition-colors"
                        >
                          {product?.name || 'Catalog Item'}
                        </a>
                      </h3>

                      <p className="text-xs text-[#685950] mb-1">
                        by{' '}
                        {brandSlug ? (
                          <a
                            href={`/creators/${brandSlug}`}
                            className="font-medium text-[#9E4A2B] hover:underline"
                          >
                            {brandHandle}
                          </a>
                        ) : (
                          <span className="font-medium text-[#30251F]">{brandHandle}</span>
                        )}
                      </p>

                      <div className="text-sm font-bold text-[#30251F]">
                        ₹{product?.price || 0}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Screen 6: Contact Button + Trash) */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-0 border-[#30251F]/10">
                    <button
                      type="button"
                      onClick={() => handleContactClick(item)}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-full text-xs font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{contactBtnLabel}</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemove(item.id, product?.name || 'item')}
                      className="p-2.5 rounded-full border border-[#30251F]/15 text-[#8A7A70] hover:text-red-700 hover:bg-[#EBE3D7] transition-colors cursor-pointer"
                      title="Remove from Cart"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Info Summary Note */}
          <div className="p-4 bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl flex items-center justify-between text-xs text-[#685950]">
            <span>Estimated Cart Total:</span>
            <span className="font-bold text-base text-[#30251F]">₹{totalEstimated}</span>
          </div>
        </div>
      )}

      {/* Global Auth Modal for Lead Cart */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          targetUrl={authModalData.url}
          creatorName={authModalData.creatorName}
          productName={authModalData.productName}
        />
      )}
    </div>
  );
};

export default CartView;
