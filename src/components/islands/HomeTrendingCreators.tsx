import React, { useState, useEffect } from 'react';
import { getTrendingCreators } from '../../lib/home';
import type { BrandWithStats } from '../../lib/brands';
import { CreatorCard } from '../ui/CreatorCard';
import { SectionHeader } from '../ui/SectionHeader';

interface Props {
  initialCreators?: BrandWithStats[];
}

export const HomeTrendingCreators: React.FC<Props> = ({ initialCreators }) => {
  const [creators, setCreators] = useState<BrandWithStats[]>(initialCreators || []);
  const [loading, setLoading] = useState(initialCreators === undefined);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (initialCreators === undefined) {
      getTrendingCreators()
        .then(({ data, error }) => {
          if (!isMounted) return;
          if (error) {
            setFetchError(error);
          } else {
            setCreators(data || []);
          }
          setLoading(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setFetchError(err instanceof Error ? err.message : 'Failed to load creators');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [initialCreators]);

  if (!loading && creators.length === 0 && !fetchError) {
    return null;
  }

  return (
    <section className="space-y-4 sm:space-y-6" id="trending-creators">
      <SectionHeader
        title="Featured Creators"
        badge="Independent Makers"
        subtitle="Meet the artisans, craftspeople, and designers behind the pieces."
        viewAllHref="/creators"
        viewAllText="Explore All"
      />

      {loading && (
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none gap-3 sm:gap-4 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible pb-2 sm:pb-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="snap-start flex-shrink-0 w-[220px] sm:w-auto">
              <div
                className="bg-[#FAF6F0] rounded-2xl sm:rounded-3xl border border-[#30251F]/10 p-5 sm:p-6 flex flex-col items-center text-center animate-pulse min-h-[280px] sm:min-h-[300px]"
              >
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-[#EFE9DF] mb-3.5" />
                <div className="h-5 w-28 bg-[#EFE9DF] rounded-md mb-1.5" />
                <div className="h-3.5 w-16 bg-[#EFE9DF] rounded-md mb-2" />
                <div className="h-4 w-20 rounded-full bg-[#EFE9DF] mb-2" />
                <div className="h-3 w-36 bg-[#EFE9DF] rounded-md mb-4" />
                <div className="mt-auto pt-4 w-full border-t border-[#30251F]/10 flex items-center justify-between">
                  <div className="h-3 w-16 bg-[#EFE9DF] rounded-md" />
                  <div className="h-3 w-16 bg-[#EFE9DF] rounded-md" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && fetchError && (
        <div className="p-6 text-center bg-[#FAF6F0] rounded-2xl border border-[#30251F]/10">
          <p className="text-xs text-[#9E4A2B] font-semibold">Unable to load creators right now.</p>
        </div>
      )}

      {!loading && creators.length > 0 && (
        <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none gap-3 sm:gap-4 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 sm:overflow-visible pb-2 sm:pb-0">
          {creators.map((creator) => (
            <div key={creator.id} className="snap-start flex-shrink-0 w-[220px] sm:w-auto">
              <CreatorCard
                name={creator.name}
                slug={creator.slug}
                avatarUrl={creator.logo_url}
                instagramUrl={creator.instagram_url}
                craft={creator.creator_type}
                tagline={creator.tagline}
                isVerified={creator.is_verified}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default HomeTrendingCreators;

