import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ShieldAlert, Lock, Globe, MapPin, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { VPN_BYPASS_PASSCODE, type LocationInfo } from '../hooks/useLocationVerification';
import { grantVPNBypass } from '../lib/secureStorage';

interface VPNBlockScreenProps {
  realLocation: LocationInfo;       // From timezone (true location)
  apparentLocation: LocationInfo;   // From IP (VPN location)
  confidence: number;
  detectionMethod: string;
  onBypass: () => void;
}

export function VPNBlockScreen({
  realLocation,
  apparentLocation,
  confidence,
  detectionMethod,
  onBypass,
}: VPNBlockScreenProps) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    // Simulate verification delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (passcode === VPN_BYPASS_PASSCODE) {
      setIsSuccess(true);
      // Store bypass securely with tamper protection
      grantVPNBypass();
      setTimeout(() => {
        onBypass();
      }, 1500);
    } else {
      setError('Invalid passcode. Please try again.');
      setIsVerifying(false);
    }
  };

  // Animated background grid
  const GridBackground = () => (
    <div className="absolute inset-0 overflow-hidden">
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(239, 68, 68, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(239, 68, 68, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      {/* Animated scan line */}
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent"
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[9999] bg-gradient-to-br from-gray-950 via-red-950/20 to-gray-950 flex items-center justify-center p-4"
    >
      <GridBackground />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="relative max-w-lg w-full"
      >
        {/* Glowing border effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 rounded-2xl blur opacity-30 animate-pulse" />
        
        <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-red-500/30 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 px-6 py-4 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-red-400">VPN Detected</h2>
                <p className="text-sm text-gray-400">Security verification required</p>
              </div>
              <div className="ml-auto">
                <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-mono">
                  {confidence}% confidence
                </span>
              </div>
            </div>
          </div>

          {/* Location comparison */}
          <div className="p-6 space-y-4">
            {/* Detection info */}
            <div className="grid grid-cols-2 gap-4">
              {/* Real Location */}
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-green-500/10 border border-green-500/30 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400 font-medium">REAL LOCATION</span>
                </div>
                <p className="text-lg font-bold text-white">{realLocation.country}</p>
                <p className="text-sm text-gray-400">{realLocation.city}</p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {realLocation.ip !== 'Hidden' ? realLocation.ip : '••••••••'}
                </p>
              </motion.div>

              {/* VPN Location */}
              <motion.div
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-red-500/10 border border-red-500/30 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-red-400" />
                  <span className="text-xs text-red-400 font-medium">VPN LOCATION</span>
                </div>
                <p className="text-lg font-bold text-white">{apparentLocation.country}</p>
                <p className="text-sm text-gray-400">{apparentLocation.city}</p>
                <p className="text-xs text-gray-500 font-mono mt-1">{apparentLocation.ip || '••••••••'}</p>
              </motion.div>
            </div>

            {/* Detection method */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap gap-2"
            >
              <span className="px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs border border-yellow-500/20">
                {detectionMethod}
              </span>
            </motion.div>

            {/* Warning message */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
            >
              <p className="text-gray-300 text-sm">
                <span className="text-red-400 font-semibold">Access Restricted:</span> Your real location ({realLocation.country}) requires verification when using a VPN. 
                Please enter the access passcode to continue.
              </p>
            </motion.div>

            {/* Passcode form */}
            <AnimatePresence mode="wait">
              {!isSuccess ? (
                <motion.form
                  key="form"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ delay: 0.7 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                      type={showPasscode ? 'text' : 'password'}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Enter passcode"
                      className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-11 pr-11 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono tracking-widest"
                      disabled={isVerifying}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasscode(!showPasscode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPasscode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-red-400 text-sm"
                    >
                      <XCircle className="w-4 h-4" />
                      {error}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={!passcode || isVerifying}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Verify & Continue
                      </>
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center py-6 space-y-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <CheckCircle className="w-16 h-16 text-green-500" />
                  </motion.div>
                  <p className="text-green-400 font-semibold">Access Granted!</p>
                  <p className="text-gray-400 text-sm">Redirecting...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-gray-800/50 border-t border-gray-700">
            <p className="text-xs text-gray-500 text-center">
              🔒 This security measure protects premium content access
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default VPNBlockScreen;
