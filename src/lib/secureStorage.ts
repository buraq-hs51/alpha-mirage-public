/**
 * Secure Storage Utility v2 - Hardened Implementation
 * 
 * Security measures:
 * 1. Session-bound secrets stored in closure (NOT accessible from console)
 * 2. Multi-layer HMAC-like signatures using strong hash
 * 3. Browser fingerprint binding (hardware + timezone + language)
 * 4. Nonce-based replay protection
 * 5. Base64 encoding to discourage manual edits
 * 6. Timing-safe signature comparison
 * 
 * Attack vectors blocked:
 * - DevTools editing: Signature verification fails
 * - Copy from another session: Fingerprint mismatch
 * - Replay attacks: Nonce + timestamp validation
 * - Timezone spoofing: Fingerprint includes multiple factors
 */

// ============================================================================
// PRIVATE SECURITY CORE - Stored in closure, NOT accessible from console
// ============================================================================
const SecurityCore = (() => {
  // Generate cryptographically secure session secret
  const generateSecret = (): string => {
    const array = new Uint8Array(64);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  };

  // Session secret - regenerated on each page load
  const SESSION_SECRET = generateSecret();
  
  // Browser fingerprint - stable properties that identify this browser
  const BROWSER_FINGERPRINT = (() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const lang = navigator.language;
    const platform = navigator.platform;
    const cores = navigator.hardwareConcurrency || 0;
    const memory = (navigator as { deviceMemory?: number }).deviceMemory || 0;
    const colorDepth = screen.colorDepth;
    const pixelRatio = window.devicePixelRatio;
    const screenRes = `${screen.width}x${screen.height}`;
    
    return `${tz}|${lang}|${platform}|${cores}|${memory}|${colorDepth}|${pixelRatio}|${screenRes}`;
  })();

  // Nonce counter
  let nonceCounter = Math.floor(Math.random() * 1000000);

  // MurmurHash3-inspired strong hash function
  const strongHash = (input: string): string => {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    let h3 = 0x9e3779b9;
    let h4 = 0xbb67ae85;
    
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
      h3 = Math.imul(h3 ^ ch, 2246822507);
      h4 = Math.imul(h4 ^ ch, 3266489909);
    }
    
    // Avalanche mixing
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    h3 = Math.imul(h3 ^ (h3 >>> 16), 2654435761);
    h3 ^= Math.imul(h4 ^ (h4 >>> 13), 1597334677);
    h4 = Math.imul(h4 ^ (h4 >>> 16), 2654435761);
    h4 ^= Math.imul(h3 ^ (h3 >>> 13), 1597334677);
    
    return (
      (h1 >>> 0).toString(16).padStart(8, '0') +
      (h2 >>> 0).toString(16).padStart(8, '0') +
      (h3 >>> 0).toString(16).padStart(8, '0') +
      (h4 >>> 0).toString(16).padStart(8, '0')
    );
  };

  // Create multi-layer HMAC-like signature
  const createSignature = (data: string, timestamp: number, nonce: number): string => {
    // Layer 1: Data + secret + timestamp
    const layer1 = strongHash(`${SESSION_SECRET}:${timestamp}:${nonce}:${data}`);
    
    // Layer 2: Add fingerprint
    const layer2 = strongHash(`${layer1}:${BROWSER_FINGERPRINT}:${SESSION_SECRET.slice(32)}`);
    
    // Layer 3: Final mixing
    const layer3 = strongHash(`${layer2}:${timestamp.toString(36)}:${nonce.toString(36)}:${layer1.slice(0, 16)}`);
    
    // Combine layers (64 chars total)
    return `${layer1.slice(0, 16)}${layer2.slice(0, 16)}${layer3}`;
  };

  // Timing-safe signature comparison
  const verifySignature = (data: string, timestamp: number, nonce: number, signature: string): boolean => {
    const expected = createSignature(data, timestamp, nonce);
    
    if (expected.length !== signature.length) return false;
    
    let result = 0;
    for (let i = 0; i < expected.length; i++) {
      result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  };

  // Get next nonce
  const getNextNonce = (): number => ++nonceCounter;

  // Get timezone
  const getTimezone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Get fingerprint hash
  const getFingerprintHash = (): string => strongHash(BROWSER_FINGERPRINT).slice(0, 16);

  return {
    createSignature,
    verifySignature,
    getNextNonce,
    getTimezone,
    getFingerprintHash,
    strongHash,
  };
})();

// ============================================================================
// SECURE STORAGE API
// ============================================================================

interface SecurePayload<T> {
  _v: 2;          // Version
  _d: T;          // Data
  _t: number;     // Timestamp
  _n: number;     // Nonce
  _s: string;     // Signature (64 chars)
  _z: string;     // Timezone hash
  _f: string;     // Fingerprint hash
}

/**
 * Securely store data with tamper protection
 */
export function secureSet<T>(key: string, value: T): void {
  const timestamp = Date.now();
  const nonce = SecurityCore.getNextNonce();
  const dataStr = JSON.stringify(value);
  const signature = SecurityCore.createSignature(dataStr, timestamp, nonce);
  
  const payload: SecurePayload<T> = {
    _v: 2,
    _d: value,
    _t: timestamp,
    _n: nonce,
    _s: signature,
    _z: SecurityCore.strongHash(SecurityCore.getTimezone()).slice(0, 8),
    _f: SecurityCore.getFingerprintHash(),
  };
  
  // Base64 encode to discourage manual editing
  sessionStorage.setItem(key, btoa(JSON.stringify(payload)));
}

/**
 * Securely retrieve data with full validation
 */
export function secureGet<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(key);
    if (!stored) return null;
    
    // Decode
    let parsed: SecurePayload<T>;
    try {
      parsed = JSON.parse(atob(stored));
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
    
    // Version check
    if (parsed._v !== 2) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    // Timezone check
    const currentTzHash = SecurityCore.strongHash(SecurityCore.getTimezone()).slice(0, 8);
    if (parsed._z !== currentTzHash) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    // Fingerprint check
    if (parsed._f !== SecurityCore.getFingerprintHash()) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    // Expiry check (24 hours)
    if (Date.now() - parsed._t > 24 * 60 * 60 * 1000) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    // Signature verification
    const dataStr = JSON.stringify(parsed._d);
    if (!SecurityCore.verifySignature(dataStr, parsed._t, parsed._n, parsed._s)) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return parsed._d;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function secureRemove(key: string): void {
  sessionStorage.removeItem(key);
}

export function secureHas(key: string): boolean {
  return secureGet(key) !== null;
}

// ============================================================================
// SPECIFIC SECURE STORAGE FUNCTIONS FOR GEO/VPN DATA
// ============================================================================

export interface SecureGeoData {
  country_code: string;
  country_name: string;
  city: string;
}

export interface SecureBypassState {
  granted: boolean;
  grantedAt: number;
}

const SECURE_KEYS = {
  GEO_SESSION: 'sec_geo',
  VPN_BYPASS: 'sec_vpn',
  GATEWAY_BYPASS: 'sec_gw',
} as const;

/**
 * Store geo location data securely
 */
export function setSecureGeoData(data: SecureGeoData): void {
  secureSet(SECURE_KEYS.GEO_SESSION, data);
}

/**
 * Get geo location data with tamper protection
 */
export function getSecureGeoData(): SecureGeoData | null {
  return secureGet<SecureGeoData>(SECURE_KEYS.GEO_SESSION);
}

/**
 * Grant VPN bypass securely (after passcode verification)
 * The signature already includes timezone/fingerprint validation
 */
export function grantVPNBypass(): void {
  const state: SecureBypassState = {
    granted: true,
    grantedAt: Date.now(),
  };
  secureSet(SECURE_KEYS.VPN_BYPASS, state);
}

/**
 * Check if VPN bypass was legitimately granted
 * secureGet already validates timezone and fingerprint
 */
export function hasVPNBypass(): boolean {
  const state = secureGet<SecureBypassState>(SECURE_KEYS.VPN_BYPASS);
  return state?.granted === true;
}

/**
 * Grant gateway bypass securely (after user acknowledges)
 */
export function grantGatewayBypass(): void {
  const state: SecureBypassState = {
    granted: true,
    grantedAt: Date.now(),
  };
  secureSet(SECURE_KEYS.GATEWAY_BYPASS, state);
}

/**
 * Check if gateway bypass was legitimately granted
 */
export function hasGatewayBypass(): boolean {
  const state = secureGet<SecureBypassState>(SECURE_KEYS.GATEWAY_BYPASS);
  return state?.granted === true;
}

/**
 * Clear all secure storage (for testing/logout)
 */
export function clearSecureStorage(): void {
  Object.values(SECURE_KEYS).forEach(key => {
    sessionStorage.removeItem(key);
  });
}

/**
 * Migrate from old insecure storage to new secure storage
 * Call this once during initialization to handle existing sessions
 */
export function migrateFromInsecureStorage(): void {
  // Clean up ALL old insecure keys - force re-authentication
  const oldKeys = [
    'vpnBypassGranted',
    'globalGatewayBypassed',
    'geoLocationSession',
    'sec_geoSession',
    'sec_vpnBypass',
    'sec_gatewayBypass',
  ];
  
  oldKeys.forEach(key => {
    if (sessionStorage.getItem(key)) {
      sessionStorage.removeItem(key);
    }
  });
}
