/**
 * ============================================
 * TERMINAL EASTER EGG
 * ============================================
 * 
 * A hidden command-line interface that appears when
 * pressing the backtick (`) key. Demonstrates:
 * - Deep technical knowledge
 * - Attention to detail
 * - Fun, hacker-style engineering
 * 
 * Commands:
 * - help: Show available commands
 * - whoami: About the developer
 * - skills: List technical skills
 * - projects: Show project list
 * - clear: Clear terminal
 * - neofetch: System info display
 * - contact: Contact information
 * - exit: Close terminal
 * 
 * Author: Shadaab Ahmed
 * ============================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X } from '@phosphor-icons/react';
import { markFeatureUsed } from './FeatureDiscoveryHints';
import { useTranslation, LANGUAGES, type LanguageCode } from '@/i18n';

// Language shortcuts for autocomplete (code -> full name)
const LANGUAGE_SHORTCUTS: Record<string, { code: LanguageCode; name: string }> = {
  'en': { code: 'en', name: 'english' },
  'eng': { code: 'en', name: 'english' },
  'english': { code: 'en', name: 'english' },
  'zh': { code: 'zh', name: 'chinese' },
  'chi': { code: 'zh', name: 'chinese' },
  'chinese': { code: 'zh', name: 'chinese' },
  'ja': { code: 'ja', name: 'japanese' },
  'jap': { code: 'ja', name: 'japanese' },
  'japanese': { code: 'ja', name: 'japanese' },
  'ko': { code: 'ko', name: 'korean' },
  'kor': { code: 'ko', name: 'korean' },
  'korean': { code: 'ko', name: 'korean' },
  'ar': { code: 'ar', name: 'arabic' },
  'ara': { code: 'ar', name: 'arabic' },
  'arabic': { code: 'ar', name: 'arabic' },
  'hi': { code: 'hi', name: 'hindi' },
  'hin': { code: 'hi', name: 'hindi' },
  'hindi': { code: 'hi', name: 'hindi' },
  'de': { code: 'de', name: 'german' },
  'ger': { code: 'de', name: 'german' },
  'german': { code: 'de', name: 'german' },
  'fr': { code: 'fr', name: 'french' },
  'fre': { code: 'fr', name: 'french' },
  'french': { code: 'fr', name: 'french' },
  'es': { code: 'es', name: 'spanish' },
  'spa': { code: 'es', name: 'spanish' },
  'spanish': { code: 'es', name: 'spanish' },
  'pt': { code: 'pt', name: 'portuguese' },
  'por': { code: 'pt', name: 'portuguese' },
  'portuguese': { code: 'pt', name: 'portuguese' },
  'ru': { code: 'ru', name: 'russian' },
  'rus': { code: 'ru', name: 'russian' },
  'russian': { code: 'ru', name: 'russian' },
  'id': { code: 'id', name: 'indonesian' },
  'ind': { code: 'id', name: 'indonesian' },
  'indonesian': { code: 'id', name: 'indonesian' },
  'ms': { code: 'ms', name: 'malay' },
  'mal': { code: 'ms', name: 'malay' },
  'malay': { code: 'ms', name: 'malay' },
  'th': { code: 'th', name: 'thai' },
  'tha': { code: 'th', name: 'thai' },
  'thai': { code: 'th', name: 'thai' },
  'vi': { code: 'vi', name: 'vietnamese' },
  'vie': { code: 'vi', name: 'vietnamese' },
  'vietnamese': { code: 'vi', name: 'vietnamese' },
};

// All language names for autocomplete
const LANGUAGE_NAMES = LANGUAGES.map(l => l.name.toLowerCase());

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'success' | 'ascii' | 'system';
  content: string;
  timestamp?: number;
}

const ASCII_LOGO = `
   _____ __              __            __     
  / ___// /_  ____ _____/ /___ _____ _/ /_    
  \\__ \\/ __ \\/ __ \`/ __  / __ \`/ __ \`/ __ \\   
 ___/ / / / / /_/ / /_/ / /_/ / /_/ / /_/ /   
/____/_/ /_/\\__,_/\\__,_/\\__,_/\\__,_/_.___/    
                                    Ahmed
`;

const COMMANDS: Record<string, (args: string[]) => TerminalLine[]> = {
  help: () => [
    { type: 'output', content: '' },
    { type: 'output', content: '╭──────────────────────────────────────────────╮' },
    { type: 'output', content: '│           AVAILABLE COMMANDS                 │' },
    { type: 'output', content: '╰──────────────────────────────────────────────╯' },
    { type: 'output', content: '' },
    { type: 'success', content: '  📋 INFORMATION:' },
    { type: 'output', content: '  help       - Show this help message' },
    { type: 'output', content: '  whoami     - About the developer' },
    { type: 'output', content: '  neofetch   - System info display' },
    { type: 'output', content: '' },
    { type: 'success', content: '  🧭 NAVIGATION: (closes terminal & navigates)' },
    { type: 'output', content: '  home       - Go to home page' },
    { type: 'output', content: '  top        - Scroll to top of current page' },
    { type: 'output', content: '  about      - Jump to About section' },
    { type: 'output', content: '  experience - Jump to Experience section' },
    { type: 'output', content: '  skills     - Jump to Skills section' },
    { type: 'output', content: '  projects   - Jump to Projects section' },
    { type: 'output', content: '  contact    - Jump to Contact section' },
    { type: 'output', content: '  sandbox    - Open Quant Sandbox' },
    { type: 'output', content: '  alpha      - Open Alpha Engine (ML Predictions)' },
    { type: 'output', content: '  resume     - Open Resume (new tab)' },
    { type: 'output', content: '' },
    { type: 'success', content: '  🎨 FUN:' },
    { type: 'output', content: '  theme      - Toggle dark/light theme' },
    { type: 'output', content: '  matrix     - Enter the matrix...' },
    { type: 'output', content: '' },
    { type: 'success', content: '  🌍 LANGUAGE:' },
    { type: 'output', content: '  lang       - Show current language' },
    { type: 'output', content: '  lang <name>- Switch language (e.g., lang french)' },
    { type: 'output', content: '               Supports: en, zh, ja, ko, ar, hi, de, fr, es, pt, ru, id, ms, th, vi' },
    { type: 'output', content: '' },
    { type: 'success', content: '  💻 TERMINAL:' },
    { type: 'output', content: '  clear      - Clear terminal' },
    { type: 'output', content: '  history    - Show command history' },
    { type: 'output', content: '  exit       - Close terminal' },
    { type: 'output', content: '' },
    { type: 'system', content: '  💡 Tip: Press Tab for autocomplete' },
    { type: 'output', content: '' }
  ],
  
  whoami: () => [
    { type: 'ascii', content: ASCII_LOGO },
    { type: 'output', content: '' },
    { type: 'success', content: 'Shadaab Ahmed' },
    { type: 'output', content: '────────────────────────────────────────' },
    { type: 'output', content: '' },
    { type: 'output', content: '  Quantitative Developer | Financial Engineer' },
    { type: 'output', content: '' },
    { type: 'output', content: '  Specializing in:' },
    { type: 'output', content: '  → Ultra-low latency trading systems' },
    { type: 'output', content: '  → Derivatives pricing & risk management' },
    { type: 'output', content: '  → Machine learning for alpha generation' },
    { type: 'output', content: '  → Statistical arbitrage strategies' },
    { type: 'output', content: '' },
    { type: 'system', content: '  "Building the future of algorithmic trading."' },
    { type: 'output', content: '' }
  ],
  
  neofetch: () => {
    const now = new Date();
    const uptime = Math.floor((now.getTime() - performance.timeOrigin) / 1000);
    const uptimeStr = `${Math.floor(uptime / 60)}m ${uptime % 60}s`;
    
    return [
      { type: 'output', content: '' },
      { type: 'ascii', content: `
       ████████╗███████╗██████╗ ███╗   ███╗
       ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║
          ██║   █████╗  ██████╔╝██╔████╔██║
          ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║
          ██║   ███████╗██║  ██║██║ ╚═╝ ██║
          ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
      ` },
      { type: 'output', content: '' },
      { type: 'output', content: `  OS:       Portfolio v1.0.0` },
      { type: 'output', content: `  Host:     ${window.location.hostname}` },
      { type: 'output', content: `  Kernel:   React 18.x` },
      { type: 'output', content: `  Uptime:   ${uptimeStr}` },
      { type: 'output', content: `  Shell:    zsh + node` },
      { type: 'output', content: `  Theme:    Cyberpunk Dark` },
      { type: 'output', content: `  Browser:  ${navigator.userAgent.split(' ').pop()?.split('/')[0] || 'Unknown'}` },
      { type: 'output', content: `  Screen:   ${window.screen.width}x${window.screen.height}` },
      { type: 'output', content: `  Memory:   ${(performance as any).memory?.usedJSHeapSize ? 
        Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'}` },
      { type: 'output', content: '' },
      { type: 'output', content: '  ████████████████████████' },
      { type: 'output', content: '' }
    ];
  },
  
  matrix: () => {
    // Trigger a fun animation or effect
    document.body.style.filter = 'hue-rotate(90deg)';
    setTimeout(() => {
      document.body.style.filter = '';
    }, 2000);
    
    return [
      { type: 'output', content: '' },
      { type: 'success', content: '  Wake up, Neo...' },
      { type: 'output', content: '  The Matrix has you...' },
      { type: 'output', content: '  Follow the white rabbit.' },
      { type: 'output', content: '' },
      { type: 'system', content: '  [Effect applied for 2 seconds]' },
      { type: 'output', content: '' }
    ];
  },
  
  theme: () => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    document.documentElement.classList.toggle('dark');
    document.documentElement.classList.toggle('light');
    
    return [
      { type: 'output', content: '' },
      { type: 'success', content: `Theme toggled: ${currentTheme} → ${currentTheme === 'dark' ? 'light' : 'dark'}` },
      { type: 'output', content: '' }
    ];
  },
  
  clear: () => [],
  
  exit: () => []
};

// Easter egg commands
const HIDDEN_COMMANDS: Record<string, () => TerminalLine[]> = {
  'sudo rm -rf /': () => [
    { type: 'error', content: '  Nice try! 🙃' },
    { type: 'output', content: '  This portfolio is protected by advanced security.' },
    { type: 'output', content: '' }
  ],
  
  'hack': () => [
    { type: 'output', content: '' },
    { type: 'success', content: '  Access Granted...' },
    { type: 'output', content: '  Just kidding! But I appreciate the enthusiasm.' },
    { type: 'output', content: '' }
  ],
  
  'coffee': () => [
    { type: 'output', content: '' },
    { type: 'output', content: '         ( (' },
    { type: 'output', content: '          ) )' },
    { type: 'output', content: '       ........' },
    { type: 'output', content: '       |      |]' },
    { type: 'output', content: '       \\      /' },
    { type: 'output', content: '        `----\'' },
    { type: 'output', content: '' },
    { type: 'success', content: '  Coffee is the fuel of great code!' },
    { type: 'output', content: '' }
  ],
  
  'hire': () => [
    { type: 'output', content: '' },
    { type: 'success', content: '  ╔════════════════════════════════════════╗' },
    { type: 'success', content: '  ║     THANK YOU FOR YOUR INTEREST!       ║' },
    { type: 'success', content: '  ╚════════════════════════════════════════╝' },
    { type: 'output', content: '' },
    { type: 'output', content: '  I would love to discuss opportunities!' },
    { type: 'output', content: '  Type "contact" to get in touch.' },
    { type: 'output', content: '' }
  ]
};

// localStorage keys for state persistence
const TERMINAL_HISTORY_KEY = 'terminal_history';
const TERMINAL_CMD_HISTORY_KEY = 'terminal_cmd_history';

// Resume URL - update this with actual resume link
const RESUME_URL = 'https://www.kickresume.com/cv/4W3LxK/';

// Navigation commands (handled specially - close terminal and navigate)
const NAVIGATION_SECTIONS: Record<string, string> = {
  'about': '#about',
  'experience': '#experience',
  'exp': '#experience',
  'work': '#experience',
  'skills': '#skills',
  'skill': '#skills',
  'projects': '#projects',
  'project': '#projects',
  'contact': '#contact',
};

// All commands for autocomplete (including navigation)
const ALL_COMMANDS = [
  // Information commands
  'help', 'whoami', 'skills', 'projects', 'neofetch', 'contact',
  // Navigation commands
  'home', 'top', 'about', 'experience', 'sandbox', 'alpha', 'resume',
  // Fun commands
  'theme', 'matrix',
  // Language command
  'lang',
  // Terminal commands
  'clear', 'history', 'exit',
  // Easter eggs
  'coffee', 'hire', 'hack'
];

export function TerminalEasterEgg() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, currentLanguage } = useTranslation();
  
  const [isOpen, setIsOpen] = useState(false);
  
  // Load history from localStorage on mount
  const [history, setHistory] = useState<TerminalLine[]>(() => {
    try {
      const saved = localStorage.getItem(TERMINAL_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Add a session separator
        return [
          ...parsed,
          { type: 'system' as const, content: '' },
          { type: 'system' as const, content: '  ── Session Restored ──' },
          { type: 'output' as const, content: '' }
        ];
      }
    } catch (e) {
      console.warn('Failed to load terminal history');
    }
    return [
      { type: 'system', content: '' },
      { type: 'system', content: '  Welcome to ShadaabOS v1.0.0' },
      { type: 'system', content: '  Type "help" for available commands.' },
      { type: 'output', content: '' }
    ];
  });
  
  const [currentInput, setCurrentInput] = useState('');
  
  // Load command history from localStorage
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(TERMINAL_CMD_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  
  // Listen for backtick key to toggle terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey) {
        // Don't trigger if typing in an input/textarea
        if (document.activeElement?.tagName === 'INPUT' || 
            document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  // Focus input when terminal opens and mark feature as used
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      // Mark terminal feature as used so hints stop showing
      markFeatureUsed('terminal');
    }
  }, [isOpen]);
  
  // Scroll to bottom on new output
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [history]);
  
  // Scroll to bottom when autocomplete suggestions appear or input changes
  useEffect(() => {
    if (terminalRef.current && (autocompleteSuggestions.length > 0 || currentInput)) {
      // Small delay to ensure DOM is updated
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
      });
    }
  }, [autocompleteSuggestions, currentInput]);
  
  // Persist history to localStorage (keep last 50 lines)
  useEffect(() => {
    try {
      const toSave = history.slice(-50);
      localStorage.setItem(TERMINAL_HISTORY_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save terminal history');
    }
  }, [history]);
  
  // Persist command history to localStorage (keep last 20 commands)
  useEffect(() => {
    try {
      const toSave = commandHistory.slice(-20);
      localStorage.setItem(TERMINAL_CMD_HISTORY_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('Failed to save command history');
    }
  }, [commandHistory]);
  
  // Navigation helper - close terminal and navigate
  const navigateAndClose = useCallback((path: string, hash?: string) => {
    setIsOpen(false);
    
    // Small delay to allow terminal to close smoothly
    setTimeout(() => {
      if (path !== location.pathname) {
        navigate(path);
      }
      
      // Scroll to section after navigation
      if (hash) {
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }, 150);
  }, [navigate, location.pathname]);
  
  const executeCommand = useCallback((input: string) => {
    const trimmedInput = input.trim();
    const [command, ...args] = trimmedInput.toLowerCase().split(' ');
    
    // Add input to history
    const inputLine: TerminalLine = { 
      type: 'input', 
      content: `$ ${trimmedInput}`,
      timestamp: Date.now()
    };
    
    // Handle special commands
    if (command === 'clear') {
      setHistory([inputLine]);
      return;
    }
    
    if (command === 'exit') {
      setIsOpen(false);
      return;
    }
    
    // ===== NAVIGATION COMMANDS =====
    
    // home / portfolio - go to home page
    if (command === 'home' || command === 'portfolio' || command === 'back') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Navigating to home page...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/');
      // Add to command history
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // top - scroll to top of current page
    if (command === 'top') {
      const currentPage = location.pathname === '/lab' ? 'Quant Sandbox' : 'page';
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: `  Scrolling to top of ${currentPage}...` },
        { type: 'output', content: '' }
      ]);
      // Close terminal first, then scroll to top
      setIsOpen(false);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 150);
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // sandbox / quant - go to Quant Sandbox
    if (command === 'sandbox' || command === 'quant' || command === 'lab' || command === 'trading') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Opening Quant Sandbox...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/lab');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // alpha / engine / ml - go to Alpha Engine (ML Predictions)
    if (command === 'alpha' || command === 'engine' || command === 'ml' || command === 'predict' || command === 'predictions') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Opening Alpha Engine...' },
        { type: 'output', content: '  ML-Powered Prediction System' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/alpha-engine');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // experience - scroll to experience section
    if (command === 'experience' || command === 'exp' || command === 'work') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to Experience section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#experience');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // about - scroll to about section
    if (command === 'about' || command === 'bio') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to About section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#about');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // skills - scroll to skills section
    if (command === 'skills' || command === 'skill') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to Skills section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#skills');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // projects - scroll to projects section
    if (command === 'projects' || command === 'project') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to Projects section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#projects');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // contact - scroll to contact section
    if (command === 'contact') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to Contact section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#contact');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // skills section (navigation version - different from skills command that shows skills list)
    if (command === 'goto' && args[0] === 'skills') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to Skills section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#skills');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // contact section (navigation)
    if (command === 'goto' && args[0] === 'contact') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Jumping to Contact section...' },
        { type: 'output', content: '' }
      ]);
      navigateAndClose('/', '#contact');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // resume - open resume link and close terminal
    if (command === 'resume' || command === 'cv') {
      setHistory(prev => [...prev, inputLine, 
        { type: 'success', content: '  Opening Resume in new tab...' },
        { type: 'output', content: '' }
      ]);
      // Open resume in new tab
      window.open(RESUME_URL, '_blank');
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      // Close terminal after opening resume
      setTimeout(() => setIsOpen(false), 300);
      return;
    }
    
    // ===== LANGUAGE COMMAND =====
    if (command === 'lang' || command === 'language') {
      // If no argument, show current language and available options
      if (args.length === 0) {
        const langList = LANGUAGES.map(l => `${l.flag} ${l.code} - ${l.name}`).join('\n  ');
        setHistory(prev => [...prev, inputLine,
          { type: 'output', content: '' },
          { type: 'success', content: `  Current language: ${currentLanguage.flag} ${currentLanguage.name}` },
          { type: 'output', content: '' },
          { type: 'output', content: '  Available languages:' },
          { type: 'output', content: `  ${langList}` },
          { type: 'output', content: '' },
          { type: 'system', content: '  Usage: lang <code|name>  (e.g., lang french, lang ja)' },
          { type: 'output', content: '' }
        ]);
        if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
        return;
      }
      
      // Try to find the language from the argument
      const langArg = args[0].toLowerCase();
      const langMatch = LANGUAGE_SHORTCUTS[langArg];
      
      if (langMatch) {
        const targetLang = LANGUAGES.find(l => l.code === langMatch.code);
        if (targetLang) {
          setLanguage(langMatch.code);
          setHistory(prev => [...prev, inputLine,
            { type: 'output', content: '' },
            { type: 'success', content: `  ✓ Language changed to ${targetLang.flag} ${targetLang.name}` },
            { type: 'output', content: '' },
            { type: 'system', content: '  Page content will be translated...' },
            { type: 'output', content: '' }
          ]);
          if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
          return;
        }
      }
      
      // Language not found
      setHistory(prev => [...prev, inputLine,
        { type: 'output', content: '' },
        { type: 'error', content: `  Unknown language: "${args[0]}"` },
        { type: 'output', content: '' },
        { type: 'output', content: '  Try: en, zh, ja, ko, ar, hi, de, fr, es, pt, ru, id, ms, th, vi' },
        { type: 'output', content: '  Or: english, chinese, japanese, korean, arabic, hindi, german, french, spanish, etc.' },
        { type: 'output', content: '' }
      ]);
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // goto command - navigate to specific section
    if (command === 'goto' || command === 'go' || command === 'cd') {
      const section = args[0];
      if (!section) {
        setHistory(prev => [...prev, inputLine, 
          { type: 'error', content: '  Usage: goto <section>' },
          { type: 'output', content: '  Available: experience, skills, projects, contact, sandbox, alpha' },
          { type: 'output', content: '' }
        ]);
        if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
        return;
      }
      
      // Check if it's a known section
      if (NAVIGATION_SECTIONS[section as keyof typeof NAVIGATION_SECTIONS]) {
        const hash = NAVIGATION_SECTIONS[section as keyof typeof NAVIGATION_SECTIONS];
        setHistory(prev => [...prev, inputLine, 
          { type: 'success', content: `  Navigating to ${section}...` },
          { type: 'output', content: '' }
        ]);
        navigateAndClose('/', hash);
        if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
        return;
      }
      
      // Special case for sandbox
      if (section === 'sandbox' || section === 'quant' || section === 'lab') {
        setHistory(prev => [...prev, inputLine, 
          { type: 'success', content: '  Opening Quant Sandbox...' },
          { type: 'output', content: '' }
        ]);
        navigateAndClose('/lab');
        if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
        return;
      }
      
      // Special case for alpha engine
      if (section === 'alpha' || section === 'engine' || section === 'ml' || section === 'predict') {
        setHistory(prev => [...prev, inputLine, 
          { type: 'success', content: '  Opening Alpha Engine...' },
          { type: 'output', content: '' }
        ]);
        navigateAndClose('/alpha-engine');
        if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
        return;
      }
      
      setHistory(prev => [...prev, inputLine, 
        { type: 'error', content: `  Unknown section: ${section}` },
        { type: 'output', content: '  Try: experience, skills, projects, contact, sandbox, alpha' },
        { type: 'output', content: '' }
      ]);
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // history command - show command history
    if (command === 'history') {
      const histLines = commandHistory.slice(-15).map((cmd, i) => ({
        type: 'output' as const,
        content: `  ${i + 1}. ${cmd}`
      }));
      setHistory(prev => [...prev, inputLine, 
        { type: 'output', content: '' },
        { type: 'success', content: '  Command History (last 15):' },
        { type: 'output', content: '' },
        ...histLines,
        { type: 'output', content: '' }
      ]);
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // ===== END NAVIGATION COMMANDS =====
    
    // Check for hidden Easter egg commands
    if (HIDDEN_COMMANDS[trimmedInput]) {
      setHistory(prev => [...prev, inputLine, ...HIDDEN_COMMANDS[trimmedInput]()]);
      if (trimmedInput) setCommandHistory(prev => [...prev, trimmedInput]);
      return;
    }
    
    // Check for regular commands
    if (COMMANDS[command]) {
      setHistory(prev => [...prev, inputLine, ...COMMANDS[command](args)]);
    } else if (trimmedInput === '') {
      setHistory(prev => [...prev, inputLine]);
    } else {
      setHistory(prev => [
        ...prev, 
        inputLine,
        { type: 'error', content: `  Command not found: ${command}` },
        { type: 'output', content: '  Type "help" for available commands.' },
        { type: 'output', content: '' }
      ]);
    }
    
    // Add to command history
    if (trimmedInput) {
      setCommandHistory(prev => [...prev, trimmedInput]);
    }
  }, []);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(currentInput);
    setCurrentInput('');
    setHistoryIndex(-1);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Arrow up - previous command
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    }
    
    // Arrow down - next command
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentInput('');
      }
    }
    
    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      if (autocompleteSuggestions.length > 0) {
        // If we have suggestions, cycle through them or select current
        setCurrentInput(autocompleteSuggestions[selectedSuggestionIndex]);
        setAutocompleteSuggestions([]);
        setSelectedSuggestionIndex(0);
      } else {
        // Generate suggestions
        const matches = ALL_COMMANDS.filter(cmd => 
          cmd.startsWith(currentInput.toLowerCase()) && cmd !== currentInput.toLowerCase()
        );
        if (matches.length === 1) {
          setCurrentInput(matches[0]);
        } else if (matches.length > 1) {
          setAutocompleteSuggestions(matches);
          setSelectedSuggestionIndex(0);
        }
      }
    }
    
    // Arrow keys for autocomplete navigation
    if (autocompleteSuggestions.length > 0) {
      if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < autocompleteSuggestions.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : autocompleteSuggestions.length - 1
        );
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        setCurrentInput(autocompleteSuggestions[selectedSuggestionIndex]);
        setAutocompleteSuggestions([]);
        setSelectedSuggestionIndex(0);
        return;
      }
      if (e.key === 'Escape') {
        setAutocompleteSuggestions([]);
        setSelectedSuggestionIndex(0);
        return;
      }
    }
  };
  
  // Update suggestions when input changes
  useEffect(() => {
    if (currentInput.length > 0) {
      const inputLower = currentInput.toLowerCase();
      const parts = inputLower.split(' ');
      
      // Check if this is a "lang" command with argument
      if (parts[0] === 'lang' && parts.length >= 1) {
        if (parts.length === 1 && !inputLower.endsWith(' ')) {
          // Just "lang" typed, no space yet - show lang as suggestion
          const matches = ALL_COMMANDS.filter(cmd => 
            cmd.startsWith(inputLower) && cmd !== inputLower
          );
          if (matches.length > 0 && matches.length <= 8) {
            setAutocompleteSuggestions(matches);
            setSelectedSuggestionIndex(0);
          } else {
            setAutocompleteSuggestions([]);
          }
        } else {
          // "lang " or "lang x" - show language suggestions
          const langArg = parts[1] || '';
          const langMatches = LANGUAGE_NAMES.filter(name => 
            name.startsWith(langArg) && name !== langArg
          );
          // Also check short codes
          const codeMatches = Object.keys(LANGUAGE_SHORTCUTS).filter(key => 
            key.startsWith(langArg) && key !== langArg && key.length <= 3
          );
          const allMatches = [...new Set([...langMatches, ...codeMatches])].slice(0, 8);
          
          if (allMatches.length > 0) {
            // Show full command with language name
            setAutocompleteSuggestions(allMatches.map(m => `lang ${m}`));
            setSelectedSuggestionIndex(0);
          } else {
            setAutocompleteSuggestions([]);
          }
        }
      } else {
        // Regular command autocomplete
        const matches = ALL_COMMANDS.filter(cmd => 
          cmd.startsWith(inputLower) && cmd !== inputLower
        );
        if (matches.length > 0 && matches.length <= 8) {
          setAutocompleteSuggestions(matches);
          setSelectedSuggestionIndex(0);
        } else {
          setAutocompleteSuggestions([]);
        }
      }
    } else {
      setAutocompleteSuggestions([]);
    }
  }, [currentInput]);
  
  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-cyan-400';
      case 'output': return 'text-foreground/80';
      case 'error': return 'text-red-400';
      case 'success': return 'text-green-400';
      case 'ascii': return 'text-purple-400';
      case 'system': return 'text-yellow-400/80';
      default: return 'text-foreground';
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl bg-black/95 border border-cyan-500/40 rounded-lg shadow-2xl shadow-cyan-500/20 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border-b border-cyan-500/30">
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-cyan-400" weight="duotone" />
                <span className="text-cyan-400 font-mono text-sm font-bold">terminal</span>
                <span className="text-foreground/40 font-mono text-xs">~ shadaab@portfolio</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer" onClick={() => setIsOpen(false)} />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-foreground/50 hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            {/* Terminal Body */}
            <div
              ref={terminalRef}
              className="h-[500px] overflow-y-auto p-4 font-mono text-sm custom-scrollbar"
            >
              {history.map((line, i) => (
                <div 
                  key={i} 
                  className={`${getLineColor(line.type)} whitespace-pre-wrap leading-relaxed`}
                >
                  {line.content}
                </div>
              ))}
              
              {/* Input Line */}
              <div className="relative">
                {/* Autocomplete Dropdown - positioned ABOVE input for visibility */}
                {autocompleteSuggestions.length > 0 && (
                  <div className="absolute left-4 bottom-full mb-1 bg-black/95 border border-cyan-500/40 rounded overflow-hidden z-10 shadow-lg shadow-cyan-500/10">
                    <div className="px-2 py-1 border-b border-cyan-500/20 text-[9px] text-foreground/40 font-mono">
                      ←→ navigate • Enter select • Esc close
                    </div>
                    <div className="flex flex-wrap gap-1 p-2 max-w-md">
                      {autocompleteSuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setCurrentInput(suggestion);
                            setAutocompleteSuggestions([]);
                            inputRef.current?.focus();
                          }}
                          className={`px-2 py-0.5 text-xs font-mono rounded transition-all ${
                            index === selectedSuggestionIndex
                              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400/50'
                              : 'bg-cyan-500/10 text-cyan-400/70 hover:bg-cyan-500/20 border border-transparent'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-1">
                  <span className="text-cyan-400">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={e => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent text-foreground outline-none font-mono caret-cyan-400 cursor-text selection:bg-cyan-500/30"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    style={{ caretColor: '#22d3ee' }}
                  />
                </form>
              </div>
            </div>
            
            {/* Terminal Footer */}
            <div className="px-4 py-1.5 border-t border-cyan-500/20 bg-cyan-500/5">
              <div className="flex justify-between items-center text-[10px] font-mono text-foreground/40">
                <span>Press ` or ESC to close • Type "help" for commands</span>
                <span>↑↓ history • Tab autocomplete • ←→ suggestions</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default TerminalEasterEgg;
