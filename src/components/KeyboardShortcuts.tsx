/**
 * ============================================
 * KEYBOARD SHORTCUTS (Bloomberg Terminal Style)
 * ============================================
 * 
 * Provides quick navigation through keyboard shortcuts.
 * Demonstrates familiarity with professional trading terminals.
 * 
 * Shortcuts:
 * - G: Go to top (home)
 * - P: Projects section
 * - S: Skills section
 * - E: Experience section
 * - Q: Quant Sandbox
 * - C: Contact section
 * - ?: Show help overlay
 * - /: Focus search (future)
 * - K: Command palette (future)
 * 
 * Author: Shadaab Ahmed
 * ============================================
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Keyboard, 
  House, 
  Code, 
  Briefcase,
  GraduationCap,
  Envelope,
  Flask,
  X,
  Command
} from '@phosphor-icons/react';
import { markFeatureUsed } from './FeatureDiscoveryHints';

interface Shortcut {
  key: string;
  description: string;
  icon: React.ElementType;
  action: () => void;
}

// Helper to scroll to section
function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Helper to navigate to route (if using router)
function navigateTo(path: string) {
  // For now, just update the hash
  window.location.hash = path;
}

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  
  // Check if we're on the lab page
  const isOnLabPage = window.location.hash.includes('/lab');
  
  const shortcuts: Shortcut[] = [
    {
      key: 'g',
      description: 'Go to Home/Top',
      icon: House,
      action: () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    {
      key: 'b',
      description: 'Back to Portfolio',
      icon: House,
      action: () => {
        if (window.location.hash.includes('/lab')) {
          window.location.hash = '/';
        }
      }
    },
    {
      key: 'p',
      description: 'Projects',
      icon: Code,
      action: () => scrollToSection('projects')
    },
    {
      key: 's',
      description: 'Skills',
      icon: GraduationCap,
      action: () => scrollToSection('skills')
    },
    {
      key: 'e',
      description: 'Experience',
      icon: Briefcase,
      action: () => scrollToSection('experience')
    },
    {
      key: 'q',
      description: 'Quant Sandbox',
      icon: Flask,
      action: () => {
        // If on home page, navigate to lab
        if (!window.location.hash.includes('/lab')) {
          window.location.hash = '/lab';
        } else {
          // If already on lab, scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    },
    {
      key: 'a',
      description: 'Alpha Engine',
      icon: Flask,
      action: () => {
        // Navigate to Alpha Engine
        if (!window.location.hash.includes('/alpha-engine')) {
          window.location.hash = '/alpha-engine';
        } else {
          // If already on alpha engine, scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    },
    {
      key: 'c',
      description: 'Contact',
      icon: Envelope,
      action: () => scrollToSection('contact')
    },
    {
      key: '?',
      description: 'Show Help',
      icon: Keyboard,
      action: () => setShowHelp(true)
    }
  ];
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger if typing in an input/textarea
    if (
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.getAttribute('contenteditable') === 'true'
    ) {
      return;
    }
    
    // Don't trigger with modifier keys (except shift for ?)
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    
    const key = e.key.toLowerCase();
    
    // Find matching shortcut
    const shortcut = shortcuts.find(s => s.key === key || (key === '/' && s.key === '?'));
    
    if (shortcut) {
      e.preventDefault();
      shortcut.action();
      
      // Mark shortcuts feature as used
      markFeatureUsed('shortcuts');
      
      // Show toast for navigation shortcuts
      if (key !== '?') {
        setLastKey(key.toUpperCase());
        setShowToast(true);
        setTimeout(() => setShowToast(false), 1500);
      }
    }
    
    // Escape closes help
    if (e.key === 'Escape') {
      setShowHelp(false);
    }
  }, [shortcuts]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return {
    showHelp,
    setShowHelp,
    shortcuts,
    showToast,
    lastKey
  };
}

// Help Modal Component
export function KeyboardShortcutsHelp({ 
  isOpen, 
  onClose, 
  shortcuts 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  shortcuts: Shortcut[];
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-black/95 border border-purple-500/40 rounded-lg shadow-2xl shadow-purple-500/20 max-w-md w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border-b border-purple-500/30">
              <div className="flex items-center gap-2">
                <Command size={18} className="text-purple-400" weight="duotone" />
                <span className="text-purple-400 font-mono text-sm font-bold">
                  KEYBOARD SHORTCUTS
                </span>
              </div>
              <button 
                onClick={onClose}
                className="text-foreground/50 hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Shortcuts Grid */}
            <div className="p-4">
              <div className="text-[10px] text-foreground/50 uppercase tracking-widest mb-3">
                Navigation • Bloomberg Terminal Style
              </div>
              
              <div className="space-y-2">
                {shortcuts.map((shortcut) => (
                  <div 
                    key={shortcut.key}
                    className="flex items-center justify-between py-2 px-3 rounded-md bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => {
                      shortcut.action();
                      if (shortcut.key !== '?') onClose();
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <shortcut.icon size={16} className="text-purple-400" />
                      <span className="text-foreground text-sm">{shortcut.description}</span>
                    </div>
                    <kbd className="px-2 py-1 bg-black/50 border border-foreground/20 rounded text-xs font-mono text-cyan-400">
                      {shortcut.key.toUpperCase()}
                    </kbd>
                  </div>
                ))}
              </div>
              
              {/* Additional Shortcuts */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-[10px] text-foreground/50 uppercase tracking-widest mb-3">
                  Special Keys
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-white/5">
                    <span className="text-foreground/80 text-sm">Open Terminal</span>
                    <kbd className="px-2 py-1 bg-black/50 border border-foreground/20 rounded text-xs font-mono text-cyan-400">
                      `
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 rounded-md bg-white/5">
                    <span className="text-foreground/80 text-sm">Close Modal</span>
                    <kbd className="px-2 py-1 bg-black/50 border border-foreground/20 rounded text-xs font-mono text-cyan-400">
                      ESC
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-4 py-2 border-t border-purple-500/20 bg-purple-500/5">
              <p className="text-[10px] text-foreground/40 text-center font-mono">
                Inspired by Bloomberg Terminal navigation • Press ? anytime
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toast notification for shortcut activation
export function ShortcutToast({ isVisible, keyPressed }: { isVisible: boolean; keyPressed: string | null }) {
  return (
    <AnimatePresence>
      {isVisible && keyPressed && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[80]"
        >
          <div className="bg-black/90 backdrop-blur-xl border border-cyan-500/40 rounded-lg px-4 py-2 shadow-lg shadow-cyan-500/20 flex items-center gap-2">
            <kbd className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 rounded text-sm font-mono text-cyan-400">
              {keyPressed}
            </kbd>
            <span className="text-foreground/80 text-sm">pressed</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Main provider component
export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const { showHelp, setShowHelp, shortcuts, showToast, lastKey } = useKeyboardShortcuts();
  
  return (
    <>
      {children}
      <KeyboardShortcutsHelp 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
        shortcuts={shortcuts}
      />
      <ShortcutToast isVisible={showToast} keyPressed={lastKey} />
    </>
  );
}

export default KeyboardShortcutsProvider;
