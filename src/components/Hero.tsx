import { Button } from "@/components/ui/button"
import { EnvelopeSimple, LinkedinLogo, GithubLogo, FileText, Code, ChartLine, Cpu } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { CandlestickAnimation } from "@/components/InteractiveEffects"
import { Link } from "react-router-dom"
import { useTranslation } from "@/i18n"

export function Hero() {
  const { t, isRTL } = useTranslation()
  
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Dynamic gradient background - CSS animated for performance */}
      <div className="absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background"></div>
        
        {/* CSS Animated gradient orbs - much cheaper than Framer Motion */}
        <div
          className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full animate-float-slow"
          style={{
            background: 'radial-gradient(circle, oklch(0.75 0.18 190 / 0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
            willChange: 'transform',
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full animate-float-medium"
          style={{
            background: 'radial-gradient(circle, oklch(0.65 0.22 300 / 0.12) 0%, transparent 70%)',
            filter: 'blur(60px)',
            willChange: 'transform',
          }}
        />
        <div
          className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full animate-float-fast"
          style={{
            background: 'radial-gradient(circle, oklch(0.72 0.19 145 / 0.1) 0%, transparent 70%)',
            filter: 'blur(50px)',
            willChange: 'transform',
          }}
        />
        
        {/* CSS Keyframes for GPU-accelerated floating */}
        <style>{`
          @keyframes floatSlow {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(50px, 30px) scale(1.1); }
          }
          @keyframes floatMedium {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-40px, -50px) scale(1.15); }
          }
          @keyframes floatFast {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50% { transform: translate(-30px, 40px) scale(1.2); }
          }
          .animate-float-slow { animation: floatSlow 8s ease-in-out infinite; }
          .animate-float-medium { animation: floatMedium 10s ease-in-out infinite; }
          .animate-float-fast { animation: floatFast 12s ease-in-out infinite; }
        `}</style>
      </div>
      
      {/* Animated Grid Pattern */}
      <div className="absolute inset-0 math-grid-bg opacity-30"></div>
      
      {/* Trading chart line animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <svg className="absolute bottom-0 left-0 w-full h-1/3" preserveAspectRatio="none" viewBox="0 0 1200 300">
          <motion.path
            d="M0,200 Q100,180 200,190 T400,150 T600,180 T800,120 T1000,160 T1200,100"
            fill="none"
            stroke="url(#gradient-line)"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 3, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="gradient-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="oklch(0.72 0.19 145)" />
              <stop offset="50%" stopColor="oklch(0.75 0.18 190)" />
              <stop offset="100%" stopColor="oklch(0.78 0.15 85)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {/* Floating Particles Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${i % 3 === 0 ? 'w-1.5 h-1.5 bg-accent/40' : i % 3 === 1 ? 'w-1 h-1 bg-gold/30' : 'w-0.5 h-0.5 bg-green/25'}`}
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800) + 400,
              opacity: 0 
            }}
            animate={{ 
              y: [null, Math.random() * -600],
              opacity: [0, 0.8, 0],
            }}
            transition={{ 
              duration: Math.random() * 10 + 10, 
              repeat: Infinity,
              delay: Math.random() * 5 
            }}
          />
        ))}
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 max-w-5xl mx-auto px-6 py-24 text-center pt-32"
      >
        {/* Status Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-8"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-accent text-sm font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            {t("Open to Global Opportunities")}
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 tracking-tight"
          style={{ letterSpacing: '-0.02em' }}
        >
          <motion.span
            animate={{
              textShadow: [
                '0 0 20px oklch(0.75 0.18 190 / 0.3)',
                '0 0 40px oklch(0.75 0.18 190 / 0.5)',
                '0 0 20px oklch(0.75 0.18 190 / 0.3)',
              ]
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            Shadaab Ahmed
          </motion.span>
          <motion.span 
            className="block mt-2 text-3xl md:text-4xl lg:text-5xl font-semibold"
            style={{
              background: 'linear-gradient(135deg, oklch(0.75 0.18 190) 0%, oklch(0.72 0.19 145) 50%, oklch(0.78 0.15 85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
            animate={{
              filter: [
                'drop-shadow(0 0 10px oklch(0.75 0.18 190 / 0.4))',
                'drop-shadow(0 0 25px oklch(0.75 0.18 190 / 0.6))',
                'drop-shadow(0 0 10px oklch(0.75 0.18 190 / 0.4))',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {t("Quantitative Developer")}
          </motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed"
        >
          {t("Multidisciplinary technologist with 4.5 years building production systems across software engineering, data engineering, machine learning, and quantitative finance. Expert in microservices, distributed systems, high-throughput data pipelines (200TB+ daily), deep learning with TensorFlow/NLP, and ultra-low-latency trading systems.")}
        </motion.p>

        {/* Tech Stack Pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-wrap gap-2 justify-center mb-10"
        >
          {["C++", "Python", "Go", "TensorFlow", "Spark", "Kafka", "AWS"].map((tech, i) => (
            <span 
              key={tech} 
              className="px-3 py-1 text-xs font-mono bg-muted/50 rounded-md border border-border/50 text-foreground/80"
            >
              {tech}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex flex-wrap gap-4 justify-center mb-12"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              size="lg" 
              className="relative bg-accent text-accent-foreground hover:bg-accent/90 overflow-hidden group"
              onClick={() => scrollToSection('contact')}
            >
              <motion.span
                className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-transparent to-green-400/20"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
              <span className="relative z-10 flex items-center">
                <EnvelopeSimple className="mr-2" weight="bold" />
                {t("Get In Touch")}
              </span>
            </Button>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              size="lg" 
              variant="outline" 
              className="border-accent/50 text-accent hover:bg-accent/10 hover:border-accent hover:shadow-[0_0_20px_oklch(0.75_0.18_190_/_0.3)] transition-all duration-300"
              onClick={() => scrollToSection('projects')}
            >
              {t("View Projects")}
            </Button>
          </motion.div>
          
          {/* Quant Sandbox Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/lab">
              <Button 
                size="lg" 
                className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 text-white border-0 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all duration-300"
              >
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 via-purple-400/30 to-pink-400/30"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <span className="relative z-10 flex items-center">
                  <ChartLine className="mr-2" weight="bold" />
                  {t("Quant Sandbox")} ✨
                </span>
              </Button>
            </Link>
          </motion.div>
          
          {/* Alpha Engine Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/alpha-engine">
              <Button 
                size="lg" 
                className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white border-0 shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:shadow-[0_0_30px_rgba(20,184,166,0.5)] transition-all duration-300"
              >
                <motion.span
                  className="absolute inset-0 bg-gradient-to-r from-emerald-400/30 via-teal-400/30 to-cyan-400/30"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <span className="relative z-10 flex items-center">
                  <Cpu className="mr-2" weight="bold" />
                  {t("Alpha Engine")} ⚡
                </span>
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
          className="flex gap-6 justify-center"
        >
          <motion.a 
            href="https://www.linkedin.com/in/shadaabah" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative p-4 rounded-full bg-muted/30 text-muted-foreground transition-all duration-300 group"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-[#0077B5]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              animate={{
                boxShadow: [
                  '0 0 20px oklch(0.6 0.15 230 / 0)',
                  '0 0 30px oklch(0.6 0.15 230 / 0.5)',
                  '0 0 20px oklch(0.6 0.15 230 / 0)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <LinkedinLogo size={28} weight="fill" className="relative z-10 group-hover:text-[#0077B5] transition-colors" />
          </motion.a>
          <motion.a 
            href="https://github.com/buraq-hs51" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative p-4 rounded-full bg-muted/30 text-muted-foreground transition-all duration-300 group"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-accent/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              animate={{
                boxShadow: [
                  '0 0 20px oklch(0.75 0.18 190 / 0)',
                  '0 0 30px oklch(0.75 0.18 190 / 0.5)',
                  '0 0 20px oklch(0.75 0.18 190 / 0)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <GithubLogo size={28} weight="fill" className="relative z-10 group-hover:text-accent transition-colors" />
          </motion.a>
          <motion.a 
            href="https://leetcode.com/u/ShAh-25/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative p-4 rounded-full bg-muted/30 text-muted-foreground transition-all duration-300 group"
            title="LeetCode"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-[#FFA116]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              animate={{
                boxShadow: [
                  '0 0 20px oklch(0.78 0.15 85 / 0)',
                  '0 0 30px oklch(0.78 0.15 85 / 0.5)',
                  '0 0 20px oklch(0.78 0.15 85 / 0)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <Code size={28} weight="bold" className="relative z-10 group-hover:text-[#FFA116] transition-colors" />
          </motion.a>
        </motion.div>
      </motion.div>

      {/* Candlestick Chart Animation */}
      <CandlestickAnimation />

      {/* Scroll Indicator */}
      <motion.div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <motion.div 
          className="w-6 h-10 border-2 border-accent/50 rounded-full flex items-start justify-center p-2"
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.div 
            className="w-1.5 h-1.5 bg-accent rounded-full"
            animate={{ y: [0, 8, 0], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      </motion.div>
    </section>
  )
}