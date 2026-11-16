import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActiveBanners, type HomeBanner } from '../../lib/home';

interface Props {
  initialBanners?: HomeBanner[];
}

export const HomeBannerSlider: React.FC<Props> = ({ initialBanners }) => {
  const [banners, setBanners] = useState<HomeBanner[]>(initialBanners || []);
  const [loading, setLoading] = useState(!initialBanners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);

  // Touch tracking for swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const sliderRef = useRef<HTMLDivElement | null>(null);

  // Fetch active banners on mount if not provided as initial props
  useEffect(() => {
    let isMounted = true;
    if (!initialBanners) {
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
    // No autoplay if <= 1 banner, if paused, if user interacted, or if reduced-motion preferred
    if (total <= 1 || isPaused || userInteracted) return;

    // Check for prefers-reduced-motion
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
          const isExternal = banner.link_url && /^https?:\/\//i.test(banner.link_url);

          const ImageElement = (
            <img
              src={banner.image_url}
              alt={banner.alt_text || 'Featured promotion banner'}
              width="1920"
              height="800"
              loading={idx === 0 ? 'eager' : 'lazy'}
              className="w-full h-full object-cover select-none"
              style={{
                objectPosition: `${banner.focal_x}% ${banner.focal_y}%`,
              }}
            />
          );

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
              {banner.link_url ? (
                <a
                  href={banner.link_url}
                  className="block w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                  tabIndex={isActive ? 0 : -1}
                  {...(isExternal ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
                  aria-label={banner.alt_text ? `${banner.alt_text} (opens link)` : `Banner ${idx + 1}`}
                >
                  {ImageElement}
                </a>
              ) : (
                ImageElement
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Arrows (Only shown when > 1 banner; hidden on small mobile to avoid crowding) */}
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

      {/* Slide Indicator Dots (Only shown when > 1 banner) */}
      {total > 1 && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/35 backdrop-blur-xs"
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
  );
};

export default HomeBannerSlider;
