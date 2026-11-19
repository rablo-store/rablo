import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActiveBanners, type HomeBanner } from '../../lib/home';

interface Props {
  initialBanners?: HomeBanner[];
}

const QUICK_LINKS = [
  { label: 'Explore Products', href: '/catalog' },
  { label: 'Creators', href: '/creators' },
  { label: 'Categories', href: '/categories' },
  { label: 'New Arrivals', href: '/catalog?sort=new' },
];

export const HomeBannerSlider: React.FC<Props> = ({ initialBanners }) => {
  const [banners, setBanners] = useState<HomeBanner[]>(initialBanners || []);
  const [loading, setLoading] = useState(initialBanners === undefined);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Touch tracking for swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Fetch active banners on mount ONLY if not provided as initial props from SSR
  useEffect(() => {
    let isMounted = true;
    if (initialBanners === undefined) {
      getActiveBanners()
        .then(({ data }) => {
          if (isMounted) {
            setBanners(data || []);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setBanners([]);
            setLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [initialBanners]);

  const total = banners.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleManualSelect = (index: number) => {
    setUserInteracted(true);
    setCurrentIndex(index);
  };

  const handleManualPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUserInteracted(true);
    prevSlide();
  };

  const handleManualNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUserInteracted(true);
    nextSlide();
  };

  // Autoplay timer effect
  useEffect(() => {
    if (total <= 1 || isPaused || userInteracted) return;

    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) return;
    }

    const interval = setInterval(() => {
      nextSlide();
    }, 5000);

    return () => clearInterval(interval);
  }, [total, isPaused, userInteracted, nextSlide]);

  // Tab visibility listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setIsPaused(true);
      } else {
        setIsPaused(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (total <= 1) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setUserInteracted(true);
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setUserInteracted(true);
      nextSlide();
    }
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = (touchStartY.current || 0) - touchEndY;

    // Require predominantly horizontal swipe > 40px
    if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) && total > 1) {
      setUserInteracted(true);
      if (deltaX > 0) {
        nextSlide();
      } else {
        prevSlide();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Loading skeleton with exact same height clamp to guarantee ZERO layout shift
  if (loading) {
    return (
      <div
        className="w-full rounded-2xl sm:rounded-3xl bg-[#EFE9DF]/80 animate-pulse border border-[#30251F]/10 overflow-hidden"
        style={{ height: 'clamp(200px, 38vw, 440px)' }}
        aria-busy="true"
        aria-label="Loading promotional banners"
      />
    );
  }

  // Zero banners: render nothing (no empty gap)
  if (total === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-3">
      {/* 1. Main Hero Banner Slider Container */}
      <section
        ref={sliderRef}
        className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#30251F]/10 shadow-soft-sm bg-[#FAF6F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
        style={{ height: 'clamp(200px, 38vw, 440px)' }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Featured Banners"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slides Container */}
        <div className="relative w-full h-full">
          {banners.map((banner, idx) => {
            const isActive = idx === currentIndex;
            const isDarkTheme = banner.text_theme !== 'light';
            const visibleButtons = (banner.buttons || []).filter((b) => b.is_visible !== false);
            const hasDynamicButtons = visibleButtons.length > 0;
            const hasLegacyText = Boolean(banner.title || banner.subtitle || banner.cta_label);
            const targetLink = banner.cta_link || banner.link_url;
            const isExternal = Boolean(targetLink && /^https?:\/\//i.test(targetLink));

            return (
              <div
                key={banner.id}
                className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${
                  isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                }`}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${idx + 1} of ${total}`}
                aria-hidden={!isActive}
              >
                {/* Responsive Image with <picture>: Mobile (<640px) -> Tablet (<1024px) -> Desktop fallback */}
                <picture className="w-full h-full block">
                  {(banner.mobile_image_url || banner.tablet_image_url) && (
                    <source
                      media="(max-width: 639px)"
                      srcSet={banner.mobile_image_url || banner.tablet_image_url || banner.image_url}
                    />
                  )}
                  {banner.tablet_image_url && (
                    <source
                      media="(max-width: 1023px)"
                      srcSet={banner.tablet_image_url || banner.image_url}
                    />
                  )}
                  <img
                    src={banner.image_url}
                    alt={banner.alt_text || banner.title || 'Featured promotion banner'}
                    width="2400"
                    height="800"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                    className="w-full h-full select-none"
                    style={{
                      objectFit: 'cover',
                      objectPosition: `${banner.focal_x || 70}% ${banner.focal_y || 50}%`,
                    }}
                  />
                </picture>

                {/* Scrims: mobile espresso bottom-to-top scrim, desktop soft calm zone scrim */}
                <div
                  className="sm:hidden absolute inset-0 bg-gradient-to-t from-[#30251F]/90 via-[#30251F]/40 to-transparent pointer-events-none"
                  aria-hidden="true"
                />
                <div
                  className={`hidden sm:block absolute inset-y-0 left-0 w-1/2 pointer-events-none ${
                    isDarkTheme
                      ? 'bg-gradient-to-r from-[#30251F]/70 via-[#30251F]/30 to-transparent'
                      : 'bg-gradient-to-r from-[#FAF6F0]/80 via-[#FAF6F0]/35 to-transparent'
                  }`}
                  aria-hidden="true"
                />

                {/* Legacy / Static Headline & Subline Overlay (if configured) */}
                {hasLegacyText && (
                  <>
                    {/* Desktop Calm Left Zone */}
                    <div className="hidden sm:flex absolute inset-y-0 left-12 md:left-16 lg:left-20 max-w-[42%] lg:max-w-[40%] flex-col justify-center z-10 py-6 pointer-events-auto">
                      {banner.title && (
                        <h2
                          className={`font-serif text-xl md:text-2xl lg:text-3xl font-bold leading-snug drop-shadow-xs mb-1.5 ${
                            isDarkTheme ? 'text-[#F5F0E7]' : 'text-[#30251F]'
                          }`}
                        >
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p
                          className={`font-sans text-xs md:text-sm line-clamp-2 mb-3.5 drop-shadow-xs leading-relaxed ${
                            isDarkTheme ? 'text-[#F5F0E7]/90' : 'text-[#30251F]/85'
                          }`}
                        >
                          {banner.subtitle}
                        </p>
                      )}
                      {!hasDynamicButtons && (banner.cta_label || targetLink) && (
                        <div className="pt-0.5">
                          <a
                            href={targetLink || '/catalog'}
                            tabIndex={isActive ? 0 : -1}
                            {...(isExternal ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                            className="min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 rounded-full font-bold text-sm tracking-wide bg-[#B87555] hover:bg-[#9E4A2B] text-[#F5F0E7] shadow-soft-sm hover:shadow-soft transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A37B] focus-visible:ring-offset-2 active:scale-[0.98]"
                          >
                            {banner.cta_label || 'Shop Now'}
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Mobile (< 640px) Bottom-Left Text */}
                    <div className="sm:hidden absolute bottom-3 left-4 right-20 z-10 space-y-0.5 pointer-events-auto">
                      {banner.title && (
                        <h2 className="font-serif text-sm sm:text-base font-bold text-[#F5F0E7] truncate leading-tight drop-shadow-sm">
                          {banner.title}
                        </h2>
                      )}
                      {banner.subtitle && (
                        <p className="font-sans text-[11px] text-[#F5F0E7]/90 truncate drop-shadow-xs">
                          {banner.subtitle}
                        </p>
                      )}
                      {!hasDynamicButtons && (banner.cta_label || targetLink) && (
                        <div className="pt-1">
                          <a
                            href={targetLink || '/catalog'}
                            tabIndex={isActive ? 0 : -1}
                            {...(isExternal ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                            className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#B87555] text-[#F5F0E7] shadow-soft-sm hover:bg-[#9E4A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A37B]"
                          >
                            {banner.cta_label || 'Shop Now'}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* 2. Dynamic CTA Buttons (Real HTML interactive elements with independent responsive configurations) */}
                {hasDynamicButtons && (
                  <div className="absolute inset-0 pointer-events-none z-15">
                    {visibleButtons.map((btn) => {
                      const shapeClass =
                        btn.style.shape === 'square'
                          ? 'rounded-none'
                          : btn.style.shape === 'slightly_rounded'
                          ? 'rounded-md'
                          : btn.style.shape === 'rounded'
                          ? 'rounded-xl'
                          : 'rounded-full';

                      const btnStyle: React.CSSProperties = {
                        backgroundColor: btn.style.background || '#9E4A2B',
                        color: btn.style.color || '#FAF6F0',
                        borderColor: btn.style.borderColor || 'transparent',
                        borderWidth: btn.style.borderWidth !== undefined ? `${btn.style.borderWidth}px` : '0px',
                        borderStyle: btn.style.borderWidth ? 'solid' : 'none',
                        fontWeight: btn.style.fontWeight || '600',
                        // Desktop positioning & size (>= 1024px)
                        '--b-x-d': `${btn.responsive.desktop.x}%`,
                        '--b-y-d': `${btn.responsive.desktop.y}%`,
                        '--b-w-d':
                          btn.responsive.desktop.width && btn.responsive.desktop.width !== 'auto'
                            ? `${btn.responsive.desktop.width}px`
                            : 'auto',
                        '--b-h-d':
                          btn.responsive.desktop.height && btn.responsive.desktop.height !== 'auto'
                            ? `${btn.responsive.desktop.height}px`
                            : 'auto',
                        '--b-fs-d': `${btn.responsive.desktop.fontSize || 16}px`,
                        // Tablet positioning & size (640px - 1023px)
                        '--b-x-t': `${btn.responsive.tablet.x}%`,
                        '--b-y-t': `${btn.responsive.tablet.y}%`,
                        '--b-w-t':
                          btn.responsive.tablet.width && btn.responsive.tablet.width !== 'auto'
                            ? `${btn.responsive.tablet.width}px`
                            : 'auto',
                        '--b-h-t':
                          btn.responsive.tablet.height && btn.responsive.tablet.height !== 'auto'
                            ? `${btn.responsive.tablet.height}px`
                            : 'auto',
                        '--b-fs-t': `${btn.responsive.tablet.fontSize || 14}px`,
                        // Mobile positioning & size (< 640px)
                        '--b-x-m': `${btn.responsive.mobile.x}%`,
                        '--b-y-m': `${btn.responsive.mobile.y}%`,
                        '--b-w-m':
                          btn.responsive.mobile.width && btn.responsive.mobile.width !== 'auto'
                            ? `${btn.responsive.mobile.width}px`
                            : 'auto',
                        '--b-h-m':
                          btn.responsive.mobile.height && btn.responsive.mobile.height !== 'auto'
                            ? `${btn.responsive.mobile.height}px`
                            : 'auto',
                        '--b-fs-m': `${btn.responsive.mobile.fontSize || 12}px`,
                      } as React.CSSProperties;

                      const isBtnExternal = btn.url && /^https?:\/\//i.test(btn.url);

                      return (
                        <a
                          key={btn.id}
                          href={btn.url || '#'}
                          tabIndex={isActive ? 0 : -1}
                          target={btn.open_in_new_tab ? '_blank' : '_self'}
                          rel={btn.open_in_new_tab || isBtnExternal ? 'noopener noreferrer' : undefined}
                          className={`banner-builder-btn pointer-events-auto ${shapeClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A37B] focus-visible:ring-offset-2`}
                          style={btnStyle}
                        >
                          {btn.text}
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* If banner has a link but NO buttons and NO text overlay, make the whole slide clickable */}
                {targetLink && !hasDynamicButtons && !hasLegacyText && (
                  <a
                    href={targetLink}
                    className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                    tabIndex={isActive ? 0 : -1}
                    {...(isExternal ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                    aria-label={banner.alt_text ? `${banner.alt_text} (opens link)` : `Banner ${idx + 1}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation Arrows (Only shown when > 1 banner; hidden on small screens < 640px to avoid crowding) */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={handleManualPrev}
              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-md hover:scale-105"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleManualNext}
              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-xs items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white shadow-md hover:scale-105"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Slide Indicator Dots (Positioned bottom-right so they never overlap the left-aligned text) */}
        {total > 1 && (
          <div
            className="absolute bottom-3 right-4 sm:bottom-4 sm:right-8 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xs"
            role="tablist"
            aria-label="Choose slide to display"
          >
            {banners.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={`Show slide ${i + 1} of ${total}`}
                onClick={() => handleManualSelect(i)}
                className="min-w-[24px] min-h-[24px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full transition-transform"
              >
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    i === currentIndex
                      ? 'w-6 h-2 bg-white shadow-xs'
                      : 'w-2 h-2 bg-white/50 hover:bg-white/80'
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Quick Links Navigation: Chips directly below the image for mobile (< 640px) */}
      <nav
        aria-label="Quick links"
        className="sm:hidden flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1 scroll-smooth"
      >
        {QUICK_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="min-h-[44px] px-4 py-2 shrink-0 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-[#FAF6F0] text-[#30251F] border border-[#30251F]/15 hover:border-[#B87555] hover:text-[#B87555] active:bg-[#EFE9DF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9A37B] focus-visible:ring-offset-2"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
};

export default HomeBannerSlider;
