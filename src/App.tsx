import { HashRouter, Routes, Route } from "react-router-dom"
import { Navigation } from "@/components/Navigation"
import { Hero } from "@/components/Hero"
import { About } from "@/components/About"
import { Experience } from "@/components/Experience"
import { Projects } from "@/components/Projects"
import { Education } from "@/components/Education"
import { Skills } from "@/components/Skills"
import { Contact } from "@/components/Contact"
import { Toaster } from "@/components/ui/sonner"
import InteractiveEffects from "@/components/InteractiveEffects"
import TradingLab from "@/components/TradingLab"
import MLQuantDashboard from "@/components/MLQuantDashboard"
import { GeoRouter } from "@/components/GeoRouter"
import { LanguageNotification } from "@/components/LanguageNotification"
import { SystemHealthMonitor } from "@/components/SystemHealthMonitor"
import { TerminalEasterEgg } from "@/components/TerminalEasterEgg"
import { KeyboardShortcutsProvider } from "@/components/KeyboardShortcuts"
import { FeatureDiscoveryHints, ShortcutIndicator } from "@/components/FeatureDiscoveryHints"
import { MobileWidgetsSection } from "@/components/MobileWidgetsSection"
import { ScrollToTop } from "@/components/ScrollToTop"

// Home Page Component
function HomePage() {
  return (
    <div className="min-h-screen cursor-none">
      {/* Background Interactive Effects */}
      <InteractiveEffects />
      
      {/* Language Auto-Detection Notification */}
      <LanguageNotification />
      
      {/* Feature Discovery Hints (Typewriter notifications) */}
      <FeatureDiscoveryHints />
      
      {/* Always-visible shortcut indicator at bottom-left */}
      <ShortcutIndicator />
      
      {/* System Health Monitor (Trading System Style) */}
      <SystemHealthMonitor />
      
      {/* Terminal Easter Egg (Press ` to open) */}
      <TerminalEasterEgg />
      
      {/* Main Content */}
      <div className="relative">
        <Navigation />
        <Hero />
        
        {/* Mobile Widgets Section - Only visible on mobile, before About */}
        <MobileWidgetsSection />
        
        <About />
        <Experience />
        <Projects />
        <Skills />
        <Education />
        <Contact />
        
        <footer className="py-8 px-6 border-t border-border/30 bg-secondary/20">
          <div className="max-w-6xl mx-auto text-center">
            <p className="text-sm text-muted-foreground mb-2">
              © {new Date().getFullYear()} Shadaab Ahmed. Quantitative Developer & Financial Engineer.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Built with React, TypeScript & Tailwind CSS
            </p>
          </div>
        </footer>
      </div>

      {/* Scroll to Top Button - visible on both mobile and desktop */}
      <ScrollToTop />

      <Toaster />
    </div>
  )
}

function App() {
  return (
    <KeyboardShortcutsProvider>
      <GeoRouter>
        <HashRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lab" element={<TradingLab />} />
            <Route path="/alpha-engine" element={<MLQuantDashboard />} />
          </Routes>
        </HashRouter>
      </GeoRouter>
    </KeyboardShortcutsProvider>
  )
}

export default App