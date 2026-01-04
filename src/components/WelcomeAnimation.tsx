import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GlobeHemisphereWest, 
  MapPin,
  RocketLaunch,
  Lightning,
  Star,
  Fingerprint,
  ShieldCheck,
  Cpu,
  Code,
  ChartLineUp,
  Sparkle,
  Globe,
  Compass,
  MapTrifold
} from '@phosphor-icons/react';

interface WelcomeAnimationProps {
  country: string;
  city: string;
  onComplete: () => void;
}

// Subtle floating particles - very minimal
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(15)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-cyan-400/30"
          style={{
            left: `${10 + Math.random() * 80}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Pulsing rings around central element
function PulsingRings({ color = 'cyan' }: { color?: string }) {
  const colorClass = color === 'cyan' ? 'border-cyan-500/40' : 
                     color === 'purple' ? 'border-purple-500/40' : 
                     color === 'green' ? 'border-green-500/40' : 'border-cyan-500/40';
  
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`absolute rounded-full border-2 ${colorClass}`}
          style={{
            width: '150px',
            height: '150px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: [1, 1.5 + i * 0.3, 2 + i * 0.3],
            opacity: [0.6, 0.3, 0],
          }}
          transition={{
            duration: 2.5,
            delay: i * 0.4,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  );
}

// Target cities with flags
const targetCities = [
  { name: 'Singapore', flag: '🇸🇬', angle: 0 },
  { name: 'Hong Kong', flag: '🇭🇰', angle: 60 },
  { name: 'London', flag: '🇬🇧', angle: 120 },
  { name: 'New York', flag: '🇺🇸', angle: 180 },
  { name: 'Dubai', flag: '🇦🇪', angle: 240 },
  { name: 'Tokyo', flag: '🇯🇵', angle: 300 },
];

// Connection visualization
function GlobalConnections({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {targetCities.map((city, i) => {
        const radius = 180;
        const x = Math.cos((city.angle - 90) * Math.PI / 180) * radius;
        const y = Math.sin((city.angle - 90) * Math.PI / 180) * radius;
        
        return (
          <motion.div
            key={city.name}
            className="absolute flex flex-col items-center"
            style={{
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`,
              transform: 'translate(-50%, -50%)',
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.15, duration: 0.5, type: 'spring' }}
          >
            {/* Connection line */}
            <motion.div
              className="absolute w-[2px] bg-gradient-to-b from-cyan-400/60 to-transparent"
              style={{
                height: `${radius - 50}px`,
                transformOrigin: 'bottom center',
                rotate: `${city.angle + 180}deg`,
                bottom: '50%',
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
            />
            
            {/* City badge */}
            <motion.div
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-gray-900/90 border border-cyan-500/30 backdrop-blur-sm"
              whileHover={{ scale: 1.1 }}
            >
              <span className="text-xl">{city.flag}</span>
              <span className="text-[10px] text-cyan-300 font-medium">{city.name}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Celebration burst
function CelebrationBurst() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * 360;
        return (
          <motion.div
            key={i}
            className="absolute"
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{
              scale: [0, 1, 0.5],
              x: Math.cos(angle * Math.PI / 180) * 120,
              y: Math.sin(angle * Math.PI / 180) * 120,
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <Star size={24} weight="fill" className="text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
          </motion.div>
        );
      })}
      
      {/* Outer ring burst */}
      {[...Array(24)].map((_, i) => {
        const angle = (i / 24) * 360;
        const colors = ['#06b6d4', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
        return (
          <motion.div
            key={`outer-${i}`}
            className="absolute w-3 h-3 rounded-full"
            style={{ 
              backgroundColor: colors[i % colors.length],
              boxShadow: `0 0 15px ${colors[i % colors.length]}`
            }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{
              scale: [0, 1.5, 0],
              x: Math.cos(angle * Math.PI / 180) * 200,
              y: Math.sin(angle * Math.PI / 180) * 200,
              opacity: [1, 0.8, 0],
            }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.1 }}
          />
        );
      })}
    </div>
  );
}

// Typewriter effect with proper cleanup
function TypewriterText({ text, className = '' }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index <= text.length) {
        setDisplayText(text.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
        // Hide cursor after typing complete
        setTimeout(() => setShowCursor(false), 500);
      }
    }, 60);
    
    return () => clearInterval(interval);
  }, [text]);

  return (
    <span className={className}>
      {displayText}
      {showCursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block w-[3px] h-[1.1em] bg-current ml-1 align-middle"
        />
      )}
    </span>
  );
}

// Phase indicator dots
function PhaseIndicator({ currentPhase, totalPhases }: { currentPhase: number; totalPhases: number }) {
  return (
    <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-2">
      {[...Array(totalPhases)].map((_, i) => (
        <motion.div
          key={i}
          className={`w-2 h-2 rounded-full ${i <= currentPhase ? 'bg-cyan-400' : 'bg-gray-700'}`}
          animate={i === currentPhase ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

export function WelcomeAnimation({ country, city, onComplete }: WelcomeAnimationProps) {
  const [phase, setPhase] = useState<number>(0);
  // Phases: 0=init, 1=scanning, 2=locating, 3=connecting, 4=verified, 5=welcome
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    // Extended cinematic timeline (~15 seconds total for premium experience)
    const timers = [
      setTimeout(() => setPhase(1), 800),        // 0.8s - Start scanning
      setTimeout(() => setPhase(2), 4000),       // 4.0s - Locating (longer scan phase)
      setTimeout(() => setPhase(3), 7500),       // 7.5s - Connecting to global network
      setTimeout(() => setPhase(4), 11000),      // 11.0s - Verified
      setTimeout(() => setShowBurst(true), 11200), // 11.2s - Show celebration
      setTimeout(() => setPhase(5), 12500),      // 12.5s - Welcome message
      setTimeout(() => onComplete(), 15000),     // 15.0s - Complete
    ];

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const phaseNames = ['Initializing', 'Scanning', 'Locating', 'Connecting', 'Verified', 'Welcome'];

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-[#0a0a12] via-[#0d0d18] to-[#0a0a12] flex items-center justify-center overflow-hidden"
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(139,92,246,0.06)_0%,_transparent_50%)]" />
      </div>
      
      {/* Floating particles */}
      <FloatingParticles />
      
      {/* Phase indicator */}
      <PhaseIndicator currentPhase={phase} totalPhases={6} />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center">
        
        {/* Central display area */}
        <div className="relative w-[450px] h-[450px] flex items-center justify-center">
          
          {/* Global connections (phase 3) */}
          <GlobalConnections show={phase === 3} />
          
          {/* Celebration burst (phase 4) */}
          {showBurst && phase >= 4 && <CelebrationBurst />}

          {/* Central icon with phases */}
          <div className="relative">
            {/* Pulsing rings */}
            {phase >= 1 && phase < 4 && (
              <PulsingRings color={phase === 1 ? 'cyan' : phase === 2 ? 'purple' : 'cyan'} />
            )}
            
            <AnimatePresence mode="wait">
              {/* Phase 0 & 1: Scanning */}
              {phase <= 1 && (
                <motion.div
                  key="scanning"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  {/* Rotating scanner */}
                  <motion.div
                    className="absolute -inset-4 rounded-full"
                    style={{
                      background: 'conic-gradient(from 0deg, transparent 0deg, rgba(6,182,212,0.3) 30deg, transparent 60deg)',
                    }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                  
                  <div className="relative p-8 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-cyan-500/50 shadow-[0_0_40px_rgba(6,182,212,0.3)]">
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Fingerprint size={80} weight="duotone" className="text-cyan-400" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Phase 2: Locating */}
              {phase === 2 && (
                <motion.div
                  key="locating"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  <div className="relative p-8 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-500/50 shadow-[0_0_40px_rgba(139,92,246,0.3)]">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    >
                      <Compass size={80} weight="duotone" className="text-purple-400" />
                    </motion.div>
                  </div>
                  
                  {/* Location ping */}
                  <motion.div
                    className="absolute -top-2 -right-2 p-2 rounded-full bg-purple-500 shadow-[0_0_20px_rgba(139,92,246,0.6)]"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <MapPin size={20} weight="fill" className="text-white" />
                  </motion.div>
                </motion.div>
              )}

              {/* Phase 3: Connecting */}
              {phase === 3 && (
                <motion.div
                  key="connecting"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.2, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="relative"
                >
                  <motion.div
                    className="absolute -inset-6 rounded-full border-2 border-cyan-400/30"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  
                  <div className="relative p-8 rounded-full bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.4)]">
                    <motion.div
                      animate={{ rotateY: [0, 360] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    >
                      <Globe size={80} weight="duotone" className="text-cyan-400" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {/* Phase 4 & 5: Verified & Welcome */}
              {phase >= 4 && (
                <motion.div
                  key="verified"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  className="relative"
                >
                  <div className="relative p-8 rounded-full bg-gradient-to-br from-green-900/50 to-cyan-900/50 border-2 border-green-500/50 shadow-[0_0_60px_rgba(34,197,94,0.4)]">
                    <ShieldCheck size={80} weight="fill" className="text-green-400" />
                  </div>
                  
                  {/* Checkmark badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="absolute -bottom-2 -right-2 p-2 rounded-full bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                  >
                    <Sparkle size={20} weight="fill" className="text-white" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Status text area */}
        <div className="h-40 flex flex-col items-center justify-start mt-4">
          <AnimatePresence mode="wait">
            {/* Phase 1: Scanning */}
            {phase === 1 && (
              <motion.div
                key="scanText"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="flex items-center gap-3 text-cyan-400 text-2xl font-light tracking-wide">
                  <Lightning size={28} weight="fill" className="animate-pulse" />
                  <TypewriterText text="Initializing Security Scan..." />
                </div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  className="mt-4 text-gray-500 text-sm"
                >
                  Verifying network credentials...
                </motion.p>
              </motion.div>
            )}

            {/* Phase 2: Locating */}
            {phase === 2 && (
              <motion.div
                key="locateText"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="flex items-center gap-3 text-purple-400 text-2xl font-light tracking-wide">
                  <MapTrifold size={28} weight="duotone" />
                  <TypewriterText text="Locating Your Position..." />
                </div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="mt-6 flex items-center justify-center gap-3 px-6 py-3 rounded-full bg-purple-500/10 border border-purple-500/30"
                >
                  <MapPin size={22} weight="fill" className="text-purple-400" />
                  <span className="text-white text-lg font-medium">
                    {city ? `${city}, ` : ''}{country}
                  </span>
                </motion.div>
              </motion.div>
            )}

            {/* Phase 3: Connecting */}
            {phase === 3 && (
              <motion.div
                key="connectText"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="flex items-center gap-3 text-cyan-400 text-2xl font-light tracking-wide">
                  <GlobeHemisphereWest size={28} weight="duotone" />
                  <TypewriterText text="Connecting to Global Network..." />
                </div>
                
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 flex gap-3 justify-center flex-wrap"
                >
                  {[
                    { icon: ChartLineUp, label: 'Quant Access', delay: 0.6 },
                    { icon: Code, label: 'Full Portfolio', delay: 0.8 },
                    { icon: RocketLaunch, label: 'Premium Features', delay: 1.0 },
                  ].map((item) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: item.delay }}
                      className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30"
                    >
                      <item.icon size={18} weight="duotone" className="text-cyan-400" />
                      <span className="text-sm text-gray-300">{item.label}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {/* Phase 4: Verified */}
            {phase === 4 && (
              <motion.div
                key="verifiedText"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <motion.div
                  className="text-3xl font-bold text-green-400 tracking-wide"
                  animate={{ textShadow: ['0 0 20px rgba(34,197,94,0.5)', '0 0 40px rgba(34,197,94,0.8)', '0 0 20px rgba(34,197,94,0.5)'] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ✓ ACCESS GRANTED
                </motion.div>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 text-gray-400 text-lg"
                >
                  Global visitor verified from <span className="text-cyan-400 font-medium">{country}</span>
                </motion.p>
              </motion.div>
            )}

            {/* Phase 5: Welcome */}
            {phase === 5 && (
              <motion.div
                key="welcomeText"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <motion.h1
                  className="text-4xl md:text-5xl font-bold mb-4"
                  style={{
                    background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                  animate={{ 
                    filter: ['brightness(1)', 'brightness(1.3)', 'brightness(1)']
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Welcome to My Portfolio
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-400 text-lg mb-6"
                >
                  Thank you for visiting — your access is unlocked
                </motion.p>

                {/* Loading bar */}
                <motion.div
                  className="w-72 h-2 bg-gray-800 rounded-full overflow-hidden mx-auto"
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #ec4899)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.3, ease: 'easeOut' }}
                  />
                </motion.div>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="mt-4 text-gray-600 text-sm flex items-center justify-center gap-2"
                >
                  <RocketLaunch size={16} className="text-amber-400" weight="fill" />
                  Launching portfolio experience...
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-6 flex items-center gap-3 text-gray-700 text-sm tracking-widest"
        >
          <div className="w-8 h-[1px] bg-gradient-to-r from-transparent to-gray-700" />
          <span>SHADAAB AHMED</span>
          <span className="text-cyan-500">•</span>
          <span>QUANT DEVELOPER</span>
          <div className="w-8 h-[1px] bg-gradient-to-l from-transparent to-gray-700" />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default WelcomeAnimation;
