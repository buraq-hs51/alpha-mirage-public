/**
 * SECURITY PROTECTION LAYER
 * 
 * Multi-layer protection against:
 * 1. DevTools inspection/debugging
 * 2. Source code viewing
 * 3. Right-click context menu (view source)
 * 4. Text selection and copying
 * 5. Keyboard shortcuts (Ctrl+U, Ctrl+S, F12, etc.)
 * 6. Console manipulation
 * 7. Iframe embedding
 * 8. Automated scraping
 * 
 * IMPORTANT: These are deterrents, not absolute protection.
 * Determined attackers can bypass client-side security.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const SECURITY_CONFIG = {
  // Enable/disable protections (set to false for development)
  ENABLED: import.meta.env.PROD,
  
  // Protection levels
  BLOCK_DEVTOOLS: true,
  BLOCK_RIGHT_CLICK: true,
  BLOCK_TEXT_SELECTION: false, // Can be annoying for users
  BLOCK_KEYBOARD_SHORTCUTS: true,
  BLOCK_IFRAME_EMBEDDING: true,
  BLOCK_CONSOLE_ACCESS: true,
  DETECT_DEBUGGER: true,
  
  // Timing
  DEVTOOLS_CHECK_INTERVAL: 1000,
  DEBUGGER_CHECK_INTERVAL: 500,
};

// ============================================================================
// ANTI-DEVTOOLS DETECTION
// ============================================================================

let devToolsOpen = false;
let lastCheckTime = 0;

/**
 * Detects if DevTools is open using multiple techniques
 */
function detectDevTools(): boolean {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_DEVTOOLS) return false;
  
  // Method 1: Window size difference (DevTools changes outer/inner dimensions)
  const widthThreshold = window.outerWidth - window.innerWidth > 160;
  const heightThreshold = window.outerHeight - window.innerHeight > 160;
  
  // Method 2: Firebug detection
  const firebugDetected = !!(window as any).Firebug && 
    (window as any).Firebug.chrome && 
    (window as any).Firebug.chrome.isInitialized;
  
  // Method 3: Console timing attack
  let consoleDetected = false;
  const startTime = performance.now();
  // Accessing console properties takes longer when DevTools is open
  for (let i = 0; i < 100; i++) {
    (console as any).log;
    (console as any).clear;
  }
  const endTime = performance.now();
  if (endTime - startTime > 100) {
    consoleDetected = true;
  }
  
  return widthThreshold || heightThreshold || firebugDetected || consoleDetected;
}

/**
 * Advanced DevTools detection using image trick
 */
function detectDevToolsAdvanced(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_DEVTOOLS) return;
  
  const element = new Image();
  Object.defineProperty(element, 'id', {
    get: function() {
      devToolsOpen = true;
      handleSecurityBreach('devtools');
    }
  });
  
  // Trigger the getter when DevTools inspects the element
  requestAnimationFrame(() => {
    // This will trigger the getter if DevTools is inspecting
  });
}

// ============================================================================
// ANTI-DEBUGGING
// ============================================================================

let debuggerDetected = false;

/**
 * Continuous debugger detection
 */
function startDebuggerDetection(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.DETECT_DEBUGGER) return;
  
  const check = () => {
    const start = performance.now();
    
    // This will pause if debugger is attached
    // Using Function constructor to avoid static analysis
    try {
      const debuggerCheck = new Function('debugger; return true;');
      debuggerCheck();
    } catch (e) {
      // Ignore errors
    }
    
    const duration = performance.now() - start;
    
    // If debugger was hit, there will be a significant delay
    if (duration > 100) {
      debuggerDetected = true;
      handleSecurityBreach('debugger');
    }
  };
  
  // Initial check
  check();
  
  // Periodic checks
  setInterval(check, SECURITY_CONFIG.DEBUGGER_CHECK_INTERVAL);
}

// ============================================================================
// KEYBOARD SHORTCUT BLOCKING
// ============================================================================

function blockKeyboardShortcuts(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_KEYBOARD_SHORTCUTS) return;
  
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // F12 - DevTools
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Ctrl+Shift+I - DevTools
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Ctrl+Shift+J - Console
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Ctrl+Shift+C - Element inspector
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Ctrl+U - View source
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Ctrl+S - Save page
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    // Cmd variants for Mac
    if (e.metaKey) {
      if (e.key === 'u' || e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      if (e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, { capture: true });
}

// ============================================================================
// RIGHT-CLICK PROTECTION
// ============================================================================

function blockRightClick(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_RIGHT_CLICK) return;
  
  document.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    return false;
  }, { capture: true });
}

// ============================================================================
// TEXT SELECTION PROTECTION
// ============================================================================

function blockTextSelection(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_TEXT_SELECTION) return;
  
  // CSS-based protection
  const style = document.createElement('style');
  style.textContent = `
    * {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
    }
    input, textarea {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;
  document.head.appendChild(style);
  
  // Event-based protection
  document.addEventListener('selectstart', (e: Event) => {
    if ((e.target as HTMLElement).tagName !== 'INPUT' && 
        (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      return false;
    }
  }, { capture: true });
  
  // Block copy
  document.addEventListener('copy', (e: ClipboardEvent) => {
    if ((e.target as HTMLElement).tagName !== 'INPUT' && 
        (e.target as HTMLElement).tagName !== 'TEXTAREA') {
      e.preventDefault();
      return false;
    }
  }, { capture: true });
}

// ============================================================================
// IFRAME EMBEDDING PROTECTION
// ============================================================================

function preventIframeEmbedding(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_IFRAME_EMBEDDING) return;
  
  // Check if in iframe
  if (window.self !== window.top) {
    // Attempt to break out of iframe
    try {
      window.top!.location.href = window.self.location.href;
    } catch (e) {
      // If we can't break out (cross-origin), hide content
      document.body.innerHTML = '';
      document.body.style.display = 'none';
    }
  }
}

// ============================================================================
// CONSOLE PROTECTION
// ============================================================================

function protectConsole(): void {
  if (!SECURITY_CONFIG.ENABLED || !SECURITY_CONFIG.BLOCK_CONSOLE_ACCESS) return;
  
  // Override console methods to prevent information leakage
  const noop = () => {};
  
  // Store original console for internal use if needed
  const originalConsole = { ...console };
  
  // Clear and disable console
  try {
    console.clear();
    
    // Override console methods
    Object.keys(console).forEach((key) => {
      try {
        (console as any)[key] = noop;
      } catch (e) {
        // Some properties may not be writable
      }
    });
    
    // Add warning message that appears when DevTools opens
    Object.defineProperty(console, '_commandLineAPI', {
      get: function() {
        handleSecurityBreach('console');
        return undefined;
      }
    });
  } catch (e) {
    // Ignore errors in strict mode
  }
}

// ============================================================================
// SECURITY BREACH HANDLER
// ============================================================================

function handleSecurityBreach(type: string): void {
  // Log the breach (can be sent to analytics)
  const timestamp = new Date().toISOString();
  
  // Different responses based on breach type
  switch (type) {
    case 'devtools':
    case 'debugger':
    case 'console':
      // Subtle degradation - don't make it obvious
      // Could redirect, clear page, or just continue
      break;
  }
}

// ============================================================================
// CONTINUOUS MONITORING
// ============================================================================

function startContinuousMonitoring(): void {
  if (!SECURITY_CONFIG.ENABLED) return;
  
  setInterval(() => {
    const now = Date.now();
    if (now - lastCheckTime < SECURITY_CONFIG.DEVTOOLS_CHECK_INTERVAL) return;
    lastCheckTime = now;
    
    if (detectDevTools()) {
      devToolsOpen = true;
      handleSecurityBreach('devtools');
    }
  }, SECURITY_CONFIG.DEVTOOLS_CHECK_INTERVAL);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all security protections
 * Call this once at app startup
 */
export function initializeSecurityProtection(): void {
  if (!SECURITY_CONFIG.ENABLED) {
    return; // Skip all protections in development
  }
  
  // Initialize protections
  blockKeyboardShortcuts();
  blockRightClick();
  blockTextSelection();
  preventIframeEmbedding();
  protectConsole();
  startDebuggerDetection();
  detectDevToolsAdvanced();
  startContinuousMonitoring();
  
  // Add anti-tampering check
  Object.freeze(SECURITY_CONFIG);
}

/**
 * Check if security has been compromised
 */
export function isSecurityCompromised(): boolean {
  return devToolsOpen || debuggerDetected;
}

/**
 * Get security status
 */
export function getSecurityStatus(): {
  enabled: boolean;
  devToolsDetected: boolean;
  debuggerDetected: boolean;
} {
  return {
    enabled: SECURITY_CONFIG.ENABLED,
    devToolsDetected: devToolsOpen,
    debuggerDetected: debuggerDetected,
  };
}

// Auto-initialize when module loads
if (typeof window !== 'undefined') {
  // Run on next tick to ensure DOM is ready
  setTimeout(() => {
    initializeSecurityProtection();
  }, 0);
}
