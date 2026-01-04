import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { List, X, Terminal, Command } from "@phosphor-icons/react"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslation } from "@/i18n"
import { LanguageToggle } from "./LanguageToggle"

// Navigation items with English labels (will be auto-translated)
// Live Widgets is FIRST and mobile-only (isMobileOnly: true)
const navItems = [
  { label: "📊 Live Widgets", href: "#mobile-widgets", isMobileOnly: true },
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
  { label: "Quant Sandbox", href: "/lab", isRoute: true },
  { label: "Alpha Engine", href: "/alpha-engine", isRoute: true },
  { label: "Skills", href: "#skills" },
  { label: "Education", href: "#education" },
]

export function Navigation() {
  const { t, isRTL } = useTranslation()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
      
      // Find active section
      const sections = navItems.map(item => item.href.slice(1))
      for (const section of sections.reverse()) {
        const element = document.getElementById(section)
        if (element) {
          const rect = element.getBoundingClientRect()
          if (rect.top <= 150) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (href: string) => {
    const element = document.getElementById(href.slice(1))
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      {/* Language Toggle - Fixed position, starts after Black-Scholes widget ends */}
      {/* Black-Scholes: fixed top-20 left-4 w-80 → ends at 16px + 320px = 336px, so we start at left-[340px] */}
      <div className="fixed top-[45px] left-[340px] z-[60] hidden lg:flex items-center gap-3 pointer-events-auto">
        <LanguageToggle variant="prominent" />
        
        {/* Terminal & Shortcuts Hint - Transparent banner */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 2, duration: 0.5 }}
          className="flex items-center gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-sm border border-foreground/10 rounded-lg"
        >
          <div className="flex items-center gap-1.5 text-foreground/50 hover:text-cyan-400 transition-colors cursor-default">
            <Terminal size={14} weight="duotone" className="text-cyan-400/70" />
            <span className="text-[11px] font-mono">press</span>
            <kbd className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-[10px] font-mono text-cyan-400">
              `
            </kbd>
          </div>
          <div className="w-px h-3 bg-foreground/10" />
          <div className="flex items-center gap-1.5 text-foreground/50 hover:text-purple-400 transition-colors cursor-default">
            <Command size={14} weight="duotone" className="text-purple-400/70" />
            <span className="text-[11px] font-mono">press</span>
            <kbd className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] font-mono text-purple-400">
              ?
            </kbd>
          </div>
        </motion.div>
      </div>
      
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
        className={`fixed top-5 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-background/80 backdrop-blur-lg border-b border-border/50 shadow-lg"
            : "bg-transparent"
        }`}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between w-full">
            {/* Mobile Language Toggle - only visible on mobile/tablet */}
            <div className="lg:hidden">
              <LanguageToggle variant="prominent" />
            </div>
            
            {/* Spacer for desktop to push nav items to right */}
            <div className="hidden lg:block" />

            {/* Desktop Navigation - filter out mobile-only items */}
            <div className={`hidden md:flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {navItems.filter(item => !('isMobileOnly' in item && item.isMobileOnly)).map((item) => (
                'isRoute' in item && item.isRoute ? (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="px-4 py-2 rounded-md text-sm font-medium transition-all text-foreground/70 hover:text-foreground hover:bg-muted/50"
                  >
                    {t(item.label)}
                  </Link>
                ) : (
                  <button
                    key={item.href}
                    onClick={() => scrollToSection(item.href)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                      activeSection === item.href.slice(1)
                        ? "text-accent bg-accent/10"
                        : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {t(item.label)}
                  </button>
                )
              ))}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <List size={24} />}
            </Button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[72px] z-40 bg-background/95 backdrop-blur-lg border-b border-border/50 md:hidden"
          >
            <nav className="max-w-6xl mx-auto px-6 py-4">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  'isRoute' in item && item.isRoute ? (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`px-4 py-3 rounded-md text-sm font-medium transition-all text-foreground/70 hover:text-foreground hover:bg-muted/50 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {t(item.label)}
                    </Link>
                  ) : 'isMobileOnly' in item && item.isMobileOnly ? (
                    <button
                      key={item.href}
                      onClick={() => scrollToSection(item.href)}
                      className={`px-4 py-3 rounded-md text-sm font-bold transition-all ${isRTL ? 'text-right' : 'text-left'} bg-black border-2 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-950 hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]`}
                    >
                      {t(item.label)}
                    </button>
                  ) : (
                    <button
                      key={item.href}
                      onClick={() => scrollToSection(item.href)}
                      className={`px-4 py-3 rounded-md text-sm font-medium transition-all ${isRTL ? 'text-right' : 'text-left'} ${
                        activeSection === item.href.slice(1)
                          ? "text-accent bg-accent/10"
                          : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {t(item.label)}
                    </button>
                  )
                ))}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
