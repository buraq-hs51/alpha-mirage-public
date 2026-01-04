// ============================================
// 🌐 REAL-TIME TRANSLATION SYSTEM
// ============================================
// Production-grade translation using Google Translate API
// with intelligent caching for optimal performance
//
// Architecture:
// 1. Pre-cached translations (instant) - 90+ common UI phrases
// 2. Memory cache - recently translated content
// 3. LocalStorage persistence - translations persist across sessions
// 4. Google Translate API - accurate real-time translation
// 5. LibreTranslate fallback - backup if Google fails
//
// Supported Languages (15):
// - English, Chinese, Japanese, Korean
// - Arabic (RTL), Hindi, German, French
// - Spanish, Portuguese, Russian
// - Indonesian, Malay, Thai, Vietnamese
//
// Usage:
//   const { t, language, setLanguage } = useTranslation();
//   <h1>{t("About Me")}</h1>  // Auto-translates to current language
//
// Performance:
// - Pre-cached: 0ms (instant)
// - Memory cache: <1ms
// - API translation: 100-300ms (cached afterwards)
// ============================================

export { 
  I18nProvider, 
  useTranslation, 
  getLanguageFromCountry, 
  getAvailableLanguages,
  countryToLanguage,
  LANGUAGES,
  getCacheStats,
  type LanguageCode,
  type LanguageMeta
} from './dynamic';

export { 
  translate, 
  translateBatch,
  translateSync,
  getCachedTranslation,
  isTranslationCached,
  clearTranslationCache,
  getCacheStats as getTranslationCacheStats,
  type TranslationResult,
} from './translation-engine';
