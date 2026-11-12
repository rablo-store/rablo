import React, { useState, useEffect, useMemo } from 'react';
import { getApprovedProducts, getApprovedCategories, type Product, type Category } from '../../lib/products';
import { getSaveCounts } from '../../lib/brands';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { SlidersHorizontal, ArrowUpDown, Check, X } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { ProductCard } from '../ui/ProductCard';
import { FilterPanel, type FilterState } from '../ui/FilterPanel';
import { CatalogSkeletonGrid } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

interface Props {
  initialProducts?: Product[];
  initialCategory?: string;
}

type TagType = 'all' | 'handmade' | 'custom' | 'limited' | 'new';
type SortOption = 'popularity' | 'newest' | 'price-asc' | 'price-desc';

export const CatalogGrid: React.FC<Props> = ({ initialProducts, initialCategory }) => {
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saveCounts, setSaveCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(!initialProducts);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('q');
      if (q) return q;
    }
    return '';
  });

  // Top Horizontal Tag (Mockup 2)
  const [activeTag, setActiveTag] = useState<TagType>('all');

  // Filter Panel State (Mockup 2 & 12)
  const [filterState, setFilterState] = useState<FilterState>({
    categories: initialCategory && initialCategory !== 'all' ? [initialCategory] : [],
    minPrice: 0,
    maxPrice: 5000,
    creatorTypes: [],
  });

  // Sort State (Mockup 2)
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

  // Mobile Filter Drawer State (Mockup 12)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Cart & UI State
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [savingCartId, setSavingCartId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalData, setAuthModalData] = useState<{ url?: string; creatorName?: string; productName?: string }>({});

  // Auth session listener
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

  // Fetch initial data & listen to global auth modal requests
  useEffect(() => {
    let isMounted = true;

    const handleOpenAuth = (e: Event) => {
      const customEvent = e as CustomEvent<{ targetUrl?: string; creatorName?: string; productName?: string }>;
      if (customEvent.detail) {
        setAuthModalData({
          url: customEvent.detail.targetUrl,
          creatorName: customEvent.detail.creatorName,
          productName: customEvent.detail.productName,
        });
        setAuthModalOpen(true);
      }
    };
    window.addEventListener('rablo:open-auth-modal', handleOpenAuth);

    async function loadData() {
      setLoading(true);
      try {
        const [cats, prods] = await Promise.all([
          getApprovedCategories(),
          getApprovedProducts(undefined),
        ]);
        if (!isMounted) return;

        setCategories(cats);
        setAllProducts(prods);

        // Fetch save counts in background so it never blocks card rendering
        getSaveCounts().then((saves) => {
          if (isMounted) setSaveCounts(saves);
        }).catch(() => {});

        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const statusMap: Record<string, boolean> = {};
            await Promise.all(
              prods.map(async (p) => {
                statusMap[p.id] = await isInCart(p.id);
              })
            );
            if (isMounted) setInCartMap(statusMap);
          }
        }
      } catch (err) {
        console.error('Failed to load catalog data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
      window.removeEventListener('rablo:open-auth-modal', handleOpenAuth);
    };
  }, []);

  // Listen for global search events dispatched from top search bar
  useEffect(() => {
    const handleSearchEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (typeof customEvent.detail?.query === 'string') {
        setSearchQuery(customEvent.detail.query);
      }
    };
    window.addEventListener('rablo:search', handleSearchEvent);
    return () => window.removeEventListener('rablo:search', handleSearchEvent);
  }, []);

  // Category product counts for badges
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: allProducts.length };
    allProducts.forEach((p) => {
      const slug = p.category?.slug;
      if (slug) {
        map[slug] = (map[slug] || 0) + 1;
      }
    });
    return map;
  }, [allProducts]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        // Category Filter
        if (filterState.categories.length > 0) {
          if (!p.category?.slug || !filterState.categories.includes(p.category.slug)) {
            return false;
          }
        }

        // Price Filter
        if (filterState.minPrice > 0 && p.price < filterState.minPrice) return false;
        if (filterState.maxPrice < 5000 && p.price > filterState.maxPrice) return false;

        // Creator Type Filter
        if (filterState.creatorTypes.length > 0) {
          const cType = p.brand?.creator_type || 'individual';
          if (!filterState.creatorTypes.includes(cType as any)) {
            return false;
          }
        }

        // Horizontal Tags Filter (Mockup 2: All Products | Handmade | Custom | Limited | New)
        if (activeTag === 'handmade') {
          const isHandmade =
            p.name.toLowerCase().includes('handmade') ||
            p.description.toLowerCase().includes('handmade') ||
            p.description.toLowerCase().includes('crochet');
          if (!isHandmade) return false;
        } else if (activeTag === 'custom') {
          const isCustom =
            p.name.toLowerCase().includes('custom') ||
            p.description.toLowerCase().includes('custom') ||
            p.description.toLowerCase().includes('made to order');
          if (!isCustom) return false;
        } else if (activeTag === 'limited') {
          if (p.stock > 5) return false;
        } else if (activeTag === 'new') {
          // Products created in the last 60 days
          const diffDays = (Date.now() - new Date(p.created_at).getTime()) / (1000 * 3600 * 24);
          if (diffDays > 60) return false;
        }

        // Search Query
        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;

        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.seller?.full_name && p.seller.full_name.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
          (p.seller_ig_url && p.seller_ig_url.toLowerCase().includes(q)) ||
          (p.brand?.name && p.brand.name.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        // Default 'popularity': sort by saved lead count descending
        const countA = saveCounts[a.id] || 0;
        const countB = saveCounts[b.id] || 0;
        if (countB !== countA) return countB - countA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [allProducts, filterState, activeTag, searchQuery, sortBy, saveCounts]);

  const handleToggleCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupabaseConfigured || !supabase) {
      window.location.href = `/account?redirect=/catalog`;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.href = `/account?redirect=/catalog`;
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

  const handleAuthRequired = (data: { url?: string; creatorName?: string; productName?: string }) => {
    setAuthModalData(data);
    setAuthModalOpen(true);
  };

  const clearAllFilters = () => {
    setFilterState({
      categories: [],
      minPrice: 0,
      maxPrice: 5000,
      creatorTypes: [],
    });
    setActiveTag('all');
    setSearchQuery('');
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3.5 rounded-2xl shadow-soft-xl z-50 text-xs font-medium flex items-center gap-2.5 border border-[#30251F]/20 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-[#637B58]/20 text-[#637B58] flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen 2: Horizontal Tag Navigation (Mockup 2: All Products, Handmade, Custom, Limited, New) */}
      {/* Also preserves nav.collection-links for test compatibility */}
      <nav
        className="collection-links flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none"
        aria-label="Product tags and categories"
      >
        {[
          { id: 'all', label: 'All Products' },
          { id: 'handmade', label: 'Handmade' },
          { id: 'custom', label: 'Custom' },
          { id: 'limited', label: 'Limited' },
          { id: 'new', label: 'New' },
        ].map((tag) => {
          const isActive = activeTag === tag.id;
          return (
            <a
              key={tag.id}
              href={`#${tag.id}`}
              role="button"
              onClick={(e) => {
                e.preventDefault();
                setActiveTag(tag.id as TagType);
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer inline-flex items-center justify-center ${
                isActive
                  ? 'bg-[#B87555] text-[#FAF6F0] shadow-soft-sm'
                  : 'bg-[#FAF6F0] text-[#30251F] hover:bg-[#EFE9DF] border border-[#30251F]/10'
              }`}
            >
              {tag.label}
            </a>
          );
        })}
      </nav>

      {/* Top Controls Bar: Mobile Filter Trigger + Sort Dropdown */}
      <div className="flex items-center justify-between gap-4 pt-1 pb-3 border-b border-[#30251F]/10">
        {/* Mobile Filter Button (Visible on mobile/tablet) */}
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="lg:hidden inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FAF6F0] hover:bg-[#EFE9DF] border border-[#30251F]/15 text-xs font-semibold text-[#30251F] transition-all cursor-pointer shadow-soft-sm"
          aria-label="Open filter drawer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#9E4A2B]" />
          <span>Filters</span>
          {(filterState.categories.length > 0 || filterState.creatorTypes.length > 0 || filterState.maxPrice < 5000) && (
            <span className="w-2 h-2 rounded-full bg-[#9E4A2B]"></span>
          )}
        </button>

        {/* Product Count Indicator */}
        <p className="hidden sm:block text-xs text-[#685950]">
          Showing <span className="font-bold text-[#30251F]">{filteredProducts.length}</span> verified indie creations
        </p>

        {/* Sort Dropdown (Mockup 2: Sort by: Popularity ⌵) */}
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="catalog-sort" className="text-xs text-[#685950] hidden sm:inline">
            Sort by:
          </label>
          <div className="relative">
            <select
              id="catalog-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none bg-[#FAF6F0] hover:bg-[#EFE9DF] border border-[#30251F]/15 rounded-full pl-3 pr-8 py-2 text-xs font-semibold text-[#30251F] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B] cursor-pointer shadow-soft-sm"
            >
              <option value="popularity">Popularity</option>
              <option value="newest">Newest</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#30251F]">
              <ArrowUpDown className="w-3 h-3 text-[#685950]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout: Desktop Sidebar (Left) + Product Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Desktop Filter Sidebar (Mockup 2: 3-column width) */}
        <div className="hidden lg:block lg:col-span-3 sticky top-24 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-5 shadow-soft-sm">
          <FilterPanel
            categories={categories}
            categoryCounts={categoryCounts}
            filters={filterState}
            onChange={(next) => setFilterState(next)}
            onClearAll={clearAllFilters}
          />
        </div>

        {/* Product Grid Area (Mockup 2: 9-column width) */}
        <div className="lg:col-span-9 min-w-0">
          {loading ? (
            <CatalogSkeletonGrid count={6} />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              title="No products match your filters"
              description="Try adjusting your category selection, price range, or clearing your search query to see more creator pieces."
              actionLabel="Clear All Filters"
              onAction={clearAllFilters}
            />
          ) : (
            /* Responsive Grid matching Mockup 2: 3 columns on desktop, 2 on mobile */
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inCart={inCartMap[product.id]}
                  isSavingCart={savingCartId === product.id}
                  isLoggedIn={isLoggedIn}
                  onToggleCart={handleToggleCart}
                  onQuickView={(p) => setQuickViewProduct(p)}
                  onToast={(msg) => {
                    setToastMessage(msg);
                    setTimeout(() => setToastMessage(null), 3500);
                  }}
                  onAuthRequired={handleAuthRequired}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Screen 12: Mobile Filter Drawer (Slide-Over Style) */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden flex justify-end"
        >
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 bg-[#30251F]/50 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Slide-in Drawer Container */}
          <div className="relative w-full max-w-sm h-full bg-[#FAF6F0] shadow-soft-2xl flex flex-col z-10 animate-slide-left p-5 overflow-hidden">
            <FilterPanel
              categories={categories}
              categoryCounts={categoryCounts}
              filters={filterState}
              onChange={(next) => setFilterState(next)}
              onClearAll={clearAllFilters}
              onClose={() => setMobileDrawerOpen(false)}
              onApply={() => setMobileDrawerOpen(false)}
              isDrawer={true}
            />
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#30251F]/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="relative w-full max-w-lg bg-[#FAF6F0] rounded-3xl p-6 shadow-soft-xl border border-[#30251F]/10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#30251F]/10">
              <h3 className="font-display text-lg font-bold text-[#30251F]">{quickViewProduct.name}</h3>
              <button
                type="button"
                onClick={() => setQuickViewProduct(null)}
                className="p-1 rounded-full text-[#685950] hover:text-[#30251F] hover:bg-black/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-square w-full rounded-2xl overflow-hidden bg-[#EFE9DF]">
              {quickViewProduct.thumbnail_url ? (
                <img
                  src={quickViewProduct.thumbnail_url}
                  alt={quickViewProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-serif text-[#8A7A70]">✦</div>
              )}
            </div>
            <div className="flex items-center justify-between text-base font-bold text-[#30251F]">
              <span>₹{quickViewProduct.price}</span>
              <span className="text-xs font-normal text-[#685950]">0% commission</span>
            </div>
            <p className="text-xs text-[#685950] line-clamp-3">{quickViewProduct.description}</p>
            <div className="pt-2 flex gap-3">
              <a
                href={`/products/${quickViewProduct.id}`}
                className="flex-1 py-2.5 px-4 rounded-full text-center text-xs font-semibold bg-[#9E4A2B] text-[#FAF6F0] hover:bg-[#843C22]"
              >
                View Full Details &rarr;
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Global Auth Modal for instant Google OAuth popup */}
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

export default CatalogGrid;
