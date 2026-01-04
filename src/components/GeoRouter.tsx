import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import { useLocationVerification } from '@/hooks/useLocationVerification';
import { GlobalGateway } from '@/components/GlobalGateway';
import { WelcomeAnimation } from '@/components/WelcomeAnimation';
import { LocationRequired } from '@/components/LocationRequired';
import { VPNBlockScreen } from '@/components/VPNBlockScreen';
import { I18nProvider } from '@/i18n';
import { GlobeHemisphereWest } from '@phosphor-icons/react';
import { hasVPNBypass, hasGatewayBypass, grantGatewayBypass, migrateFromInsecureStorage } from '@/lib/secureStorage';

interface GeoRouterProps {
  children: React.ReactNode;
}

export function GeoRouter({ children }: GeoRouterProps) {
  const { isIndia, isLoading, country, countryCode, city, error, refetch, isCached } = useGeoLocation();
  const locationVerification = useLocationVerification();
  const [animationComplete, setAnimationComplete] = useState(false);
  const [bypassGateway, setBypassGateway] = useState(false);
  const [vpnBypassed, setVpnBypassed] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check if user has previously bypassed (secure storage) - only on mount
  useEffect(() => {
    migrateFromInsecureStorage();
    
    const gatewayBypassed = hasGatewayBypass();
    const vpnBypassGranted = hasVPNBypass();
    
    if (gatewayBypassed) {
      setBypassGateway(true);
      setAnimationComplete(true);
    }
    if (vpnBypassGranted) {
      setVpnBypassed(true);
    }
    if (isCached) {
      setAnimationComplete(true);
    }
    setInitialized(true);
  }, [isCached]);

  // Handle retry from LocationRequired page
  const handleRetry = useCallback(() => {
    sessionStorage.removeItem('geoLocation');
    if (refetch) {
      refetch();
    } else {
      window.location.reload();
    }
  }, [refetch]);

  // Handle "Explore anyway" from GlobalGateway
  const handleExplore = () => {
    grantGatewayBypass();
    setBypassGateway(true);
    setAnimationComplete(true);
  };

  // Handle VPN bypass with passcode
  const handleVPNBypass = () => {
    setVpnBypassed(true);
  };

  // Handle welcome animation complete
  const handleAnimationComplete = () => {
    setAnimationComplete(true);
  };

  // Wait for initialization
  if (!initialized) {
    return null;
  }

  // Loading state - wait for both geo and location verification
  if (isLoading || locationVerification.isLoading) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <GlobeHemisphereWest 
              size={60} 
              className="text-cyan-400/50"
              weight="duotone"
            />
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-400 text-sm"
          >
            {locationVerification.isLoading ? 'Verifying connection...' : 'Detecting location...'}
          </motion.p>
        </div>
      </div>
    );
  }

  // ========================================
  // LOCATION VERIFICATION LOGIC (Timezone-based)
  // ========================================
  // The new system uses browser timezone as "ground truth" for real location
  // VPN can only spoof IP, not system timezone
  // 
  // Scenario 1: Real location = India + VPN detected → Block with passcode
  // Scenario 2: Real location = India + No VPN → Normal India flow  
  // Scenario 3: Real location = Outside India + VPN → Pass directly (no restriction)
  // Scenario 4: Real location = Outside India + No VPN → Normal international flow

  if (locationVerification.shouldBlock && !vpnBypassed) {
    return (
      <VPNBlockScreen
        realLocation={locationVerification.realLocation!}
        apparentLocation={locationVerification.apparentLocation!}
        confidence={locationVerification.vpnConfidence}
        detectionMethod={locationVerification.detectionMethod}
        onBypass={handleVPNBypass}
      />
    );
  }

  // Foreign user with VPN - pass directly with VPN location's language
  if (locationVerification.canPassDirectly && locationVerification.isVPNDetected) {
    const vpnCountryCode = locationVerification.apparentLocation?.countryCode || countryCode;
    return (
      <I18nProvider countryCode={vpnCountryCode}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {children}
        </motion.div>
      </I18nProvider>
    );
  }

  // Location detection failed - show LocationRequired page (unless bypassed)
  if (error && !bypassGateway) {
    return <LocationRequired onRetry={handleRetry} />;
  }

  // India visitors - show GlobalGateway (unless bypassed)
  if (isIndia && !bypassGateway && !vpnBypassed) {
    return <GlobalGateway country={country} onExplore={handleExplore} />;
  }

  // International visitors - show welcome animation first
  if (!isIndia && !animationComplete && !bypassGateway) {
    const displayCountry = locationVerification.apparentLocation?.country || country;
    const displayCity = locationVerification.apparentLocation?.city || city;
    const displayCountryCode = locationVerification.apparentLocation?.countryCode || countryCode;
    return (
      <I18nProvider countryCode={displayCountryCode}>
        <WelcomeAnimation 
          country={displayCountry} 
          city={displayCity}
          onComplete={handleAnimationComplete} 
        />
      </I18nProvider>
    );
  }

  // Show portfolio (international after animation, or bypassed India user, or VPN bypassed user)
  // For VPN bypassed users, use the VPN location for translation
  const effectiveCountryCode = locationVerification.apparentLocation?.countryCode || countryCode;
  
  return (
    <I18nProvider countryCode={effectiveCountryCode}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </I18nProvider>
  );
}

export default GeoRouter;