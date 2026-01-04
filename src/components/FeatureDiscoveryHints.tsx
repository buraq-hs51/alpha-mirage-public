/**
 * ============================================
 * FEATURE DISCOVERY HINTS (v2)
 * ============================================
 * 
 * Smart hints that:
 * 1. Show initial hints after delays
 * 2. Track if user ACTUALLY used the features
 * 3. Re-show hints if not used (with longer intervals)
 * 4. Persistent indicator that pulses periodically
 * 
 * Author: Shadaab Ahmed
 * ============================================
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Keyboard, X, Command, Sparkle } from '@phosphor-icons/react';

interface FeatureHint {
  id: string;
  icon: React.ElementType;
  message: string;
  keystroke: string;
  color: string;
}

const FEATURE_HINTS: FeatureHint[] = [
  {
    id: 'terminal',
    icon: Terminal,
    message: 'Hidden terminal available',
    keystroke: '`',
    color: 'cyan'
  },
  {
    id: 'shortcuts',
    icon: Keyboard,
    message: 'Keyboard shortcuts enabled',
    keystroke: '?',
    color: 'purple'
  }
];

// Track feature usage globally
const featureUsageTracker = {
  terminal: false,
  shortcuts: false,
  
  markUsed(feature: 'terminal' | 'shortcuts') {
    this[feature] = true;
    try {
      const stored = JSON.parse(localStorage.getItem('usedFeatures') || '{}');
      stored[feature] = true;
      localStorage.setItem('usedFeatures', JSON.stringify(stored));
    } catch {}
  },
  
  isUsed(feature: 'terminal' | 'shortcuts'): boolean {
    if (this[feature]) return true;
    try {
      const stored = JSON.parse(localStorage.getItem('usedFeatures') || '{}');
      return stored[feature] === true;
    } catch {
      return false;
    }
  }
};

// Export for other components to mark features as used
export const markFeatureUsed = (feature: 'terminal' | 'shortcuts') => {
  featureUsageTracker.markUsed(feature);
};

// Typewriter effect hook
function useTypewriter(text: string, speed: number = 50, startDelay: number = 0) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    setDisplayText('');
    setIsComplete(false);
    
    let timeout: NodeJS.Timeout;
    let charIndex = 0;
    
    const startTyping = () => {
      const type = () => {
        if (charIndex < text.length) {
          setDisplayText(text.slice(0, charIndex + 1));
          charIndex++;
          timeout = setTimeout(type, speed);
        } else {
          setIsComplete(true);
        }
      };
      type();
    };
    
    timeout = setTimeout(startTyping, startDelay);
    
    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);
  
  return { displayText, isComplete };
}

// Individual hint notification
function HintNotification({ 
  hint, 
  onDismiss
}: { 
  hint: FeatureHint; 
  onDismiss: () => void;
}) {
  const { displayText, isComplete } = useTypewriter(hint.message, 35, 300);
  const Icon = hint.icon;
  
  const colorClasses = {
    cyan: {
      border: 'border-cyan-500/50',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      glow: 'shadow-cyan-500/30',
      kbd: 'bg-cyan-500/20 border-cyan-500/50'
    },
    purple: {
      border: 'border-purple-500/50',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      glow: 'shadow-purple-500/30',
      kbd: 'bg-purple-500/20 border-purple-500/50'
    }
  }[hint.color] || { border: 'border-foreground/20', bg: 'bg-foreground/10', text: 'text-foreground', glow: '', kbd: 'bg-foreground/10 border-foreground/20' };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className={`
        bg-black/95 backdrop-blur-xl border-2 ${colorClasses.border} rounded-xl 
        shadow-xl ${colorClasses.glow} overflow-hidden cursor-auto min-w-[280px]
      `}
      style={{ cursor: 'auto' }}
    >
      {/* Header with icon and close */}
      <div className={`px-4 py-2 ${colorClasses.bg} border-b ${colorClasses.border} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Icon size={16} className={colorClasses.text} weight="duotone" />
          </motion.div>
          <span className={`text-xs font-mono font-bold ${colorClasses.text} uppercase tracking-wider`}>
            Discovery
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-foreground/40 hover:text-foreground transition-colors p-1 rounded hover:bg-white/5"
        >
          <X size={14} />
        </button>
      </div>
      
      {/* Content */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Message with typewriter */}
          <div className="text-foreground text-sm font-medium">
            {displayText}
            {!isComplete && (
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.4, repeat: Infinity }}
                className={colorClasses.text}
              >
                ▌
              </motion.span>
            )}
          </div>
          
          {/* Keystroke */}
          <motion.kbd 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className={`
              px-3 py-1.5 ${colorClasses.kbd} border rounded-lg
              text-base font-mono ${colorClasses.text} font-bold
              shadow-lg
            `}
          >
            {hint.keystroke}
          </motion.kbd>
        </div>
        
        {/* Subtle instruction */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-foreground/40 text-xs mt-2 font-mono"
        >
          Press the key to try it out
        </motion.p>
      </div>
      
      {/* Progress bar */}
      <motion.div
        className={`h-1 ${colorClasses.bg}`}
        style={{ background: `linear-gradient(90deg, ${hint.color === 'cyan' ? 'rgb(6, 182, 212)' : 'rgb(168, 85, 247)'} 0%, transparent 100%)` }}
        initial={{ width: '100%', opacity: 0.5 }}
        animate={{ width: '0%', opacity: 0.3 }}
        transition={{ duration: 10, ease: 'linear' }}
        onAnimationComplete={onDismiss}
      />
    </motion.div>
  );
}

export function FeatureDiscoveryHints() {
  const [activeHint, setActiveHint] = useState<FeatureHint | null>(null);
  const [sessionShown, setSessionShown] = useState<Set<string>>(new Set());
  
  // Initialize hint queue based on what hasn't been used
  const getUnusedHints = useCallback(() => {
    return FEATURE_HINTS.filter(h => !featureUsageTracker.isUsed(h.id as 'terminal' | 'shortcuts'));
  }, []);
  
  // Initial hints - show after user scrolls/interacts
  useEffect(() => {
    let initialTimeout: NodeJS.Timeout;
    let fallbackTimeout: NodeJS.Timeout;
    
    const showInitialHints = () => {
      // Wait a bit, then show first unused hint
      initialTimeout = setTimeout(() => {
        const unusedHint = FEATURE_HINTS.find(h => 
          !featureUsageTracker.isUsed(h.id as 'terminal' | 'shortcuts') && 
          !sessionShown.has(h.id)
        );
        if (unusedHint) {
          setActiveHint(unusedHint);
        }
      }, 8000); // Show after 8 seconds
    };
    
    // Wait for interaction
    const handleInteraction = () => {
      showInitialHints();
    };
    
    window.addEventListener('scroll', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });
    
    // Also trigger after 12 seconds even without interaction
    fallbackTimeout = setTimeout(showInitialHints, 12000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(fallbackTimeout);
      window.removeEventListener('scroll', handleInteraction);
      window.removeEventListener('click', handleInteraction);
    };
  }, [sessionShown]);
  
  // Recurring reminders - show again every 90 seconds if feature not used
  useEffect(() => {
    const reminderInterval = setInterval(() => {
      // Only remind if no active hint and features still unused
      if (activeHint) return;
      
      const unusedHint = FEATURE_HINTS.find(h => 
        !featureUsageTracker.isUsed(h.id as 'terminal' | 'shortcuts')
      );
      
      if (unusedHint) {
        setActiveHint(unusedHint);
      }
    }, 90000); // Every 90 seconds
    
    return () => clearInterval(reminderInterval);
  }, [activeHint]);
  
  const dismissHint = useCallback((hintId: string) => {
    setSessionShown(prev => new Set([...prev, hintId]));
    setActiveHint(null);
    
    // Show next hint after a short delay
    setTimeout(() => {
      const nextHint = FEATURE_HINTS.find(h => 
        h.id !== hintId && 
        !featureUsageTracker.isUsed(h.id as 'terminal' | 'shortcuts') &&
        !sessionShown.has(h.id)
      );
      if (nextHint && !sessionShown.has(nextHint.id)) {
        setActiveHint(nextHint);
      }
    }, 3000);
  }, [sessionShown]);
  
  return (
    <div className="fixed top-20 right-4 z-[60] pointer-events-auto hidden lg:block">
      <AnimatePresence mode="wait">
        {activeHint && (
          <HintNotification
            key={activeHint.id}
            hint={activeHint}
            onDismiss={() => dismissHint(activeHint.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Persistent floating indicator - always shows available shortcuts with periodic pulse
export function ShortcutIndicator() {
  const [isPulsing, setIsPulsing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Periodic pulse to draw attention
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      // Only pulse if features haven't been used
      const terminalUsed = featureUsageTracker.isUsed('terminal');
      const shortcutsUsed = featureUsageTracker.isUsed('shortcuts');
      
      if (!terminalUsed || !shortcutsUsed) {
        setIsPulsing(true);
        setTimeout(() => setIsPulsing(false), 2000);
      }
    }, 30000); // Pulse every 30 seconds
    
    // Initial pulse after 20 seconds
    const initialPulse = setTimeout(() => {
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 2000);
    }, 20000);
    
    return () => {
      clearInterval(pulseInterval);
      clearTimeout(initialPulse);
    };
  }, []);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3 }}
      className="fixed bottom-4 left-4 z-[60] pointer-events-auto hidden lg:block"
      onMouseEnter={() => { setIsHovered(true); setShowTooltip(true); }}
      onMouseLeave={() => { setIsHovered(false); setShowTooltip(false); }}
    >
      {/* Tooltip on hover */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full left-0 mb-2 bg-black/95 backdrop-blur-xl border border-foreground/20 rounded-lg p-3 min-w-[200px]"
          >
            <div className="text-xs text-foreground/60 mb-2 font-mono uppercase tracking-wider">
              Power User Features
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-cyan-400" />
                  <span className="text-sm text-foreground">Open Terminal</span>
                </div>
                <kbd className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded text-xs font-mono text-cyan-400">
                  `
                </kbd>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Keyboard size={14} className="text-purple-400" />
                  <span className="text-sm text-foreground">Shortcuts</span>
                </div>
                <kbd className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 rounded text-xs font-mono text-purple-400">
                  ?
                </kbd>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-foreground/10 text-[10px] text-foreground/40">
              Bloomberg Terminal style navigation
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main indicator */}
      <motion.div
        className={`
          bg-black/80 backdrop-blur-xl border rounded-lg px-3 py-2 cursor-pointer
          transition-all duration-300
          ${isPulsing ? 'border-purple-500/60 shadow-lg shadow-purple-500/20' : 'border-foreground/10'}
          ${isHovered ? 'border-purple-500/40 bg-black/90' : ''}
        `}
        style={{ cursor: 'pointer' }}
        animate={isPulsing ? { 
          scale: [1, 1.02, 1],
          borderColor: ['rgba(168, 85, 247, 0.3)', 'rgba(168, 85, 247, 0.6)', 'rgba(168, 85, 247, 0.3)']
        } : {}}
        transition={{ duration: 1, repeat: isPulsing ? 2 : 0 }}
      >
        <div className="flex items-center gap-3">
          {/* Icon with glow when pulsing */}
          <div className="relative">
            <Command size={14} className={`${isPulsing ? 'text-purple-400' : 'text-foreground/40'} transition-colors`} />
            {isPulsing && (
              <motion.div
                className="absolute inset-0 bg-purple-500/30 rounded-full blur-sm"
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
          
          {/* Keys preview */}
          <div className="flex items-center gap-1.5">
            <kbd className={`
              px-1.5 py-0.5 rounded text-[10px] font-mono transition-all
              ${isPulsing ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400' : 'bg-foreground/5 border border-foreground/10 text-foreground/40'}
            `}>
              `
            </kbd>
            <kbd className={`
              px-1.5 py-0.5 rounded text-[10px] font-mono transition-all
              ${isPulsing ? 'bg-purple-500/20 border border-purple-500/40 text-purple-400' : 'bg-foreground/5 border border-foreground/10 text-foreground/40'}
            `}>
              ?
            </kbd>
          </div>
          
          {/* Sparkle when pulsing */}
          {isPulsing && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
            >
              <Sparkle size={12} className="text-yellow-400" weight="fill" />
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default FeatureDiscoveryHints;
