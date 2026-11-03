import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getApprovedProducts, getApprovedCategories, type Product, type Category } from '../../lib/products';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Search, ExternalLink, ShoppingBag, Check, X, Eye, Sparkles, Filter, Lock } from 'lucide-react';
import { openInstagramAuthModal } from './AuthModal';

const INITIAL_BATCH_SIZE = 24;
const BATCH_INCREMENT = 16;

interface Props {
  initialProducts?: Product[];
  initialCategory?: string;
}

export const CatalogGrid: React.FC<Props> = ({ initialProducts, initialCategory }) => {
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      return url.searchParams.get('category') || url.searchParams.get('cat') || initialCategory || 'all';
    }
    return initialCategory || 'all';
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      return url.searchParams.get('q') || '';
    }
    return '';
  });
  const [priceFilter, setPriceFilter] = useState<'all' | 'under1000' | '1000to2000' | 'above2000'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [loading, setLoading] = useState(!initialProducts);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Synchronize with global search from header
  useEffect(() => {
    const handleSearchEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (typeof customEvent.detail?.query === 'string') {
        setSearchQuery(customEvent.detail.query);
      }
    };

    const handleCategoryEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ category: string }>;
      if (typeof customEvent.detail?.category === 'string') {
        setSelectedCategory(customEvent.detail.category);
        setSearchQuery('');
      }
    };

    window.addEventListener('rablo:search', handleSearchEvent);
    window.addEventListener('rablo:category-change', handleCategoryEvent);
    return () => {
      window.removeEventListener('rablo:search', handleSearchEvent);
      window.removeEventListener('rablo:category-change', handleCategoryEvent);
    };
  }, []);

  // Endless Vertical Scrolling State
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load products & categories
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cats, prods] = await Promise.all([
          getApprovedCategories(),
          getApprovedProducts(undefined), // fetch all to calculate cross-category counts
        ]);
        setCategories(cats);
        setAllProducts(prods);

        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          setIsLoggedIn(Boolean(session?.user));
          if (session?.user) {
            const statusMap: Record<string, boolean> = {};
            await Promise.all(
              prods.map(async (p) => {
                statusMap[p.id] = await isInCart(p.id);
              })
            );
            setInCartMap(statusMap);
          }
        }
      } catch (err) {
        console.error('Failed to load catalog data:', err);
      } finally {
        setLoading(false);
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsLoggedIn(Boolean(session?.user));
      });
      loadData();
      return () => subscription.unsubscribe();
    } else {
      loadData();
    }
  }, []);

  // Compute category count map
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

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allProducts
      .filter((p) => {
        // Price filter
        if (priceFilter === 'under1000' && p.price >= 1000) return false;
        if (priceFilter === '1000to2000' && (p.price < 1000 || p.price > 2000)) return false;
        if (priceFilter === 'above2000' && p.price <= 2000) return false;

        // Category filter:
        // When searching, if query matches another category name/slug, allow those creations!
        if (selectedCategory !== 'all') {
          const queryMatchesOtherCategory = Boolean(
            query && (
              (p.category?.name && p.category.name.toLowerCase().includes(query)) ||
              (p.category?.slug && p.category.slug.toLowerCase().includes(query))
            )
          );
          if (!queryMatchesOtherCategory && p.category?.slug !== selectedCategory) {
            return false;
          }
        }

        if (!query) return true;

        return (
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query)) ||
          (p.seller?.full_name && p.seller.full_name.toLowerCase().includes(query)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(query)) ||
          (p.category?.slug && p.category.slug.toLowerCase().includes(query)) ||
          (p.seller_ig_url && p.seller_ig_url.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [allProducts, selectedCategory, priceFilter, searchQuery, sortBy]);

  // Reset pagination whenever filters, category, search, or sorting changes
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH_SIZE);
  }, [selectedCategory, priceFilter, searchQuery, sortBy]);

  // Endless / Infinite Scroll Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && visibleCount < filteredProducts.length && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + BATCH_INCREMENT, filteredProducts.length));
            setIsLoadingMore(false);
          }, 60);
        }
      },
      {
        root: null,
        rootMargin: '600px', // Fetch nicely before reaching the bottom
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filteredProducts.length, isLoadingMore]);

  // Visible window of products
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  const handleDirectDmClick = (
    e: React.MouseEvent,
    targetUrl?: string | null,
    creatorName?: string,
    productName?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!targetUrl) return;

    if (!isLoggedIn) {
      openInstagramAuthModal({
        targetUrl,
        creatorName: creatorName || 'Verified Creator',
        productName,
      });
      return;
    }

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleAddToCart = async (e: React.MouseEvent, productId: string) => {
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

    setAddingId(productId);
    const result = await addToCart(productId);
    setAddingId(null);

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

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-charcoal-900 text-ivory-100 px-5 py-3.5 rounded-sm shadow-soft-lg z-50 text-xs font-medium flex items-center gap-2.5 border border-charcoal-700 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-sage-500/20 text-sage-300 flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CUMID Search & Filter Controls */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-charcoal-800/10">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search creator, craft, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-ivory-100 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 placeholder:text-charcoal-500/70 focus:outline-none focus:ring-2 focus:ring-[#7C0E44]/30 focus:border-[#7C0E44] focus:bg-ivory-50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 justify-between sm:justify-end text-xs text-charcoal-700">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-charcoal-500" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-ivory-100 border border-charcoal-800/20 rounded-sm px-2.5 py-1.5 text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-[#7C0E44]/30 focus:border-[#7C0E44] cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Price Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 font-semibold mr-1 flex-shrink-0">
            Budget:
          </span>
          {[
            { id: 'all', label: 'All Prices' },
            { id: 'under1000', label: 'Under ₹1,000' },
            { id: '1000to2000', label: '₹1,000 – ₹2,000' },
            { id: 'above2000', label: '₹2,000+' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setPriceFilter(chip.id as any)}
              className={`px-3 py-1 rounded-full text-xs transition-colors flex-shrink-0 cursor-pointer ${
                priceFilter === chip.id
                  ? 'bg-charcoal-800 text-ivory-100 font-medium'
                  : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-700 border border-charcoal-800/15'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* CUMID Collection Links / Category Navigation */}
      <nav className="collection-links mb-8" aria-label="Catalog categories">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`cursor-pointer transition-colors pb-1 text-xs sm:text-sm ${
            selectedCategory === 'all'
              ? 'text-[#7C0E44] underline underline-offset-8 font-semibold'
              : 'text-charcoal-800 hover:text-[#7C0E44]'
          }`}
        >
          All creations {categoryCounts.all ? `(${categoryCounts.all})` : ''}
        </button>
        {categories.map((cat) => {
          const count = categoryCounts[cat.slug] || 0;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`cursor-pointer transition-colors pb-1 text-xs sm:text-sm flex items-center gap-1.5 ${
                selectedCategory === cat.slug
                  ? 'text-[#7C0E44] underline underline-offset-8 font-semibold'
                  : 'text-charcoal-800 hover:text-[#7C0E44]'
              }`}
            >
              <span>{cat.name}</span>
              {count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-charcoal-800/10 rounded-full font-mono">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Loading State */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-charcoal-500">Loading verified creator creations...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm my-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#7C0E44]/10 text-[#7C0E44] mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-base font-display font-medium text-charcoal-900 mb-1">
              No matching creations found
            </p>
            <p className="text-xs text-charcoal-600 max-w-md mx-auto leading-relaxed">
              {searchQuery || priceFilter !== 'all'
                ? 'Try clearing your search query or adjusting your price filters.'
                : 'Run the setup SQL script in your Supabase SQL Editor to populate verified showcase products!'}
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            {(searchQuery || priceFilter !== 'all' || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPriceFilter('all');
                  setSelectedCategory('all');
                }}
                className="btn-secondary py-2.5 px-4 text-xs"
              >
                Reset Filters
              </button>
            )}
            <a href="/seller/upload" className="btn-primary py-2.5 px-4 text-xs">
              List Your Creation ↗
            </a>
          </div>
        </div>
      ) : (
        /* Rablo Responsive Catalog Grid: 2 cols on mobile, up to 5-6 cols on desktop */
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2.5 sm:gap-4 md:gap-4 lg:gap-5">
            {displayedProducts.map((product) => {
              const inCart = inCartMap[product.id];
              const isAdding = addingId === product.id;

              return (
                <article
                  key={product.id}
                  className="product-card flex flex-col group bg-ivory-100/60 hover:bg-ivory-100 transition-colors p-1.5 sm:p-2 rounded-sm border border-charcoal-800/10 hover:border-charcoal-800/25 shadow-xs hover:shadow-soft"
                >
                  {/* Product Art Stage in Rablo beige backing */}
                  <div className="product-art bg-[#eee9e1] aspect-square rounded-xs overflow-hidden relative shadow-xs">
                    <a
                      href={`/products/${product.id}`}
                      aria-label={`View ${product.name} details`}
                      className="block w-full h-full p-2 sm:p-2.5 flex items-center justify-center"
                    >
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-contain rounded-xs transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-charcoal-400 font-serif text-2xl sm:text-3xl">
                          ✦
                        </div>
                      )}
                    </a>

                    {/* Category Pill Tag */}
                    {product.category && (
                      <div className="absolute top-1.5 left-1.5 max-w-[55%]">
                        <span className="inline-block text-[9px] sm:text-[10px] font-medium uppercase tracking-tight px-1.5 py-0.5 rounded-xs bg-ivory-100/90 text-charcoal-700 backdrop-blur-xs truncate shadow-xs">
                          {product.category.name}
                        </span>
                      </div>
                    )}

                    {/* Stock / Limited Batch Badge */}
                    <div className="absolute top-1.5 right-1.5">
                      <span
                        className={`inline-block text-[9px] sm:text-[10px] font-medium tracking-tight px-1.5 py-0.5 rounded-xs backdrop-blur-xs shadow-xs ${
                          product.stock > 0
                            ? 'bg-ivory-100/90 text-charcoal-700'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        {product.stock > 0 ? `${product.stock} in batch` : 'Sold out'}
                      </span>
                    </div>

                    {/* Quick Preview Hover Trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setQuickViewProduct(product);
                      }}
                      className="absolute bottom-1.5 right-1.5 bg-charcoal-900/85 hover:bg-charcoal-900 text-ivory-100 p-1.5 rounded-xs backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Quick Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Product Metadata */}
                  <div className="pt-2 sm:pt-2.5 flex flex-col flex-1">
                    <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-charcoal-500 mb-0.5 sm:mb-1">
                      <span className="font-medium text-charcoal-700 truncate max-w-[105px] sm:max-w-[140px]">
                        {product.seller?.full_name || 'Verified Creator'}
                      </span>
                      {isLoggedIn ? (
                        <span className="text-[9px] sm:text-[10px] text-[#7C0E44] font-semibold tracking-tight flex-shrink-0">
                          Direct DM
                        </span>
                      ) : (
                        <span
                          className="text-[9px] sm:text-[10px] text-charcoal-500 font-medium tracking-tight flex-shrink-0 flex items-center gap-0.5"
                          title="Sign in to view creator Instagram ID and DM"
                        >
                          <Lock className="w-2.5 h-2.5 text-[#7C0E44]" />
                          <span>Login for DM</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-display font-medium text-xs sm:text-sm text-charcoal-900 group-hover:text-[#7C0E44] transition-colors line-clamp-1 mb-0.5 leading-tight">
                      <a href={`/products/${product.id}`}>{product.name}</a>
                    </h3>

                    <p className="text-[10px] sm:text-xs text-charcoal-600 line-clamp-1 leading-snug mb-1.5 sm:mb-2 flex-1">
                      {product.description}
                    </p>

                    <div className="text-xs sm:text-sm font-semibold text-charcoal-900 mb-2 flex items-center justify-between">
                      <span>₹{product.price}</span>
                      <span className="text-[9px] sm:text-[10px] text-charcoal-500 font-normal">
                        0% fee
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 pt-1.5 sm:pt-2 border-t border-charcoal-800/10 mt-auto">
                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(e, product.id)}
                        disabled={isAdding || inCart}
                        aria-label={inCart ? 'Saved to cart' : 'Save to cart'}
                        className={`inline-flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-xs text-[10px] sm:text-xs font-medium transition-colors border cursor-pointer ${
                          inCart
                            ? 'bg-sage-100 text-sage-700 border-sage-300 cursor-default'
                            : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-800 border-charcoal-800/20 active:scale-95'
                        }`}
                      >
                        {inCart ? (
                          <>
                            <Check className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">Saved</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{isAdding ? '...' : 'Save'}</span>
                            <span className="hidden md:inline">{isAdding ? '' : ' to Cart'}</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDirectDmClick(e, product.product_ig_url || product.seller_ig_url, product.seller?.full_name, product.name)}
                        aria-label={isLoggedIn ? "Direct Instagram DM with creator" : "Sign in to view Instagram ID and DM creator"}
                        className="inline-flex items-center justify-center gap-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-xs text-[10px] sm:text-xs font-medium bg-charcoal-800 hover:bg-charcoal-700 text-ivory-100 transition-colors active:scale-95 cursor-pointer"
                      >
                        {isLoggedIn ? (
                          <>
                            <span className="truncate">DM</span>
                            <span className="hidden md:inline"> on IG</span>
                            <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 opacity-70 flex-shrink-0" />
                          </>
                        ) : (
                          <>
                            <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#FBE4EE] flex-shrink-0" />
                            <span className="truncate">DM</span>
                            <span className="hidden md:inline"> on IG</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Endless Vertical Scrolling Sentinel */}
          {filteredProducts.length > 0 && (
            <div ref={sentinelRef} className="h-10 w-full pointer-events-none" aria-hidden="true" />
          )}

          {/* Infinite Scroll Loading Pulse */}
          {isLoadingMore && (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-charcoal-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#7C0E44] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#7C0E44] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#7C0E44] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[11px] font-mono text-charcoal-500">
                Loading more creations ({displayedProducts.length} of {filteredProducts.length})...
              </span>
            </div>
          )}

          {/* End of Catalog Indicator */}
          {!isLoadingMore && displayedProducts.length === filteredProducts.length && filteredProducts.length > 0 && (
            <div className="py-8 text-center text-xs text-charcoal-400 font-mono border-t border-charcoal-800/10 mt-8">
              ✦ Showing all {filteredProducts.length} verified creations
            </div>
          )}
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="bg-ivory-100 max-w-2xl w-full rounded-sm border border-charcoal-800/20 shadow-soft-lg overflow-hidden flex flex-col md:flex-row relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-ivory-50/80 hover:bg-ivory-300 text-charcoal-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Image */}
            <div className="w-full md:w-1/2 bg-[#eee9e1] p-8 flex items-center justify-center aspect-square md:aspect-auto">
              <img
                src={quickViewProduct.thumbnail_url || ''}
                alt={quickViewProduct.name}
                className="max-h-72 object-contain rounded-sm"
              />
            </div>

            {/* Right Info */}
            <div className="p-6 md:p-8 w-full md:w-1/2 flex flex-col justify-between space-y-4">
              <div>
                <span className="eyebrow !mb-1">
                  {quickViewProduct.category?.name || 'Creator Discovery'}
                </span>
                <h3 className="font-display font-medium text-xl text-charcoal-900 mb-2">
                  {quickViewProduct.name}
                </h3>
                <div className="text-xl font-bold text-charcoal-900 mb-3">
                  ₹{quickViewProduct.price}
                </div>
                <p className="text-xs text-charcoal-600 leading-relaxed max-h-36 overflow-y-auto">
                  {quickViewProduct.description}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-charcoal-800/10">
                <button
                  type="button"
                  onClick={(e) => handleDirectDmClick(e, quickViewProduct.product_ig_url || quickViewProduct.seller_ig_url, quickViewProduct.seller?.full_name, quickViewProduct.name)}
                  className="btn-primary w-full py-3 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoggedIn ? (
                    <>
                      <span>Chat with Creator on IG</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#FBE4EE]" />
                      <span>Sign In to View Insta ID &amp; Chat on IG</span>
                    </>
                  )}
                </button>
                <a
                  href={`/products/${quickViewProduct.id}`}
                  className="btn-secondary w-full py-2.5 text-xs font-medium text-center block"
                >
                  Full Creation Details ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogGrid;
