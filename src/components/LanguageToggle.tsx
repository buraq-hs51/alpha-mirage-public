import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobeHemisphereWest, CaretDown, Check, Spinner, Brain } from '@phosphor-icons/react';
import { useTranslation, LanguageCode } from '@/i18n';

interface LanguageToggleProps {
  className?: string;
  variant?: 'default' | 'minimal' | 'floating' | 'prominent';
}

export function LanguageToggle({ className = '', variant = 'default' }: LanguageToggleProps) {
  const { language, setLanguage, languages, currentLanguage, isTranslating, modelStatus, modelLoadProgress } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (langCode: LanguageCode) => {
    setLanguage(langCode);
    setIsOpen(false);
  };

  // PROMINENT variant - Smaller, transparent button for top-left navigation
  if (variant === 'prominent') {
    return (
      <div className={`relative ${className}`}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 backdrop-blur-sm
                     border border-white/10 rounded-lg hover:border-cyan-500/30 hover:bg-white/10 
                     transition-all duration-300"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Globe icon - smaller */}
          <GlobeHemisphereWest size={18} className="text-cyan-400/80" weight="duotone" />
          
          {/* Flag only */}
          <span className="text-base">{currentLanguage.flag}</span>
          
          {/* Dropdown arrow */}
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <CaretDown size={12} className="text-gray-500" />
          </motion.div>
        </motion.button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-2 left-0 min-w-[200px] bg-slate-900/95 border border-white/10 
                         rounded-xl overflow-hidden shadow-2xl shadow-black/40 backdrop-blur-xl max-h-[400px] overflow-y-auto z-[60]"
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-white/5 bg-gradient-to-r from-cyan-500/10 to-violet-500/10">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Select Language</p>
              </div>
              
              {/* Quick switch to English if not already English */}
              {language !== 'en' && (
                <button
                  onClick={() => handleLanguageChange('en')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-cyan-500/10 
                             text-cyan-400 hover:bg-cyan-500/20 transition-colors border-b border-white/5 text-sm"
                >
                  <span className="text-base">🇺🇸</span>
                  <span className="font-medium">Switch to English</span>
                </button>
              )}
              
              {/* All languages */}
              {languages.map((lang) => (
                <motion.button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left
                             transition-colors duration-200 ${
                               language === lang.code 
                                 ? 'bg-cyan-500/20 text-cyan-400' 
                                 : 'text-gray-300 hover:bg-white/5 hover:text-white'
                             }`}
                  whileHover={{ x: language === lang.code ? 0 : 3 }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{lang.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{lang.nativeName}</span>
                      <span className="text-[10px] text-gray-500">{lang.name}</span>
                    </div>
                  </div>
                  {language === lang.code && (
                    <Check size={14} className="text-cyan-400" weight="bold" />
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click outside to close */}
        {isOpen && (
          <div 
            className="fixed inset-0 z-[55]" 
            onClick={() => setIsOpen(false)} 
          />
        )}
      </div>
    );
  }

  // Floating variant - fixed position in corner
  if (variant === 'floating') {
    return (
      <div className={`fixed top-4 z-50 language-toggle ${className}`}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative"
        >
          {/* Toggle button */}
          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900/90 border border-white/10 rounded-xl 
                       hover:border-cyan-500/50 hover:bg-gray-800/90 transition-all duration-300
                       shadow-lg shadow-black/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {modelStatus === 'loading' ? (
              <div className="flex items-center gap-1">
                <Brain size={18} className="text-purple-400 animate-pulse" weight="duotone" />
                <span className="text-[10px] text-purple-400 font-mono">{Math.round(modelLoadProgress)}%</span>
              </div>
            ) : isTranslating ? (
              <Spinner size={18} className="text-cyan-400 animate-spin" />
            ) : (
              <span className="text-lg">{currentLanguage.flag}</span>
            )}
            <span className="text-sm font-medium text-white">{currentLanguage.nativeName}</span>
            {modelStatus === 'loading' && (
              <span className="text-[10px] text-purple-400 font-mono">ML</span>
            )}
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <CaretDown size={14} className="text-gray-400" />
            </motion.div>
          </motion.button>

          {/* Model loading progress bar */}
          {modelStatus === 'loading' && (
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gray-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-cyan-500"
                initial={{ width: 0 }}
                animate={{ width: `${modelLoadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {/* Dropdown */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full mt-2 right-0 min-w-[180px] bg-gray-900/95 border border-white/10 
                           rounded-xl overflow-hidden shadow-xl shadow-black/30 backdrop-blur-sm max-h-[400px] overflow-y-auto"
              >
                {languages.map((lang) => (
                  <motion.button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left
                               transition-colors duration-200 ${
                                 language === lang.code 
                                   ? 'bg-cyan-500/20 text-cyan-400' 
                                   : 'text-gray-300 hover:bg-white/5 hover:text-white'
                               }`}
                    whileHover={{ x: language === lang.code ? 0 : 4 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{lang.flag}</span>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{lang.nativeName}</span>
                        <span className="text-xs text-gray-500">{lang.name}</span>
                      </div>
                    </div>
                    {language === lang.code && (
                      <Check size={16} className="text-cyan-400" weight="bold" />
                    )}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Click outside to close */}
        {isOpen && (
          <div 
            className="fixed inset-0 z-[-1]" 
            onClick={() => setIsOpen(false)} 
          />
        )}
      </div>
    );
  }

  // Minimal variant - just icon and current language code
  if (variant === 'minimal') {
    return (
      <div className={`relative ${className}`}>
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-sm">{currentLanguage.flag}</span>
          <span className="text-xs font-medium text-gray-400 uppercase">{language}</span>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute top-full mt-1 right-0 bg-gray-900 border border-white/10 rounded-lg 
                         overflow-hidden shadow-lg min-w-[120px]"
            >
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                    language === lang.code 
                      ? 'bg-cyan-500/20 text-cyan-400' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {lang.nativeName}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {isOpen && (
          <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)} />
        )}
      </div>
    );
  }

  // Default variant - full button with dropdown
  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg 
                   hover:border-white/20 hover:bg-white/10 transition-all duration-200"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <GlobeHemisphereWest size={18} className="text-cyan-400" weight="duotone" />
        <span className="text-sm text-gray-300">{currentLanguage.nativeName}</span>
        <CaretDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 right-0 min-w-[150px] bg-gray-900 border border-white/10 
                       rounded-xl overflow-hidden shadow-xl z-50"
          >
            {/* Switch to English quick action */}
            {language !== 'en' && (
              <>
                <button
                  onClick={() => handleLanguageChange('en')}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left bg-cyan-500/10 
                             text-cyan-400 hover:bg-cyan-500/20 transition-colors border-b border-white/5"
                >
                  <span className="text-sm font-medium">🇺🇸 Switch to English</span>
                </button>
              </>
            )}
            
            {/* All languages */}
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  language === lang.code 
                    ? 'bg-white/5 text-white' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-sm">{lang.flag} {lang.nativeName}</span>
                {language === lang.code && (
                  <Check size={14} className="text-cyan-400" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export default LanguageToggle;
