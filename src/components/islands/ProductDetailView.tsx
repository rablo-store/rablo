import React, { useState, useEffect } from 'react';
import { getProductById, type Product, extractInstagramHandle } from '../../lib/products';
import { getSafeInquiryUrl } from '../../lib/instagram';
import { sanitizeContactUrl } from '../../lib/contact';
import { executeContactAction } from '../../lib/useContactAction';
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
    const result = await executeContactAction({
      product,
      sellerName: product?.seller?.full_name,
      fallbackUrl: targetUrl,
      onToast: (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
      },
    });

    if (result.status === 'auth_required') {
      setPendingIgTarget(result.url || '');
      setAuthModalOpen(true);
    }
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

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-[#685950]" aria-label="Breadcrumb">
        <a href="/" className="hover:text-[#9E4A2B] transition-colors">Home</a>
        <span>&gt;</span>
        <a href="/catalog" className="hover:text-[#9E4A2B] transition-colors">Products</a>
        <span>&gt;</span>
        <span className="text-[#30251F] font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Gallery with Vertical Thumbnails & Main Preview (Screen 3) */}
        <div className="lg:col-span-7 flex flex-col-reverse sm:flex-row gap-4 items-start">
          {/* Vertical Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex sm:flex-col gap-3 overflow-x-auto sm:overflow-y-auto sm:max-h-[500px] pb-2 sm:pb-0 flex-shrink-0">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-[#EFE9DF] p-1 border-2 transition-all flex-shrink-0 cursor-pointer ${
                    selectedImage === img
                      ? 'border-[#9E4A2B] ring-2 ring-[#9E4A2B]/20'
                      : 'border-transparent hover:border-[#30251F]/20'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                </button>
              ))}
            </div>
          )}

          {/* Main Stage Image */}
          <div className="flex-1 w-full space-y-3">
            <div className="bg-[#EFE9DF] aspect-square rounded-3xl overflow-hidden p-6 sm:p-10 flex items-center justify-center relative shadow-soft border border-[#30251F]/5">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.name}
                  className="w-full h-full object-contain transition-transform duration-300 hover:scale-102"
                />
              ) : (
                <span className="text-[#8A7A70] font-serif text-5xl">✦</span>
              )}

              {product.category && (
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FAF6F0]/90 text-[#30251F] backdrop-blur-xs border border-[#30251F]/10 shadow-xs">
                    {product.category.name}
                  </span>
                </div>
              )}
            </div>

            {/* Pagination Dots Indicator */}
            {allImages.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedImage(img)}
                    className={`h-2 rounded-full transition-all ${
                      selectedImage === img ? 'w-6 bg-[#9E4A2B]' : 'w-2 bg-[#30251F]/20'
                    }`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Product Details & Purchase Actions (Screen 3) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full overflow-hidden bg-[#EFE9DF] border border-[#30251F]/10 flex-shrink-0">
                {product.seller?.avatar_url || product.brand?.logo_url ? (
                  <img
                    src={product.seller?.avatar_url || product.brand?.logo_url || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-[#9E4A2B]">
                    {(product.brand?.name || product.seller?.full_name || 'C').charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-xs text-[#685950]">by</span>
              {product.brand?.slug ? (
                <a
                  href={`/creators/${product.brand.slug}`}
                  className="text-xs font-semibold text-[#9E4A2B] hover:underline"
                >
                  @{product.brand.slug}
                </a>
              ) : (
                <span className="text-xs font-semibold text-[#30251F]">
                  {extractInstagramHandle(product.seller_ig_url) || product.seller?.full_name || 'Verified Creator'}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-[#30251F] tracking-tight leading-tight">
              {product.name}
            </h1>

            <div className="text-2xl sm:text-3xl font-bold text-[#30251F] pt-1">
              ₹{product.price}
            </div>

            {/* Tags (Screen 3: Handmade, Made to Order) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EFE9DF] text-[#685950]">
                Handmade
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#EFE9DF] text-[#685950]">
                Made to Order
              </span>
              {product.bulk_orders && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#9E4A2B]/10 text-[#9E4A2B]">
                  Bulk orders
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="text-xs sm:text-sm text-[#685950] leading-relaxed whitespace-pre-line border-t border-b border-[#30251F]/10 py-4">
            {product.description}
          </div>

          {/* Verified Creator Card */}
          <div className="p-4 bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#8A7A70] block font-semibold">
                Creator Profile
              </span>
              <span className="font-semibold text-[#30251F] text-sm">
                {product.brand?.name || product.seller?.full_name || 'Verified Creator'}
              </span>
              {product.contact_link && (
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#9E4A2B] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9E4A2B]"></span>
                  <span>Direct Chat Inquiry Enabled</span>
                </div>
              )}
            </div>

            {isLoggedIn ? (
              <a
                href={sanitizeContactUrl(product.contact_link || product.seller_ig_url || product.product_ig_url) || getSafeInquiryUrl(product.contact_link || product.seller_ig_url || product.product_ig_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#9E4A2B] hover:underline inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#9E4A2B]/10"
                title={product.contact_link ? "Open direct inquiry chat" : "View creator's Instagram profile"}
              >
                <span>{product.contact_link ? "Direct Chat" : (extractInstagramHandle(product.seller_ig_url || product.product_ig_url) || 'View Profile')}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleGoToInstagram(product.contact_link || product.seller_ig_url || product.product_ig_url)}
                className="text-xs font-semibold text-[#9E4A2B] hover:bg-[#9E4A2B]/15 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#9E4A2B]/10 transition-colors cursor-pointer"
                title={product.contact_link ? "Sign in to chat directly" : "Sign in to view creator's Instagram ID"}
              >
                <Lock className="w-3 h-3 text-[#9E4A2B]" />
                <span>{product.contact_link ? "Sign in to Chat" : "Sign in to view Insta ID"}</span>
              </button>
            )}
          </div>

          {/* Action CTAs: Save to Lead Cart + Contact on Instagram (Screen 3) */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={addingToCart || inCart}
              className={`w-full py-3.5 px-4 text-xs sm:text-sm font-semibold rounded-full border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                inCart
                  ? 'bg-[#E8EDE6] text-[#637B5B] border-[#637B5B]/30 cursor-default'
                  : 'bg-[#FAF6F0] hover:bg-[#EBE3D7] text-[#30251F] border-[#30251F]/15 shadow-xs'
              }`}
            >
              {inCart ? (
                <>
                  <Check className="w-4 h-4 text-[#637B5B]" />
                  <span>Saved in Your Lead Cart</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 text-[#30251F]" />
                  <span>{addingToCart ? 'Saving...' : 'Save to Lead Cart'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleGoToInstagram(product.contact_link || product.product_ig_url || product.seller_ig_url)}
              className="w-full py-4 px-6 text-sm sm:text-base font-semibold rounded-full transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0]"
              aria-label={
                product.contact_link
                  ? (isLoggedIn ? "Contact / Chat with Creator" : "Sign in to Contact / Chat with Creator")
                  : (isLoggedIn ? "Contact on Instagram" : "Sign in to view Insta ID and chat on Instagram")
              }
            >
              <MessageCircle className="w-4 h-4 text-[#FAF6F0]" />
              <span>
                {product.contact_link
                  ? (isLoggedIn ? "Contact / Chat with Creator" : "Sign in to Contact / Chat with Creator")
                  : (isLoggedIn ? "Contact on Instagram" : "Sign in to view Insta ID and chat on Instagram")}
              </span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            <p className="text-center text-[11px] text-[#685950] pt-1">
              You'll be redirected to the creator's chat to discuss the purchase.
            </p>
          </div>

          {/* Specifications Table (Screen 3: Product Details) */}
          {(() => {
            const attrs = product.attributes || {};
            const material = attrs.Material || attrs.material;
            const size = attrs.Size || attrs.size;
            const type = attrs.Type || attrs.type;
            const availability = attrs.Availability || attrs.availability;

            const detailRows = [
              { label: 'Material', value: material },
              { label: 'Size', value: size },
              { label: 'Type', value: type },
              { label: 'Availability', value: availability },
            ].filter((row) => Boolean(row.value && String(row.value).trim()));

            if (detailRows.length === 0) return null;

            return (
              <div className="p-5 bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl space-y-3">
                <h3 className="font-semibold text-xs sm:text-sm text-[#30251F] uppercase tracking-wider">
                  Product Details
                </h3>
                <div className="space-y-2 text-xs divide-y divide-[#30251F]/10">
                  {detailRows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between py-1.5">
                      <span className="text-[#685950]">{row.label}</span>
                      <span className="font-medium text-[#30251F]">{String(row.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          targetUrl={pendingIgTarget}
          creatorName={product?.brand?.name || product?.seller?.full_name || 'Verified Creator'}
          productName={product?.name}
        />
      )}
    </div>
  );
};

export default ProductDetailView;
