import { useState, useEffect, useCallback } from 'react';

interface VPNDetectionResult {
  isVPNDetected: boolean;
  realLocation: {
    country: string;
    countryCode: string;
    city: string;
    ip: string;
  } | null;
  vpnLocation: {
    country: string;
    countryCode: string;
    city: string;
    ip: string;
  } | null;
  isLoading: boolean;
  error: string | null;
  confidence: number; // 0-100% confidence in VPN detection
  detectionMethods: string[]; // Which methods detected VPN
}

// WebRTC STUN servers for IP leak detection
const STUN_SERVERS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
  'stun:stun2.l.google.com:19302',
  'stun:stun.stunprotocol.org:3478',
];

// Known VPN/Datacenter ASN patterns (common VPN providers)
const VPN_ASN_KEYWORDS = [
  'vpn', 'proxy', 'hosting', 'datacenter', 'data center', 'cloud',
  'digitalocean', 'linode', 'vultr', 'aws', 'amazon', 'google cloud',
  'microsoft azure', 'ovh', 'hetzner', 'contabo', 'scaleway',
  'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'protonvpn',
  'private internet access', 'cyberghost', 'ipvanish', 'windscribe',
  'tunnelbear', 'hotspot shield', 'hide.me', 'purevpn', 'vyprvpn'
];

// Get real IP via WebRTC (bypasses VPN in many cases)
async function getWebRTCIP(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: STUN_SERVERS.map(url => ({ urls: url }))
      });
      
      const ips: Set<string> = new Set();
      let resolved = false;
      
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        
        // Extract IP from candidate string
        const candidateStr = event.candidate.candidate;
        const ipMatch = candidateStr.match(/(\d{1,3}\.){3}\d{1,3}/);
        
        if (ipMatch) {
          const ip = ipMatch[0];
          // Filter out local/private IPs
          if (!ip.startsWith('10.') && 
              !ip.startsWith('192.168.') && 
              !ip.startsWith('172.') &&
              !ip.startsWith('127.') &&
              !ip.startsWith('0.')) {
            ips.add(ip);
          }
        }
      };
      
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete' && !resolved) {
          resolved = true;
          pc.close();
          // Return first public IP found (likely real IP)
          const ipArray = Array.from(ips);
          resolve(ipArray.length > 0 ? ipArray[0] : null);
        }
      };
      
      // Create data channel to trigger ICE gathering
      pc.createDataChannel('vpn-detect');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          if (!resolved) {
            resolved = true;
            pc.close();
            resolve(null);
          }
        });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          const ipArray = Array.from(ips);
          resolve(ipArray.length > 0 ? ipArray[0] : null);
        }
      }, 5000);
      
    } catch {
      resolve(null);
    }
  });
}

// Check if ASN/Org indicates VPN
function isVPNOrg(org: string | undefined): boolean {
  if (!org) return false;
  const lowerOrg = org.toLowerCase();
  return VPN_ASN_KEYWORDS.some(keyword => lowerOrg.includes(keyword));
}

// Get location from IP using ipapi.co
async function getLocationFromIP(ip?: string): Promise<{
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  timezone: string;
  isVPN: boolean;
  isProxy: boolean;
  org: string;
} | null> {
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    
    const data = await response.json();
    const org = data.org || '';
    return {
      ip: data.ip || ip || '',
      country: data.country_name || '',
      countryCode: data.country_code || '',
      city: data.city || '',
      timezone: data.timezone || '',
      org: org,
      isVPN: isVPNOrg(org),
      isProxy: data.proxy || false,
    };
  } catch {
    return null;
  }
}

// Check VPN using ipwho.is (HTTPS) - ip-api.com is HTTP only which causes mixed content issues on HTTPS sites
// This function is a fallback that uses ipwho.is security endpoint
async function checkVPNStatusIpApi(ip: string): Promise<{
  isVPN: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  org: string;
} | null> {
  try {
    const response = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    
    const data = await response.json();
    const org = data.connection?.org || data.connection?.isp || '';
    const type = data.connection?.type || '';
    const isHostingType = type.toLowerCase() === 'hosting' || type.toLowerCase() === 'datacenter';
    
    return {
      isVPN: isHostingType || data.security?.proxy || data.security?.vpn || isVPNOrg(org),
      isProxy: data.security?.proxy || false,
      isDatacenter: isHostingType,
      org: org,
    };
  } catch {
    return null;
  }
}

// Check VPN using ipwhois (another source)
async function checkVPNStatusIpWhois(ip: string): Promise<{
  isVPN: boolean;
  isProxy: boolean;
  org: string;
  type: string;
} | null> {
  try {
    const response = await fetch(`https://ipwho.is/${ip}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    
    const data = await response.json();
    const org = data.connection?.org || data.connection?.isp || '';
    const type = data.connection?.type || '';
    
    // 'isp' type is usually residential, 'hosting' or 'business' can be VPN
    const isHostingType = type.toLowerCase() === 'hosting' || type.toLowerCase() === 'datacenter';
    
    return {
      isVPN: isHostingType || isVPNOrg(org),
      isProxy: data.security?.proxy || false,
      org: org,
      type: type,
    };
  } catch {
    return null;
  }
}

// Check timezone mismatch (VPN indicator)
function checkTimezoneMismatch(ipTimezone: string): boolean {
  try {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // If timezones are completely different, might be VPN
    if (ipTimezone && browserTimezone) {
      // Extract region from timezone (e.g., "Asia" from "Asia/Kolkata")
      const ipRegion = ipTimezone.split('/')[0];
      const browserRegion = browserTimezone.split('/')[0];
      
      // If regions don't match, likely VPN
      return ipRegion !== browserRegion;
    }
    return false;
  } catch {
    return false;
  }
}

// IMPORTANT: Get browser's timezone - this CANNOT be spoofed by VPN
function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
}

// Check if browser timezone indicates India
function isBrowserTimezoneIndia(): boolean {
  const timezone = getBrowserTimezone();
  const indianTimezones = [
    'Asia/Kolkata',
    'Asia/Calcutta', 
    'Asia/Mumbai',
    'Asia/Chennai',
    'Asia/New_Delhi',
    'Asia/Delhi'
  ];
  return indianTimezones.includes(timezone);
}

// Get browser's timezone-based country estimate
function getBrowserTimezoneCountry(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Map common timezones to countries
    const timezoneCountryMap: Record<string, string> = {
      'Asia/Kolkata': 'IN',
      'Asia/Mumbai': 'IN',
      'Asia/Calcutta': 'IN',
      'Asia/Chennai': 'IN',
      'Asia/New_Delhi': 'IN',
      'Asia/Delhi': 'IN',
      'America/New_York': 'US',
      'America/Los_Angeles': 'US',
      'America/Chicago': 'US',
      'America/Denver': 'US',
      'America/Phoenix': 'US',
      'America/Toronto': 'CA',
      'America/Vancouver': 'CA',
      'Europe/London': 'GB',
      'Europe/Paris': 'FR',
      'Europe/Berlin': 'DE',
      'Europe/Amsterdam': 'NL',
      'Europe/Rome': 'IT',
      'Europe/Madrid': 'ES',
      'Europe/Zurich': 'CH',
      'Asia/Tokyo': 'JP',
      'Asia/Shanghai': 'CN',
      'Asia/Hong_Kong': 'HK',
      'Asia/Singapore': 'SG',
      'Asia/Seoul': 'KR',
      'Asia/Bangkok': 'TH',
      'Asia/Jakarta': 'ID',
      'Asia/Dubai': 'AE',
      'Asia/Riyadh': 'SA',
      'Australia/Sydney': 'AU',
      'Australia/Melbourne': 'AU',
      'Pacific/Auckland': 'NZ',
    };
    
    return timezoneCountryMap[timezone] || null;
  } catch {
    return null;
  }
}

// Get country name from code
function getCountryNameFromCode(code: string): string {
  const countryNames: Record<string, string> = {
    'IN': 'India',
    'US': 'United States',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'JP': 'Japan',
    'SG': 'Singapore',
    'AE': 'United Arab Emirates',
    'NL': 'Netherlands',
    'CH': 'Switzerland',
    'IT': 'Italy',
    'ES': 'Spain',
    'KR': 'South Korea',
    'HK': 'Hong Kong',
    'CN': 'China',
    'TH': 'Thailand',
    'ID': 'Indonesia',
    'SA': 'Saudi Arabia',
    'NZ': 'New Zealand',
  };
  return countryNames[code] || code;
}

export function useVPNDetection(): VPNDetectionResult & { refetch: () => void } {
  const [result, setResult] = useState<VPNDetectionResult>({
    isVPNDetected: false,
    realLocation: null,
    vpnLocation: null,
    isLoading: true,
    error: null,
    confidence: 0,
    detectionMethods: [],
  });

  const [fetchTrigger, setFetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    setResult(prev => ({ ...prev, isLoading: true, error: null }));
    setFetchTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function detectVPN() {
      console.log('🔍 Starting VPN detection...');
      const detectionMethods: string[] = [];
      let vpnConfidence = 0;
      
      try {
        // Step 1: Get current IP location (this might be VPN IP)
        console.log('📍 Getting apparent IP location...');
        const apparentLocation = await getLocationFromIP();
        
        if (!apparentLocation) {
          throw new Error('Failed to detect location');
        }
        
        console.log('📍 Apparent location:', apparentLocation);
        
        // =====================================================
        // CRITICAL: TIMEZONE-FIRST VPN DETECTION
        // =====================================================
        // The browser's timezone CANNOT be spoofed by VPN
        // If timezone says India but IP says different country = VPN
        
        const browserTimezone = getBrowserTimezone();
        const browserCountryCode = getBrowserTimezoneCountry();
        const browserIsIndia = isBrowserTimezoneIndia();
        
        console.log('🕐 Browser timezone:', browserTimezone);
        console.log('� Browser timezone country:', browserCountryCode);
        console.log('🇮🇳 Browser is India timezone:', browserIsIndia);
        console.log('📍 IP country:', apparentLocation.countryCode);
        
        let realLocation: {
          country: string;
          countryCode: string;
          city: string;
          ip: string;
        } | null = null;
        let vpnLocation: {
          country: string;
          countryCode: string;
          city: string;
          ip: string;
        } | null = null;
        let isVPN = false;
        const detectionMethods: string[] = [];
        let vpnConfidence = 0;
        
        // =====================================================
        // PRIMARY CHECK: Browser timezone vs IP location
        // =====================================================
        // This is the most reliable VPN detection method
        if (browserCountryCode && browserCountryCode !== apparentLocation.countryCode) {
          console.log('🚨 VPN DETECTED: Browser timezone country differs from IP country!');
          console.log('   Browser timezone says:', browserCountryCode, '| IP says:', apparentLocation.countryCode);
          
          isVPN = true;
          vpnConfidence = 95; // Very high confidence
          detectionMethods.push('Timezone/IP country mismatch');
          
          // Real location is from browser timezone (cannot be spoofed)
          realLocation = {
            country: getCountryNameFromCode(browserCountryCode),
            countryCode: browserCountryCode,
            city: 'Detected via timezone',
            ip: 'Hidden by VPN',
          };
          
          // VPN location is from IP
          vpnLocation = {
            country: apparentLocation.country,
            countryCode: apparentLocation.countryCode,
            city: apparentLocation.city,
            ip: apparentLocation.ip,
          };
        }
        
        // =====================================================
        // SECONDARY CHECK: Specific India timezone check
        // =====================================================
        // Extra check: If browser timezone is specifically Indian
        if (!isVPN && browserIsIndia && apparentLocation.countryCode !== 'IN') {
          console.log('🚨 VPN DETECTED: Indian timezone but non-Indian IP!');
          
          isVPN = true;
          vpnConfidence = 98; // Very high confidence for India
          detectionMethods.push('Indian timezone with foreign IP');
          
          realLocation = {
            country: 'India',
            countryCode: 'IN',
            city: 'Detected via timezone',
            ip: 'Hidden by VPN',
          };
          
          vpnLocation = {
            country: apparentLocation.country,
            countryCode: apparentLocation.countryCode,
            city: apparentLocation.city,
            ip: apparentLocation.ip,
          };
        }
        
        // =====================================================
        // TERTIARY CHECK: WebRTC IP leak (if VPN doesn't block it)
        // =====================================================
        if (!isVPN) {
          console.log('🌐 Attempting WebRTC IP detection...');
          const webrtcIP = await getWebRTCIP();
          console.log('🌐 WebRTC IP:', webrtcIP);
          
          if (webrtcIP && webrtcIP !== apparentLocation.ip) {
            console.log('⚠️ IP mismatch detected! WebRTC:', webrtcIP, 'vs API:', apparentLocation.ip);
            
            const webrtcLocation = await getLocationFromIP(webrtcIP);
            
            if (webrtcLocation && webrtcLocation.countryCode !== apparentLocation.countryCode) {
              isVPN = true;
              vpnConfidence = 90;
              detectionMethods.push('WebRTC IP leak');
              
              realLocation = {
                country: webrtcLocation.country,
                countryCode: webrtcLocation.countryCode,
                city: webrtcLocation.city,
                ip: webrtcIP,
              };
              
              vpnLocation = {
                country: apparentLocation.country,
                countryCode: apparentLocation.countryCode,
                city: apparentLocation.city,
                ip: apparentLocation.ip,
              };
            }
          }
        }
        
        // =====================================================
        // QUATERNARY CHECK: Known VPN/Datacenter IPs
        // =====================================================
        if (!isVPN) {
          // Check if IP is known VPN/proxy from initial location check
          if (apparentLocation.isVPN || apparentLocation.isProxy) {
            vpnConfidence += 30;
            detectionMethods.push('Known VPN/Proxy IP (ipapi.co)');
            isVPN = true;
            console.log('🔍 ipapi.co detected VPN/Proxy, org:', apparentLocation.org);
            
            // Use timezone as real location
            if (browserCountryCode) {
              realLocation = {
                country: getCountryNameFromCode(browserCountryCode),
                countryCode: browserCountryCode,
                city: 'Detected via timezone',
                ip: 'Hidden by VPN',
              };
              vpnLocation = {
                country: apparentLocation.country,
                countryCode: apparentLocation.countryCode,
                city: apparentLocation.city,
                ip: apparentLocation.ip,
              };
            }
          }
          
          // Check with ip-api.com
          const vpnStatusIpApi = await checkVPNStatusIpApi(apparentLocation.ip);
          if (vpnStatusIpApi?.isVPN || vpnStatusIpApi?.isDatacenter) {
            vpnConfidence += 25;
            if (vpnStatusIpApi.isProxy) detectionMethods.push('Proxy (ip-api.com)');
            if (vpnStatusIpApi.isDatacenter) detectionMethods.push('Datacenter IP');
            isVPN = true;
            console.log('🔍 ip-api.com detected VPN/Datacenter, org:', vpnStatusIpApi.org);
            
            if (!realLocation && browserCountryCode) {
              realLocation = {
                country: getCountryNameFromCode(browserCountryCode),
                countryCode: browserCountryCode,
                city: 'Detected via timezone',
                ip: 'Hidden by VPN',
              };
              vpnLocation = {
                country: apparentLocation.country,
                countryCode: apparentLocation.countryCode,
                city: apparentLocation.city,
                ip: apparentLocation.ip,
              };
            }
          }
          
          // Check with ipwhois
          const vpnStatusWhois = await checkVPNStatusIpWhois(apparentLocation.ip);
          if (vpnStatusWhois?.isVPN) {
            vpnConfidence += 20;
            detectionMethods.push(`${vpnStatusWhois.type || 'Suspicious'} connection (ipwho.is)`);
            isVPN = true;
            console.log('🔍 ipwho.is detected VPN, type:', vpnStatusWhois.type, 'org:', vpnStatusWhois.org);
            
            if (!realLocation && browserCountryCode) {
              realLocation = {
                country: getCountryNameFromCode(browserCountryCode),
                countryCode: browserCountryCode,
                city: 'Detected via timezone',
                ip: 'Hidden by VPN',
              };
              vpnLocation = {
                country: apparentLocation.country,
                countryCode: apparentLocation.countryCode,
                city: apparentLocation.city,
                ip: apparentLocation.ip,
              };
            }
          }
        }
        
        // If no VPN detected, set apparent location as real
        if (!isVPN) {
          realLocation = {
            country: apparentLocation.country,
            countryCode: apparentLocation.countryCode,
            city: apparentLocation.city,
            ip: apparentLocation.ip,
          };
        }
        
        console.log('✅ VPN Detection complete:', { isVPN, vpnConfidence, detectionMethods, realLocation, vpnLocation });
        
        if (!cancelled) {
          setResult({
            isVPNDetected: isVPN,
            realLocation,
            vpnLocation,
            isLoading: false,
            error: null,
            confidence: Math.min(vpnConfidence, 100),
            detectionMethods,
          });
        }
        
      } catch (err) {
        if (!cancelled) {
          console.error('❌ VPN detection error:', err);
          setResult({
            isVPNDetected: false,
            realLocation: null,
            vpnLocation: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Detection failed',
            confidence: 0,
            detectionMethods: [],
          });
        }
      }
    }

    detectVPN();

    return () => {
      cancelled = true;
    };
  }, [fetchTrigger]);

  return { ...result, refetch };
}

// Cache key for VPN detection
export const VPN_CACHE_KEY = 'vpnDetectionCache';
export const VPN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Passcode for VPN bypass (should be stored securely in production)
export const VPN_BYPASS_PASSCODE = 'ALPHA2024';
