import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAllProductsPage, HOME_LIMITS } from '../../lib/home';
import type { Product } from '../../lib/products';
import { ProductCard } from '../ui/ProductCard';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { SectionHeader } from '../ui/SectionHeader';
import { AuthModal } from './AuthModal';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Check, Loader2, ArrowRight, RefreshCw } from 'lucide-react';

interface Props {
  initialProducts?: Product[];
}

export const AllProductsSection: React.FC<Props> = ({ initialProducts }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loadingInitial, setLoadingInitial] = useState(!initialProducts || initialProducts.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(initialProducts && initialProducts.length > 0 ? 1 : 0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cart & Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [savingCartId, setSavingCartId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalData, setAuthModalData] = useState<{ url?: string; creatorName?: string; productName?: string }>({});

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const loadedPagesRef = useRef<Set<number>>(new Set());

  // Listen for login session
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

  // Fetch a page of products with deduplication and guards
  const loadPage = useCallback(async (pageToLoad: number) => {
    if (isFetchingRef.current) return;
    if (loadedPagesRef.current.has(pageToLoad)) return;
    if (pageToLoad * HOME_LIMITS.allProductsPageSize >= HOME_LIMITS.allProductsMax) {
      setHasMore(false);
      return;
    }

    isFetchingRef.current = true;
    if (pageToLoad === 0) {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
    }
    setLoadError(null);

    try {
      const res = await getAllProductsPage(pageToLoad);
      if (res.error) {
        setLoadError(res.error);
        if (pageToLoad === 0) setLoadingInitial(false);
        setLoadingMore(false);
        isFetchingRef.current = false;
        return;
      }

      loadedPagesRef.current.add(pageToLoad);

      const newItems = res.items || [];
      setProducts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const filteredNew = newItems.filter((p) => !seen.has(p.id));
        const combined = [...prev, ...filteredNew];
        if (combined.length >= HOME_LIMITS.allProductsMax) {
          setHasMore(false);
          return combined.slice(0, HOME_LIMITS.allProductsMax);
        }
        return combined;
      });

      setHasMore(res.hasMore);
      setPage(pageToLoad + 1);

      // Check cart status for newly loaded items
      if (newItems.length > 0 && isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const statusMap: Record<string, boolean> = {};
            await Promise.all(
              newItems.map(async (p) => {
                statusMap[p.id] = await isInCart(p.id);
              })
            );
            setInCartMap((prev) => ({ ...prev, ...statusMap }));
          }
        } catch {}
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error loading products';
      setLoadError(message);
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Initial load effect
  useEffect(() => {
    if (!initialProducts || initialProducts.length === 0) {
      loadPage(0);
    } else {
      loadedPagesRef.current.add(0);
    }
  }, [initialProducts, loadPage]);

  // Infinite scroll IntersectionObserver
  useEffect(() => {
    if (!hasMore || loadingInitial || loadingMore) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    // Do not auto-scroll if user prefers reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && !isFetchingRef.current && hasMore) {
          loadPage(page);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadingInitial, loadingMore, page, loadPage]);

  const handleToggleCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupabaseConfigured || !supabase) {
      window.location.href = `/account?redirect=/`;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.href = `/account?redirect=/`;
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

  return (
    <section className="space-y-6 pt-2" id="all-products">
      <SectionHeader
        title="All Products"
        badge="Independent Catalog"
        subtitle="Explore authentic artisan creations directly from indie makers across India."
        viewAllHref="/catalog"
        viewAllText="View Full Catalog"
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3.5 rounded-2xl shadow-soft-xl z-50 text-xs font-medium flex items-center gap-2.5 border border-[#30251F]/20 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-[#637B58]/20 text-[#637B58] flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Initial 8 Card Skeletons */}
      {loadingInitial && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State when no products exist at all */}
      {!loadingInitial && products.length === 0 && !loadError && (
        <div className="p-8 sm:p-12 text-center bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10 space-y-3 max-w-md mx-auto">
          <p className="font-display font-bold text-base text-[#30251F]">No Products Available</p>
          <p className="text-xs text-[#685950]">Check back soon as new artisan products are approved regularly.</p>
        </div>
      )}

      {/* Initial load error */}
      {!loadingInitial && products.length === 0 && loadError && (
        <div className="p-8 text-center bg-[#FAF6F0] rounded-3xl border border-[#30251F]/10 space-y-3 max-w-md mx-auto">
          <p className="text-xs text-[#9E4A2B] font-semibold">{loadError}</p>
          <button
            type="button"
            onClick={() => loadPage(0)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#9E4A2B] text-[#FAF6F0] shadow-sm hover:bg-[#83381E] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Products Grid */}
      {products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
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

      {/* Incremental loading spinner */}
      {loadingMore && (
        <div className="py-6 flex items-center justify-center gap-2 text-xs font-medium text-[#685950]" aria-live="polite">
          <Loader2 className="w-4 h-4 animate-spin text-[#9E4A2B]" />
          <span>Loading more creations...</span>
        </div>
      )}

      {/* Fallback Load More button if load failed or reduced-motion / non-observer */}
      {!loadingMore && hasMore && products.length > 0 && (
        <div className="py-4 text-center">
          {loadError && (
            <p className="text-xs text-[#9E4A2B] mb-2 font-medium">
              Couldn&apos;t load more. Try again
            </p>
          )}
          <button
            type="button"
            onClick={() => loadPage(page)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-[#30251F]/15 bg-[#FAF6F0] text-xs font-semibold text-[#30251F] hover:bg-white hover:border-[#9E4A2B]/40 transition-all cursor-pointer shadow-soft-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
          >
            <span>Load more products</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#9E4A2B]" />
          </button>
        </div>
      )}

      {/* Sentinel element for IntersectionObserver */}
      {hasMore && !loadingInitial && (
        <div ref={sentinelRef} className="h-4 w-full pointer-events-none" aria-hidden="true" />
      )}

      {/* Completion message after 48 items or when no more products exist */}
      {!hasMore && products.length > 0 && (
        <div className="py-8 text-center space-y-3 border-t border-[#30251F]/10 pt-8">
          <p className="text-xs sm:text-sm font-medium text-[#685950]">
            You&apos;ve seen the latest picks
          </p>
          <div>
            <a
              href="/catalog"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FAF6F0] border border-[#30251F]/15 text-xs sm:text-sm font-semibold text-[#30251F] hover:bg-white hover:border-[#9E4A2B]/40 transition-all shadow-soft-sm group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
            >
              <span>Browse all products</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#9E4A2B] group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      )}

      {/* Auth Modal for guest interactions */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        targetUrl={authModalData.url}
        creatorName={authModalData.creatorName}
        productName={authModalData.productName}
      />
    </section>
  );
};

export default AllProductsSection;

