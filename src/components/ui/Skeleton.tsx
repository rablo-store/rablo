import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-[#FAF6F0] rounded-2xl sm:rounded-3xl border border-[#30251F]/10 overflow-hidden p-3 space-y-3 animate-pulse">
      <div className="aspect-square bg-[#EFE9DF] rounded-xl sm:rounded-2xl" />
      <div className="space-y-2 pt-1">
        <div className="h-3 bg-[#EFE9DF] rounded-full w-24" />
        <div className="h-4 bg-[#EFE9DF] rounded-full w-3/4" />
        <div className="h-4 bg-[#EFE9DF] rounded-full w-16" />
      </div>
      <div className="pt-2 flex gap-2">
        <div className="h-9 bg-[#EFE9DF] rounded-full flex-1" />
        <div className="h-9 bg-[#EFE9DF] rounded-full flex-1" />
      </div>
    </div>
  );
};

export const CatalogSkeletonGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
};

export default ProductCardSkeleton;

