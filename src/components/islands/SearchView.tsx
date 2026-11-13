import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getApprovedProducts, type Product } from '../../lib/products';
import { listApprovedBrands, type BrandWithStats } from '../../lib/brands';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Search, X, ShoppingBag, Users, ArrowRight, Check } from 'lucide-react';
import { ProductCard } from '../ui/ProductCard';
import { CreatorCard } from '../ui/CreatorCard';
import { AuthModal } from './AuthModal';

interface Props {
  initialQuery?: string;
}

export function sanitizeSearchQuery(raw: string): string {
  if (!raw) return '';
  return raw.replace(/[<>{}\\]/g, '').trim();
}

export const SearchView: React.FC<Props> = ({ initialQuery = '' }) => {
  const [queryInput, setQueryInput] = useState(() => sanitizeSearchQuery(initialQuery));
  const [activeQuery, setActiveQuery] = useState(() => sanitizeSearchQuery(initialQuery));
  const [activeTab, setActiveTab] = useState<'products' | 'creators'>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [creators, setCreators] = useState<BrandWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Cart & UI State
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [savingCartId, setSavingCartId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalData, setAuthModalData] = useState<{ url?: string; creatorName?: string; productName?: string }>({});

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auth state listener
  useEffect(() => {
    let isMounted = true;
    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (isMounted) setIsLoggedIn(Boolean(session?.user));
      }).catch(() => {});

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (isMounted) setIsLoggedIn(Boolean(session?.user));
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    }
  }, []);

  // Fetch products and creators
  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [allProds, allBrands] = await Promise.all([
          getApprovedProducts(undefined),
          listApprovedBrands(),
        ]);
        if (!isMounted) return;
        setProducts(allProds);
        setCreators(allBrands);

        // Check cart status for products
        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const statusMap: Record<string, boolean> = {};
            await Promise.all(
              allProds.map(async (p) => {
                statusMap[p.id] = await isInCart(p.id);
              })
            );
            if (isMounted) setInCartMap(statusMap);
          }
        }
      } catch (err) {
        console.error('Failed to load search data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products: matches name, description, category, and brand name
  const filteredProducts = useMemo(() => {
    const q = activeQuery.toLowerCase().trim();
    if (!q) return products;

    return products.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      const catMatch =
        (p.category?.name || '').toLowerCase().includes(q) ||
        (p.category?.slug || '').toLowerCase().includes(q);
      const brandMatch =
        (p.brand?.name || '').toLowerCase().includes(q) ||
        (p.brand?.slug || '').toLowerCase().includes(q) ||
        (p.seller?.full_name || '').toLowerCase().includes(q);

      return nameMatch || descMatch || catMatch || brandMatch;
    });
  }, [products, activeQuery]);

  // Filter creators: matches name, handle/slug, and tagline/bio
  const filteredCreators = useMemo(() => {
    const q = activeQuery.toLowerCase().trim();
    if (!q) return creators;

    return creators.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(q);
      const slugMatch = c.slug.toLowerCase().includes(q);
      const taglineMatch = (c.tagline || '').toLowerCase().includes(q);
      const bioMatch = (c.bio || '').toLowerCase().includes(q);

      return nameMatch || slugMatch || taglineMatch || bioMatch;
    });
  }, [creators, activeQuery]);

  // Handle search submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeSearchQuery(queryInput);
    setActiveQuery(sanitized);

    if (typeof window !== 'undefined') {
      const newUrl = sanitized
        ? `/search?q=${encodeURIComponent(sanitized)}`
        : '/search';
      window.history.pushState(null, '', newUrl);
    }
  };

  const handleClear = () => {
    setQueryInput('');
    setActiveQuery('');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/search');
    }
    inputRef.current?.focus();
  };

  // Cart action
  const handleToggleCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (savingCartId) return;

    setSavingCartId(productId);
    try {
      const currentlyInCart = inCartMap[productId];
      const res = await addToCart(productId);
      if (res.success) {
        const nextState = !currentlyInCart;
        setInCartMap((prev) => ({ ...prev, [productId]: nextState }));
        setToastMessage(nextState ? 'Saved to Lead Cart' : 'Removed from Lead Cart');
        window.dispatchEvent(new CustomEvent('rablo:cart-updated'));
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch {
      setToastMessage('Could not update Lead Cart.');
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSavingCartId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3 rounded-2xl shadow-soft-xl z-50 text-xs font-medium flex items-center gap-2 border border-[#30251F]/20 animate-slide-up"
        >
          <Check className="w-4 h-4 text-[#D9A37B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen 10: Search Bar Form */}
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
        <div className="relative flex items-center">
          <Search className="w-5 h-5 text-[#8A7A70] absolute left-4 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Search creations, crafts, or creators..."
            aria-label="Search creations or creators"
            className="w-full pl-12 pr-12 py-3.5 sm:py-4 bg-[#FAF6F0] border border-[#30251F]/15 rounded-2xl sm:rounded-full text-sm sm:text-base text-[#30251F] placeholder:text-[#8A7A70] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B] focus:border-transparent transition-all shadow-soft-sm"
          />
          {queryInput && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-4 p-1.5 rounded-full text-[#8A7A70] hover:text-[#30251F] hover:bg-[#30251F]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Screen 10: Search Results Header & Counts */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#30251F] tracking-tight">
            {activeQuery ? `Search Results for "${activeQuery}"` : 'All Products & Creators'}
          </h1>
          <p className="text-xs sm:text-sm text-[#8A7A70] mt-1">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} · {filteredCreators.length} {filteredCreators.length === 1 ? 'creator' : 'creators'}
          </p>
        </div>

        {/* Screen 10: Filter Tabs (Products / Creators) */}
        <div className="flex items-center gap-2 border-b border-[#30251F]/10 pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
              activeTab === 'products'
                ? 'bg-[#9E4A2B] text-[#FAF6F0] shadow-sm'
                : 'bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/10 hover:border-[#9E4A2B]/30'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Products ({filteredProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('creators')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
              activeTab === 'creators'
                ? 'bg-[#9E4A2B] text-[#FAF6F0] shadow-sm'
                : 'bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/10 hover:border-[#9E4A2B]/30'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Creators ({filteredCreators.length})</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 py-8">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[#FAF6F0] rounded-2xl sm:rounded-3xl border border-[#30251F]/10 p-3 sm:p-4 space-y-3">
              <div className="w-full aspect-square bg-[#EFE9DF] rounded-xl sm:rounded-2xl" />
              <div className="h-4 bg-[#EFE9DF] rounded-md w-3/4" />
              <div className="h-3 bg-[#EFE9DF] rounded-md w-1/2" />
            </div>
          ))}
        </div>
      ) : activeTab === 'products' ? (
        /* Products Tab Content */
        filteredProducts.length === 0 ? (
          /* Empty State for Products */
          <div className="py-12 sm:py-16 text-center max-w-md mx-auto bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10 p-8 space-y-4 shadow-soft-sm">
            <div className="w-14 h-14 rounded-full bg-[#EFE9DF] text-[#9E4A2B] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-display font-bold text-[#30251F]">
                {activeQuery ? `No products match "${activeQuery}"` : 'No products available'}
              </h2>
              <p className="text-xs sm:text-sm text-[#8A7A70] leading-relaxed">
                Try checking for typos, using broader keywords, or browse through our craft categories.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="/categories"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-[#9E4A2B] text-[#FAF6F0] shadow-sm hover:bg-[#83381E] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
              >
                <span>Browse Categories</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="/catalog"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-white text-[#30251F] border border-[#30251F]/15 hover:border-[#9E4A2B]/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
              >
                <span>All Products</span>
              </a>
            </div>
          </div>
        ) : (
          /* Products Grid (Mockup 10) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                inCart={inCartMap[p.id]}
                isSavingCart={savingCartId === p.id}
                isLoggedIn={isLoggedIn}
                onToggleCart={handleToggleCart}
                onToast={(msg) => {
                  setToastMessage(msg);
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                onAuthRequired={(data) => {
                  setAuthModalData(data);
                  setAuthModalOpen(true);
                }}
              />
            ))}
          </div>
        )
      ) : (
        /* Creators Tab Content */
        filteredCreators.length === 0 ? (
          /* Empty State for Creators */
          <div className="py-12 sm:py-16 text-center max-w-md mx-auto bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10 p-8 space-y-4 shadow-soft-sm">
            <div className="w-14 h-14 rounded-full bg-[#EFE9DF] text-[#9E4A2B] flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-display font-bold text-[#30251F]">
                {activeQuery ? `No creators match "${activeQuery}"` : 'No creators found'}
              </h2>
              <p className="text-xs sm:text-sm text-[#8A7A70] leading-relaxed">
                Looking for a specific maker? Try searching by their brand name or craft style.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="/creators"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-[#9E4A2B] text-[#FAF6F0] shadow-sm hover:bg-[#83381E] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
              >
                <span>Explore All Creators</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a
                href="/categories"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-white text-[#30251F] border border-[#30251F]/15 hover:border-[#9E4A2B]/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
              >
                <span>Browse Categories</span>
              </a>
            </div>
          </div>
        ) : (
          /* Creators Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredCreators.map((c) => (
              <CreatorCard
                key={c.id}
                id={c.id}
                name={c.name}
                slug={c.slug}
                avatarUrl={c.logo_url}
                instagramUrl={c.instagram_url}
                craft={c.tagline || undefined}
                tagline={c.tagline}
                productCount={c.product_count}
                isVerified={c.is_verified}
              />
            ))}
          </div>
        )
      )}

      {/* Auth Modal for Direct Chat Flow */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        targetUrl={authModalData.url}
        creatorName={authModalData.creatorName}
        productName={authModalData.productName}
      />
    </div>
  );
};

export default SearchView;
