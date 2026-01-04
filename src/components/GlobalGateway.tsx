import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GlobeHemisphereWest, 
  Airplane, 
  MapPin,
  Rocket,
  LinkedinLogo,
  EnvelopeSimple,
  Sparkle,
  ArrowRight,
  Buildings,
  ChartLineUp,
  Code,
  Trophy,
  Briefcase,
  GraduationCap,
  Lock,
  Heart
} from '@phosphor-icons/react';

// ============================================
// CONFIGURATION: Toggle for "Explore Portfolio Anyway" button
// Set to false to hide the bypass option for Indian users
// Set to true to allow Indian users to explore the portfolio
// ============================================
const ALLOW_INDIA_EXPLORE_BYPASS = false;

interface GlobalGatewayProps {
  country: string;
  onExplore?: () => void;
}

// Cities I'm targeting
const targetCities = [
  { name: 'Singapore', flag: '🇸🇬', color: 'from-red-500 to-white' },
  { name: 'Hong Kong', flag: '🇭🇰', color: 'from-red-600 to-pink-500' },
  { name: 'London', flag: '🇬🇧', color: 'from-blue-600 to-red-500' },
  { name: 'New York', flag: '🇺🇸', color: 'from-blue-500 to-red-500' },
  { name: 'Dubai', flag: '🇦🇪', color: 'from-green-500 to-red-500' },
  { name: 'Tokyo', flag: '🇯🇵', color: 'from-white to-red-500' },
];

// Impact & achievements to showcase
const impactStats = [
  { icon: ChartLineUp, value: '6+', label: 'Trading Systems Built', color: 'text-green-400' },
  { icon: Briefcase, value: '$1M+', label: 'Trading Volume Handled', color: 'text-cyan-400' },
  { icon: GraduationCap, value: 'MFE', label: 'Financial Engineering', color: 'text-purple-400' },
  { icon: Trophy, value: '5+', label: 'Research Projects', color: 'text-amber-400' },
];

// Animated floating particles
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400/30 rounded-full"
          initial={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
          }}
          animate={{
            x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
            y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: 10 + Math.random() * 20,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Animated connection lines
function ConnectionLines() {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
      <defs>
        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity="1" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[...Array(5)].map((_, i) => (
        <motion.line
          key={i}
          x1="10%"
          y1={`${20 + i * 15}%`}
          x2="90%"
          y2={`${30 + i * 10}%`}
          stroke="url(#lineGradient)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 0.5, 0] }}
          transition={{
            duration: 3,
            delay: i * 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </svg>
  );
}

export function GlobalGateway({ country, onExplore }: GlobalGatewayProps) {
  const [activeCity, setActiveCity] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  // Cycle through cities
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCity((prev) => (prev + 1) % targetCities.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Show details after initial animation
  useEffect(() => {
    const timer = setTimeout(() => setShowDetails(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white overflow-hidden relative">
      <FloatingParticles />
      <ConnectionLines />
      
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
      
      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12">
        
        {/* Animated Globe Section */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', duration: 1.5, bounce: 0.4 }}
          className="relative mb-8"
        >
          {/* Orbiting ring */}
          <motion.div
            className="absolute inset-0 border-2 border-cyan-500/30 rounded-full"
            style={{ width: '180px', height: '180px', left: '-30px', top: '-30px' }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Globe icon */}
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <GlobeHemisphereWest 
              size={120} 
              weight="duotone"
              className="text-cyan-400 drop-shadow-[0_0_30px_rgba(6,182,212,0.5)]"
            />
          </motion.div>

          {/* Orbiting airplane */}
          <motion.div
            className="absolute"
            animate={{
              rotate: 360,
            }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{ width: '160px', height: '160px', left: '-20px', top: '-20px' }}
          >
            <motion.div className="absolute -top-2 left-1/2 -translate-x-1/2">
              <Airplane size={28} className="text-amber-400 -rotate-45" weight="fill" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Main heading */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="text-center mb-8"
        >
          {/* Locked indicator */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-amber-500/10 border border-amber-500/30"
          >
            <Lock size={16} className="text-amber-400" weight="fill" />
            <span className="text-sm text-amber-300">Portfolio Reserved for Global Recruiters</span>
          </motion.div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Hey there, fellow Indian! 👋
            </span>
          </h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xl text-gray-300 max-w-2xl mx-auto mb-6"
          >
            You've discovered something special — but this interactive portfolio 
            is <span className="text-cyan-400 font-semibold">exclusively designed</span> for 
            global recruiters and hiring managers.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="flex items-center justify-center gap-2 text-gray-400"
          >
            <MapPin size={18} className="text-cyan-400" />
            <span>You're in {country || 'India'}</span>
            <ArrowRight size={18} className="text-purple-400" />
            <span className="text-gray-500">Targeting:</span>
            <motion.span
              key={activeCity}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="font-semibold text-white"
            >
              {targetCities[activeCity].flag} {targetCities[activeCity].name}
            </motion.span>
          </motion.div>
        </motion.div>

        {/* Journey message */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl text-center mb-10"
            >
              {/* Why locked message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/20"
              >
                <p className="text-lg text-gray-300 leading-relaxed">
                  <Heart size={20} className="inline text-red-400 mr-2" weight="fill" />
                  I'm a <span className="text-cyan-400 font-semibold">Quantitative Developer</span> & 
                  <span className="text-purple-400 font-semibold"> Financial Engineer</span> on a mission 
                  to bring <strong className="text-white">Indian talent to the world's leading financial hubs</strong>.
                </p>
                <p className="text-sm text-gray-400 mt-3">
                  This portfolio showcases my work to <span className="text-cyan-300">international recruiters</span> — 
                  it's how I'm opening doors that are often closed to us.
                </p>
              </motion.div>

              {/* Impact stats */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mb-8"
              >
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  What I've Built So Far
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {impactStats.map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="p-4 rounded-xl bg-white/5 border border-white/10"
                    >
                      <stat.icon size={24} className={`${stat.color} mx-auto mb-2`} weight="duotone" />
                      <div className="text-2xl font-bold text-white">{stat.value}</div>
                      <div className="text-xs text-gray-400">{stat.label}</div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
              
              {/* Skills showcase */}
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                {[
                  { icon: ChartLineUp, label: 'Quant Trading', color: 'text-green-400' },
                  { icon: Code, label: 'Algo Development', color: 'text-cyan-400' },
                  { icon: Buildings, label: 'Risk Analytics', color: 'text-purple-400' },
                ].map((skill, i) => (
                  <motion.div
                    key={skill.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10"
                  >
                    <skill.icon size={20} className={skill.color} weight="duotone" />
                    <span className="text-sm text-gray-300">{skill.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Target cities grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-10"
        >
          {targetCities.map((city, i) => (
            <motion.div
              key={city.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 + i * 0.1 }}
              whileHover={{ scale: 1.1, y: -5 }}
              className={`
                flex flex-col items-center gap-2 p-4 rounded-xl
                bg-gradient-to-br ${activeCity === i ? 'from-cyan-500/20 to-purple-500/20 border-cyan-500/50' : 'from-white/5 to-white/0 border-white/10'}
                border transition-all duration-300 cursor-pointer
              `}
              onClick={() => setActiveCity(i)}
            >
              <span className="text-2xl">{city.flag}</span>
              <span className="text-xs text-gray-400">{city.name}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <motion.a
            href="https://www.linkedin.com/in/shadaabah"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-cyan-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <LinkedinLogo size={24} weight="fill" />
            Connect Globally
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ArrowRight size={20} />
            </motion.span>
          </motion.a>

          <motion.a
            href="mailto:shadaab.ah17@gmail.com"
            className="group flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-semibold transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <EnvelopeSimple size={24} />
            Get in Touch
          </motion.a>
        </motion.div>

        {/* Explore portfolio option - Only shows if ALLOW_INDIA_EXPLORE_BYPASS is true */}
        {ALLOW_INDIA_EXPLORE_BYPASS && onExplore && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            onClick={onExplore}
            className="mt-8 group flex items-center gap-2 text-gray-500 hover:text-cyan-400 transition-colors"
          >
            <Sparkle size={16} className="group-hover:animate-spin" />
            <span className="text-sm">Explore my portfolio anyway</span>
            <Sparkle size={16} className="group-hover:animate-spin" />
          </motion.button>
        )}

        {/* Footer message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
          className="absolute bottom-8 text-center text-gray-600 text-sm max-w-md"
        >
          <Heart size={16} className="inline mr-2 text-red-400" weight="fill" />
          Made with love from India — aiming for the world 🌍
        </motion.p>
      </div>
    </div>
  );
}

export default GlobalGateway;
