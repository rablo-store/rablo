import React, { useState, useEffect } from 'react';
import type { Brand } from '../../lib/brands';
import { getBrandBySlug, getBrandByInstagramHandle, getBrandProducts } from '../../lib/brands';
import type { Product } from '../../lib/products';
import { executeContactAction } from '../../lib/useContactAction';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { ProductCard } from '../ui/ProductCard';
import { AuthModal } from './AuthModal';
import {
  BadgeCheck,
  MessageCircle,
  ExternalLink,
  Check,
  Sparkles,
  Info,
  Calendar,
  Layers,
  AlertCircle,
} from 'lucide-react';

export interface BrandStoreViewProps {
  brand?: Brand | null;
  products?: Product[];
  slug?: string;
  error?: string | null;
}

export const BrandStoreView: React.FC<BrandStoreViewProps> = ({
  brand: initialBrand,
  products: initialProducts = [],
  slug,
  error: initialError,
}) => {
  const [brand, setBrand] = useState<Brand | null>(initialBrand || null);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [error, setError] = useState<string | null>(initialError || null);
  const [loading, setLoading] = useState(!initialBrand && Boolean(slug));
  const [notFound, setNotFound] = useState(false);

  const [activeTab, setActiveTab] = useState<'products' | 'about'>('products');
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [savingCartId, setSavingCartId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalData, setAuthModalData] = useState<{
    url?: string;
    creatorName?: string;
    productName?: string;
  }>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Client-side hydration and fallback loading if initialBrand not provided (e.g. dev/test mocks)
  useEffect(() => {
    let isMounted = true;
    if (!initialBrand && slug) {
      setLoading(true);
      (async () => {
        try {
          const b = await getBrandBySlug(slug);
          if (b && b.approval_status === 'Approved') {
            if (!isMounted) return;
            setBrand(b);
            try {
              const prods = await getBrandProducts(b.id);
              if (isMounted) setProducts(prods);
            } catch (err: any) {
              if (isMounted) setError(err?.message || 'Failed to load creations');
            }
          } else {
            // Check if slug is an Instagram handle of an approved brand
            const redirected = await getBrandByInstagramHandle(slug);
            if (redirected && redirected.approval_status === 'Approved') {
              window.location.replace(`/creators/${redirected.slug}`);
              return;
            }
            if (isMounted) setNotFound(true);
          }
        } catch {
          if (isMounted) setNotFound(true);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
    } else if (initialBrand) {
      setBrand(initialBrand);
      setProducts(initialProducts);
      setError(initialError || null);
      getBrandProducts(initialBrand.id)
        .then((prods) => {
          if (isMounted) {
            setProducts(prods);
            setError(null);
          }
        })
        .catch((err: any) => {
          if (isMounted) {
            setError(err?.message || 'Failed to load creations');
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [slug, initialBrand, initialProducts, initialError]);

  useEffect(() => {
    let isMounted = true;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isMounted) setIsLoggedIn(Boolean(session?.user));
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isMounted) setIsLoggedIn(Boolean(session?.user));
      });

      // Check which products are in cart
      Promise.all(
        products.map(async (p) => {
          const inC = await isInCart(p.id);
          return { id: p.id, inC };
        })
      ).then((results) => {
        if (isMounted) {
          const map: Record<string, boolean> = {};
          for (const r of results) {
            if (r.inC) map[r.id] = true;
          }
          setInCartMap(map);
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }
  }, [products]);

  const handleToggleCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!brand) return;

    if (!isSupabaseConfigured || !supabase) {
      window.location.href = `/account?redirect=/creators/${brand.slug}`;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.href = `/account?redirect=/creators/${brand.slug}`;
      return;
    }

    setSavingCartId(productId);
    const result = await addToCart(productId);
    setSavingCartId(null);

    if (result.success) {
      setInCartMap((prev) => ({ ...prev, [productId]: true }));
      setToastMessage('Saved to your Lead Cart');
      window.dispatchEvent(new CustomEvent('rablo:cart-updated'));
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      setToastMessage(result.error || 'Could not save to cart.');
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleBrandContactClick = async () => {
    if (!brand) return;
    const result = await executeContactAction({
      brand,
      sellerName: brand.name,
      fallbackUrl: brand.instagram_url,
      onToast: (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
      },
    });

    if (result.status === 'auth_required') {
      setAuthModalData({
        url: result.url,
        creatorName: brand.name,
      });
      setAuthModalOpen(true);
    }
  };

  const handleAuthRequired = (data: {
    url?: string;
    creatorName?: string;
    productName?: string;
  }) => {
    setAuthModalData(data);
    setAuthModalOpen(true);
  };

  if (loading) {
    return (
      <div className="w-full space-y-8 animate-pulse">
        <div className="h-56 bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10" />
        <div className="h-10 w-48 bg-[#FAF6F0] rounded-full" />
      </div>
    );
  }

  if (notFound || !brand) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center font-serif text-2xl font-bold">
          ✦
        </div>
        <h1 className="text-2xl font-display font-bold text-[#30251F]">
          Creator Not Found
        </h1>
        <p className="text-xs sm:text-sm text-[#685950] leading-relaxed">
          The creator profile <span className="font-semibold text-[#30251F]">"@{slug || ''}"</span> could not be found or is currently undergoing curation review.
        </p>
        <div className="pt-2">
          <a
            href="/creators"
            className="inline-block px-6 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] text-xs font-semibold shadow-soft-sm transition-all"
          >
            Explore Verified Creators &rarr;
          </a>
        </div>
      </div>
    );
  }

  const memberYear = brand.created_at
    ? new Date(brand.created_at).getFullYear()
    : 2026;

  return (
    <div className="w-full space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3.5 rounded-2xl shadow-soft-xl z-50 text-xs font-medium flex items-center gap-2.5 border border-[#30251F]/20 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-[#637B58]/20 text-[#637B58] flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero Header Card (Screen 4: Creator Profile) */}
      <section className="bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10 overflow-hidden shadow-soft-sm">
        {/* Banner Image */}
        <div className="h-44 sm:h-56 lg:h-64 w-full bg-[#EFE9DF] relative overflow-hidden">
          {brand.banner_url ? (
            <img
              src={brand.banner_url}
              alt={`${brand.name} Banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#D9A37B]/40 via-[#B87555]/30 to-[#637B58]/30 flex items-center justify-center">
              <span className="font-serif text-5xl text-[#8A7A70]/40">✦ ✦ ✦</span>
            </div>
          )}
        </div>

        {/* Profile Info Container with Overlapping Avatar */}
        <div className="px-6 sm:px-10 pb-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 -mt-14 sm:-mt-16 mb-6">
            {/* Circular Logo / Avatar */}
            <div className="relative">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-[#FAF6F0] border-4 border-[#FAF6F0] shadow-soft flex items-center justify-center">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#EFE9DF] flex items-center justify-center font-display text-3xl font-bold text-[#9E4A2B]">
                    {brand.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* CTAs (Mockup 4: Contact on Instagram + Instagram Profile) */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBrandContactClick}
                className="px-6 py-3 rounded-full bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] font-semibold text-xs sm:text-sm shadow-soft-sm hover:shadow-soft transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact on Instagram</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>

              <a
                href={brand.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-full bg-[#FAF6F0] hover:bg-[#EBE3D7] text-[#30251F] border border-[#30251F]/15 font-semibold text-xs sm:text-sm transition-all inline-flex items-center gap-1.5"
              >
                <span>Instagram Profile</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#685950]" />
              </a>
            </div>
          </div>

          {/* Identity & Bio */}
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#30251F] tracking-tight">
                {brand.name}
              </h1>
              {brand.is_verified && (
                <div
                  className="inline-flex items-center text-[#9E4A2B]"
                  title="Verified Creator"
                >
                  <BadgeCheck className="w-5 h-5 fill-[#9E4A2B]/10" />
                </div>
              )}
            </div>

            <p className="text-xs sm:text-sm font-semibold text-[#9E4A2B]">
              @{brand.slug}
            </p>

            {brand.tagline && (
              <p className="text-xs sm:text-sm text-[#685950] leading-relaxed">
                {brand.tagline}
              </p>
            )}

            {/* Stats Row (Screen 4: Products Count only - per anti-guessing rules) */}
            <div className="flex items-center gap-6 pt-3 border-t border-[#30251F]/10">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-base sm:text-lg text-[#30251F]">
                  {products.length}
                </span>
                <span className="text-xs text-[#685950]">Products</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs text-[#685950]">Type:</span>
                <span className="font-semibold text-xs text-[#30251F] capitalize">
                  {brand.creator_type === 'small_brand' ? 'Small Brand / Studio' : 'Individual Artisan'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Navigation (Screen 4: Products, About - NO Reviews tab per Step D) */}
      <div className="border-b border-[#30251F]/10">
        <nav className="flex items-center gap-8 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'border-[#9E4A2B] text-[#9E4A2B]'
                : 'border-transparent text-[#685950] hover:text-[#30251F]'
            }`}
          >
            Products ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'about'
                ? 'border-[#9E4A2B] text-[#9E4A2B]'
                : 'border-transparent text-[#685950] hover:text-[#30251F]'
            }`}
          >
            About Creator
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      {activeTab === 'products' ? (
        <div>
          {error ? (
            <div className="text-center py-16 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-base font-display font-medium text-[#30251F]">
                Unable to Load Creations
              </p>
              <p className="text-xs text-[#685950] max-w-sm mx-auto leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-block px-5 py-2.5 rounded-full bg-[#9E4A2B] text-[#FAF6F0] text-xs font-semibold hover:bg-[#843C22] transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 px-6 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#EFE9DF] text-[#9E4A2B] mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-base font-display font-medium text-[#30251F]">
                No Creations Listed Yet
              </p>
              <p className="text-xs text-[#685950] max-w-sm mx-auto leading-relaxed">
                {brand.name} is preparing unique handcrafted pieces for their storefront. Check back soon!
              </p>
              <a
                href="/catalog"
                className="inline-block px-5 py-2.5 rounded-full bg-[#9E4A2B] text-[#FAF6F0] text-xs font-semibold hover:bg-[#843C22] transition-colors"
              >
                Browse All Creators &rarr;
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {products.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  priority={idx < 4}
                  inCart={Boolean(inCartMap[product.id])}
                  isSavingCart={savingCartId === product.id}
                  isLoggedIn={isLoggedIn}
                  onToggleCart={handleToggleCart}
                  onToast={setToastMessage}
                  onAuthRequired={handleAuthRequired}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* About Tab Panel (Screen 4) */
        <div className="bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10 p-6 sm:p-10 space-y-6">
          <div className="space-y-2">
            <h2 className="font-display font-bold text-lg text-[#30251F] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#9E4A2B]" />
              <span>About {brand.name}</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#685950] leading-relaxed whitespace-pre-line max-w-2xl">
              {brand.bio ||
                'Independent creator dedicated to crafting slow, intentional, and authentic pieces directly for their community.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#30251F]/10 text-xs">
            <div className="flex items-center gap-3 p-4 bg-[#FAF6F0] rounded-2xl border border-[#30251F]/10">
              <div className="w-8 h-8 rounded-full bg-[#EFE9DF] text-[#9E4A2B] flex items-center justify-center flex-shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[#8A7A70] block font-medium text-[11px]">Store Type</span>
                <span className="font-semibold text-[#30251F] capitalize">
                  {brand.creator_type === 'small_brand' ? 'Small Brand / Studio' : 'Individual Creator'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-[#FAF6F0] rounded-2xl border border-[#30251F]/10">
              <div className="w-8 h-8 rounded-full bg-[#EFE9DF] text-[#9E4A2B] flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[#8A7A70] block font-medium text-[11px]">Member Since</span>
                <span className="font-semibold text-[#30251F]">Active Creator since {memberYear}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Auth Modal for island contact clicks */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          targetUrl={authModalData.url}
          creatorName={authModalData.creatorName || brand.name}
          productName={authModalData.productName}
        />
      )}
    </div>
  );
};

export default BrandStoreView;

