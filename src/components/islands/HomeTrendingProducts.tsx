import React, { useState, useEffect, useCallback } from 'react';
import { getTrendingProducts } from '../../lib/home';
import type { Product } from '../../lib/products';
import { ProductCard } from '../ui/ProductCard';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { SectionHeader } from '../ui/SectionHeader';
import { AuthModal } from './AuthModal';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Check } from 'lucide-react';

interface Props {
  initialProducts?: Product[];
}

export const HomeTrendingProducts: React.FC<Props> = ({ initialProducts }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [savingCartId, setSavingCartId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth modal
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalData, setAuthModalData] = useState<{ url?: string; creatorName?: string; productName?: string }>({});

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

  useEffect(() => {
    let isMounted = true;
    if (!initialProducts || initialProducts.length === 0) {
      getTrendingProducts()
        .then(async ({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            setFetchError(error);
            setLoading(false);
            return;
          }
          const items = data || [];
          setProducts(items);

          // Check cart status for items
          if (items.length > 0 && isSupabaseConfigured && supabase) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (session?.user) {
                const statusMap: Record<string, boolean> = {};
                await Promise.all(
                  items.map(async (p) => {
                    statusMap[p.id] = await isInCart(p.id);
                  })
                );
                if (isMounted) setInCartMap(statusMap);
              }
            } catch {}
          }
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setFetchError(err instanceof Error ? err.message : 'Failed to load trending products');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [initialProducts]);

  const handleToggleCart = useCallback(async (e: React.MouseEvent, productId: string) => {
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
  }, []);

  const handleAuthRequired = useCallback((data: { url?: string; creatorName?: string; productName?: string }) => {
    setAuthModalData(data);
    setAuthModalOpen(true);
  }, []);

  // Hidden when empty
  if (!loading && products.length === 0 && !fetchError) {
    return null;
  }

  return (
    <section className="space-y-4 sm:space-y-6" id="trending-products">
      <SectionHeader
        title="Trending Products"
        badge="Curated Edit"
        subtitle="Top hand-curated pieces from verified independent creators."
        viewAllHref="/catalog"
        viewAllText="View All"
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

      {/* Loading Skeletons */}
      {loading && (
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none gap-3 sm:gap-4 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible pb-2 sm:pb-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="snap-start flex-shrink-0 w-[240px] sm:w-auto">
              <ProductCardSkeleton />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && fetchError && (
        <div className="p-6 text-center bg-[#FAF6F0] rounded-2xl border border-[#30251F]/10">
          <p className="text-xs text-[#9E4A2B] font-semibold">Unable to load trending products right now.</p>
        </div>
      )}

      {/* Horizontally scrollable row on mobile with scroll-snap, responsive grid on desktop */}
      {!loading && products.length > 0 && (
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none gap-3 sm:gap-4 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible pb-2 sm:pb-0">
          {products.map((product, idx) => (
            <div key={product.id} className="snap-start flex-shrink-0 w-[240px] sm:w-auto">
              <ProductCard
                product={product}
                priority={idx < 2}
                inCart={Boolean(inCartMap[product.id])}
                isSavingCart={savingCartId === product.id}
                isLoggedIn={isLoggedIn}
                onToggleCart={handleToggleCart}
                onToast={setToastMessage}
                onAuthRequired={handleAuthRequired}
              />
            </div>
          ))}
        </div>
      )}

      {/* Auth Modal for logged out Contact / Save actions */}
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

export default HomeTrendingProducts;

