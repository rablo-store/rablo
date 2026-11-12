import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Flame, Sparkles, CheckCircle2 } from 'lucide-react';
import { listApprovedBrands, type BrandWithStats } from '../../lib/brands';
import { CreatorCard } from '../ui/CreatorCard';
import { EmptyState } from '../ui/EmptyState';

type FilterType = 'all' | 'trending' | 'new' | 'verified';

export const CreatorsList: React.FC = () => {
  const [brands, setBrands] = useState<BrandWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await listApprovedBrands({
          sort: activeFilter === 'new' ? 'new' : activeFilter === 'verified' ? 'verified' : 'trending',
        });
        if (isMounted) {
          setBrands(data);
        }
      } catch (err) {
        console.error('Failed to load creators:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [activeFilter]);

  // Client-side filtering by name, handle (slug), tagline, and active chip
  const filteredBrands = useMemo(() => {
    let list = [...brands];
    const q = searchQuery.toLowerCase().trim();

    if (q) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q) ||
          (b.tagline && b.tagline.toLowerCase().includes(q)) ||
          (b.bio && b.bio.toLowerCase().includes(q))
      );
    }

    if (activeFilter === 'verified') {
      list = list.filter((b) => b.is_verified);
    } else if (activeFilter === 'new') {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (activeFilter === 'trending') {
      list.sort((a, b) => (b.save_count || 0) - (a.save_count || 0));
    }

    return list;
  }, [brands, searchQuery, activeFilter]);

  return (
    <div className="w-full space-y-8">
      {/* Search & Filter Controls (Screen 5) */}
      <div className="space-y-4">
        {/* Search Box */}
        <div className="relative max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8A7A70] pointer-events-none" />
          <input
            type="text"
            id="creator-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search creators (e.g. crochet, art, candles, pottery)..."
            className="w-full pl-10 pr-9 py-3 bg-[#FAF6F0] border border-[#30251F]/15 rounded-full text-xs sm:text-sm text-[#30251F] placeholder:text-[#8A7A70] focus:outline-none focus:ring-2 focus:ring-[#9E4A2B] transition-all shadow-xs"
            aria-label="Search creators"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A7A70] hover:text-[#30251F] p-1 rounded-full cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips (Screen 5: All Creators, Trending, New, Verified — NO Top Rated per anti-guessing rules) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-[#9E4A2B] text-[#FAF6F0] shadow-soft-sm'
                : 'bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/15 hover:bg-[#EBE3D7]'
            }`}
          >
            All Creators
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('trending')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'trending'
                ? 'bg-[#9E4A2B] text-[#FAF6F0] shadow-soft-sm'
                : 'bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/15 hover:bg-[#EBE3D7]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-[#B87555]" />
            <span>Trending</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('new')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'new'
                ? 'bg-[#9E4A2B] text-[#FAF6F0] shadow-soft-sm'
                : 'bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/15 hover:bg-[#EBE3D7]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D9A37B]" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('verified')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'verified'
                ? 'bg-[#9E4A2B] text-[#FAF6F0] shadow-soft-sm'
                : 'bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/15 hover:bg-[#EBE3D7]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#637B58]" />
            <span>Verified</span>
          </button>
        </div>
      </div>

      {/* Grid of Creators */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl p-6 flex flex-col items-center animate-pulse space-y-4"
            >
              <div className="w-20 h-20 rounded-full bg-[#EFE9DF]" />
              <div className="h-4 w-28 bg-[#EFE9DF] rounded-full" />
              <div className="h-3 w-20 bg-[#EFE9DF] rounded-full" />
              <div className="h-3 w-36 bg-[#EFE9DF] rounded-full" />
              <div className="h-8 w-full bg-[#EFE9DF] rounded-full mt-4" />
            </div>
          ))}
        </div>
      ) : filteredBrands.length === 0 ? (
        <EmptyState
          title="No Creators Found"
          description={
            searchQuery
              ? `No independent creators matched "${searchQuery}". Try a different keyword or reset filters.`
              : 'No verified creators found in this view.'
          }
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setActiveFilter('all');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-2">
          {filteredBrands.map((brand) => (
            <CreatorCard
              key={brand.id}
              name={brand.name}
              slug={brand.slug}
              avatarUrl={brand.logo_url}
              instagramUrl={brand.instagram_url}
              tagline={brand.tagline}
              productCount={brand.product_count}
              isVerified={brand.is_verified}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CreatorsList;

