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
  const [loading, setLoading] = useState(!initialCreators);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!initialCreators) {
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
            <div
              key={i}
              className="snap-start flex-shrink-0 w-[200px] sm:w-auto p-6 rounded-2xl sm:rounded-3xl bg-[#FAF6F0] border border-[#30251F]/10 flex flex-col items-center animate-pulse"
            >
              <div className="w-18 h-18 rounded-full bg-[#EFE9DF] mb-3" />
              <div className="h-4 w-24 bg-[#EFE9DF] rounded-md mb-2" />
              <div className="h-3 w-32 bg-[#EFE9DF] rounded-md" />
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

