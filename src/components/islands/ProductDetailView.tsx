import React, { useState, useEffect } from 'react';
import { getProductById, type Product, extractInstagramHandle } from '../../lib/products';
import { canonicalizeInstagramUrl, getSafeInstagramUrl } from '../../lib/instagram';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ShoppingBag, ExternalLink, Check, MessageCircle, ArrowLeft, Lock } from 'lucide-react';
import { AuthModal } from './AuthModal';

interface Props {
  productId: string;
}

export const ProductDetailView: React.FC<Props> = ({ productId }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [inCart, setInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingIgTarget, setPendingIgTarget] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    // Immediately check session without waiting for product load
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isMounted) setIsLoggedIn(Boolean(session?.user));
      }).catch(() => {});
    }

    async function load() {
      setLoading(true);
      try {
        const prod = await getProductById(productId);
        if (!isMounted) return;
        setProduct(prod);
        if (prod?.thumbnail_url) {
          setSelectedImage(prod.thumbnail_url);
        }

        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (isMounted) setIsLoggedIn(Boolean(session?.user));

          const inC = await isInCart(productId);
          if (isMounted) setInCart(inC);
        }
      } catch (err) {
        console.error('Failed to load product detail:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isMounted) setIsLoggedIn(Boolean(session?.user));
      });
      if (productId) {
        load();
      }
      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else if (productId) {
      load();
      return () => {
        isMounted = false;
      };
    }
  }, [productId]);

  const handleGoToInstagram = async (targetUrl?: string | null) => {
    const rawTarget =
      targetUrl ||
      product?.product_ig_url ||
      product?.seller_ig_url ||
      product?.seller?.instagram_url;
    const finalUrl = getSafeInstagramUrl(rawTarget) || canonicalizeInstagramUrl(rawTarget) || 'https://instagram.com';

    let authenticated = isLoggedIn;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        authenticated = Boolean(session?.user);
        setIsLoggedIn(authenticated);
      } catch {}
    }

    if (!authenticated) {
      setPendingIgTarget(finalUrl);
      setAuthModalOpen(true);
      return;
    }
    window.open(finalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAddToCart = async () => {
    if (!isSupabaseConfigured || !supabase) {
      window.location.href = `/account?redirect=/products/${productId}`;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.href = `/account?redirect=/products/${productId}`;
      return;
    }

    setAddingToCart(true);
    const res = await addToCart(productId);
    setAddingToCart(false);

    if (res.success) {
      setInCart(true);
      setToastMessage('Added to your Lead Cart');
      window.dispatchEvent(new CustomEvent('rablo:cart-updated'));
      setTimeout(() => setToastMessage(null), 3000);
    } else {
      setToastMessage(res.error || 'Failed to add to cart.');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-charcoal-500">Loading creator details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm">
        <p className="text-base font-display font-medium text-charcoal-900 mb-2">
          Creation Not Found
        </p>
        <p className="text-xs text-charcoal-600 mb-6 leading-relaxed">
          This product might be awaiting admin moderation or may have been removed.
        </p>
        <a href="/catalog" className="btn-primary">
          Back to Catalog
        </a>
      </div>
    );
  }

  const allImages = [
    ...(product.thumbnail_url ? [product.thumbnail_url] : []),
    ...(product.gallery_urls || []),
  ];

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-charcoal-900 text-ivory-100 px-5 py-3 rounded-sm shadow-soft-lg z-50 text-xs font-medium flex items-center gap-2 border border-charcoal-700/50">
          <Check className="w-4 h-4 text-sage-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Back Link */}
      <div>
        <a
          href="/catalog"
          className="inline-flex items-center gap-1.5 text-xs text-charcoal-600 hover:text-lavender-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Discovery Catalog</span>
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* Left: CUMID Art Stage Gallery */}
        <div className="space-y-4">
          <div className="bg-[#eee9e1] aspect-square rounded-sm overflow-hidden p-8 sm:p-12 flex items-center justify-center relative shadow-soft">
            {selectedImage ? (
              <img
                src={selectedImage}
                alt={product.name}
                className="w-full h-full object-contain rounded-sm"
              />
            ) : (
              <span className="text-charcoal-400 font-serif text-5xl">✦</span>
            )}

            {product.category && (
              <div className="absolute top-4 left-4">
                <span className="badge-preview">
                  {product.category.name}
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 rounded-sm overflow-hidden bg-[#eee9e1] p-1 border transition-all flex-shrink-0 ${
                    selectedImage === img
                      ? 'border-lavender-600 ring-2 ring-lavender-600/30'
                      : 'border-charcoal-800/15 hover:border-charcoal-800/40'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Meta & Purchase Routing */}
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="eyebrow !mb-2">
              {product.category?.name || 'Handmade Creation'}
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-medium text-charcoal-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            <div className="text-2xl font-bold text-charcoal-900 pt-2">
              ₹{product.price}
            </div>

            {(product.bulk_orders || product.international_export) && (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {product.bulk_orders && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#7C0E44]/10 text-[#7C0E44] border border-[#7C0E44]/25 text-xs font-semibold rounded-full">
                    <Check className="w-3.5 h-3.5 text-[#7C0E44]" />
                    <span>Bulk orders</span>
                  </span>
                )}
                {product.international_export && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#7C0E44]/10 text-[#7C0E44] border border-[#7C0E44]/25 text-xs font-semibold rounded-full">
                    <Check className="w-3.5 h-3.5 text-[#7C0E44]" />
                    <span>International Export</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="text-sm text-charcoal-700 leading-relaxed whitespace-pre-line border-t border-b border-charcoal-800/10 py-5">
            {product.description}
          </div>

          {/* Order Details: Bulk orders & International Export */}
          {(product.bulk_orders || product.international_export) && (
            <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm space-y-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-charcoal-700 block">
                Order & Shipping Details
              </span>
              <div className="space-y-1.5 text-xs">
                {product.bulk_orders && (
                  <div className="flex items-center gap-2 text-charcoal-800">
                    <span className="w-2 h-2 rounded-full bg-[#7C0E44]"></span>
                    <span className="font-semibold text-charcoal-900">Bulk orders:</span>
                    <span>Available</span>
                  </div>
                )}
                {product.international_export && (
                  <div className="flex items-center gap-2 text-charcoal-800">
                    <span className="w-2 h-2 rounded-full bg-[#7C0E44]"></span>
                    <span className="font-semibold text-charcoal-900">International Export:</span>
                    <span>Available</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Verified Creator Card */}
          <div className="p-4 bg-ivory-100 border border-charcoal-800/10 rounded-sm flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-charcoal-500 block">
                Instagram Creator
              </span>
              <span className="font-semibold text-charcoal-900 text-sm">
                {product.seller?.full_name || 'Verified Creator'}
              </span>
            </div>

            {isLoggedIn ? (
              <a
                href={canonicalizeInstagramUrl(product.seller_ig_url || product.product_ig_url) || 'https://instagram.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-[#7C0E44] hover:underline inline-flex items-center gap-1.5"
                title="View creator's Instagram profile"
              >
                <span>{extractInstagramHandle(product.seller_ig_url || product.product_ig_url) || 'View Profile'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleGoToInstagram(product.seller_ig_url || product.product_ig_url)}
                className="text-xs font-medium text-[#7C0E44] hover:bg-[#7C0E44]/15 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7C0E44]/10 transition-colors cursor-pointer"
                title="Sign in to view creator's Instagram ID"
              >
                <Lock className="w-3 h-3 text-[#7C0E44]" />
                <span>Sign in to view Insta ID</span>
              </button>
            )}
          </div>

          {/* CTA Buttons in CUMID Layout */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => handleGoToInstagram(product.product_ig_url || product.seller_ig_url)}
              className="btn-primary w-full py-4 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              aria-label={isLoggedIn ? "Chat on Instagram" : "Sign in to view Insta ID and chat on Instagram"}
            >
              {isLoggedIn ? (
                <>
                  <MessageCircle className="w-4 h-4 text-sage-300" />
                  <span>Chat on Instagram</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#FBE4EE]" />
                  <span>Sign in to view Insta ID and Chat on Instagram</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addingToCart || inCart}
              className={`w-full py-3.5 text-xs font-semibold rounded-sm border transition-colors flex items-center justify-center gap-2 ${
                inCart
                  ? 'bg-sage-100 text-sage-700 border-sage-300 cursor-default'
                  : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-800 border-charcoal-800/20'
              }`}
            >
              {inCart ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved in Your Lead Cart</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>{addingToCart ? 'Saving...' : 'Save to Lead Cart'}</span>
                </>
              )}
            </button>
          </div>

          {/* Format Note */}
          <div className="pt-2 text-xs text-charcoal-500 leading-relaxed">
            <p>
              Direct transaction guarantee: Zero platform commissions. You speak directly with the creator on Instagram to confirm colors, dimensions, and shipping.
            </p>
          </div>
        </div>
      </div>

      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          targetUrl={pendingIgTarget}
          creatorName={product?.seller?.full_name || 'Verified Creator'}
          productName={product?.name}
        />
      )}
    </div>
  );
};

export default ProductDetailView;
