import React, { useState, useEffect, useRef } from 'react';
import {
  listFeaturedAdmin,
  addFeatured,
  removeFeatured,
  reorderFeatured,
  searchApprovedProducts,
  searchApprovedBrands,
  listCategoriesAdmin,
  type HomeFeaturedSection,
  type HomeFeaturedItemAdmin,
} from '../../../lib/home';
import type { Category } from '../../../lib/products';
import { getCategoryImageUrl } from '../../../lib/categories';
import {
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Tag,
  Store,
  ShoppingBag,
  AlertCircle,
  X,
} from 'lucide-react';
import { EmptyState } from '../../ui/EmptyState';

export interface AdminFeaturedSectionManagerProps {
  section: HomeFeaturedSection;
  title: string;
  maxLimit: number;
  helpText: string;
  allowReorder?: boolean;
  isNewArrivals?: boolean;
  onNotify: (message: string, isError?: boolean) => void;
}

interface CandidateItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
}

export const AdminFeaturedSectionManager: React.FC<AdminFeaturedSectionManagerProps> = ({
  section,
  title,
  maxLimit,
  helpText,
  allowReorder = true,
  isNewArrivals = false,
  onNotify,
}) => {
  const [items, setItems] = useState<HomeFeaturedItemAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [remainingCategories, setRemainingCategories] = useState<Category[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await listFeaturedAdmin(section);
    if (error) {
      onNotify(`Error loading ${title}: ${error}`, true);
    } else {
      setItems(data);
    }

    if (section === 'trending_categories') {
      const { data: catData } = await listCategoriesAdmin(section);
      setRemainingCategories(catData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();

    const handleCategoriesUpdated = () => {
      if (section === 'trending_categories') {
        loadItems();
      }
    };
    window.addEventListener('rablo:categories-updated', handleCategoriesUpdated);
    return () => window.removeEventListener('rablo:categories-updated', handleCategoriesUpdated);
  }, [section]);

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 300 ms debounced search for products or brands
  useEffect(() => {
    if (section === 'trending_categories') return;

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setCandidates([]);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      if (section === 'trending_products' || section === 'new_arrivals') {
        const { data, error } = await searchApprovedProducts(trimmed, section);
        if (error) {
          onNotify(`Search failed: ${error}`, true);
        } else {
          setCandidates(
            (data || []).map((p) => ({
              id: p.id,
              title: p.name,
              subtitle: p.price ? `₹${p.price.toLocaleString('en-IN')}` : undefined,
              imageUrl: p.thumbnail_url,
            }))
          );
          setIsDropdownOpen(true);
        }
      } else if (section === 'trending_creators') {
        const { data, error } = await searchApprovedBrands(trimmed, section);
        if (error) {
          onNotify(`Search failed: ${error}`, true);
        } else {
          setCandidates(
            (data || []).map((b) => ({
              id: b.id,
              title: b.name,
              subtitle: b.tagline || (b.slug ? `@${b.slug}` : undefined),
              imageUrl: b.logo_url,
            }))
          );
          setIsDropdownOpen(true);
        }
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, section]);

  const handleAddItem = async (targetId: string, itemName?: string) => {
    if (!isNewArrivals && items.length >= maxLimit) {
      onNotify(
        `Section full (max ${maxLimit}). Remove an existing item before adding a new one.`,
        true
      );
      return;
    }

    setActionLoading(true);
    setIsDropdownOpen(false);
    setSearchQuery('');

    const { error } = await addFeatured(section, targetId);
    if (error) {
      onNotify(`Failed to add item: ${error}`, true);
    } else {
      onNotify(`Added ${itemName ? `"${itemName}"` : 'item'} to ${title}!`);
      await loadItems();
    }
    setActionLoading(false);
  };

  const handleRemoveItem = async (item: HomeFeaturedItemAdmin) => {
    const itemName =
      item.product?.name || item.brand?.name || item.category?.name || 'this item';

    const confirmMessage = isNewArrivals
      ? `Remove "${itemName}" from New Arrivals?\n\nNote: The product itself will NOT be deleted.`
      : `Remove "${itemName}" from ${title}?`;

    if (!window.confirm(confirmMessage)) return;

    const previousItems = [...items];
    // Optimistic removal
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    const { success, error } = await removeFeatured(section, item.id);
    if (!success || error) {
      setItems(previousItems);
      onNotify(`Failed to remove item: ${error || 'Unknown error'}`, true);
    } else {
      onNotify(
        isNewArrivals
          ? `Removed "${itemName}" from New Arrivals (product preserved)`
          : `Removed "${itemName}" from ${title}`
      );
      if (section === 'trending_categories') {
        const { data: catData } = await listCategoriesAdmin(section);
        setRemainingCategories(catData || []);
      }
    }
  };

  const handleReorder = async (currentIndex: number, direction: 'up' | 'down') => {
    if (!allowReorder) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const previousItems = [...items];
    const updated = [...items];
    const [moved] = updated.splice(currentIndex, 1);
    updated.splice(targetIndex, 0, moved);

    // Optimistic reorder
    const updatedWithPos = updated.map((item, idx) => ({ ...item, position: idx }));
    setItems(updatedWithPos);

    const orderedIds = updatedWithPos.map((i) => i.id);
    const { success, error } = await reorderFeatured(section, orderedIds);

    if (!success || error) {
      setItems(previousItems);
      onNotify(`Failed to reorder items: ${error || 'Unknown error'}`, true);
    } else {
      onNotify(`${title} order updated`);
    }
  };

  const isFull = !isNewArrivals && items.length >= maxLimit;

  return (
    <div className="p-5 bg-ivory-100 border border-espresso-900/10 rounded-2xl space-y-5">
      {/* Section Header with Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display font-bold text-base text-espresso-900">
              {title}
            </h3>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isFull
                  ? 'bg-peach-500/15 text-peach-700 border border-peach-500/30'
                  : 'bg-sage/15 text-sage-800 border border-sage/25'
              }`}
            >
              {items.length} of {maxLimit}
            </span>
          </div>
          <p className="text-xs text-espresso-600 max-w-xl">{helpText}</p>
        </div>

        {/* Add Controls */}
        <div className="flex-shrink-0 min-w-[240px] sm:max-w-xs relative" ref={searchContainerRef}>
          {section === 'trending_categories' ? (
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const selectedCat = remainingCategories.find((c) => c.id === e.target.value);
                    handleAddItem(e.target.value, selectedCat?.name);
                  }
                }}
                disabled={isFull || actionLoading}
                className={`w-full px-3 py-2 text-xs bg-ivory-50 border rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#9E4A2B] ${
                  isFull
                    ? 'border-espresso-900/10 text-espresso-400 bg-ivory-100 cursor-not-allowed'
                    : 'border-espresso-900/20 text-espresso-900 cursor-pointer'
                }`}
              >
                <option value="">
                  {isFull ? `Section full (max ${maxLimit})` : '+ Add Approved Category...'}
                </option>
                {remainingCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-espresso-400 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (candidates.length > 0) setIsDropdownOpen(true);
                  }}
                  disabled={isFull || actionLoading}
                  placeholder={
                    isFull
                      ? `Section full (max ${maxLimit})`
                      : section === 'trending_creators'
                        ? 'Search approved creators...'
                        : 'Search approved products...'
                  }
                  className={`w-full pl-8 pr-7 py-2 text-xs bg-ivory-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9E4A2B] ${
                    isFull
                      ? 'border-espresso-900/10 text-espresso-400 bg-ivory-100 cursor-not-allowed placeholder:text-espresso-400'
                      : 'border-espresso-900/20 text-espresso-900 placeholder:text-espresso-400'
                  }`}
                />
                {searching ? (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-espresso-800 border-t-transparent rounded-full animate-spin" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setCandidates([]);
                      setIsDropdownOpen(false);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-espresso-400 hover:text-espresso-700"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : null}
              </div>

              {/* Autocomplete Dropdown */}
              {isDropdownOpen && candidates.length > 0 && (
                <div className="absolute right-0 left-0 mt-1.5 bg-ivory-100 border border-espresso-900/15 rounded-xl shadow-soft-lg z-50 max-h-60 overflow-y-auto divide-y divide-espresso-900/10">
                  {candidates.map((c) => (
                    <div
                      key={c.id}
                      className="p-2 hover:bg-ivory-200 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-ivory-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
                          ) : section === 'trending_creators' ? (
                            <Store className="w-4 h-4 text-espresso-500" />
                          ) : (
                            <ShoppingBag className="w-4 h-4 text-espresso-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-espresso-900 truncate">
                            {c.title}
                          </p>
                          {c.subtitle && (
                            <p className="text-[10px] text-espresso-500 truncate">{c.subtitle}</p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddItem(c.id, c.title)}
                        disabled={actionLoading || isFull}
                        className="py-1 px-2.5 rounded-lg bg-espresso-900 text-ivory-100 text-[10px] font-semibold hover:bg-espresso-800 transition-colors flex-shrink-0 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Items List */}
      {loading ? (
        <div className="py-8 text-center text-xs text-espresso-500">
          <div className="inline-block w-5 h-5 border-2 border-espresso-800 border-t-transparent rounded-full animate-spin mb-2" />
          <p>Loading items...</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={`No items in ${title}`}
          description={
            isNewArrivals
              ? 'New arrivals populate automatically when products are approved by the administrator, or you can search and add products above.'
              : `Curate your first item using the search input above. Maximum ${maxLimit} items.`
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const displayName =
              item.product?.name || item.brand?.name || item.category?.name || 'Untitled Item';
            const displaySub =
              item.product?.price !== undefined
                ? `₹${item.product.price.toLocaleString('en-IN')}`
                : item.brand?.tagline || (item.brand?.slug ? `@${item.brand.slug}` : undefined);
            const imageUrl =
              item.product?.thumbnail_url ||
              item.brand?.logo_url ||
              (item.category
                ? item.category.image_url || getCategoryImageUrl(item.category)
                : null);

            return (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-ivory-50 border border-espresso-900/10 rounded-xl hover:border-espresso-900/20 transition-all"
              >
                {/* Thumbnail & Title */}
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <span className="w-5 text-center text-[10px] font-bold text-espresso-400 flex-shrink-0">
                    #{index + 1}
                  </span>

                  <div className="w-10 h-10 rounded-lg bg-ivory-200 border border-espresso-900/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : section === 'trending_categories' ? (
                      <Tag className="w-4 h-4 text-terracotta-600" />
                    ) : section === 'trending_creators' ? (
                      <Store className="w-4 h-4 text-espresso-500" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-espresso-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-espresso-900 truncate">
                      {displayName}
                    </p>
                    {displaySub && (
                      <p className="text-[11px] text-espresso-500 truncate">{displaySub}</p>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap self-end sm:self-center flex-shrink-0">
                  {allowReorder && (
                    <>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleReorder(index, 'up')}
                        className={`p-1.5 rounded-lg border border-espresso-900/10 transition-colors ${
                          index === 0
                            ? 'opacity-30 cursor-not-allowed text-espresso-400'
                            : 'hover:bg-ivory-200 text-espresso-700 cursor-pointer'
                        }`}
                        title="Move Up"
                        aria-label={`Move ${displayName} up`}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        disabled={index === items.length - 1}
                        onClick={() => handleReorder(index, 'down')}
                        className={`p-1.5 rounded-lg border border-espresso-900/10 transition-colors ${
                          index === items.length - 1
                            ? 'opacity-30 cursor-not-allowed text-espresso-400'
                            : 'hover:bg-ivory-200 text-espresso-700 cursor-pointer'
                        }`}
                        title="Move Down"
                        aria-label={`Move ${displayName} down`}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item)}
                    className="py-1 px-2.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer inline-flex items-center gap-1 ml-1"
                    title={
                      isNewArrivals
                        ? 'Remove from New Arrivals (does not delete product)'
                        : `Remove from ${title}`
                    }
                    aria-label={`Remove ${displayName} from ${title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isNewArrivals ? 'Remove from New Arrivals' : 'Remove'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note for New Arrivals */}
      {isNewArrivals && (
        <div className="flex items-start gap-2 p-3 bg-ivory-200/60 rounded-xl border border-espresso-900/10 text-[11px] text-espresso-600">
          <AlertCircle className="w-4 h-4 text-terracotta-600 flex-shrink-0 mt-0.5" />
          <p>
            <strong>Note:</strong> Removing an item from New Arrivals only removes it from this curated home page section. The product itself is <strong>not</strong> deleted from the catalog.
          </p>
        </div>
      )}
    </div>
  );
};
