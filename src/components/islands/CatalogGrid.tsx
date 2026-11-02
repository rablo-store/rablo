import React, { useState, useEffect, useMemo } from 'react';
import { getApprovedProducts, getApprovedCategories, type Product, type Category } from '../../lib/products';
import { addToCart, isInCart } from '../../lib/cart';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { Search, ExternalLink, ShoppingBag, Check, X, Eye, Sparkles, Filter } from 'lucide-react';

interface Props {
  initialProducts?: Product[];
  initialCategory?: string;
}

export const CatalogGrid: React.FC<Props> = ({ initialProducts, initialCategory }) => {
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts || []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'under1000' | '1000to2000' | 'above2000'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price-asc' | 'price-desc'>('newest');
  const [loading, setLoading] = useState(!initialProducts);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [inCartMap, setInCartMap] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Load products & categories
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cats, prods] = await Promise.all([
          getApprovedCategories(),
          getApprovedProducts(undefined), // fetch all to calculate cross-category counts
        ]);
        setCategories(cats);
        setAllProducts(prods);

        if (isSupabaseConfigured && supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const statusMap: Record<string, boolean> = {};
            await Promise.all(
              prods.map(async (p) => {
                statusMap[p.id] = await isInCart(p.id);
              })
            );
            setInCartMap(statusMap);
          }
        }
      } catch (err) {
        console.error('Failed to load catalog data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Compute category count map
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: allProducts.length };
    allProducts.forEach((p) => {
      const slug = p.category?.slug;
      if (slug) {
        map[slug] = (map[slug] || 0) + 1;
      }
    });
    return map;
  }, [allProducts]);

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        // Category filter
        if (selectedCategory !== 'all' && p.category?.slug !== selectedCategory) {
          return false;
        }

        // Price filter
        if (priceFilter === 'under1000' && p.price >= 1000) return false;
        if (priceFilter === '1000to2000' && (p.price < 1000 || p.price > 2000)) return false;
        if (priceFilter === 'above2000' && p.price <= 2000) return false;

        // Search query
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        return (
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          (p.seller?.full_name && p.seller.full_name.toLowerCase().includes(query)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(query)) ||
          (p.seller_ig_url && p.seller_ig_url.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'price-desc') return b.price - a.price;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [allProducts, selectedCategory, priceFilter, searchQuery, sortBy]);

  const handleAddToCart = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isSupabaseConfigured || !supabase) {
      window.location.href = `/account?redirect=/catalog`;
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      window.location.href = `/account?redirect=/catalog`;
      return;
    }

    setAddingId(productId);
    const result = await addToCart(productId);
    setAddingId(null);

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

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-charcoal-900 text-ivory-100 px-5 py-3.5 rounded-sm shadow-soft-lg z-50 text-xs font-medium flex items-center gap-2.5 border border-charcoal-700 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-sage-500/20 text-sage-300 flex items-center justify-center flex-shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CUMID Search & Filter Controls */}
      <div className="space-y-4 mb-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-charcoal-800/10">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search creator, craft, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-ivory-100 border border-charcoal-800/20 rounded-sm text-xs text-charcoal-800 placeholder:text-charcoal-500/70 focus:outline-none focus:ring-2 focus:ring-lavender-600 focus:bg-ivory-50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 justify-between sm:justify-end text-xs text-charcoal-700">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-charcoal-500" />
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-ivory-100 border border-charcoal-800/20 rounded-sm px-2.5 py-1.5 text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-lavender-600 cursor-pointer"
              >
                <option value="newest">Newest First</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Price Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] uppercase tracking-wider text-charcoal-500 font-semibold mr-1 flex-shrink-0">
            Budget:
          </span>
          {[
            { id: 'all', label: 'All Prices' },
            { id: 'under1000', label: 'Under ₹1,000' },
            { id: '1000to2000', label: '₹1,000 – ₹2,000' },
            { id: 'above2000', label: '₹2,000+' },
          ].map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setPriceFilter(chip.id as any)}
              className={`px-3 py-1 rounded-full text-xs transition-colors flex-shrink-0 cursor-pointer ${
                priceFilter === chip.id
                  ? 'bg-charcoal-800 text-ivory-100 font-medium'
                  : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-700 border border-charcoal-800/15'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* CUMID Collection Links / Category Navigation */}
      <nav className="collection-links mb-8" aria-label="Catalog categories">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`cursor-pointer transition-colors pb-1 text-xs sm:text-sm ${
            selectedCategory === 'all'
              ? 'text-lavender-700 underline underline-offset-8 font-semibold'
              : 'text-charcoal-800 hover:text-lavender-700'
          }`}
        >
          All creations {categoryCounts.all ? `(${categoryCounts.all})` : ''}
        </button>
        {categories.map((cat) => {
          const count = categoryCounts[cat.slug] || 0;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.slug)}
              className={`cursor-pointer transition-colors pb-1 text-xs sm:text-sm flex items-center gap-1.5 ${
                selectedCategory === cat.slug
                  ? 'text-lavender-700 underline underline-offset-8 font-semibold'
                  : 'text-charcoal-800 hover:text-lavender-700'
              }`}
            >
              <span>{cat.name}</span>
              {count > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-charcoal-800/10 rounded-full font-mono">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Loading State */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-2 border-charcoal-800 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-xs text-charcoal-500">Loading verified creator creations...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="text-center py-20 px-6 bg-ivory-100 border border-charcoal-800/10 rounded-sm my-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-lavender-100 text-lavender-700 mx-auto flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-base font-display font-medium text-charcoal-900 mb-1">
              No matching creations found
            </p>
            <p className="text-xs text-charcoal-600 max-w-md mx-auto leading-relaxed">
              {searchQuery || priceFilter !== 'all'
                ? 'Try clearing your search query or adjusting your price filters.'
                : 'Run the setup SQL script in your Supabase SQL Editor to populate verified showcase products!'}
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            {(searchQuery || priceFilter !== 'all' || selectedCategory !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setPriceFilter('all');
                  setSelectedCategory('all');
                }}
                className="btn-secondary py-2.5 px-4 text-xs"
              >
                Reset Filters
              </button>
            )}
            <a href="/seller/upload" className="btn-primary py-2.5 px-4 text-xs">
              List Your Creation ↗
            </a>
          </div>
        </div>
      ) : (
        /* CUMID 3-Column Cover Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {filteredProducts.map((product) => {
            const inCart = inCartMap[product.id];
            const isAdding = addingId === product.id;

            return (
              <article key={product.id} className="product-card flex flex-col group">
                {/* Product Art Stage in CUMID beige backing */}
                <div className="product-art bg-[#eee9e1] aspect-square rounded-sm overflow-hidden relative shadow-soft">
                  <a
                    href={`/products/${product.id}`}
                    aria-label={`View ${product.name} details`}
                    className="block w-full h-full p-6 sm:p-8 flex items-center justify-center"
                  >
                    {product.thumbnail_url ? (
                      <img
                        src={product.thumbnail_url}
                        alt={product.name}
                        loading="lazy"
                        className="w-full h-full object-contain rounded-sm transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-charcoal-400 font-serif text-3xl">
                        ✦
                      </div>
                    )}
                  </a>

                  {/* Category Pill Tag */}
                  {product.category && (
                    <div className="absolute top-3 left-3">
                      <span className="badge-preview">
                        {product.category.name}
                      </span>
                    </div>
                  )}

                  {/* Stock / Limited Batch Badge */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={product.stock > 0 ? 'badge-preview' : 'badge-sold-out'}>
                      {product.stock > 0 ? `${product.stock} in batch` : 'Sold out'}
                    </span>
                  </div>

                  {/* Quick Preview Hover Trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setQuickViewProduct(product);
                    }}
                    className="absolute bottom-3 right-3 bg-charcoal-900/80 hover:bg-charcoal-900 text-ivory-100 p-2 rounded-sm backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Quick Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                {/* Product Metadata */}
                <div className="pt-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between text-xs text-charcoal-500 mb-1.5">
                    <span className="font-medium text-charcoal-700 truncate max-w-[170px]">
                      {product.seller?.full_name || 'Verified Creator'}
                    </span>
                    <span className="text-[11px] text-lavender-700 font-medium flex-shrink-0">
                      Direct Instagram DM
                    </span>
                  </div>

                  <h3 className="font-display font-medium text-base text-charcoal-900 group-hover:text-lavender-800 transition-colors mb-1">
                    <a href={`/products/${product.id}`}>{product.name}</a>
                  </h3>

                  <p className="text-xs text-charcoal-600 line-clamp-2 leading-relaxed mb-3 flex-1">
                    {product.description}
                  </p>

                  <div className="text-sm font-semibold text-charcoal-900 mb-4 flex items-center justify-between">
                    <span>₹{product.price}</span>
                    <span className="text-[11px] text-charcoal-500 font-normal">
                      0% platform fee
                    </span>
                  </div>

                  {/* Actions in CUMID Button Layout */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-charcoal-800/10">
                    <button
                      type="button"
                      onClick={(e) => handleAddToCart(e, product.id)}
                      disabled={isAdding || inCart}
                      className={`inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-sm text-xs font-medium transition-colors border ${
                        inCart
                          ? 'bg-sage-100 text-sage-700 border-sage-300 cursor-default'
                          : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-800 border-charcoal-800/20'
                      }`}
                    >
                      {inCart ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>In Cart</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>{isAdding ? 'Adding...' : 'Save to Cart'}</span>
                        </>
                      )}
                    </button>

                    <a
                      href={product.product_ig_url || product.seller_ig_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-sm text-xs font-medium bg-charcoal-800 hover:bg-charcoal-700 text-ivory-100 transition-colors"
                    >
                      <span>Chat on IG</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-charcoal-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="bg-ivory-100 max-w-2xl w-full rounded-sm border border-charcoal-800/20 shadow-soft-lg overflow-hidden flex flex-col md:flex-row relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-ivory-50/80 hover:bg-ivory-300 text-charcoal-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Left Image */}
            <div className="w-full md:w-1/2 bg-[#eee9e1] p-8 flex items-center justify-center aspect-square md:aspect-auto">
              <img
                src={quickViewProduct.thumbnail_url || ''}
                alt={quickViewProduct.name}
                className="max-h-72 object-contain rounded-sm"
              />
            </div>

            {/* Right Info */}
            <div className="p-6 md:p-8 w-full md:w-1/2 flex flex-col justify-between space-y-4">
              <div>
                <span className="eyebrow !mb-1">
                  {quickViewProduct.category?.name || 'Creator Discovery'}
                </span>
                <h3 className="font-display font-medium text-xl text-charcoal-900 mb-2">
                  {quickViewProduct.name}
                </h3>
                <div className="text-xl font-bold text-charcoal-900 mb-3">
                  ₹{quickViewProduct.price}
                </div>
                <p className="text-xs text-charcoal-600 leading-relaxed max-h-36 overflow-y-auto">
                  {quickViewProduct.description}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-charcoal-800/10">
                <a
                  href={quickViewProduct.product_ig_url || quickViewProduct.seller_ig_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full py-3 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <span>Chat with Creator on IG</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
                <a
                  href={`/products/${quickViewProduct.id}`}
                  className="btn-secondary w-full py-2.5 text-xs font-medium text-center block"
                >
                  Full Creation Details ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogGrid;
