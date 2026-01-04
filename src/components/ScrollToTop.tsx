import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUp } from "@phosphor-icons/react"

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      // Show button when user scrolls down 300px
      if (window.scrollY > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)
    return () => window.removeEventListener("scroll", toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    })
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.2 }}
          onClick={scrollToTop}
          className="fixed bottom-6 left-6 lg:bottom-20 z-50 p-3 rounded-full 
                     bg-[#0a0a0f] border-2 border-cyan-500/50 
                     text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]
                     hover:bg-cyan-950 hover:border-cyan-400 
                     hover:shadow-[0_0_25px_rgba(6,182,212,0.5)]
                     active:scale-95 transition-all duration-200
                     cursor-pointer"
          aria-label="Scroll to top"
        >
          <ArrowUp size={24} weight="bold" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
