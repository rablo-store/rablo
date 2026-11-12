import React, { useState, useEffect } from 'react';
import type { Category } from '../../lib/products';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterState {
  categories: string[]; // category slugs
  minPrice: number;
  maxPrice: number;
  creatorTypes: ('individual' | 'small_brand' | 'madetoorder')[];
}

export interface FilterPanelProps {
  categories: Category[];
  categoryCounts: Record<string, number>;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClearAll: () => void;
  onClose?: () => void;
  isDrawer?: boolean;
  onApply?: () => void;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  categories,
  categoryCounts,
  filters,
  onChange,
  onClearAll,
  onClose,
  isDrawer = false,
  onApply,
  className = '',
}) => {
  // Local state for drawer mode (allows Cancel vs Apply)
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [creatorTypeOpen, setCreatorTypeOpen] = useState(true);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const current = isDrawer ? localFilters : filters;

  const update = (patch: Partial<FilterState>) => {
    const next = { ...current, ...patch };
    if (isDrawer) {
      setLocalFilters(next);
    } else {
      onChange(next);
    }
  };

  const toggleCategory = (slug: string) => {
    const exists = current.categories.includes(slug);
    const updated = exists
      ? current.categories.filter((s) => s !== slug)
      : [...current.categories, slug];
    update({ categories: updated });
  };

  const toggleCreatorType = (type: 'individual' | 'small_brand' | 'madetoorder') => {
    const exists = current.creatorTypes.includes(type);
    const updated = exists
      ? current.creatorTypes.filter((t) => t !== type)
      : [...current.creatorTypes, type];
    update({ creatorTypes: updated });
  };

  const handlePriceSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    update({ maxPrice: val });
  };

  const handleApply = () => {
    onChange(localFilters);
    onApply?.();
  };

  const handleReset = () => {
    const resetState: FilterState = {
      categories: [],
      minPrice: 0,
      maxPrice: 5000,
      creatorTypes: [],
    };
    if (isDrawer) {
      setLocalFilters(resetState);
    } else {
      onChange(resetState);
    }
    onClearAll();
  };

  return (
    <aside className={`flex flex-col h-full bg-[#FAF6F0] ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#30251F]/10">
        <div className="flex items-center gap-2">
          {isDrawer && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 -ml-1 text-[#30251F] hover:bg-[#EBE3D7] rounded-full transition-colors cursor-pointer"
              aria-label="Close filters drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <h2 className="font-display font-bold text-lg text-[#30251F]">
            Filters
          </h2>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-[#9E4A2B] hover:text-[#843C22] font-semibold cursor-pointer transition-colors"
        >
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1 text-[#30251F]">
        {/* Category Section */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setCategoryOpen(!categoryOpen)}
            className="flex items-center justify-between w-full font-semibold text-xs tracking-wider uppercase text-[#30251F] cursor-pointer"
          >
            <span>Category</span>
            {categoryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {categoryOpen && (
            <div className="space-y-2 pt-1 pl-0.5">
              {categories.map((cat) => {
                const isChecked = current.categories.includes(cat.slug);
                const count = categoryCounts[cat.slug] || 0;

                return (
                  <label
                    key={cat.id}
                    className="flex items-center justify-between gap-2 text-xs text-[#30251F] cursor-pointer hover:text-[#9E4A2B] transition-colors py-0.5 group"
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(cat.slug)}
                        className="w-4 h-4 rounded text-[#9E4A2B] accent-[#9E4A2B] border-[#30251F]/30 focus:ring-[#9E4A2B] cursor-pointer"
                      />
                      <span className={`${isChecked ? 'font-semibold text-[#9E4A2B]' : ''}`}>
                        {cat.name}
                      </span>
                    </div>
                    {count > 0 && (
                      <span className="text-[10px] text-[#685950] font-mono">
                        {count}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Price Range Section */}
        <div className="space-y-3 pt-3 border-t border-[#30251F]/10">
          <button
            type="button"
            onClick={() => setPriceOpen(!priceOpen)}
            className="flex items-center justify-between w-full font-semibold text-xs tracking-wider uppercase text-[#30251F] cursor-pointer"
          >
            <span>Price Range</span>
            {priceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {priceOpen && (
            <div className="space-y-3.5 pt-1">
              {/* Range Track */}
              <div className="px-1">
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={current.maxPrice}
                  onChange={handlePriceSliderChange}
                  className="w-full h-1.5 bg-[#EBE3D7] rounded-lg appearance-none cursor-pointer accent-[#9E4A2B]"
                />
              </div>

              {/* Min - Max Box Controls */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-[#FAF6F0] border border-[#30251F]/20 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[#685950]">₹0</span>
                </div>
                <div className="bg-[#FAF6F0] border border-[#30251F]/20 rounded-xl px-3 py-2 flex items-center justify-between font-semibold text-[#9E4A2B]">
                  <span>₹{current.maxPrice >= 5000 ? '5,000 +' : current.maxPrice}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Creator Type Section */}
        <div className="space-y-3 pt-3 border-t border-[#30251F]/10">
          <button
            type="button"
            onClick={() => setCreatorTypeOpen(!creatorTypeOpen)}
            className="flex items-center justify-between w-full font-semibold text-xs tracking-wider uppercase text-[#30251F] cursor-pointer"
          >
            <span>Creator Type</span>
            {creatorTypeOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {creatorTypeOpen && (
            <div className="space-y-2 pt-1 pl-0.5">
              <label className="flex items-center gap-2.5 text-xs text-[#30251F] cursor-pointer hover:text-[#9E4A2B] transition-colors py-0.5">
                <input
                  type="checkbox"
                  checked={current.creatorTypes.includes('individual')}
                  onChange={() => toggleCreatorType('individual')}
                  className="w-4 h-4 rounded text-[#9E4A2B] accent-[#9E4A2B] border-[#30251F]/30 focus:ring-[#9E4A2B] cursor-pointer"
                />
                <span>Individual Creator</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-[#30251F] cursor-pointer hover:text-[#9E4A2B] transition-colors py-0.5">
                <input
                  type="checkbox"
                  checked={current.creatorTypes.includes('small_brand')}
                  onChange={() => toggleCreatorType('small_brand')}
                  className="w-4 h-4 rounded text-[#9E4A2B] accent-[#9E4A2B] border-[#30251F]/30 focus:ring-[#9E4A2B] cursor-pointer"
                />
                <span>Small Brand</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-[#30251F] cursor-pointer hover:text-[#9E4A2B] transition-colors py-0.5">
                <input
                  type="checkbox"
                  checked={current.creatorTypes.includes('madetoorder')}
                  onChange={() => toggleCreatorType('madetoorder')}
                  className="w-4 h-4 rounded text-[#9E4A2B] accent-[#9E4A2B] border-[#30251F]/30 focus:ring-[#9E4A2B] cursor-pointer"
                />
                <span>Handmade / Made to Order</span>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Action Buttons (Cancel / Apply Filters) */}
      {isDrawer && (
        <div className="pt-4 border-t border-[#30251F]/10 grid grid-cols-2 gap-3 mt-auto">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-3 text-xs w-full cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn-primary py-3 text-xs w-full cursor-pointer"
          >
            Apply Filters
          </button>
        </div>
      )}
    </aside>
  );
};

export default FilterPanel;

