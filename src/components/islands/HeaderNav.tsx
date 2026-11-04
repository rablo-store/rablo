import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Menu,
  ShoppingBag,
  BookOpen,
  HelpCircle,
  Store,
  ChevronRight,
  ArrowRight,
  Sparkles,
  Tag,
} from 'lucide-react';
import CartButton from './CartButton';
import HeaderAuthButton from './HeaderAuthButton';
import {
  getApprovedProducts,
  getApprovedCategories,
  type Product,
  type Category,
} from '../../lib/products';

interface Props {
  logoUrl: string;
}

interface NavItem {
  label: string;
  href: string;
  sectionId: string | null;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_LINKS: NavItem[] = [
  {
    label: 'Catalog',
    href: '/catalog',
    sectionId: null,
    icon: ShoppingBag,
    description: 'Browse verified indie creations',
  },
  {
    label: 'Seller Hub',
    href: '/seller',
    sectionId: null,
    icon: Store,
    description: 'Manage your Instagram shop listings',
  }
];

export const HeaderNav: React.FC<Props> = ({ logoUrl }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Lazy load product & category data for top search suggestions
  const ensureCacheLoaded = async () => {
    if (isCacheLoaded) return;
    try {
      const [prods, cats] = await Promise.all([
        getApprovedProducts(),
        getApprovedCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setIsCacheLoaded(true);
    } catch (err) {
      console.warn('Rablo: Error loading search cache:', err);
    }
  };

  // Sync searchQuery with URL on mount & listen to cross-component search events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlQuery = new URLSearchParams(window.location.search).get('q');
      if (urlQuery) {
        setSearchQuery(urlQuery);
      }
    }

    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (typeof customEvent.detail?.query === 'string') {
        setSearchQuery(customEvent.detail.query);
      }
    };

    window.addEventListener('rablo:search', handleGlobalSearch);
    return () => window.removeEventListener('rablo:search', handleGlobalSearch);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown or mobile menu on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter matching categories and products for live suggestions
  const { matchingCategories, matchingProducts } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || q.length < 2) {
      return { matchingCategories: [], matchingProducts: [] };
    }

    const catMatches = categories
      .filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
      .slice(0, 3);

    const prodMatches = products
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.seller?.full_name && p.seller.full_name.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q))
        );
      })
      .slice(0, 4);

    return { matchingCategories: catMatches, matchingProducts: prodMatches };
  }, [searchQuery, categories, products]);

  // Execute search submission across views
  const executeSearch = (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    setIsDropdownOpen(false);
    setIsMenuOpen(false);

    window.dispatchEvent(new CustomEvent('rablo:search', { detail: { query: q } }));

    const isHome = window.location.pathname === '/' || window.location.pathname === '';
    const isCatalog = window.location.pathname === '/catalog';

    if (isHome) {
      const shopEl = document.getElementById('shop');
      if (shopEl) {
        shopEl.scrollIntoView({ behavior: 'smooth' });
      }
      const newUrl = q ? `/?q=${encodeURIComponent(q)}#shop` : '/#shop';
      window.history.replaceState(null, '', newUrl);
    } else if (isCatalog) {
      const newUrl = q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog';
      window.history.replaceState(null, '', newUrl);
    } else {
      window.location.href = `/?q=${encodeURIComponent(q)}#shop`;
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsDropdownOpen(false);
    window.dispatchEvent(new CustomEvent('rablo:search', { detail: { query: '' } }));
    if (window.location.search.includes('q=')) {
      const newUrl = window.location.pathname + (window.location.hash || '');
      window.history.replaceState(null, '', newUrl);
    }
  };

  const handleNavClick = (e: React.MouseEvent, item: NavItem) => {
    setIsMenuOpen(false);
    const isHome = window.location.pathname === '/' || window.location.pathname === '';
    if (item.sectionId && isHome) {
      const target = document.getElementById(item.sectionId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', `#${item.sectionId}`);
        window.dispatchEvent(
          new CustomEvent('rablo:section-change', { detail: { sectionId: item.sectionId } })
        );
      }
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* ── TOP HEADER ROW: Logo + (Nav Links on Desktop) + Search Bar (Middle on All Screens) + Actions + Hamburger ── */}
      <div className="header-inner-row flex items-center justify-between h-14 sm:h-16 lg:h-20 gap-1 sm:gap-3 xl:gap-5 min-w-0">
        {/* Brand Logo Lockup */}
        <a
          href="/"
          className="header-brand-lockup flex-none flex items-center gap-1.5 sm:gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-600 rounded-lg p-0.5 sm:p-1"
          aria-label="Rablo Home"
        >
          <img
            src={logoUrl}
            alt="rablo logo"
            className="w-6 h-6 sm:w-8 sm:h-8 lg:w-9 lg:h-9 object-contain transition-transform group-hover:scale-105"
            width="36"
            height="36"
            loading="eager"
            decoding="sync"
          />
          <span
            translate="no"
            className="notranslate font-display text-lg sm:text-2xl font-bold tracking-tight text-[#7C0E44] group-hover:text-[#5F0A34] transition-colors lowercase select-none"
          >
            rablo
          </span>
        </a>

        {/* ── DESKTOP NAVIGATION (The 4 Options on Big Screen: md+ / lg+) ── */}
        <nav
          className="header-nav-container hidden md:flex items-center space-x-3.5 lg:space-x-6 xl:space-x-7 flex-shrink-0"
          aria-label="Main Desktop Navigation"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link)}
              className="text-xs lg:text-sm font-medium text-charcoal-800 hover:text-lavender-700 transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-lavender-600 hover:after:w-full after:transition-all cursor-pointer whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* ── SEARCH BAR: IN THE MIDDLE ON THE SAME LINE AS THE LOGO (PERFECT FIT ON ALL SCREENS) ── */}
        <div
          ref={searchContainerRef}
          className="header-search-container flex flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-md xl:max-w-lg mx-1.5 sm:mx-3 lg:mx-4 relative"
        >
          <div className="relative w-full">
            <Search className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-charcoal-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search creations..."
              value={searchQuery}
              onFocus={() => {
                ensureCacheLoaded();
                if (searchQuery.trim().length >= 2) setIsDropdownOpen(true);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                ensureCacheLoaded();
                setIsDropdownOpen(val.trim().length >= 2);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  executeSearch();
                }
              }}
              className="w-full pl-7 sm:pl-9 pr-6 sm:pr-8 py-1.5 sm:py-2 bg-ivory-100/95 hover:bg-ivory-100 border border-charcoal-800/15 rounded-full text-[11px] sm:text-xs text-charcoal-900 placeholder:text-charcoal-500/70 focus:outline-none focus:ring-1.5 sm:focus:ring-2 focus:ring-[#7C0E44] focus:bg-ivory-50 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700 p-0.5 rounded-full"
                title="Clear search"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>

          {/* Live Suggestions Dropdown (Desktop & Mobile) */}
          {isDropdownOpen && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-ivory-100 border border-charcoal-800/15 rounded-md shadow-soft-lg z-50 overflow-hidden divide-y divide-charcoal-800/10 animate-fade-in max-h-80 overflow-y-auto">
              {matchingCategories.length > 0 && (
                <div className="p-2 sm:p-2.5 bg-ivory-50">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500 mb-1 px-1">
                    Matching Categories
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {matchingCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => executeSearch(cat.name)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] bg-ivory-200 hover:bg-lavender-100 text-charcoal-800 hover:text-lavender-800 border border-charcoal-800/10 transition-colors cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5 text-lavender-600" />
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchingProducts.length > 0 ? (
                <div className="p-1.5 sm:p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-500 mb-1 px-1">
                    Matching Creations
                  </p>
                  {matchingProducts.map((p) => (
                    <a
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="flex items-center gap-2 p-1.5 sm:p-2 rounded-sm hover:bg-ivory-200 transition-colors group"
                    >
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-sm bg-[#eee9e1] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-charcoal-400">✦</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-charcoal-900 truncate group-hover:text-[#7C0E44] transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-charcoal-500 truncate">
                          by {p.seller?.full_name || 'Verified Creator'} · ₹{p.price}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : matchingCategories.length === 0 ? (
                <div className="p-3 sm:p-4 text-center text-xs text-charcoal-600">
                  No direct matches for "{searchQuery}". Press Enter to search catalog.
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => executeSearch()}
                className="w-full px-3 py-2 sm:py-2.5 text-left text-xs font-semibold text-[#7C0E44] hover:bg-[#7C0E44]/5 flex items-center justify-between transition-colors bg-ivory-50 cursor-pointer"
              >
                <span>View all search results for "{searchQuery}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#7C0E44]" />
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT HEADER ACTIONS ── */}
        <div className="header-right-actions flex items-center gap-0.5 sm:gap-2 lg:gap-3 flex-shrink-0">
          <CartButton />
          <HeaderAuthButton />

          <a
            href="/seller/upload"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 lg:px-4 py-2 rounded-sm text-xs font-medium bg-ivory-200 hover:bg-ivory-300 text-charcoal-800 border border-charcoal-800/20 transition-all hover:border-charcoal-800/40 whitespace-nowrap"
          >
            <span>+ List Product</span>
          </a>

          {/* ── MOBILE MENU BUTTON (Hamburger ☰ / X) on Smaller Screens ── */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-1.5 sm:p-2 rounded-full text-charcoal-800 hover:bg-ivory-300 active:bg-ivory-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C0E44] cursor-pointer"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-charcoal-800" />
            ) : (
              <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-charcoal-800" />
            )}
          </button>
        </div>
      </div>

      {/* ── ON SMALL SCREEN LIKE FOR MOBILE: ADD OTHER 4 OPTIONS IN THE MENU ── */}
      {isMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-start"
        >
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 bg-charcoal-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Slide-Down Menu Drawer */}
          <div className="relative w-full bg-ivory-200 border-b border-charcoal-800/20 shadow-soft-xl max-h-[88vh] overflow-y-auto z-10 animate-slide-down">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-800/10">
              <div className="flex items-center gap-2">
                <span
                  translate="no"
                  className="notranslate font-display text-xl font-bold tracking-tight text-[#7C0E44] lowercase select-none"
                >
                  rablo
                </span>
                <span className="text-[10px] uppercase tracking-wider text-charcoal-500 font-semibold px-2 py-0.5 rounded-full bg-ivory-100 border border-charcoal-800/10">
                  Menu
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-full text-charcoal-600 hover:text-charcoal-900 hover:bg-ivory-300 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* The 4 Command Options in the Mobile Menu */}
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-500 px-2 mb-2">
                Explore Rablo
              </p>
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link)}
                    className="flex items-center justify-between p-3.5 rounded-sm bg-ivory-100 hover:bg-ivory-50 border border-charcoal-800/10 hover:border-[#7C0E44]/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#7C0E44]/10 text-[#7C0E44] flex items-center justify-center flex-shrink-0 group-hover:bg-[#7C0E44] group-hover:text-ivory-100 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-charcoal-900 group-hover:text-[#7C0E44] transition-colors">
                          {link.label}
                        </p>
                        <p className="text-[11px] text-charcoal-500">
                          {link.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-charcoal-400 group-hover:text-[#7C0E44] transition-transform group-hover:translate-x-0.5" />
                  </a>
                );
              })}
            </div>

            {/* Quick Actions in Mobile Menu */}
            <div className="px-4 pb-6 pt-2 space-y-2.5 border-t border-charcoal-800/10 mt-2">
              <a
                href="/seller/upload"
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-3 px-4 rounded-sm text-xs font-semibold bg-charcoal-800 hover:bg-charcoal-700 text-ivory-100 flex items-center justify-center gap-2 transition-colors shadow-soft"
              >
                <Sparkles className="w-4 h-4 text-[#F6C9DD]" />
                <span>+ List Your Product on Rablo</span>
              </a>

              <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
                <a
                  href="/cart"
                  onClick={() => setIsMenuOpen(false)}
                  className="py-2.5 px-3 rounded-sm bg-ivory-100 hover:bg-ivory-300 border border-charcoal-800/15 text-charcoal-800 font-medium"
                >
                  View Lead Cart
                </a>
                <a
                  href="/account"
                  onClick={() => setIsMenuOpen(false)}
                  className="py-2.5 px-3 rounded-sm bg-ivory-100 hover:bg-ivory-300 border border-charcoal-800/15 text-charcoal-800 font-medium"
                >
                  Account / Portal
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderNav;
