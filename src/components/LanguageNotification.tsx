import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n';
import { X, Zap, Globe } from 'lucide-react';

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
  hi: 'हिन्दी',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  id: 'Bahasa',
  ms: 'Melayu',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

// Creative messages for cache-accelerated mode
const TURBO_MESSAGES = [
  { emoji: '⚡', title: 'Turbo Mode Active!', subtitle: 'Loaded from your local cache' },
  { emoji: '🚀', title: 'Blazing Fast!', subtitle: 'Your cached translations are ready' },
  { emoji: '💨', title: 'Speed Boost!', subtitle: 'Powered by your saved preferences' },
  { emoji: '✨', title: 'Cache Magic!', subtitle: 'Instant load from memory' },
  { emoji: '🔥', title: 'Lightning Fast!', subtitle: 'Using your cached data' },
];

export const LanguageNotification: React.FC = () => {
  // Use detectedLanguage (location-based) for the popup message, NOT the current page language
  const { detectedLanguage, detectedLanguageMeta, isCacheAccelerated, cacheHitRate } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [turboMessage] = useState(() => 
    TURBO_MESSAGES[Math.floor(Math.random() * TURBO_MESSAGES.length)]
  );

  // Show notification on EVERY page load after a short delay
  useEffect(() => {
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, isCacheAccelerated ? 500 : 2000); // Show faster for cached users

    // Auto-hide after time
    const hideTimer = setTimeout(() => {
      setIsVisible(false);
    }, isCacheAccelerated ? 6000 : 10000); // Shorter for turbo mode

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isCacheAccelerated]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  // Use the DETECTED language (from location), not the current page language
  const languageName = LANGUAGE_NAMES[detectedLanguage] || detectedLanguage.toUpperCase();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 25 
          }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] max-w-md w-[90%]"
        >
          {/* Always show language notification (user preference over turbo mode) */}
          {false ? (
            // 🚀 TURBO MODE - Cache Accelerated Notification
            <div className="relative bg-gradient-to-r from-emerald-500/20 via-cyan-500/20 to-blue-500/20 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl shadow-2xl overflow-hidden">
              {/* Animated pulse glow */}
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              
              {/* Content */}
              <div className="relative p-5 pr-12">
                <div className="flex items-start gap-4">
                  {/* Animated lightning bolt */}
                  <motion.div 
                    className="flex-shrink-0"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{ 
                      duration: 0.6,
                      repeat: 2,
                    }}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                      <Zap className="w-6 h-6 text-white fill-white" />
                    </div>
                  </motion.div>
                  
                  {/* Text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{turboMessage.emoji}</span>
                      <h3 className="font-bold text-lg text-white">{turboMessage.title}</h3>
                    </div>
                    <p className="text-white/70 text-sm mt-1">
                      {turboMessage.subtitle}
                    </p>
                    {cacheHitRate > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="h-1.5 flex-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(cacheHitRate, 100)}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                          />
                        </div>
                        <span className="text-xs text-emerald-400 font-mono">{cacheHitRate}% cached</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Progress bar for auto-dismiss */}
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 5.5, ease: "linear" }}
                className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-blue-500/50 origin-left"
              />
              
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            // 🌐 NORMAL MODE - First Visit Language Notification
            <div className="relative bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
              {/* Subtle animated gradient border */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-purple-500/20 opacity-50" />
              
              {/* Content */}
              <div className="relative p-5 pr-12">
                {/* Creative message */}
                <div className="flex items-start gap-4">
                  {/* Animated globe/flag - uses DETECTED location flag */}
                  <motion.div 
                    className="text-3xl"
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      repeatDelay: 3
                    }}
                  >
                    {detectedLanguageMeta.flag}
                  </motion.div>
                  
                  {/* Text */}
                  <div className="flex-1">
                    <p className="text-white/90 text-sm leading-relaxed">
                      <span className="font-medium text-cyan-300">✨ Hey there!</span> We noticed you're browsing from{' '}
                      <span className="font-semibold text-white">{languageName}</span> territory.
                    </p>
                    <p className="text-white/60 text-xs mt-2">
                      Look for the <span className="inline-flex items-center gap-1 text-cyan-400 font-medium"><Globe className="w-3 h-3" /> globe</span> on the <span className="text-white/80">top-left</span> to switch languages anytime.
                    </p>
                  </div>
                </div>
                
                {/* Progress bar for auto-dismiss */}
                <motion.div
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: 8, ease: "linear" }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500/50 via-violet-500/50 to-purple-500/50 origin-left"
                />
              </div>
              
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-2 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LanguageNotification;
