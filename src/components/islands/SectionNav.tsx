import React, { useState, useEffect } from 'react';
import { ShoppingBag, BookOpen, HelpCircle } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'shop', label: 'Shop Catalog', icon: ShoppingBag },
  { id: 'story', label: 'Our Story', icon: BookOpen },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

export const SectionNav: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('shop');
  const [isSticky, setIsSticky] = useState<boolean>(false);

  useEffect(() => {
    // Check initial hash if present
    const hash = window.location.hash.replace('#', '');
    if (hash && NAV_ITEMS.some((item) => item.id === hash)) {
      setActiveSection(hash);
      const target = document.getElementById(hash);
      if (target) {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }

    // Scroll spy to highlight active tab
    const handleScroll = () => {
      const scrollPos = window.scrollY + 200;
      setIsSticky(window.scrollY > 420);

      // Find current section
      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const item = NAV_ITEMS[i];
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          if (scrollPos >= top) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    // Listen for custom trigger from header or elsewhere
    const handleCustomNav = (e: Event) => {
      const customEvent = e as CustomEvent<{ sectionId: string }>;
      if (customEvent.detail?.sectionId) {
        setActiveSection(customEvent.detail.sectionId);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('rablo:section-change', handleCustomNav);
    window.addEventListener('hashchange', () => {
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash && NAV_ITEMS.some((item) => item.id === currentHash)) {
        setActiveSection(currentHash);
      }
    });

    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('rablo:section-change', handleCustomNav);
    };
  }, []);

  const handleTabClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setActiveSection(id);

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      // Update URL hash without full reload or scroll jump
      window.history.pushState(null, '', `#${id}`);
      window.dispatchEvent(new CustomEvent('rablo:section-change', { detail: { sectionId: id } }));
    }
  };

  return (
    <div
      className={`sticky top-16 sm:top-20 z-20 transition-all duration-300 py-3 ${
        isSticky
          ? 'bg-ivory-200/90 backdrop-blur-md border-b border-charcoal-800/10 shadow-soft'
          : 'bg-transparent border-b border-charcoal-800/10'
      }`}
    >
      <div className="store-width flex items-center justify-between gap-4">
        {/* Navigation Switcher Pills */}
        <nav
          className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 scrollbar-none w-full sm:w-auto justify-start sm:justify-center"
          aria-label="In-page sections"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleTabClick(e, item.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs font-medium transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'bg-[#7C0E44] text-white shadow-sm scale-[1.02]'
                    : 'bg-ivory-100 hover:bg-ivory-300 text-charcoal-700 border border-charcoal-800/15 hover:border-[#7C0E44]/30'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  className={`w-3.5 h-3.5 transition-colors ${
                    isActive ? 'text-[#FBE4EE]' : 'text-charcoal-500'
                  }`}
                />
                <span>
                  {item.id === 'faq' ? (
                    <span translate="no" className="notranslate">FAQ</span>
                  ) : (
                    item.label
                  )}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FBE4EE] animate-pulse ml-0.5" />
                )}
              </a>
            );
          })}
        </nav>

        {/* Quick status label on widescreen */}
        <div className="hidden lg:flex items-center gap-2 text-[11px] text-charcoal-500 font-mono">
          <span className="w-2 h-2 rounded-full bg-sage-500"></span>
          <span>Zero-Reload Reactive Navigation</span>
        </div>
      </div>
    </div>
  );
};

export default SectionNav;
