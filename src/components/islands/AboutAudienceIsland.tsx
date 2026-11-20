import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Store,
  ChevronDown,
  Check,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AUDIENCE_COPY } from '../../config/about';

interface AboutAudienceIslandProps {
  initialTab?: 'shoppers' | 'sellers';
}

export const AboutAudienceIsland: React.FC<AboutAudienceIslandProps> = ({
  initialTab = 'shoppers',
}) => {
  const [activeTab, setActiveTab] = useState<'shoppers' | 'sellers'>(initialTab);
  const [expandedShopperStep, setExpandedShopperStep] = useState<number | null>(0);
  const [expandedSellerStep, setExpandedSellerStep] = useState<number | null>(0);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const tabListRef = useRef<HTMLDivElement>(null);
  const shoppersTabRef = useRef<HTMLButtonElement>(null);
  const sellersTabRef = useRef<HTMLButtonElement>(null);

  // Sync with URL hash on client mount and hashchange
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#sellers' || hash === '#seller') {
        setActiveTab('sellers');
      } else if (hash === '#shoppers' || hash === '#shopper') {
        setActiveTab('shoppers');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const switchTab = (tab: 'shoppers' | 'sellers', updateHash = true) => {
    setActiveTab(tab);
    if (updateHash && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const newTab = activeTab === 'shoppers' ? 'sellers' : 'shoppers';
      switchTab(newTab);
      if (newTab === 'shoppers') {
        shoppersTabRef.current?.focus();
      } else {
        sellersTabRef.current?.focus();
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      switchTab('shoppers');
      shoppersTabRef.current?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      switchTab('sellers');
      sellersTabRef.current?.focus();
    }
  };

  const toggleChecklist = (id: string) => {
    setCheckedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const copy = AUDIENCE_COPY;
  const shopperCopy = copy.shopperView;
  const sellerCopy = copy.sellerView;

  return (
    <div id="audience-section" className="scroll-mt-24 space-y-8">
      {/* Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#30251F]/10 pb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-medium text-[#30251F]">
            {copy.heading}
          </h2>
          <p className="text-xs sm:text-sm text-[#685950] mt-1">
            {copy.subheading}
          </p>
        </div>

        <div
          ref={tabListRef}
          role="tablist"
          id="audience-tablist"
          aria-label="Target audience views"
          onKeyDown={handleKeyDown}
          className="inline-flex p-1 bg-[#F5F0E7] border border-[#30251F]/10 rounded-2xl self-start sm:self-auto shadow-inner"
        >
          <button
            ref={shoppersTabRef}
            role="tab"
            id="tab-shoppers"
            aria-selected={activeTab === 'shoppers'}
            aria-controls="tabpanel-shoppers"
            tabIndex={activeTab === 'shoppers' ? 0 : -1}
            onClick={() => switchTab('shoppers')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
              activeTab === 'shoppers'
                ? 'bg-white text-[#30251F] shadow-sm font-semibold'
                : 'text-[#685950] hover:text-[#30251F]'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-[#9E4A2B]" />
            <span>{shopperCopy.tabLabel}</span>
          </button>

          <button
            ref={sellersTabRef}
            role="tab"
            id="tab-sellers"
            aria-selected={activeTab === 'sellers'}
            aria-controls="tabpanel-sellers"
            tabIndex={activeTab === 'sellers' ? 0 : -1}
            onClick={() => switchTab('sellers')}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B] ${
              activeTab === 'sellers'
                ? 'bg-white text-[#30251F] shadow-sm font-semibold'
                : 'text-[#685950] hover:text-[#30251F]'
            }`}
          >
            <Store className="w-4 h-4 text-[#9E4A2B]" />
            <span>{sellerCopy.tabLabel}</span>
          </button>
        </div>
      </div>

      {/* Shopper Panel */}
      <section
        role="tabpanel"
        id="tabpanel-shoppers"
        aria-labelledby="tab-shoppers"
        aria-hidden={activeTab !== 'shoppers'}
        className={`space-y-8 animate-in fade-in duration-200 ${
          activeTab !== 'shoppers' ? 'hidden' : ''
        }`}
      >
        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-[#30251F]">
            {shopperCopy.title}
          </h3>
          <p className="text-sm text-[#685950]">
            {shopperCopy.subtitle}
          </p>
        </div>

        {/* 4-Step Shopper Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shopperCopy.steps.map((step, idx) => {
            const isExpanded = expandedShopperStep === idx;
            return (
              <div
                key={step.number}
                className="p-5 sm:p-6 bg-white border border-[#30251F]/10 rounded-2xl shadow-soft-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#9E4A2B]/10 text-[#9E4A2B] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {step.number}
                    </span>
                    <h4 className="text-base font-display font-medium text-[#30251F]">
                      {step.title}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedShopperStep(isExpanded ? null : idx)
                    }
                    className="p-1 text-[#685950] hover:text-[#30251F] rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} step ${step.number}: ${step.title}`}
                    aria-expanded={isExpanded}
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-[#685950] mt-2 leading-relaxed">
                  {step.shortDesc}
                </p>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#30251F]/5 text-xs text-[#30251F]/80 leading-relaxed bg-[#FAF6F0]/60 p-3 rounded-xl">
                    {step.detailedDesc}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Shopper Benefits & Explore Links */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-7 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-4">
            <h4 className="text-base sm:text-lg font-display font-medium text-[#30251F] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#9E4A2B]" />
              <span>{shopperCopy.benefitsTitle}</span>
            </h4>
            <ul className="space-y-2.5">
              {shopperCopy.benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#685950]">
                  <Check className="w-4 h-4 text-[#637B58] shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 p-6 sm:p-7 bg-white border border-[#30251F]/10 rounded-3xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#9E4A2B] font-semibold">
                Explore The Catalog
              </span>
              <h4 className="text-base sm:text-lg font-display font-medium text-[#30251F]">
                Ready to find authentic craftsmanship?
              </h4>
              <p className="text-xs text-[#685950] leading-relaxed">
                Filter through thousands of unique pieces from verified creators across India.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {shopperCopy.exploreLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#FAF6F0] hover:bg-[#F5F0E7] text-xs font-medium text-[#30251F] border border-[#30251F]/10 transition-colors min-h-[44px]"
                >
                  <span>{link.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#9E4A2B]" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Seller Panel */}
      <section
        role="tabpanel"
        id="tabpanel-sellers"
        aria-labelledby="tab-sellers"
        aria-hidden={activeTab !== 'sellers'}
        className={`space-y-8 animate-in fade-in duration-200 ${
          activeTab !== 'sellers' ? 'hidden' : ''
        }`}
      >
        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-[#30251F]">
            {sellerCopy.title}
          </h3>
          <p className="text-sm text-[#685950]">
            {sellerCopy.subtitle}
          </p>
        </div>

        {/* 6-Step Seller Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sellerCopy.steps.map((step, idx) => {
            const isExpanded = expandedSellerStep === idx;
            return (
              <div
                key={step.number}
                className="p-5 bg-white border border-[#30251F]/10 rounded-2xl shadow-soft-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="w-8 h-8 rounded-full bg-[#9E4A2B]/10 text-[#9E4A2B] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {step.number}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSellerStep(isExpanded ? null : idx)
                      }
                      className="p-1 text-[#685950] hover:text-[#30251F] rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9E4A2B]"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} step ${step.number}: ${step.title}`}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>

                  <h4 className="text-sm sm:text-base font-display font-medium text-[#30251F] mt-2">
                    {step.title}
                  </h4>
                  <p className="text-xs text-[#685950] mt-1 leading-relaxed">
                    {step.shortDesc}
                  </p>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#30251F]/5 text-xs text-[#30251F]/80 leading-relaxed bg-[#FAF6F0]/60 p-3 rounded-xl">
                    {step.detailedDesc}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Interactive "Before You List" Checklist */}
        <div className="p-6 sm:p-8 bg-[#FAF6F0] border border-[#30251F]/10 rounded-3xl space-y-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#9E4A2B]">
              <ShieldCheck className="w-4 h-4" />
              <span>Interactive Readiness Checklist</span>
            </div>
            <h4 className="text-lg sm:text-xl font-display font-medium text-[#30251F]">
              {sellerCopy.checklistTitle}
            </h4>
            <p className="text-xs sm:text-sm text-[#685950]">
              {sellerCopy.checklistSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sellerCopy.checklist.map((item) => {
              const isChecked = !!checkedItems[item.id];
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer min-h-[44px] ${
                    isChecked
                      ? 'bg-white border-[#637B58]/40 shadow-soft-sm'
                      : 'bg-white/70 border-[#30251F]/10 hover:bg-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChecklist(item.id)}
                    className="mt-1 h-4 w-4 rounded border-[#30251F]/30 text-[#9E4A2B] focus:ring-[#9E4A2B] cursor-pointer"
                  />
                  <div className="space-y-1">
                    <span
                      className={`text-xs sm:text-sm font-medium block leading-tight ${
                        isChecked
                          ? 'text-[#30251F] line-through opacity-80'
                          : 'text-[#30251F]'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[11px] text-[#685950] block leading-snug">
                      {item.description}
                    </span>
                    <span className="text-[10px] font-mono text-[#9E4A2B] bg-[#9E4A2B]/10 px-2 py-0.5 rounded-full inline-block mt-1">
                      Required Field: {item.field}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#30251F]/10">
            <p className="text-xs text-[#685950]">
              Ready to submit? Approved brands can begin uploading pieces immediately.
            </p>
            <a
              href={sellerCopy.sellerCta.href}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#9E4A2B] text-white hover:bg-[#853E24] text-xs sm:text-sm font-semibold transition-colors shadow-soft-sm min-h-[44px]"
            >
              <span>{sellerCopy.sellerCta.label}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
