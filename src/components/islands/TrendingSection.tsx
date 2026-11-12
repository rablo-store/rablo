import React, { useState, useEffect } from 'react';
import { getApprovedProducts, type Product } from '../../lib/products';
import { getSaveCounts } from '../../lib/brands';
import { ProductCard } from '../ui/ProductCard';
import { ProductCardSkeleton } from '../ui/Skeleton';
import { AuthModal } from './AuthModal';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Check, X } from 'lucide-react';

interface Props {
  initialProducts?: Product[];
}

export const TrendingSection: React.FC<Props> = ({ initialProducts }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [loading, setLoading] = useState(!initialProducts || initialProducts.length === 0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [savingCartId, setSavingCartId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // AuthModal state
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

    async function loadTrending() {
      try {
        const [prods, saveCounts] = await Promise.all([
          getApprovedProducts(undefined),
          getSaveCounts(),
        ]);

        if (!isMounted) return;

        // Sort by save count descending, then by created_at
        const sorted = [...prods].sort((a, b) => {
          const countA = saveCounts[a.id] || 0;
          const countB = saveCounts[b.id] || 0;
          if (countB !== countA) return countB - countA;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        // Top 4 trending items as depicted in Mockup 1
        const topTrending = sorted.slice(0, 4);
        setProducts(topTrending);

        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const statusMap: Record<string, boolean> = {};
            await Promise.all(
              topTrending.map(async (p) => {
                statusMap[p.id] = await isInCart(p.id);
              })
            );
            if (isMounted) setInCartMap(statusMap);
          }
        }
      } catch (err) {
        console.error('Failed to load trending products:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadTrending();

    return () => {
      isMounted = false;
    };
  }, []);

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
    <div className="w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-[#30251F] text-[#FAF6F0] px-5 py-3.5 rounded-2xl shadow-soft-xl z-50 text-xs font-medium flex items-center gap-2.5 border border-[#30251F]/20 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-[#637B58]/20 text-[#637B58] flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Grid or Skeleton */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-3xl bg-[#FAF6F0] border border-[#30251F]/10">
          <p className="text-sm font-medium text-[#30251F]">Trending creations will appear here soon.</p>
          <a href="/catalog" className="mt-3 inline-block text-xs font-semibold text-[#9E4A2B] hover:underline">
            Explore All Creations &rarr;
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {products.map((product) => (
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

      {/* Global Auth Modal */}
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

export default TrendingSection;
