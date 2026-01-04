import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useEffect, 
  ReactNode,
  useRef
} from 'react';
import { 
  translate as translateText, 
  getCachedTranslation, 
  getCacheStats,
  LanguageCode 
} from './translation-engine';

// Re-export LanguageCode
export type { LanguageCode };

// ============================================
// TYPES
// ============================================

export interface LanguageMeta {
  code: LanguageCode;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  flag: string;
}

interface I18nContextType {
  language: LanguageCode;
  detectedLanguage: LanguageCode; // Language based on user's location (never changes)
  setLanguage: (lang: LanguageCode) => void;
  t: (text: string) => string;
  tAsync: (text: string) => Promise<string>;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
  languages: LanguageMeta[];
  currentLanguage: LanguageMeta;
  detectedLanguageMeta: LanguageMeta; // Metadata for location-based language
  isTranslating: boolean;
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  modelLoadProgress: number;
  // Cache acceleration
  isCacheAccelerated: boolean; // True if returning user with cached data
  cacheHitRate: number; // Percentage of translations from cache (0-100)
}

// ============================================
// LANGUAGE METADATA
// ============================================

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr', flag: '🇺🇸' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', direction: 'ltr', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', direction: 'ltr', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', direction: 'ltr', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', direction: 'rtl', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr', flag: '🇮🇳' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', direction: 'ltr', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', direction: 'ltr', flag: '🇫🇷' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', direction: 'ltr', flag: '🇪🇸' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', direction: 'ltr', flag: '🇧🇷' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', direction: 'ltr', flag: '🇷🇺' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', direction: 'ltr', flag: '🇮🇩' },
  { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', direction: 'ltr', flag: '🇲🇾' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', direction: 'ltr', flag: '🇹🇭' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', direction: 'ltr', flag: '🇻🇳' },
];

// ============================================
// COUNTRY TO LANGUAGE MAPPING
// ============================================

export const countryToLanguage: Record<string, LanguageCode> = {
  // English speaking
  'US': 'en', 'GB': 'en', 'UK': 'en', 'AU': 'en', 'CA': 'en', 'NZ': 'en', 'IE': 'en', 'PH': 'en',
  
  // Chinese speaking
  'CN': 'zh', 'HK': 'zh', 'TW': 'zh', 'MO': 'zh',
  
  // Japanese
  'JP': 'ja',
  
  // Korean
  'KR': 'ko',
  
  // Arabic speaking (Middle East & North Africa)
  'AE': 'ar', 'SA': 'ar', 'QA': 'ar', 'KW': 'ar', 'BH': 'ar', 'OM': 'ar', 
  'EG': 'ar', 'JO': 'ar', 'LB': 'ar', 'IQ': 'ar', 'SY': 'ar', 'PS': 'ar',
  'YE': 'ar', 'LY': 'ar', 'TN': 'ar', 'DZ': 'ar', 'MA': 'ar', 'SD': 'ar',
  
  // Hindi
  'IN': 'hi',
  
  // German speaking
  'DE': 'de', 'AT': 'de', 'LI': 'de',
  
  // French speaking
  'FR': 'fr', 'BE': 'fr', 'LU': 'fr', 'MC': 'fr', 'SN': 'fr', 'CI': 'fr',
  
  // Spanish speaking
  'ES': 'es', 'MX': 'es', 'AR': 'es', 'CO': 'es', 'CL': 'es', 'PE': 'es', 
  'VE': 'es', 'EC': 'es', 'GT': 'es', 'CU': 'es', 'BO': 'es', 'DO': 'es',
  'HN': 'es', 'PY': 'es', 'SV': 'es', 'NI': 'es', 'CR': 'es', 'PA': 'es', 'UY': 'es',
  
  // Portuguese speaking
  'BR': 'pt', 'PT': 'pt', 'AO': 'pt', 'MZ': 'pt',
  
  // Russian speaking
  'RU': 'ru', 'BY': 'ru', 'KZ': 'ru', 'KG': 'ru',
  
  // Indonesian
  'ID': 'id',
  
  // Malay (Malaysia, Singapore, Brunei)
  'MY': 'ms', 'SG': 'en', 'BN': 'ms',
  
  // Thai
  'TH': 'th',
  
  // Vietnamese
  'VN': 'vi',
  
  // Swiss (default to German, most common)
  'CH': 'de',
  
  // Netherlands - default English (Dutch not supported)
  'NL': 'en',
  
  // Italian speaking - default English (Italian not supported yet)
  'IT': 'en',
  
  // Nordic - default English
  'SE': 'en', 'NO': 'en', 'DK': 'en', 'FI': 'en', 'IS': 'en',
  
  // Eastern Europe - default English or Russian
  'PL': 'en', 'CZ': 'en', 'SK': 'en', 'HU': 'en', 'RO': 'en',
  'UA': 'ru', 'BG': 'ru',
  
  // Balkans
  'GR': 'en', 'HR': 'en', 'RS': 'en', 'SI': 'en',
  
  // Others
  'TR': 'en', 'IL': 'en', 'ZA': 'en', 'NG': 'en', 'KE': 'en',
};

export function getLanguageFromCountry(countryCode: string): LanguageCode {
  return countryToLanguage[countryCode?.toUpperCase()] || 'en';
}

// ============================================
// CONTEXT
// ============================================

const I18nContext = createContext<I18nContextType | null>(null);

const LANGUAGE_STORAGE_KEY = 'portfolioLanguage';
const USER_SELECTED_KEY = 'portfolioLanguageUserSelected'; // Track if user manually selected
const CACHE_INITIALIZED_KEY = 'portfolioCacheInitialized'; // Track if cache has been warmed up
const VISIT_TIMESTAMP_KEY = 'portfolioLastVisit'; // Track when user last visited
const LAST_COUNTRY_KEY = 'portfolioLastCountry'; // Track last detected country

// ============================================
// PROVIDER
// ============================================

interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: LanguageCode;
  countryCode?: string;
}

// Check if this is a returning user with cached data
function checkCacheAcceleration(): { isCacheAccelerated: boolean; timeSinceLastVisit: number } {
  if (typeof window === 'undefined') return { isCacheAccelerated: false, timeSinceLastVisit: 0 };
  
  const cacheInitialized = localStorage.getItem(CACHE_INITIALIZED_KEY) === 'true';
  const lastVisit = localStorage.getItem(VISIT_TIMESTAMP_KEY);
  const now = Date.now();
  
  // Mark this visit
  localStorage.setItem(VISIT_TIMESTAMP_KEY, now.toString());
  localStorage.setItem(CACHE_INITIALIZED_KEY, 'true');
  
  if (cacheInitialized && lastVisit) {
    const timeSinceLastVisit = now - parseInt(lastVisit, 10);
    // Cache accelerated if visited within last 7 days (cache persists in localStorage)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return { 
      isCacheAccelerated: timeSinceLastVisit < sevenDaysMs, 
      timeSinceLastVisit 
    };
  }
  
  return { isCacheAccelerated: false, timeSinceLastVisit: 0 };
}

export function I18nProvider({ 
  children, 
  defaultLanguage,
  countryCode 
}: I18nProviderProps) {
  // Calculate detected language from location (this NEVER changes based on user selection)
  const detectedLanguage: LanguageCode = countryCode 
    ? getLanguageFromCountry(countryCode) 
    : (defaultLanguage || 'en');

  // Check for cache acceleration (returning user)
  const [cacheAcceleration] = useState(() => checkCacheAcceleration());
  const translationStats = useRef({ cacheHits: 0, totalTranslations: 0 });

  // Initial language is always based on detected location (from countryCode prop)
  // This ensures VPN location is used when VPN is active
  const getInitialLanguage = (): LanguageCode => {
    // Always use location-based detection as the source of truth
    return detectedLanguage;
  };

  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [isTranslating, setIsTranslating] = useState(false);
  const [, forceUpdate] = useState(0);
  
  // Log current language state
  console.log('🌐 I18nProvider RENDER - Current language:', language, 'countryCode prop:', countryCode);
  
  // Track pending translations
  const pendingTranslations = useRef<Set<string>>(new Set());
  
  // Track if user manually selected a language (to prevent auto-override)
  const userManuallySelected = useRef(false);

  // Update language when country code changes (ONLY on initial load or country change)
  // DO NOT override user's manual selection
  useEffect(() => {
    if (countryCode) {
      const lastCountry = localStorage.getItem(LAST_COUNTRY_KEY);
      const detectedLang = getLanguageFromCountry(countryCode);
      const isUserSelected = localStorage.getItem(USER_SELECTED_KEY) === 'true';
      
      console.log('🌐 I18nProvider useEffect triggered');
      console.log('   Current Country Code:', countryCode);
      console.log('   Last Known Country:', lastCountry);
      console.log('   Detected Language:', detectedLang);
      console.log('   Current language state:', language);
      console.log('   User manually selected:', isUserSelected || userManuallySelected.current);
      
      // Only auto-update language if:
      // 1. Country has changed (new VPN location), OR
      // 2. This is the first visit (no lastCountry)
      // AND the user hasn't manually selected a language in this session
      const countryChanged = lastCountry !== countryCode;
      
      if (countryChanged && !userManuallySelected.current) {
        console.log('   🌍 Country changed, UPDATING language to:', detectedLang);
        localStorage.setItem(LAST_COUNTRY_KEY, countryCode);
        // Clear user selection flag when country changes (new location = new default)
        localStorage.removeItem(USER_SELECTED_KEY);
        setLanguageState(detectedLang);
      } else if (!lastCountry) {
        console.log('   🌍 First visit, setting language to:', detectedLang);
        localStorage.setItem(LAST_COUNTRY_KEY, countryCode);
        setLanguageState(detectedLang);
      } else {
        console.log('   ✅ Keeping current language (user selected or same country)');
      }
    }
  }, [countryCode]); // REMOVED 'language' from dependencies - this was causing the override!

  // Set language (called when user manually selects)
  const setLanguage = useCallback((lang: LanguageCode) => {
    console.log('🌐 User manually selected language:', lang);
    userManuallySelected.current = true; // Mark as user-selected for this session
    setLanguageState(lang);
    // Save to localStorage and mark as user-selected
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    localStorage.setItem(USER_SELECTED_KEY, 'true');
    
    const langMeta = LANGUAGES.find(l => l.code === lang);
    if (langMeta) {
      document.documentElement.dir = langMeta.direction;
      document.documentElement.lang = lang;
    }
  }, []);

  // Async translation
  const tAsync = useCallback(async (text: string): Promise<string> => {
    if (!text || language === 'en') return text;
    
    // Check cache first
    const cached = getCachedTranslation(text, language);
    if (cached) return cached;
    
    // Translate via API
    const result = await translateText(text, language);
    return result.text;
  }, [language]);

  // Sync translation (returns cached or triggers async fetch)
  const t = useCallback((text: string): string => {
    if (!text || language === 'en') return text;
    
    // Track total translations
    translationStats.current.totalTranslations++;
    
    // Check cache first (includes pre-cached translations)
    const cached = getCachedTranslation(text, language);
    if (cached) {
      // Track cache hit
      translationStats.current.cacheHits++;
      return cached;
    }
    
    // If not cached and not already pending, trigger translation
    const pendingKey = `${language}:${text}`;
    if (!pendingTranslations.current.has(pendingKey)) {
      pendingTranslations.current.add(pendingKey);
      setIsTranslating(true);
      
      translateText(text, language).then((result) => {
        pendingTranslations.current.delete(pendingKey);
        
        if (pendingTranslations.current.size === 0) {
          setIsTranslating(false);
        }
        
        // Force re-render to show translated text
        if (result.source !== 'original') {
          forceUpdate(n => n + 1);
        }
      }).catch(() => {
        pendingTranslations.current.delete(pendingKey);
        if (pendingTranslations.current.size === 0) {
          setIsTranslating(false);
        }
      });
    }
    
    // Return original text while translation is pending
    return text;
  }, [language]);

  // Calculate cache hit rate
  const cacheHitRate = translationStats.current.totalTranslations > 0
    ? Math.round((translationStats.current.cacheHits / translationStats.current.totalTranslations) * 100)
    : 0;

  const currentLanguage = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
  const detectedLanguageMeta = LANGUAGES.find(l => l.code === detectedLanguage) || LANGUAGES[0];

  const value: I18nContextType = {
    language,
    detectedLanguage, // Location-based language (never changes based on user selection)
    setLanguage,
    t,
    tAsync,
    direction: currentLanguage.direction,
    isRTL: currentLanguage.direction === 'rtl',
    languages: LANGUAGES,
    currentLanguage,
    detectedLanguageMeta, // Metadata for location-based language
    isTranslating,
    modelStatus: 'ready', // API-based, always ready
    modelLoadProgress: 100, // API-based, always 100%
    // Cache acceleration
    isCacheAccelerated: cacheAcceleration.isCacheAccelerated,
    cacheHitRate,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

// ============================================
// UTILITY EXPORTS
// ============================================

export function getAvailableLanguages(): LanguageMeta[] {
  return LANGUAGES;
}

// Export cache stats for debugging
export { getCacheStats };
