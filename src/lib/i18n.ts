/**
 * RABLO — Internationalization & Auto-Localization Engine
 * Translates content automatically according to visitor region (Germany -> de, Korea -> ko, Japan -> ja, France -> fr, Italy -> it, Vietnam -> vi, etc.)
 */

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  countries: string[];
  timezones?: string[];
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', countries: ['US', 'GB', 'IN', 'AU', 'NZ', 'CA'] },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', countries: ['DE', 'AT', 'CH'], timezones: ['Berlin', 'Vienna', 'Zurich'] },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', countries: ['KR', 'KP'], timezones: ['Seoul', 'Pyongyang'] },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', countries: ['JP'], timezones: ['Tokyo'] },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', countries: ['FR', 'BE', 'MC', 'SN', 'CI', 'LU'], timezones: ['Paris', 'Brussels'] },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', countries: ['IT', 'SM', 'VA'], timezones: ['Rome'] },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', countries: ['VN'], timezones: ['Ho_Chi_Minh', 'Saigon', 'Hanoi'] },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', countries: ['ES', 'MX', 'AR', 'CO', 'CL', 'PE'], timezones: ['Madrid'] },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', countries: ['PT', 'BR'], timezones: ['Lisbon', 'Sao_Paulo'] },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', countries: ['IN'], timezones: ['Kolkata'] },
  { code: 'zh-CN', name: 'Chinese', nativeName: '中文 (简体)', flag: '🇨🇳', countries: ['CN', 'SG', 'TW'], timezones: ['Shanghai'] },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', countries: ['SA', 'AE', 'EG'], timezones: ['Riyadh', 'Cairo'] },
];

export const COUNTRY_TO_LANG: Record<string, string> = {
  DE: 'de', AT: 'de', CH: 'de',
  KR: 'ko', KP: 'ko',
  JP: 'ja',
  FR: 'fr', BE: 'fr', MC: 'fr',
  IT: 'it', SM: 'it', VA: 'it',
  VN: 'vi',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es',
  PT: 'pt', BR: 'pt',
  CN: 'zh-CN', TW: 'zh-CN', SG: 'zh-CN',
  IN: 'en',
  US: 'en', GB: 'en', CA: 'en', AU: 'en', NZ: 'en',
};

/** Get cookie value by name */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/** Set cookie across paths and domain */
export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  const domain = window.location.hostname;
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax;`;
  if (domain && domain !== 'localhost' && !domain.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; domain=.${domain}; SameSite=Lax;`;
  }
}

/** Detect the user's best matching language based on saved preference, geo-location, locale, and timezone */
export function detectUserLanguage(): string {
  if (typeof window === 'undefined') return 'en';

  // 1. Explicit user preference
  const savedPref = localStorage.getItem('rablo:preferred_language') || getCookie('rablo_lang');
  if (savedPref && SUPPORTED_LANGUAGES.some((l) => l.code === savedPref)) {
    return savedPref;
  }

  // 2. Cloudflare Geo-IP country cookie
  const geoCountry = getCookie('rablo_geo_country');
  if (geoCountry && COUNTRY_TO_LANG[geoCountry.toUpperCase()]) {
    return COUNTRY_TO_LANG[geoCountry.toUpperCase()];
  }

  // 3. Browser Language (navigator.language)
  const navLangs = navigator.languages || [navigator.language || ''];
  for (const nl of navLangs) {
    if (!nl) continue;
    const clean = nl.toLowerCase().split('-')[0];
    const directMatch = SUPPORTED_LANGUAGES.find((l) => l.code === clean);
    if (directMatch) {
      return directMatch.code;
    }
  }

  // 4. Timezone heuristics
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    for (const lang of SUPPORTED_LANGUAGES) {
      if (lang.timezones && lang.timezones.some((t) => tz.includes(t))) {
        return lang.code;
      }
    }
  } catch {}

  return 'en';
}

/** Set current active language and trigger seamless translation */
export function setLanguage(langCode: string, reloadIfFallback = true) {
  if (typeof window === 'undefined') return;

  const validLang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  if (!validLang) return;

  // Persist preference
  localStorage.setItem('rablo:preferred_language', langCode);
  setCookie('rablo_lang', langCode, 365);

  // Set Google Translate cookie
  const googTransVal = langCode === 'en' ? '' : `/en/${langCode}`;
  setCookie('googtrans', googTransVal, 365);

  // Notify UI subscribers
  window.dispatchEvent(
    new CustomEvent('rablo:language-changed', {
      detail: { lang: validLang },
    })
  );

  // Update Google Translate select element if loaded
  const selectEl = document.querySelector<HTMLSelectElement>('.goog-te-combo');
  if (selectEl) {
    selectEl.value = langCode === 'en' ? '' : langCode;
    selectEl.dispatchEvent(new Event('change'));
  } else if (reloadIfFallback) {
    window.location.reload();
  }
}

/** Asynchronously detect IP geolocation if not yet determined and apply automatically */
export async function autoDetectAndApplyLanguage() {
  if (typeof window === 'undefined') return;

  // If user already picked manually, respect it
  const manual = localStorage.getItem('rablo:preferred_language');
  if (manual) {
    // Ensure cookies match manual choice
    const expected = manual === 'en' ? '' : `/en/${manual}`;
    const current = getCookie('googtrans');
    if (current !== expected && manual !== 'en') {
      setLanguage(manual, false);
    }
    return;
  }

  const detected = detectUserLanguage();

  if (detected && detected !== 'en') {
    setLanguage(detected, false);
    return;
  }

  // Fallback: Free, fast IP geo lookup for localhost or clients without header
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('https://get.geojs.io/v1/ip/country.json', {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const country = (data.country || '').toUpperCase();
      if (country && COUNTRY_TO_LANG[country]) {
        const lang = COUNTRY_TO_LANG[country];
        setCookie('rablo_geo_country', country, 30);
        if (lang !== 'en') {
          setLanguage(lang, false);
        }
      }
    }
  } catch {}
}
