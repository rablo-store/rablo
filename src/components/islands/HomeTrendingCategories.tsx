import React, { useState, useEffect } from 'react';
import { getTrendingCategories } from '../../lib/home';
import type { CategoryWithCount } from '../../lib/products';
import { SectionHeader } from '../ui/SectionHeader';
import {
  ShoppingBag,
  Sparkles,
  Palette,
  Smartphone,
  Gem,
  Shirt,
  Home,
  BookOpen,
  Coffee,
  Heart,
  Tag,
  Scissors,
} from 'lucide-react';

interface Props {
  initialCategories?: CategoryWithCount[];
}

function getCategoryIcon(slug: string) {
  const s = slug.toLowerCase();
  if (s.includes('bag')) return ShoppingBag;
  if (s.includes('pottery') || s.includes('ceramic')) return Coffee;
  if (s.includes('jewel') || s.includes('gem')) return Gem;
  if (s.includes('sticker') || s.includes('stationery') || s.includes('book')) return BookOpen;
  if (s.includes('cloth') || s.includes('apparel') || s.includes('wear')) return Shirt;
  if (s.includes('decor') || s.includes('home') || s.includes('living')) return Home;
  if (s.includes('crochet') || s.includes('knit') || s.includes('craft')) return Scissors;
  if (s.includes('phone') || s.includes('digital') || s.includes('tech')) return Smartphone;
  if (s.includes('art') || s.includes('print')) return Palette;
  if (s.includes('access')) return Sparkles;
  if (s.includes('care') || s.includes('beauty')) return Heart;
  return Tag;
}

export const HomeTrendingCategories: React.FC<Props> = ({ initialCategories }) => {
  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories || []);
  const [loading, setLoading] = useState(!initialCategories);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!initialCategories) {
      getTrendingCategories()
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            setFetchError(error);
          } else {
            setCategories(data || []);
          }
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setFetchError(err instanceof Error ? err.message : 'Failed to load categories');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [initialCategories]);

  if (!loading && categories.length === 0 && !fetchError) {
    return null;
  }

  return (
    <section className="space-y-4 sm:space-y-6" id="trending-categories">
      <SectionHeader
        title="Shop by Category"
        badge="Collections"
        subtitle="Browse handmade, pottery, jewelry, and fashion."
        viewAllHref="/categories"
        viewAllText="All Categories"
      />

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#FAF6F0] rounded-2xl sm:rounded-3xl p-5 border border-[#30251F]/10 flex flex-col items-center animate-pulse"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#EFE9DF] mb-3" />
              <div className="h-4 w-20 bg-[#EFE9DF] rounded-md mb-1.5" />
              <div className="h-3 w-16 bg-[#EFE9DF] rounded-md" />
            </div>
          ))}
        </div>
      )}

      {!loading && fetchError && (
        <div className="p-6 text-center bg-[#FAF6F0] rounded-2xl border border-[#30251F]/10">
          <p className="text-xs text-[#9E4A2B] font-semibold">Unable to load categories right now.</p>
        </div>
      )}

      {!loading && categories.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {categories.map((cat) => {
            const IconComponent = getCategoryIcon(cat.slug);
            return (
              <a
                key={cat.id}
                href={`/catalog?category=${cat.slug}`}
                className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col items-center text-center justify-between shadow-soft-sm hover:shadow-soft hover:border-[#9E4A2B]/30 hover:-translate-y-1 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
              >
                <div className="w-full aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-[#EFE9DF] mb-3 flex items-center justify-center p-4 shadow-xs group-hover:scale-105 transition-transform duration-300">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white/80 shadow-xs flex items-center justify-center text-[#9E4A2B] group-hover:text-[#83381E] group-hover:bg-white transition-colors">
                    <IconComponent className="w-6 h-6 sm:w-8 sm:h-8" />
                  </div>
                </div>

                <div className="w-full space-y-0.5">
                  <h3 className="font-display font-bold text-xs sm:text-sm text-[#30251F] group-hover:text-[#9E4A2B] transition-colors leading-snug">
                    {cat.name}
                  </h3>
                  <p className="text-[10px] sm:text-xs text-[#8A7A70]">
                    {cat.product_count !== undefined
                      ? `${cat.product_count} ${cat.product_count === 1 ? 'item' : 'items'}`
                      : 'Explore'}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default HomeTrendingCategories;

