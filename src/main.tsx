import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { StrictMode } from 'react'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { clearSecureStorage } from './lib/secureStorage.ts'
import { initializeSecurityProtection } from './lib/securityProtection.ts'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

// ============================================
// Security Protection Initialization
// ============================================
// Initialize security protections FIRST before any other code runs
initializeSecurityProtection();

// ============================================
// Session & Cache Management
// ============================================
// 
// BEHAVIOR:
// 1. NEW TAB/WINDOW (close browser, open new tab): Clear ALL → Fresh start
// 2. HARD REFRESH (Cmd+Shift+R): Clear ALL → Fresh start  
// 3. NORMAL REFRESH (Cmd+R): Keep caches → Fast experience
//
// CACHES MANAGED:
// - VPN bypass (secureStorage: sec_vpnBypass - tamper-protected)
// - Geolocation bypass (secureStorage: sec_gatewayBypass - tamper-protected)
// - Geolocation data (localStorage: geoLocationCache, secureStorage: sec_geoSession)
// - Language selection (localStorage: portfolioLanguage, portfolioLanguageUserSelected, portfolioLastCountry)
// ============================================

const HARD_REFRESH_FLAG = '_hardRefreshPending';
const SESSION_ID_KEY = '_sessionId';

// Generate a unique session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check if this is a new browser session (new tab after closing browser)
function isNewBrowserSession(): boolean {
  const storedSessionId = sessionStorage.getItem(SESSION_ID_KEY);
  
  if (!storedSessionId) {
    // No session ID = new browser session (after closing browser or new tab)
    const newSessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, newSessionId);
    return true;
  }
  
  return false;
}

// Clear ALL caches for fresh start
function clearAllCaches() {
  
  // Clear secure storage (VPN bypass, gateway bypass, geo session)
  clearSecureStorage();
  
  // Clear legacy insecure keys (migration cleanup)
  sessionStorage.removeItem('vpnBypassGranted');
  sessionStorage.removeItem('globalGatewayBypassed');
  sessionStorage.removeItem('geoLocationSession');
  
  // Clear geolocation data from localStorage
  localStorage.removeItem('geoLocationCache');
  
  // Clear language caches to force re-detection
  localStorage.removeItem('portfolioLanguage');
  localStorage.removeItem('portfolioLanguageUserSelected');
  localStorage.removeItem('portfolioLastCountry');
  
  // Clear old language keys (legacy)
  localStorage.removeItem('userPreferredLanguage');
  sessionStorage.removeItem('languageNotificationShown');
  
}

// Handle cache clearing on page load
function handleCacheOnLoad() {
  // Check for hard refresh flag first
  const isHardRefresh = localStorage.getItem(HARD_REFRESH_FLAG) === 'true';
  
  if (isHardRefresh) {
    localStorage.removeItem(HARD_REFRESH_FLAG);
    clearAllCaches();
    return;
  }
  
  // Check if this is a new browser session
  if (isNewBrowserSession()) {
    clearAllCaches();
    return;
  }
  
  // Normal refresh - keep caches
}

// Listen for hard refresh keyboard shortcuts
let shiftKeyHeld = false;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') {
    shiftKeyHeld = true;
  }
  
  // Detect Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
    localStorage.setItem(HARD_REFRESH_FLAG, 'true');
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') {
    shiftKeyHeld = false;
  }
});

// Handle beforeunload with Shift detection
window.addEventListener('beforeunload', () => {
  if (shiftKeyHeld) {
    localStorage.setItem(HARD_REFRESH_FLAG, 'true');
  }
});

// Run cache management immediately
handleCacheOnLoad();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
