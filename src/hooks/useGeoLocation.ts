import { useState, useEffect, useCallback } from 'react';
import { getSecureGeoData, setSecureGeoData, secureRemove, type SecureGeoData } from '@/lib/secureStorage';

interface GeoLocationState {
  country: string;
  countryCode: string;
  city: string;
  isIndia: boolean;
  isLoading: boolean;
  error: string | null;
  isCached: boolean; // NEW: Track if data came from cache
}

interface GeoLocation extends GeoLocationState {
  refetch: () => void;
}

interface GeoData {
  country_code: string;
  country_name: string;
  city: string;
}

// Cache keys - using localStorage for persistence across sessions
const GEO_CACHE_KEY = 'geoLocationCache';
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days (persistent)

// For testing: set to 'IN' to simulate India, 'US' for international, or null for real detection
const FORCE_COUNTRY_CODE: string | null = null;

// Helper to get cached geo data (checks secure storage and localStorage)
function getCachedGeo(): GeoData | null {
  try {
    // First check secure session storage (tamper-protected)
    const secureData = getSecureGeoData();
    if (secureData) {
      return secureData;
    }

    // Then check localStorage (persistent across sessions, but verify with API on use)
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > GEO_CACHE_TTL) {
      localStorage.removeItem(GEO_CACHE_KEY);
      return null;
    }
    // Store securely in session for subsequent access
    setSecureGeoData(data);
    return data;
  } catch {
    return null;
  }
}

// Helper to cache geo data (to localStorage and secure session storage)
function setCachedGeo(data: GeoData): void {
  try {
    // Save to localStorage (persistent)
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    // Also save to secure session storage (tamper-protected)
    setSecureGeoData(data);
  } catch {
    // Ignore storage errors
  }
}

// Check if we have valid cached data (for instant initialization)
function getInitialState(): GeoLocationState {
  // Force mode for testing
  if (FORCE_COUNTRY_CODE) {
    return {
      country: FORCE_COUNTRY_CODE === 'IN' ? 'India' : 'United States',
      countryCode: FORCE_COUNTRY_CODE,
      city: FORCE_COUNTRY_CODE === 'IN' ? 'Mumbai' : 'New York',
      isIndia: FORCE_COUNTRY_CODE === 'IN',
      isLoading: false,
      error: null,
      isCached: true,
    };
  }

  // Check for cached data - if found, initialize with it immediately (NO loading state!)
  const cached = getCachedGeo();
  if (cached && cached.country_code) {
    return {
      country: cached.country_name || '',
      countryCode: cached.country_code || '',
      city: cached.city || '',
      isIndia: cached.country_code === 'IN',
      isLoading: false, // Not loading - we have cached data!
      error: null,
      isCached: true,
    };
  }

  // No cache - need to fetch
  return {
    country: '',
    countryCode: '',
    city: '',
    isIndia: false,
    isLoading: true,
    error: null,
    isCached: false,
  };
}

export function useGeoLocation(): GeoLocation {
  // Initialize with cached data if available (skips loading state!)
  const [location, setLocation] = useState<GeoLocationState>(getInitialState);
  
  const [fetchTrigger, setFetchTrigger] = useState(0);
  
  const refetch = useCallback(() => {
    // Clear all caches
    localStorage.removeItem(GEO_CACHE_KEY);
    secureRemove('sec_geoSession'); // Clear secure session storage
    // Trigger re-fetch by updating trigger
    setLocation(prev => ({ ...prev, isLoading: true, error: null, isCached: false }));
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    // Skip fetch if we already have cached data!
    if (location.isCached && !location.isLoading && location.countryCode) {
      return;
    }

    const detectLocation = async () => {
      // Force mode for testing
      if (FORCE_COUNTRY_CODE) {
        setLocation({
          country: FORCE_COUNTRY_CODE === 'IN' ? 'India' : 'United States',
          countryCode: FORCE_COUNTRY_CODE,
          city: FORCE_COUNTRY_CODE === 'IN' ? 'Mumbai' : 'New York',
          isIndia: FORCE_COUNTRY_CODE === 'IN',
          isLoading: false,
          error: null,
          isCached: true,
        });
        return;
      }

      // Double-check cache (in case of race condition)
      const cached = getCachedGeo();
      if (cached && cached.country_code) {
        const isIndia = cached.country_code === 'IN';
        setLocation({
          country: cached.country_name || '',
          countryCode: cached.country_code || '',
          city: cached.city || '',
          isIndia: isIndia,
          isLoading: false,
          error: null,
          isCached: true,
        });
        return;
      }


      try {
        let data: GeoData | null = null;
        
        // Try ipapi.co first
        try {
          const response = await fetch('https://ipapi.co/json/', {
            signal: AbortSignal.timeout(5000)
          });
          if (response.ok) {
            const jsonData = await response.json();
            if (jsonData.country_code) {
              data = {
                country_code: jsonData.country_code,
                country_name: jsonData.country_name,
                city: jsonData.city,
              };
            }
          }
        } catch {
        }

        // Fallback to ipinfo.io if ipapi.co fails (HTTPS only - ip-api.com is HTTP only)
        if (!data) {
          try {
            const response = await fetch('https://ipinfo.io/json', {
              signal: AbortSignal.timeout(5000)
            });
            if (response.ok) {
              const ipInfoData = await response.json();
              data = {
                country_code: ipInfoData.country,
                country_name: ipInfoData.country, // ipinfo.io returns code, not name
                city: ipInfoData.city,
              };
            }
          } catch {
          }
        }

        // If both failed, try one more API
        if (!data) {
          try {
            const response = await fetch('https://ipwho.is/', {
              signal: AbortSignal.timeout(5000)
            });
            if (response.ok) {
              const whoIsData = await response.json();
              data = {
                country_code: whoIsData.country_code,
                country_name: whoIsData.country,
                city: whoIsData.city,
              };
            }
          } catch {
          }
        }

        if (data && data.country_code) {
          const isIndia = data.country_code === 'IN';
          
          // Cache successful result
          setCachedGeo(data);
          
          setLocation({
            country: data.country_name || '',
            countryCode: data.country_code || '',
            city: data.city || '',
            isIndia: isIndia,
            isLoading: false,
            error: null,
            isCached: false, // Fresh from API
          });
        } else {
          throw new Error('All geo APIs failed');
        }
      } catch (err) {
        console.error('❌ Geo detection failed:', err);
        // If geo-detection fails, default to showing GlobalGateway (assume India)
        setLocation({
          country: 'Unknown',
          countryCode: 'IN',
          city: '',
          isIndia: true,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to detect location',
          isCached: false,
        });
      }
    };

    detectLocation();
  }, [fetchTrigger]);

  return { ...location, refetch };
}
