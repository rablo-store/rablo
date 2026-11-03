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
  ExternalLink,
  Sparkles,
  ArrowRight,
  Tag,
} from 'lucide-react';
import CartButton from './CartButton';
import HeaderAuthButton from './HeaderAuthButton';
import LanguageSelector from './LanguageSelector';
import {
  getApprovedProducts,
  getApprovedCategories,
  type Product,
  type Category,
} from '../../lib/products';

interface NavItem {
  label: string;
  href: string;
  sectionId: string | null;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_LINKS: NavItem[] = [
  {
    label: 'Shop',
    href: '/#shop',
    sectionId: 'shop',
    icon: ShoppingBag,
    description: 'Browse verified indie creations',
  },
  {
    label: 'Our Story',
    href: '/#story',
    sectionId: 'story',
    icon: BookOpen,
    description: 'Direct maker commerce protocol',
  },
  {
    label: 'FAQ',
    href: '/#faq',
    sectionId: 'faq',
    icon: HelpCircle,
    description: 'Zero fees & direct Instagram DM',
  },
  {
    label: 'Sell',
    href: '/seller',
    sectionId: null,
    icon: Store,
    description: 'List your Instagram shop for free',
  },
];

export const HeaderNav: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Lazy load products and categories cache on focus or input
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

  // Sync with global search event if triggered elsewhere
  useEffect(() => {
    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (typeof customEvent.detail?.query === 'string') {
        setSearchQuery(customEvent.detail.query);
      }
    };
    window.addEventListener('rablo:search', handleGlobalSearch);
    return () => window.removeEventListener('rablo:search', handleGlobalSearch);
  }, []);

  // Close dropdown on click outside
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

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Matching categories computed live as user types (e.g. "accessories", "crochet")
  const matchingCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return categories.filter((c) => {
      return (
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, categories]);

  // Matching products computed live as user types (by name, category, seller, description)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return products
      .filter((p) => {
        return (
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.seller?.full_name && p.seller.full_name.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q)) ||
          (p.category?.slug && p.category.slug.toLowerCase().includes(q))
        );
      })
      .slice(0, 6);
  }, [searchQuery, products]);

  // Handle in-page smooth navigation for desktop and mobile drawer
  const handleNavClick = (e: React.MouseEvent, link: NavItem) => {
    setIsMenuOpen(false);
    if (!link.sectionId) {
      return; // Regular link like /seller
    }

    const isHomePage =
      window.location.pathname === '/' || window.location.pathname === '';
    if (isHomePage) {
      e.preventDefault();
      const target = document.getElementById(link.sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, '', `#${link.sectionId}`);
        window.dispatchEvent(
          new CustomEvent('rablo:section-change', {
            detail: { sectionId: link.sectionId },
          })
        );
      }
    }
  };

  // Handle selecting a category from the search bar
  const handleCategorySelect = (categorySlug: string) => {
    setIsDropdownOpen(false);
    setIsMenuOpen(false);
    setSearchQuery('');

    const isHomePage =
      window.location.pathname === '/' || window.location.pathname === '';
    if (isHomePage) {
      const target =
        document.getElementById('shop') ||
        document.getElementById('featured-catalog');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      window.dispatchEvent(
        new CustomEvent('rablo:category-change', {
          detail: { category: categorySlug },
        })
      );
      window.history.pushState(
        null,
        '',
        `#shop?category=${encodeURIComponent(categorySlug)}`
      );
    } else {
      window.location.href = `/#shop?category=${encodeURIComponent(categorySlug)}`;
    }
  };

  // Handle search submit (Enter key or button click)
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    setIsDropdownOpen(false);
    setIsMenuOpen(false);

    // If query matches a category name exactly, switch to that category
    const directCat = categories.find(
      (c) =>
        c.name.toLowerCase() === q.toLowerCase() ||
        c.slug.toLowerCase() === q.toLowerCase()
    );

    const isHomePage =
      window.location.pathname === '/' || window.location.pathname === '';

    if (isHomePage) {
      const target =
        document.getElementById('shop') ||
        document.getElementById('featured-catalog');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }

      if (directCat) {
        window.dispatchEvent(
          new CustomEvent('rablo:category-change', {
            detail: { category: directCat.slug },
          })
        );
        window.history.pushState(
          null,
          '',
          `#shop?category=${encodeURIComponent(directCat.slug)}`
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('rablo:search', { detail: { query: q } })
        );
        window.history.pushState(
          null,
          '',
          `#shop${q ? `?q=${encodeURIComponent(q)}` : ''}`
        );
      }
    } else {
      if (directCat) {
        window.location.href = `/#shop?category=${encodeURIComponent(directCat.slug)}`;
      } else {
        window.location.href = `/#shop?q=${encodeURIComponent(q)}`;
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-between gap-1.5 sm:gap-3 xl:gap-5 min-w-0">
      {/* ── BIG SCREENS (lg+): The 4 Navigation Commands ── */}
      <nav
        className="hidden lg:flex items-center gap-2 xl:gap-4 2xl:gap-6 flex-none"
        aria-label="Main Navigation"
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            onClick={(e) => handleNavClick(e, link)}
            className="header-nav-link text-xs xl:text-sm font-medium text-charcoal-800 hover:text-[#7C0E44] transition-colors py-1 relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-[#7C0E44] hover:after:w-full after:transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* ── SEARCH BOX & BAR ── */}
      {/* On small screens, centered in place of the 3/4 navbar links */}
      {/* On big screens, present alongside all 4 navigation items */}
      <div
        ref={searchContainerRef}
        className="relative flex-1 min-w-[130px] sm:min-w-[160px] max-w-[180px] sm:max-w-xs xl:max-w-sm mx-1 sm:mx-2 lg:mx-0"
      >
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              setIsDropdownOpen(true);
              ensureCacheLoaded();
            }}
            placeholder="Search products or categories..."
            aria-label="Search products or categories"
            className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 text-xs bg-ivory-100 hover:bg-ivory-50 focus:bg-white text-charcoal-800 placeholder:text-charcoal-500/70 border border-charcoal-800/15 focus:border-[#7C0E44] rounded-full focus:outline-none focus:ring-2 focus:ring-[#7C0E44]/20 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                const isHomePage =
                  window.location.pathname === '/' ||
                  window.location.pathname === '';
                if (isHomePage) {
                  window.dispatchEvent(
                    new CustomEvent('rablo:search', { detail: { query: '' } })
                  );
                }
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-700 p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        {/* Live Search Autocomplete Popover (Categories & Products) */}
        {isDropdownOpen && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 sm:right-auto sm:w-80 md:w-96 top-full mt-2 bg-ivory-100 border border-charcoal-800/15 rounded-sm shadow-soft-lg z-50 overflow-hidden divide-y divide-charcoal-800/10 animate-fade-in">
            {/* 1. MATCHING CATEGORIES SECTION */}
            {matchingCategories.length > 0 && (
              <div className="p-2.5 bg-ivory-200/70">
                <div className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-[#7C0E44]" />
                    <span>Matching Categories</span>
                  </span>
                  <span className="font-mono text-[9px] text-charcoal-400">
                    {matchingCategories.length} category
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {matchingCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat.slug)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-ivory-100 hover:bg-[#7C0E44]/10 text-charcoal-800 hover:text-[#7C0E44] border border-charcoal-800/15 transition-all shadow-xs cursor-pointer group"
                    >
                      <Sparkles className="w-3 h-3 text-[#7C0E44] group-hover:scale-110 transition-transform" />
                      <span className="capitalize">{cat.name}</span>
                      <ArrowRight className="w-3 h-3 text-charcoal-400 group-hover:text-[#7C0E44]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 2. MATCHING CREATIONS SECTION */}
            {searchResults.length > 0 ? (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-charcoal-500 bg-ivory-200/50 flex items-center justify-between">
                  <span>Matching Creations</span>
                  <span className="font-mono">{searchResults.length} found</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-charcoal-800/5">
                  {searchResults.map((p) => (
                    <a
                      key={p.id}
                      href={`/products/${p.id}`}
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-2.5 p-2.5 hover:bg-ivory-200/70 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-xs bg-[#eee9e1] flex-shrink-0 overflow-hidden flex items-center justify-center p-0.5 border border-charcoal-800/10">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-charcoal-400 font-serif text-xs">
                            ✦
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-medium text-charcoal-900 group-hover:text-[#7C0E44] transition-colors truncate">
                            {p.name}
                          </p>
                          {p.category && (
                            <span className="text-[9px] px-1 py-0.2 bg-charcoal-800/5 text-charcoal-500 rounded-xs flex-shrink-0 truncate max-w-[70px]">
                              {p.category.name}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-charcoal-500 truncate">
                          {p.seller?.full_name || 'Verified Creator'} ·{' '}
                          <span className="font-semibold text-charcoal-800">
                            ₹{p.price}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-charcoal-400 group-hover:text-[#7C0E44] flex-shrink-0" />
                    </a>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-[#7C0E44] hover:bg-[#7C0E44]/5 flex items-center justify-between transition-colors bg-ivory-100 cursor-pointer"
                >
                  <span className="truncate">
                    View all catalog results for "{searchQuery}"
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 ml-1 text-[#7C0E44]" />
                </button>
              </>
            ) : matchingCategories.length === 0 ? (
              <div className="px-4 py-4 text-xs text-charcoal-600 text-center space-y-2">
                <p>No creations or categories match "{searchQuery}"</p>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="text-xs text-[#7C0E44] underline font-semibold hover:text-[#5F0A34] cursor-pointer"
                >
                  Filter entire catalog ↗
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── RIGHT ACTIONS: Language, Cart, Profile/Auth, + List Product, & Hamburger Menu ── */}
      <div className="flex-none flex items-center gap-1 sm:gap-1.5 xl:gap-2 flex-shrink-0">
        {/* Region & Language Selector */}
        <LanguageSelector compact={true} />

        {/* Lead Cart Icon Button */}
        <CartButton />

        {/* User Account / Admin Button */}
        <HeaderAuthButton />

        {/* + List Product CTA Button (Desktop sm+) */}
        <a
          href="/seller/upload"
          className="hidden sm:inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 xl:px-4 py-1.5 sm:py-2 rounded-sm text-xs font-medium bg-ivory-100 hover:bg-ivory-300 text-charcoal-800 border border-charcoal-800/20 transition-all hover:border-charcoal-800/40 whitespace-nowrap flex-shrink-0"
        >
          <span>+ List Product</span>
        </a>

        {/* ── MOBILE MENU BUTTON (Visible on smaller screens <lg) ── */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="lg:hidden p-2 rounded-full text-charcoal-800 hover:bg-ivory-300 active:bg-ivory-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender-600 cursor-pointer"
          aria-label={isMenuOpen ? 'Close menu' : 'Open navigation menu bar'}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? (
            <X className="w-5 h-5 text-charcoal-800" />
          ) : (
            <Menu className="w-5 h-5 text-charcoal-800" />
          )}
        </button>
      </div>

      {/* ── MOBILE MENU BAR DRAWER (On Smaller Screens) ── */}
      {isMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-start"
        >
          {/* Backdrop Blur Scrim */}
          <div
            className="fixed inset-0 bg-charcoal-900/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Menu Drawer Content */}
          <div className="relative w-full bg-ivory-200 border-b border-charcoal-800/20 shadow-soft-xl max-h-[88vh] overflow-y-auto z-10 animate-slide-down">
            {/* Header of Drawer */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-charcoal-800/10">
              <div className="flex items-center gap-2">
                <span translate="no" className="notranslate font-display text-xl font-bold tracking-tight text-[#7C0E44] lowercase select-none">
                  rablo
                </span>
                <span className="text-[10px] uppercase tracking-wider text-charcoal-500 font-semibold px-2 py-0.5 rounded-full bg-ivory-100 border border-charcoal-800/10">
                  Navigation
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

            {/* The 4 Command Navigation Links in Smaller Screen Menu Bar */}
            <div className="p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-500 px-2 mb-2">
                Menu Commands
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
                      <div className="w-8 h-8 rounded-full bg-[#7C0E44]/10 text-[#7C0E44] flex items-center justify-center flex-shrink-0 group-hover:bg-[#7C0E44] group-hover:text-ivory-100 transition-colors">
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

            {/* List Product & Creator Call-To-Action */}
            <div className="px-4 pb-6 pt-2 space-y-2.5 border-t border-charcoal-800/10 mt-2">
              <a
                href="/seller/upload"
                onClick={() => setIsMenuOpen(false)}
                className="w-full py-3 px-4 rounded-sm text-xs font-semibold bg-charcoal-800 hover:bg-charcoal-700 text-ivory-100 flex items-center justify-center gap-2 transition-colors shadow-soft"
              >
                <Sparkles className="w-4 h-4 text-[#F6C9DD]" />
                <span>+ List Your Product on Rablo</span>
              </a>

              <div className="flex items-center justify-between px-2 pt-2 pb-1 text-xs text-charcoal-700">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-charcoal-500">Region &amp; Language</span>
                <LanguageSelector compact={false} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
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
