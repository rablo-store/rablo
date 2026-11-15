import React from 'react';
import { AdminBannerManager } from './AdminBannerManager';
import { AdminFeaturedSectionManager } from './AdminFeaturedSectionManager';
import { HOME_LIMITS } from '../../../lib/home';
import { Layout } from 'lucide-react';

interface AdminHomepageTabProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export const AdminHomepageTab: React.FC<AdminHomepageTabProps> = ({ onNotify }) => {
  return (
    <div className="space-y-10">
      {/* Intro Header */}
      <div className="border-b border-espresso-900/10 pb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="p-1.5 rounded-lg bg-[#9E4A2B]/10 text-[#9E4A2B]">
            <Layout className="w-4 h-4" />
          </span>
          <h2 className="text-xl font-display font-bold text-espresso-900">
            Homepage Layout &amp; Curation
          </h2>
        </div>
        <p className="text-xs text-espresso-600 max-w-2xl">
          Curate the banners and featured sections displayed to shoppers on Rablo&apos;s home page.
          All changes take effect immediately across all devices.
        </p>
      </div>

      {/* 1. Hero Banner Slider Manager */}
      <section>
        <AdminBannerManager onNotify={onNotify} />
      </section>

      {/* 2. Trending Products Manager */}
      <section>
        <AdminFeaturedSectionManager
          section="trending_products"
          title="Trending Products"
          maxLimit={HOME_LIMITS.trendingProducts}
          helpText="Curate up to 12 top-performing or spotlight creations. Displayed in a responsive 4-column product grid with Up/Down custom ordering."
          allowReorder={true}
          onNotify={onNotify}
        />
      </section>

      {/* 3. New Arrivals Manager */}
      <section>
        <AdminFeaturedSectionManager
          section="new_arrivals"
          title="New Arrivals"
          maxLimit={HOME_LIMITS.newArrivals}
          helpText="Displays the newest approved products (max 8 displayed). Newly approved creations are automatically placed at the front. Removing an item removes it from this section without deleting the product."
          allowReorder={false}
          isNewArrivals={true}
          onNotify={onNotify}
        />
      </section>

      {/* 4. Trending Creators Manager */}
      <section>
        <AdminFeaturedSectionManager
          section="trending_creators"
          title="Trending Creators"
          maxLimit={HOME_LIMITS.trendingCreators}
          helpText="Feature up to 8 independent artisan brands and studio storefronts. Reorder with Up/Down."
          allowReorder={true}
          onNotify={onNotify}
        />
      </section>

      {/* 5. Trending Categories Manager */}
      <section>
        <AdminFeaturedSectionManager
          section="trending_categories"
          title="Trending Categories"
          maxLimit={HOME_LIMITS.trendingCategories}
          helpText="Feature up to 4 primary shopping categories on the home page. Reorder with Up/Down."
          allowReorder={true}
          onNotify={onNotify}
        />
      </section>
    </div>
  );
};
