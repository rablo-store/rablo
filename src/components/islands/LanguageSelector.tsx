import React, { useState, useEffect, useRef } from 'react';
import {
  SUPPORTED_LANGUAGES,
  detectUserLanguage,
  setLanguage,
  autoDetectAndApplyLanguage,
  type LanguageOption,
} from '../../lib/i18n';
import { Globe, Check, ChevronDown, Sparkles } from 'lucide-react';

interface Props {
  compact?: boolean;
}

export const LanguageSelector: React.FC<Props> = ({ compact = false }) => {
  const [currentLangCode, setCurrentLangCode] = useState<string>('en');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initial detection & apply auto-translation based on visitor location
    const initial = detectUserLanguage();
    setCurrentLangCode(initial);
    autoDetectAndApplyLanguage();

    // 2. Listen to custom language-changed events
    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ lang: LanguageOption }>;
      if (customEvent.detail?.lang?.code) {
        setCurrentLangCode(customEvent.detail.lang.code);
      }
    };
    window.addEventListener('rablo:language-changed', handleLangChange);

    // 3. Close on outside click
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      window.removeEventListener('rablo:language-changed', handleLangChange);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const activeLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  const handleSelect = (code: string) => {
    setCurrentLangCode(code);
    setIsOpen(false);
    setLanguage(code);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-200 cursor-pointer select-none notranslate ${
          isOpen
            ? 'border-[#7C0E44] bg-[#7C0E44]/10 text-[#7C0E44]'
            : 'border-charcoal-800/15 bg-ivory-100 hover:bg-ivory-300 text-charcoal-700 hover:border-[#7C0E44]/40'
        } ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs'}`}
        aria-expanded={isOpen}
        aria-label="Select language and translation"
        title={`Current Language: ${activeLang.nativeName} (${activeLang.name})`}
      >
        <span className="text-sm leading-none">{activeLang.flag}</span>
        <span className="font-medium truncate max-w-[70px] sm:max-w-none">
          {compact ? activeLang.code.toUpperCase() : activeLang.nativeName}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-charcoal-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#7C0E44]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-sm bg-ivory-100 border border-charcoal-800/15 shadow-soft-lg z-50 overflow-hidden divide-y divide-charcoal-800/10 animate-fade-in notranslate">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-ivory-200/80 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-600 flex items-center gap-1">
              <Globe className="w-3 h-3 text-[#7C0E44]" />
              <span>Auto-Translate Region</span>
            </span>
            <span className="text-[9px] font-mono text-[#7C0E44] bg-[#7C0E44]/10 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" />
              <span>Live</span>
            </span>
          </div>

          {/* Language Options List */}
          <div className="max-h-72 overflow-y-auto p-1 space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === currentLangCode;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  className={`w-full text-left px-3 py-2 rounded-xs text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#7C0E44] text-white font-medium'
                      : 'hover:bg-ivory-300 text-charcoal-800 hover:text-charcoal-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base leading-none">{lang.flag}</span>
                    <span className="truncate">{lang.nativeName}</span>
                    <span
                      className={`text-[10px] truncate ${
                        isSelected ? 'text-ivory-200' : 'text-charcoal-500'
                      }`}
                    >
                      ({lang.name})
                    </span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-white flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer Notice */}
          <div className="px-3.5 py-2 bg-ivory-200/50 text-[10px] text-charcoal-500 leading-tight">
            <span>Automatically adapts to your country &amp; region without language barrier.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
