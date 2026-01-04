/**
 * Location Verification System
 * 
 * This module provides robust VPN/location spoofing detection by comparing
 * multiple sources of location data:
 * 
 * 1. Browser Timezone (CANNOT be spoofed by VPN - requires OS-level change)
 * 2. IP-based Geolocation (CAN be spoofed by VPN)
 * 3. Browser Language/Locale hints
 * 
 * The timezone is considered the "source of truth" for real location.
 */

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface LocationInfo {
  country: string;
  countryCode: string;
  city: string;
  timezone?: string;
  ip?: string;
  source: 'timezone' | 'ip' | 'webrtc';
}

export interface VerificationResult {
  // Core status
  isLoading: boolean;
  error: string | null;
  
  // Location data
  realLocation: LocationInfo | null;      // From timezone (truth)
  apparentLocation: LocationInfo | null;  // From IP (might be VPN)
  
  // VPN Detection
  isVPNDetected: boolean;
  vpnConfidence: number;  // 0-100
  
  // Decision flags based on requirements
  realLocationIsIndia: boolean;
  apparentLocationIsIndia: boolean;
  shouldBlock: boolean;           // True if India user + VPN
  shouldShowPasscode: boolean;    // True if blocked and VPN detected
  canPassDirectly: boolean;       // True if non-India real location
  
  // Debug info
  detectionMethod: string;
  browserTimezone: string;
}

// ============================================================================
// TIMEZONE TO COUNTRY MAPPING
// ============================================================================

const TIMEZONE_TO_COUNTRY: Record<string, { code: string; name: string }> = {
  // India - All possible variations
  'Asia/Kolkata': { code: 'IN', name: 'India' },
  'Asia/Calcutta': { code: 'IN', name: 'India' },
  
  // United States
  'America/New_York': { code: 'US', name: 'United States' },
  'America/Chicago': { code: 'US', name: 'United States' },
  'America/Denver': { code: 'US', name: 'United States' },
  'America/Los_Angeles': { code: 'US', name: 'United States' },
  'America/Phoenix': { code: 'US', name: 'United States' },
  'America/Anchorage': { code: 'US', name: 'United States' },
  'Pacific/Honolulu': { code: 'US', name: 'United States' },
  
  // United Kingdom
  'Europe/London': { code: 'GB', name: 'United Kingdom' },
  
  // Canada
  'America/Toronto': { code: 'CA', name: 'Canada' },
  'America/Vancouver': { code: 'CA', name: 'Canada' },
  'America/Edmonton': { code: 'CA', name: 'Canada' },
  'America/Halifax': { code: 'CA', name: 'Canada' },
  
  // Australia
  'Australia/Sydney': { code: 'AU', name: 'Australia' },
  'Australia/Melbourne': { code: 'AU', name: 'Australia' },
  'Australia/Brisbane': { code: 'AU', name: 'Australia' },
  'Australia/Perth': { code: 'AU', name: 'Australia' },
  
  // Europe
  'Europe/Paris': { code: 'FR', name: 'France' },
  'Europe/Berlin': { code: 'DE', name: 'Germany' },
  'Europe/Amsterdam': { code: 'NL', name: 'Netherlands' },
  'Europe/Rome': { code: 'IT', name: 'Italy' },
  'Europe/Madrid': { code: 'ES', name: 'Spain' },
  'Europe/Zurich': { code: 'CH', name: 'Switzerland' },
  'Europe/Stockholm': { code: 'SE', name: 'Sweden' },
  'Europe/Oslo': { code: 'NO', name: 'Norway' },
  'Europe/Copenhagen': { code: 'DK', name: 'Denmark' },
  'Europe/Helsinki': { code: 'FI', name: 'Finland' },
  'Europe/Dublin': { code: 'IE', name: 'Ireland' },
  'Europe/Brussels': { code: 'BE', name: 'Belgium' },
  'Europe/Vienna': { code: 'AT', name: 'Austria' },
  'Europe/Warsaw': { code: 'PL', name: 'Poland' },
  'Europe/Prague': { code: 'CZ', name: 'Czech Republic' },
  'Europe/Moscow': { code: 'RU', name: 'Russia' },
  
  // Asia
  'Asia/Tokyo': { code: 'JP', name: 'Japan' },
  'Asia/Shanghai': { code: 'CN', name: 'China' },
  'Asia/Hong_Kong': { code: 'HK', name: 'Hong Kong' },
  'Asia/Singapore': { code: 'SG', name: 'Singapore' },
  'Asia/Seoul': { code: 'KR', name: 'South Korea' },
  'Asia/Bangkok': { code: 'TH', name: 'Thailand' },
  'Asia/Jakarta': { code: 'ID', name: 'Indonesia' },
  'Asia/Manila': { code: 'PH', name: 'Philippines' },
  'Asia/Kuala_Lumpur': { code: 'MY', name: 'Malaysia' },
  'Asia/Dubai': { code: 'AE', name: 'United Arab Emirates' },
  'Asia/Riyadh': { code: 'SA', name: 'Saudi Arabia' },
  'Asia/Tel_Aviv': { code: 'IL', name: 'Israel' },
  'Asia/Jerusalem': { code: 'IL', name: 'Israel' },
  
  // Other
  'Pacific/Auckland': { code: 'NZ', name: 'New Zealand' },
  'America/Sao_Paulo': { code: 'BR', name: 'Brazil' },
  'America/Mexico_City': { code: 'MX', name: 'Mexico' },
  'Africa/Johannesburg': { code: 'ZA', name: 'South Africa' },
  'Africa/Cairo': { code: 'EG', name: 'Egypt' },
  'Africa/Lagos': { code: 'NG', name: 'Nigeria' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the browser's timezone (this CANNOT be changed by VPN)
 * VPN only changes IP routing, not system timezone
 */
function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

/**
 * Get country from browser timezone
 */
function getCountryFromTimezone(timezone: string): { code: string; name: string } | null {
  return TIMEZONE_TO_COUNTRY[timezone] || null;
}

/**
 * Check if timezone indicates India
 */
function isIndianTimezone(timezone: string): boolean {
  return timezone === 'Asia/Kolkata' || timezone === 'Asia/Calcutta';
}

/**
 * Fetch IP-based location from multiple APIs for reliability
 */
async function getIPLocation(): Promise<{
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
  org: string;
} | null> {
  // Try ipapi.co first
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const data = await response.json();
      if (data.country_code) {
        return {
          ip: data.ip || '',
          country: data.country_name || '',
          countryCode: data.country_code || '',
          city: data.city || '',
          timezone: data.timezone || '',
          org: data.org || '',
        };
      }
    }
  } catch (e) {
  }
  
  // Fallback to ipwho.is (HTTPS) - ip-api.com is HTTP only which causes mixed content issues
  try {
    const response = await fetch('https://ipwho.is/', {
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success !== false) {
        return {
          ip: data.ip || '',
          country: data.country || '',
          countryCode: data.country_code || '',
          city: data.city || '',
          timezone: data.timezone?.id || '',
          org: data.connection?.org || data.connection?.isp || '',
        };
      }
    }
  } catch (e) {
  }
  
  return null;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useLocationVerification(): VerificationResult & { refetch: () => void } {
  const [result, setResult] = useState<VerificationResult>({
    isLoading: true,
    error: null,
    realLocation: null,
    apparentLocation: null,
    isVPNDetected: false,
    vpnConfidence: 0,
    realLocationIsIndia: false,
    apparentLocationIsIndia: false,
    shouldBlock: false,
    shouldShowPasscode: false,
    canPassDirectly: false,
    detectionMethod: '',
    browserTimezone: '',
  });
  
  const [trigger, setTrigger] = useState(0);
  
  const refetch = useCallback(() => {
    setResult(prev => ({ ...prev, isLoading: true, error: null }));
    setTrigger(t => t + 1);
  }, []);
  
  useEffect(() => {
    let cancelled = false;
    
    async function verify() {
      
      try {
        // ─────────────────────────────────────────────────────────
        // STEP 1: Get Browser Timezone (REAL location - cannot be VPN spoofed)
        // ─────────────────────────────────────────────────────────
        const browserTimezone = getBrowserTimezone();
        const timezoneCountry = getCountryFromTimezone(browserTimezone);
        const realIsIndia = isIndianTimezone(browserTimezone);
        
        
        const realLocation: LocationInfo | null = timezoneCountry ? {
          country: timezoneCountry.name,
          countryCode: timezoneCountry.code,
          city: 'N/A (timezone-based)',
          timezone: browserTimezone,
          source: 'timezone',
        } : null;
        
        // ─────────────────────────────────────────────────────────
        // STEP 2: Get IP-based Location (APPARENT location - can be VPN)
        // ─────────────────────────────────────────────────────────
        const ipLocation = await getIPLocation();
        
        
        const apparentLocation: LocationInfo | null = ipLocation ? {
          country: ipLocation.country,
          countryCode: ipLocation.countryCode,
          city: ipLocation.city,
          timezone: ipLocation.timezone,
          ip: ipLocation.ip,
          source: 'ip',
        } : null;
        
        const apparentIsIndia = ipLocation?.countryCode === 'IN';
        
        // ─────────────────────────────────────────────────────────
        // STEP 3: VPN Detection Logic
        // ─────────────────────────────────────────────────────────
        let isVPNDetected = false;
        let vpnConfidence = 0;
        let detectionMethod = 'No VPN detected';
        
        if (timezoneCountry && ipLocation) {
          // Compare timezone country with IP country
          if (timezoneCountry.code !== ipLocation.countryCode) {
            isVPNDetected = true;
            vpnConfidence = 95;
            detectionMethod = `Timezone (${timezoneCountry.code}) ≠ IP (${ipLocation.countryCode})`;
            
          }
        }
        
        // Additional check: If IP timezone doesn't match browser timezone
        if (!isVPNDetected && ipLocation?.timezone && browserTimezone) {
          if (ipLocation.timezone !== browserTimezone) {
            // Check if they're in different regions
            const ipRegion = ipLocation.timezone.split('/')[0];
            const browserRegion = browserTimezone.split('/')[0];
            
            if (ipRegion !== browserRegion) {
              isVPNDetected = true;
              vpnConfidence = 85;
              detectionMethod = `Timezone region mismatch: Browser(${browserRegion}) ≠ IP(${ipRegion})`;
              
            }
          }
        }
        
        // ─────────────────────────────────────────────────────────
        // STEP 4: Decision Logic Based on Requirements
        // ─────────────────────────────────────────────────────────
        /**
         * Decision Matrix:
         * 
         * | Real (TZ) | Apparent (IP) | VPN? | Action |
         * |-----------|---------------|------|--------|
         * | India     | India         | No   | Normal India flow |
         * | India     | Foreign       | Yes  | BLOCK + Passcode |
         * | Foreign   | India         | Yes  | Pass directly (real is foreign) |
         * | Foreign   | Foreign       | No   | Normal international flow |
         * | Foreign   | Different     | Yes  | Pass directly (real is foreign) |
         */
        
        let shouldBlock = false;
        let shouldShowPasscode = false;
        let canPassDirectly = false;
        
        if (realIsIndia) {
          // Real location is India
          if (isVPNDetected) {
            // India user trying to use VPN to appear from elsewhere
            shouldBlock = true;
            shouldShowPasscode = true;
          } else {
            // Normal India user, no VPN
            shouldBlock = false;
            shouldShowPasscode = false;
          }
        } else {
          // Real location is NOT India
          canPassDirectly = true;
          shouldBlock = false;
          shouldShowPasscode = false;
          
          if (isVPNDetected) {
          } else {
          }
        }
        
        
        if (!cancelled) {
          setResult({
            isLoading: false,
            error: null,
            realLocation,
            apparentLocation,
            isVPNDetected,
            vpnConfidence,
            realLocationIsIndia: realIsIndia,
            apparentLocationIsIndia: apparentIsIndia,
            shouldBlock,
            shouldShowPasscode,
            canPassDirectly,
            detectionMethod,
            browserTimezone,
          });
        }
        
      } catch (err) {
        console.error('❌ Location verification error:', err);
        if (!cancelled) {
          setResult(prev => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Verification failed',
          }));
        }
      }
    }
    
    verify();
    
    return () => { cancelled = true; };
  }, [trigger]);
  
  return { ...result, refetch };
}

// ============================================================================
// PASSCODE - Visionary and compelling
// ============================================================================

// Creates intrigue - makes recruiters curious about what they're about to discover
export const VPN_BYPASS_PASSCODE = 'archItect1ngAlph5a';
