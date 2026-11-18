import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Menu,
  ShoppingBag,
  BookOpen,
  HelpCircle,
  ChevronRight,
  ArrowRight,
  Tag,
  Users,
  Grid,
  User,
  LogOut,
  PlusCircle,
  ShieldAlert,
} from 'lucide-react';
import CartButton from './CartButton';
import HeaderAuthButton from './HeaderAuthButton';
import AuthModal from './AuthModal';
import type { InitialAuth } from '../../lib/server-auth';
import {
  useViewer,
  getViewerFromInitialAuth,
  canListProducts,
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
 * ONE single source of truth for navigation items across desktop and dropdown menu.
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
    description: 'Your saved items & pending inquiries',
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

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Dropdown anchoring coordinates
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; right: number }>({
    top: 64,
    right: 12,
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // State machine refs for hover/click coordination
  const isOpenRef = useRef(false);
  const closeTimerRef = useRef<number | null>(null);
  const openedByHoverRef = useRef(false);
  const isPinnedRef = useRef(false);

  const setMenuOpenState = (open: boolean) => {
    isOpenRef.current = open;
    if (!open) {
      openedByHoverRef.current = false;
      isPinnedRef.current = false;
    }
    setIsMenuOpen(open);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const isFinePointer = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const updateDropdownPosition = () => {
    if (!menuButtonRef.current) return;
    const rect = menuButtonRef.current.getBoundingClientRect();
    const rightOffset = Math.max(12, Math.round(window.innerWidth - rect.right));
    const topOffset = Math.round(rect.bottom + 8);
    setDropdownCoords({
      top: topOffset,
      right: rightOffset,
    });
  };

  // Keep dropdown position aligned if page scrolls or resizes while open
  useEffect(() => {
    if (!isMenuOpen) return;
    updateDropdownPosition();

    const handleScrollOrResize = () => {
      updateDropdownPosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isMenuOpen]);

  // Close menu on popstate (browser back/forward) or Astro page transitions
  useEffect(() => {
    const handleNavigation = () => {
      clearCloseTimer();
      openedByHoverRef.current = false;
      setMenuOpenState(false);
      setIsDropdownOpen(false);
      if (typeof window !== 'undefined') {
        setCurrentPath(window.location.pathname);
      }
    };

    window.addEventListener('popstate', handleNavigation);
    document.addEventListener('astro:page-load', handleNavigation);
    document.addEventListener('astro:after-swap', handleNavigation);
    return () => {
      window.removeEventListener('popstate', handleNavigation);
      document.removeEventListener('astro:page-load', handleNavigation);
      document.removeEventListener('astro:after-swap', handleNavigation);
    };
  }, []);

  // Close dropdown on resize to >= 768px (desktop breakpoint)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isOpenRef.current) {
        clearCloseTimer();
        openedByHoverRef.current = false;
        setMenuOpenState(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(() => {
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

  // Close search suggestions on outside click
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

  // Close dropdown on outside pointerdown
  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        clearCloseTimer();
        openedByHoverRef.current = false;
        setMenuOpenState(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isMenuOpen]);

  // Close dropdown on Escape key and return focus to button
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearCloseTimer();
        openedByHoverRef.current = false;
        setMenuOpenState(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
    setMenuOpenState(false);
    openedByHoverRef.current = false;

    window.dispatchEvent(new CustomEvent('rablo:search', { detail: { query: q } }));

    const isCatalog = window.location.pathname === '/catalog';
    if (isCatalog) {
      const newUrl = q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog';
      window.history.replaceState(null, '', newUrl);
    } else {
      window.location.href = q ? `/search?q=${encodeURIComponent(q)}` : '/search';
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

  // Hover and Click Handlers
  const handleButtonMouseEnter = () => {
    if (!isFinePointer()) return;
    clearCloseTimer();
    if (!isOpenRef.current) {
      openedByHoverRef.current = true;
      updateDropdownPosition();
      setMenuOpenState(true);
    }
  };

  const handleButtonMouseLeave = () => {
    if (!isFinePointer() || isPinnedRef.current) return;
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpenState(false);
      openedByHoverRef.current = false;
    }, 150);
  };

  const handlePanelMouseEnter = () => {
    if (!isFinePointer()) return;
    clearCloseTimer();
  };

  const handlePanelMouseLeave = () => {
    if (!isFinePointer() || isPinnedRef.current) return;
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpenState(false);
      openedByHoverRef.current = false;
    }, 150);
  };

  const handleButtonClick = () => {
    clearCloseTimer();
    // A click while hover-open keeps it open (pins it open)
    if (openedByHoverRef.current) {
      openedByHoverRef.current = false;
      isPinnedRef.current = true;
      if (!isOpenRef.current) {
        updateDropdownPosition();
        setMenuOpenState(true);
      }
      return;
    }

    openedByHoverRef.current = false;
    if (isOpenRef.current) {
      isPinnedRef.current = false;
      setMenuOpenState(false);
    } else {
      isPinnedRef.current = true;
      updateDropdownPosition();
      setMenuOpenState(true);
    }
  };

  const handleButtonKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!isOpenRef.current) {
        e.preventDefault();
        updateDropdownPosition();
        setMenuOpenState(true);
        requestAnimationFrame(() => {
          const first = dropdownRef.current?.querySelector<HTMLElement>('a[href], button');
          first?.focus();
        });
      }
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Tab') {
      const focusable = dropdownRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        clearCloseTimer();
        openedByHoverRef.current = false;
        setMenuOpenState(false);
        menuButtonRef.current?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        clearCloseTimer();
        openedByHoverRef.current = false;
        setMenuOpenState(false);
        menuButtonRef.current?.focus();
      }
    }
  };

  const handleMenuLinkClick = () => {
    clearCloseTimer();
    openedByHoverRef.current = false;
    setMenuOpenState(false);
  };

  const handleDropdownSignOut = async () => {
    handleMenuLinkClick();
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
    return currentPath === href || currentPath.startsWith(href + '/');
  };

  return (
    <div className="w-full flex flex-col">
      {/* ── TOP HEADER ROW: Logo + (Nav Links on Desktop) + Search Bar (Middle) + Actions + Hamburger ── */}
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

          {/* ── MOBILE MENU BUTTON: Shown below 768px, hidden on md: and up ── */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={handleButtonClick}
            onMouseEnter={handleButtonMouseEnter}
            onMouseLeave={handleButtonMouseLeave}
            onKeyDown={handleButtonKeyDown}
            className="md:hidden w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[#30251F] hover:bg-[#EBE3D7] active:bg-[#DDD6CC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F0E7] cursor-pointer flex-shrink-0"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-controls="mobile-nav-drawer"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 stroke-[2.2] text-[#30251F]" />
            ) : (
              <Menu className="w-6 h-6 stroke-[2.2] text-[#30251F]" />
            )}
          </button>
        </div>
      </div>

      {/* ── DROPDOWN MENU: Rendered via Portal to document.body (Immune to ancestor containing blocks) ── */}
      {mounted &&
        isMenuOpen &&
        createPortal(
          <div
            id="mobile-nav-drawer"
            ref={dropdownRef}
            role="dialog"
            aria-modal="false"
            aria-label="Navigation menu"
            onMouseEnter={handlePanelMouseEnter}
            onMouseLeave={handlePanelMouseLeave}
            onKeyDown={handleDropdownKeyDown}
            style={{
              position: 'fixed',
              top: `${dropdownCoords.top}px`,
              right: `${dropdownCoords.right}px`,
              width: '280px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: `calc(100dvh - ${dropdownCoords.top + 16}px)`,
            }}
            className="fixed z-[9999] bg-[#F5F0E7] text-[#30251F] border border-[#D9A37B] rounded-2xl shadow-soft-lg p-3 overflow-y-auto animate-dropdown-slide md:hidden"
          >
            {/* 1. Primary Navigation Links (Discover, Creators, Categories) */}
            <div className="space-y-1">
              {NAV_ITEMS.slice(0, 3).map((item) => {
                const Icon = item.icon;
                const isActive = isCurrentActive(item.href);
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={handleMenuLinkClick}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all min-h-[48px] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
                      isActive
                        ? 'bg-white border-[#9E4A2B] text-[#9E4A2B] font-semibold shadow-xs'
                        : 'bg-white/70 border-[#30251F]/10 hover:border-[#D9A37B] hover:bg-white text-[#30251F]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          isActive
                            ? 'bg-[#9E4A2B] text-white'
                            : 'bg-[#F5F0E7] text-[#9E4A2B] group-hover:bg-[#9E4A2B] group-hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold truncate leading-tight">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isActive
                          ? 'text-[#9E4A2B] translate-x-0.5'
                          : 'text-[#685950] group-hover:text-[#9E4A2B] group-hover:translate-x-0.5'
                      }`}
                    />
                  </a>
                );
              })}
            </div>

            <div className="my-2 border-t border-[#30251F]/10" />

            {/* 2. Lead Cart */}
            <a
              href="/cart"
              onClick={handleMenuLinkClick}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all min-h-[48px] group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
                isCurrentActive('/cart')
                  ? 'bg-white border-[#9E4A2B] text-[#9E4A2B] font-semibold shadow-xs'
                  : 'bg-white/70 border-[#30251F]/10 hover:border-[#D9A37B] hover:bg-white text-[#30251F]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isCurrentActive('/cart')
                      ? 'bg-[#9E4A2B] text-white'
                      : 'bg-[#F5F0E7] text-[#9E4A2B] group-hover:bg-[#9E4A2B] group-hover:text-white'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold truncate leading-tight">
                    Lead Cart
                  </span>
                  {cartCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#9E4A2B] text-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#685950] group-hover:text-[#9E4A2B] flex-shrink-0" />
            </a>

            <div className="my-2 border-t border-[#30251F]/10" />

            {/* 3. Secondary Navigation Links: Our Story & FAQ */}
            <div className="space-y-0.5">
              {SECONDARY_NAV_ITEMS.map((sec) => {
                const SecIcon = sec.icon;
                const isSecActive = isCurrentActive(sec.href);
                return (
                  <a
                    key={sec.label}
                    href={sec.href}
                    onClick={handleMenuLinkClick}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                      isSecActive
                        ? 'bg-white text-[#9E4A2B] font-semibold'
                        : 'text-[#685950] hover:text-[#30251F] hover:bg-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <SecIcon className="w-3.5 h-3.5 text-[#9E4A2B]" />
                      <span>{sec.label}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </a>
                );
              })}
            </div>

            <div className="my-2 border-t border-[#30251F]/10" />

            {/* 4. Account Section by Role */}
            <div className="space-y-1.5 pt-0.5">
              {viewer.role === 'guest' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleMenuLinkClick();
                      setAuthModalOpen(true);
                    }}
                    className="w-full min-h-[44px] py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-[#9E4A2B] hover:bg-[#843C22] text-[#FAF6F0] flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                  >
                    <User className="w-4 h-4" />
                    <span>Sign in with Google</span>
                  </button>

                  <a
                    href="/seller"
                    onClick={handleMenuLinkClick}
                    className="w-full min-h-[38px] py-2 px-3 rounded-xl text-xs font-medium text-[#685950] hover:text-[#30251F] hover:bg-white/60 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Become a Creator</span>
                  </a>
                </>
              ) : viewer.role === 'loading' ? (
                <div className="py-2 text-center text-xs text-[#685950]">
                  Loading profile...
                </div>
              ) : (
                <>
                  {/* User Profile Tile */}
                  <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/70 border border-[#30251F]/10">
                    <div className="w-7 h-7 rounded-full bg-[#D9A378] text-[#30251F] font-bold text-[11px] flex items-center justify-center flex-shrink-0">
                      {getInitials()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#30251F] truncate leading-tight">
                        {viewer.fullName || 'User'}
                      </p>
                      <p className="text-[10px] text-[#685950] truncate">{viewer.email}</p>
                    </div>
                  </div>

                  {/* My Account */}
                  <a
                    href="/account"
                    onClick={handleMenuLinkClick}
                    className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold text-[#30251F] hover:bg-white flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-[#685950]" />
                    <span>My Account</span>
                  </a>

                  {/* Become a Creator (only for normal users, not seller or admin) */}
                  {viewer.role === 'user' && (
                    <a
                      href="/seller"
                      onClick={handleMenuLinkClick}
                      className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-medium text-[#685950] hover:text-[#30251F] hover:bg-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Become a Creator</span>
                    </a>
                  )}

                  {/* Creator Dashboard (seller & admin) */}
                  {(viewer.role === 'seller' || viewer.role === 'admin') && (
                    <a
                      href="/seller"
                      onClick={handleMenuLinkClick}
                      className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold text-[#30251F] hover:bg-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Creator Dashboard</span>
                    </a>
                  )}

                  {/* List a Product (seller & admin ONLY) */}
                  {canList && (
                    <a
                      href="/seller/upload"
                      onClick={handleMenuLinkClick}
                      className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold text-[#9E4A2B] bg-[#9E4A2B]/10 hover:bg-[#9E4A2B]/15 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5 text-[#9E4A2B]" />
                      <span>List a Product</span>
                    </a>
                  )}

                  {/* Admin Panel (admin ONLY) */}
                  {viewer.role === 'admin' && (
                    <a
                      href="/admin"
                      onClick={handleMenuLinkClick}
                      className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-semibold text-[#30251F] hover:bg-white flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-[#9E4A2B]" />
                      <span>Admin Panel</span>
                    </a>
                  )}

                  {/* Sign Out */}
                  <button
                    type="button"
                    onClick={handleDropdownSignOut}
                    className="w-full min-h-[38px] px-3 py-2 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out</span>
                  </button>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Render AuthModal for guest sign-in */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
};

export default HeaderNav;
