import { motion } from 'framer-motion';
import { 
  MapPinLine, 
  Globe, 
  ShieldCheck, 
  ArrowClockwise,
  Sparkle,
  LinkedinLogo,
  EnvelopeSimple,
  GlobeHemisphereWest
} from '@phosphor-icons/react';

interface LocationRequiredProps {
  onRetry: () => void;
}

export function LocationRequired({ onRetry }: LocationRequiredProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center overflow-hidden">
      {/* Subtle animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, transparent 70%)',
            top: '10%',
            left: '20%',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.5) 0%, transparent 70%)',
            bottom: '10%',
            right: '20%',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 text-center max-w-2xl">
        {/* Animated globe icon */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 100 }}
          className="relative mb-8"
        >
          <motion.div
            className="p-6 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30"
            animate={{
              boxShadow: [
                '0 0 20px rgba(249, 115, 22, 0.2)',
                '0 0 40px rgba(249, 115, 22, 0.3)',
                '0 0 20px rgba(249, 115, 22, 0.2)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <MapPinLine size={56} className="text-orange-400" weight="duotone" />
          </motion.div>
          
          {/* Pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-orange-500/30"
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-orange-500/20"
            animate={{ scale: [1, 2.2], opacity: [0.3, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl md:text-4xl font-bold mb-4"
        >
          <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
            Location Access Needed
          </span>
        </motion.h1>

        {/* Friendly explanation */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg text-gray-300 mb-6 leading-relaxed"
        >
          I couldn't detect your location, which means I can't show you the{' '}
          <span className="text-cyan-400 font-semibold">personalized portfolio experience</span>{' '}
          I've built for global recruiters and professionals.
        </motion.p>

        {/* Why we need location */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="w-full max-w-md mb-8 p-6 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10"
        >
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-green-400" />
            Why Location?
          </h3>
          <ul className="space-y-3 text-left text-gray-300">
            <li className="flex items-start gap-3">
              <Globe size={20} className="text-cyan-400 mt-0.5 shrink-0" />
              <span>To provide a <strong className="text-white">tailored experience</strong> based on your region</span>
            </li>
            <li className="flex items-start gap-3">
              <Sparkle size={20} className="text-purple-400 mt-0.5 shrink-0" />
              <span>To show you relevant <strong className="text-white">local market insights</strong> & projects</span>
            </li>
            <li className="flex items-start gap-3">
              <GlobeHemisphereWest size={20} className="text-amber-400 mt-0.5 shrink-0" />
              <span>I use <strong className="text-white">IP-based detection</strong> (no precise tracking)</span>
            </li>
          </ul>
        </motion.div>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4 mb-8"
        >
          <motion.button
            onClick={onRetry}
            className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-orange-500/25"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowClockwise size={24} weight="bold" className="group-hover:animate-spin" />
            Retry Location Detection
          </motion.button>
        </motion.div>

        {/* Alternative contact options */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col items-center gap-4"
        >
          <p className="text-sm text-gray-500">Or reach out directly:</p>
          <div className="flex gap-4">
            <motion.a
              href="https://www.linkedin.com/in/shadaabah"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-gray-300 hover:text-white transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LinkedinLogo size={20} weight="fill" />
              LinkedIn
            </motion.a>
            <motion.a
              href="mailto:shadaab.ah17@gmail.com"
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-gray-300 hover:text-white transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <EnvelopeSimple size={20} />
              Email
            </motion.a>
          </div>
        </motion.div>

        {/* Helpful tips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-10 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 max-w-md"
        >
          <p className="text-sm text-orange-300/80">
            <strong className="text-orange-300">💡 Tip:</strong> If you're using a VPN or ad blocker, 
            try disabling it temporarily. Also ensure your browser allows IP-based location detection.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

export default LocationRequired;
