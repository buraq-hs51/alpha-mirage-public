import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EnvelopeSimple, LinkedinLogo, GithubLogo, FileText, Code } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/i18n"

export function Contact() {
  const { t, isRTL } = useTranslation()
  
  return (
    <section id="contact" className="py-24 px-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            {t("Let's Connect")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("Actively seeking quantitative developer roles globally. Open to opportunities in derivatives pricing, trading systems engineering, and quantitative research. Willing to relocate for the right opportunity.")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Card className="p-8 border-border/50 bg-card/50 backdrop-blur">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <h3 className="text-xl font-semibold mb-4">{t("Contact Information")}</h3>
                
                {/* Email - show address since it's professional */}
                <a
                  href="mailto:shadaab.ah17@gmail.com"
                  className="flex items-center gap-3 text-card-foreground/80 hover:text-accent transition-colors group"
                >
                  <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent/20 group-hover:scale-110 transition-all duration-300">
                    <EnvelopeSimple size={28} className="text-accent" weight="duotone" />
                  </div>
                  <span className="font-medium">shadaab.ah17@gmail.com</span>
                </a>

                {/* Social Icons Row */}
                <div className="flex items-center gap-5 pt-4">
                  <a
                    href="https://www.linkedin.com/in/shadaabah"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                    title="LinkedIn"
                  >
                    <div className="p-4 bg-[#0077B5]/10 rounded-xl hover:bg-[#0077B5]/25 hover:scale-110 hover:shadow-[0_0_25px_rgba(0,119,181,0.4)] transition-all duration-300 cursor-pointer">
                      <LinkedinLogo size={32} className="text-[#0077B5] group-hover:drop-shadow-[0_0_8px_rgba(0,119,181,0.8)]" weight="fill" />
                    </div>
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      LinkedIn
                    </span>
                  </a>

                  <a
                    href="https://github.com/buraq-hs51"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                    title="GitHub"
                  >
                    <div className="p-4 bg-accent/10 rounded-xl hover:bg-accent/25 hover:scale-110 hover:shadow-[0_0_25px_oklch(0.75_0.18_190_/_0.4)] transition-all duration-300 cursor-pointer">
                      <GithubLogo size={32} className="text-accent group-hover:drop-shadow-[0_0_8px_oklch(0.75_0.18_190)]" weight="fill" />
                    </div>
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      GitHub
                    </span>
                  </a>

                  <a
                    href="https://leetcode.com/u/ShAh-25/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                    title="LeetCode"
                  >
                    <div className="p-4 bg-[#FFA116]/10 rounded-xl hover:bg-[#FFA116]/25 hover:scale-110 hover:shadow-[0_0_25px_rgba(255,161,22,0.4)] transition-all duration-300 cursor-pointer">
                      <Code size={32} className="text-[#FFA116] group-hover:drop-shadow-[0_0_8px_rgba(255,161,22,0.8)]" weight="bold" />
                    </div>
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      LeetCode
                    </span>
                  </a>

                  <a
                    href="https://www.kickresume.com/cv/4W3LxK/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative"
                    title="Resume"
                  >
                    <div className="p-4 bg-green-500/10 rounded-xl hover:bg-green-500/25 hover:scale-110 hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transition-all duration-300 cursor-pointer">
                      <FileText size={32} className="text-green-500 group-hover:drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]" weight="duotone" />
                    </div>
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      Resume
                    </span>
                  </a>
                </div>
              </div>

              <div className="flex flex-col justify-center space-y-4">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-[0_0_30px_oklch(0.75_0.18_190_/_0.5)] transition-all duration-300"
                >
                  <a href="https://www.kickresume.com/cv/4W3LxK/" target="_blank" rel="noopener noreferrer">
                    <FileText className="mr-2" weight="duotone" />
                    {t("View Resume")}
                  </a>
                </Button>
                
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full border-accent/50 text-accent hover:bg-accent/10"
                >
                  <a href="mailto:shadaab.ah17@gmail.com">
                    <EnvelopeSimple className="mr-2" />
                    {t("Send Email")}
                  </a>
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex flex-wrap items-center justify-center gap-6 p-6 rounded-lg bg-muted/30 backdrop-blur">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("Current Status")}</p>
              <p className="font-medium text-accent">{t("Actively Seeking Opportunities")}</p>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block"></div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("Location")}</p>
              <p className="font-medium">{t("Open to Global Relocation")}</p>
            </div>
            <div className="h-8 w-px bg-border hidden sm:block"></div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("Availability")}</p>
              <p className="font-medium">{t("Immediate / Flexible")}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}