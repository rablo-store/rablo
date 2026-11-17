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
  Tag,
  Users,
  Grid,
  User,
  ShieldCheck,
  LogOut,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import CartButton from './CartButton';
import HeaderAuthButton from './HeaderAuthButton';
import AuthModal from './AuthModal';
import type { InitialAuth } from '../../lib/server-auth';
import {
  useViewer,
  getViewerFromInitialAuth,
  canListProducts,
  canSeeAdminLink,
} from '../../lib/viewer';
import { getCartCount } from '../../lib/cart';
import { signOutUser, isSupabaseConfigured, supabase } from '../../lib/supabase';
import {
  getApprovedProducts,
  getApprovedCategories,
  type Product,
  type Category,
} from '../../lib/products';

interface Props {
  logoUrl: string;
  initialAuth?: InitialAuth | null;
}

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

/**
 * ONE single source of truth for navigation items across desktop and mobile.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Discover',
    href: '/catalog',
    icon: ShoppingBag,
    description: 'Browse verified indie creations',
  },
  {
    label: 'Creators',
    href: '/creators',
    icon: Users,
    description: 'Meet independent makers and artisans',
  },
  {
    label: 'Categories',
    href: '/categories',
    icon: Grid,
    description: 'Explore handmade, pottery, jewelry and fashion',
  },
  {
    label: 'Lead Cart',
    href: '/cart',
    icon: ShoppingBag,
    description: 'Your saved items & pending DM inquiries',
  },
];

export const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    label: 'Our Story',
    href: '/our-story',
    icon: BookOpen,
    description: 'Direct maker commerce protocol',
  },
  {
    label: 'FAQ',
    href: '/faq',
    icon: HelpCircle,
    description: 'Zero fees & direct Instagram DM',
  },
];

export const HeaderNav: React.FC<Props> = ({ logoUrl, initialAuth }) => {
  const viewer = useViewer(getViewerFromInitialAuth(initialAuth));
  const canList = canListProducts(viewer);
  const isAdmin = canSeeAdminLink(viewer);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerSearchQuery, setDrawerSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Current path & cart count listener
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }

    const updateCount = async () => {
      try {
        const c = await getCartCount();
        setCartCount(c);
      } catch {}
    };

    updateCount();
    window.addEventListener('rablo:cart-updated', updateCount);

    if (isSupabaseConfigured && supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        updateCount();
      });
      return () => {
        subscription.unsubscribe();
        window.removeEventListener('rablo:cart-updated', updateCount);
      };
    }

    return () => {
      window.removeEventListener('rablo:cart-updated', updateCount);
    };
  }, []);

  // Listen to popstate for route change
  useEffect(() => {
    const handlePopState = () => {
      setIsMenuOpen(false);
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      console.warn('Rijlo: Error loading search cache:', err);
    }
  };

  // Sync searchQuery with URL on mount & listen to cross-component search events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlQuery = new URLSearchParams(window.location.search).get('q');
      if (urlQuery) {
        setSearchQuery(urlQuery);
        setDrawerSearchQuery(urlQuery);
      }
    }

    const handleGlobalSearch = (e: Event) => {
      const customEvent = e as CustomEvent<{ query: string }>;
      if (typeof customEvent.detail?.query === 'string') {
        setSearchQuery(customEvent.detail.query);
        setDrawerSearchQuery(customEvent.detail.query);
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
        if (isMenuOpen) {
          setIsMenuOpen(false);
          if (menuButtonRef.current) {
            menuButtonRef.current.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  // Lock body scroll and trap focus when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';

      // Move focus into the drawer
      const drawerEl = drawerRef.current;
      if (drawerEl) {
        const focusableSelector =
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableEls = drawerEl.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusableEls.length > 0) {
          focusableEls[0].focus();
        }
      }

      const handleTrapTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const drawerEl = drawerRef.current;
        if (!drawerEl) return;

        const focusableSelector =
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusable = drawerEl.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      };

      window.addEventListener('keydown', handleTrapTab);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleTrapTab);
      };
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

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

  // Execute search submission
  const executeSearch = (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    setIsDropdownOpen(false);
    setIsMenuOpen(false);

    window.dispatchEvent(new CustomEvent('rablo:search', { detail: { query: q } }));

    const isCatalog = window.location.pathname === '/catalog';
    if (isCatalog) {
      const newUrl = q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog';
      window.history.replaceState(null, '', newUrl);
    } else {
      window.location.href = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
    }
  };

  const executeDrawerSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = drawerSearchQuery.trim();
    setIsMenuOpen(false);
    window.location.href = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setDrawerSearchQuery('');
    setIsDropdownOpen(false);
    window.dispatchEvent(new CustomEvent('rablo:search', { detail: { query: '' } }));
    if (window.location.search.includes('q=')) {
      const newUrl = window.location.pathname + (window.location.hash || '');
      window.history.replaceState(null, '', newUrl);
    }
  };

  const handleDrawerClose = () => {
    setIsMenuOpen(false);
    if (menuButtonRef.current) {
      menuButtonRef.current.focus();
    }
  };

  const handleDrawerSignOut = async () => {
    setIsMenuOpen(false);
    await signOutUser('/account?signed_out=1');
  };

  const getInitials = () => {
    if (viewer.fullName) {
      const parts = viewer.fullName.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (viewer.email) {
      return viewer.email.split('@')[0].slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  const isCurrentActive = (href: string) => {
    if (href === '/') return currentPath === '/' || currentPath === '';
    return currentPath.startsWith(href);
  };

  return (
    <div className="w-full flex flex-col">
      {/* ── TOP HEADER ROW: Logo + (Nav Links on Desktop) + Search Bar (Middle on All Screens) + Actions + Hamburger ── */}
      <div className="header-inner-row flex items-center justify-between h-14 sm:h-16 lg:h-20 gap-1 sm:gap-3 xl:gap-5 min-w-0">
        {/* Brand Logo Lockup */}
        <a
          href="/"
          className="header-brand-lockup flex-none flex items-center group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] rounded-lg py-1 px-1 -ml-1 transition-transform"
          aria-label="Rijlo Home"
        >
          <img
            src={logoUrl || '/brand/logo.webp'}
            alt="Rijlo"
            className="h-8 sm:h-9 lg:h-10 w-auto object-contain transition-transform group-hover:scale-105 select-none"
            width="708"
            height="216"
          />
        </a>

        {/* ── DESKTOP NAVIGATION (>= 768px): Discover, Creators, Categories ── */}
        <nav
          className="header-nav-container hidden md:flex items-center space-x-3.5 lg:space-x-6 xl:space-x-7 flex-shrink-0"
          aria-label="Main Desktop Navigation"
        >
          {NAV_ITEMS.slice(0, 3).map((link) => {
            const isActive = isCurrentActive(link.href);
            return (
              <a
                key={link.label}
                href={link.href}
                className={`text-xs lg:text-sm font-medium transition-colors py-1 relative whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'text-[#9E4A2B] font-semibold after:w-full'
                    : 'text-[#30251F] hover:text-[#9E4A2B]'
                } after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-[#9E4A2B] hover:after:w-full after:transition-all`}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* ── SEARCH BAR: IN THE MIDDLE ON THE SAME LINE AS THE LOGO ── */}
        <div
          ref={searchContainerRef}
          className="header-search-container flex flex-1 min-w-0 max-w-xs sm:max-w-sm md:max-w-md xl:max-w-lg mx-1.5 sm:mx-3 lg:mx-4 relative"
        >
          <form
            action="/search"
            method="GET"
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch();
            }}
            className="relative w-full"
          >
            <Search className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#685950] pointer-events-none" />
            <input
              type="search"
              name="q"
              placeholder="Search creations..."
              value={searchQuery}
              onFocus={() => {
                ensureCacheLoaded();
                if (searchQuery.trim().length >= 2) setIsDropdownOpen(true);
              }}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setDrawerSearchQuery(val);
                ensureCacheLoaded();
                setIsDropdownOpen(val.trim().length >= 2);
              }}
              className="w-full pl-7 sm:pl-9 pr-6 sm:pr-8 py-1.5 sm:py-2 bg-[#FAF6F0] hover:bg-[#FAF6F0] border border-[#30251F]/15 rounded-full text-[11px] sm:text-xs text-[#30251F] placeholder:text-[#685950]/70 focus:outline-none focus:ring-1.5 sm:focus:ring-2 focus:ring-[#9E4A2B] focus:bg-white transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-[#685950] hover:text-[#30251F] p-0.5 rounded-full"
                title="Clear search"
              >
                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </form>

          {/* Live Suggestions Dropdown */}
          {isDropdownOpen && searchQuery.trim().length >= 2 && (
            <div className="fixed left-3 right-3 top-14 sm:top-16 sm:absolute sm:top-full sm:left-0 sm:right-0 sm:mt-2 bg-[#FAF6F0] border border-[#30251F]/15 rounded-xl shadow-soft-lg z-50 overflow-hidden divide-y divide-[#30251F]/10 animate-fade-in max-h-80 overflow-y-auto">
              {matchingCategories.length > 0 && (
                <div className="p-2 sm:p-2.5 bg-[#FAF8F5]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#685950] mb-1 px-1">
                    Matching Categories
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {matchingCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => executeSearch(cat.name)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] bg-[#EBE3D7] hover:bg-[#D9A37B]/20 text-[#30251F] border border-[#30251F]/10 transition-colors cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5 text-[#9E4A2B]" />
                        <span>{cat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {matchingProducts.length > 0 ? (
                <div className="p-1.5 sm:p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#685950] mb-1 px-1">
                    Matching Creations
                  </p>
                  {matchingProducts.map((p) => (
                    <a
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-[#EBE3D7]/70 transition-colors group"
                    >
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-md bg-[#eee9e1] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.thumbnail_url ? (
                          <img
                            src={p.thumbnail_url}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-[#685950]">✦</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#30251F] truncate group-hover:text-[#9E4A2B] transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-[#685950] truncate">
                          by {p.seller?.full_name || 'Verified Creator'} · ₹{p.price}
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              ) : matchingCategories.length === 0 ? (
                <div className="p-3 sm:p-4 text-center text-xs text-[#685950]">
                  No direct matches for "{searchQuery}". Press Enter to search catalog.
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => executeSearch()}
                className="w-full px-3 py-2 sm:py-2.5 text-left text-xs font-semibold text-[#9E4A2B] hover:bg-[#9E4A2B]/5 flex items-center justify-between transition-colors bg-[#FAF8F5] cursor-pointer"
              >
                <span>View all search results for "{searchQuery}"</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#9E4A2B]" />
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT HEADER ACTIONS ── */}
        <div className="header-right-actions flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          <CartButton />

          <HeaderAuthButton initialAuth={initialAuth} />

          {/* Desktop "List Product" Button: ONLY rendered for seller and admin */}
          {canList && (
            <a
              href="/seller/upload"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EBE3D7] text-[#30251F] border border-[#30251F]/15 transition-all whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#9E4A2B]" />
              <span>+ List Product</span>
            </a>
          )}

          {/* ── MOBILE MENU BUTTON (Hamburger ☰ / X): Shown below 768px, hidden on md: and up ── */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-1.5 sm:p-2 rounded-full text-[#30251F] hover:bg-[#EBE3D7] active:bg-[#DDD6CC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] cursor-pointer"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5 text-[#30251F]" />
            ) : (
              <Menu className="w-5 h-5 text-[#30251F]" />
            )}
          </button>
        </div>
      </div>

      {/* ── MOBILE MENU DRAWER (Below 768px) ── */}
      {isMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Menu"
          className="fixed inset-0 z-50 md:hidden flex flex-col justify-start"
        >
          {/* Backdrop Scrim */}
          <div
            className="fixed inset-0 bg-[#30251F]/50 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={handleDrawerClose}
          />

          {/* Slide-Down Menu Drawer Container */}
          <div
            ref={drawerRef}
            className="relative w-full bg-[#FAF6F0] border-b border-[#30251F]/15 shadow-2xl max-h-[92vh] overflow-y-auto z-10 animate-slide-down flex flex-col divide-y divide-[#30251F]/10"
          >
            {/* 1. Header: Rijlo Wordmark + Close Button */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#FAF6F0]">
              <div className="flex items-center gap-2">
                <span
                  translate="no"
                  className="notranslate font-display text-2xl font-bold tracking-tight text-[#9E4A2B] lowercase select-none"
                >
                  rijlo
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[#685950] font-semibold px-2 py-0.5 rounded-full border border-[#30251F]/15 bg-white">
                  Menu
                </span>
              </div>
              <button
                type="button"
                onClick={handleDrawerClose}
                className="p-1.5 rounded-full text-[#30251F] hover:bg-[#30251F]/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                aria-label="Close menu"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* 2. Mobile Search Field */}
            <div className="px-5 py-3 bg-[#FAF8F5]">
              <form onSubmit={executeDrawerSearch} className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#685950] pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search creators, crafts, categories..."
                  value={drawerSearchQuery}
                  onChange={(e) => setDrawerSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#30251F]/15 rounded-xl text-xs text-[#30251F] placeholder:text-[#685950]/70 focus:outline-none focus:ring-2 focus:ring-[#9E4A2B]"
                />
                {drawerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setDrawerSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#685950] hover:text-[#30251F] p-0.5 rounded-full"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </form>
            </div>

            {/* 3. Primary Nav Items (Discover, Creators, Categories, Lead Cart) >= 44px tap target */}
            <div className="p-4 sm:p-5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#685950] px-1 mb-1">
                Explore Rijlo
              </p>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = isCurrentActive(item.href);
                const isCart = item.href === '/cart';

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all group cursor-pointer min-h-[48px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
                      isActive
                        ? 'bg-[#FAF8F5] border-[#9E4A2B] shadow-xs'
                        : 'bg-white border-[#30251F]/10 hover:border-[#9E4A2B]/40 hover:bg-[#FAF8F5]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                          isActive
                            ? 'bg-[#9E4A2B] text-white'
                            : 'bg-[#FAF6F0] text-[#9E4A2B] group-hover:bg-[#9E4A2B] group-hover:text-white'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm sm:text-base font-semibold leading-snug truncate ${
                              isActive ? 'text-[#9E4A2B]' : 'text-[#30251F] group-hover:text-[#9E4A2B]'
                            }`}
                          >
                            {item.label}
                          </p>
                          {isCart && cartCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#9E4A2B] text-white">
                              {cartCount > 99 ? '99+' : cartCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#685950] mt-0.5 truncate leading-tight">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-5 h-5 flex-shrink-0 transition-transform ${
                        isActive
                          ? 'text-[#9E4A2B] translate-x-0.5'
                          : 'text-[#685950] group-hover:text-[#9E4A2B] group-hover:translate-x-0.5'
                      }`}
                    />
                  </a>
                );
              })}
            </div>

            {/* 4. Secondary Rows: Our Story & FAQ */}
            <div className="p-4 sm:p-5 space-y-2 bg-[#FAF8F5]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#685950] px-1 mb-1">
                About & Trust
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {SECONDARY_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = isCurrentActive(item.href);
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border min-h-[44px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
                        isActive
                          ? 'bg-white border-[#9E4A2B] text-[#9E4A2B] font-semibold'
                          : 'bg-white border-[#30251F]/10 text-[#30251F] hover:border-[#9E4A2B]/40'
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[#9E4A2B] flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{item.label}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* 5. Account Section By Viewer Role */}
            <div className="p-5 space-y-3 bg-[#FAF6F0]">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#685950] px-1">
                Account & Creator Hub
              </p>

              {/* Guest Viewer */}
              {viewer.role === 'guest' && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setAuthModalOpen(true);
                    }}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                  >
                    <User className="w-4 h-4" />
                    <span>Sign In with Google</span>
                  </button>

                  <a
                    href="/seller"
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-white hover:bg-[#FAF8F5] text-[#30251F] border border-[#30251F]/15 flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                  >
                    <Sparkles className="w-4 h-4 text-[#9E4A2B]" />
                    <span>Become a Creator</span>
                  </a>
                </div>
              )}

              {/* Logged-In User (Normal, Seller, Admin) */}
              {viewer.role !== 'guest' && viewer.role !== 'loading' && (
                <div className="space-y-3">
                  {/* User Profile Header Tile */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#30251F]/10">
                    <div className="w-10 h-10 rounded-full bg-[#D9A378] text-[#30251F] font-bold text-xs flex items-center justify-center border border-[#30251F]/15 flex-shrink-0">
                      {isAdmin ? <ShieldCheck className="w-5 h-5 text-[#30251F]" /> : getInitials()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-[#30251F] truncate">
                        {viewer.fullName || 'Rijlo User'}
                      </p>
                      <p className="text-[11px] text-[#685950] truncate">{viewer.email}</p>
                    </div>
                    {isAdmin && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Admin
                      </span>
                    )}
                    {viewer.role === 'seller' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sage-100 text-sage-800 border border-sage-200">
                        Creator
                      </span>
                    )}
                  </div>

                  {/* Actions Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="/account"
                      onClick={() => setIsMenuOpen(false)}
                      className="min-h-[44px] p-2.5 rounded-xl bg-white border border-[#30251F]/10 hover:border-[#9E4A2B]/40 text-[#30251F] flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#685950] flex-shrink-0" />
                      <span className="truncate">My Account</span>
                    </a>

                    {/* Normal User: Become a Creator link */}
                    {viewer.role === 'user' && (
                      <a
                        href="/seller"
                        onClick={() => setIsMenuOpen(false)}
                        className="min-h-[44px] p-2.5 rounded-xl bg-white border border-[#30251F]/10 hover:border-[#9E4A2B]/40 text-[#30251F] flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-[#9E4A2B] flex-shrink-0" />
                        <span className="truncate">Become a Creator</span>
                      </a>
                    )}

                    {/* Seller or Admin: Creator Dashboard */}
                    {canList && (
                      <a
                        href="/seller"
                        onClick={() => setIsMenuOpen(false)}
                        className="min-h-[44px] p-2.5 rounded-xl bg-white border border-[#30251F]/10 hover:border-[#9E4A2B]/40 text-[#30251F] flex items-center gap-2 text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Store className="w-4 h-4 text-[#685950] flex-shrink-0" />
                        <span className="truncate">Creator Dashboard</span>
                      </a>
                    )}

                    {/* Admin: Admin link */}
                    {isAdmin && (
                      <a
                        href="/admin"
                        onClick={() => setIsMenuOpen(false)}
                        className="min-h-[44px] p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center gap-2 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-purple-700 flex-shrink-0" />
                        <span className="truncate">Admin Portal</span>
                      </a>
                    )}
                  </div>

                  {/* Seller / Admin: List a Product full-width action button */}
                  {canList && (
                    <a
                      href="/seller/upload"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full min-h-[44px] py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>List a Product</span>
                    </a>
                  )}

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={handleDrawerSignOut}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Render AuthModal for drawer guest sign-in */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export default HeaderNav;
