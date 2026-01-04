import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, TrendUp, Rocket } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/i18n"

export function About() {
  const { t, isRTL } = useTranslation()
  
  // Core strengths - just use plain English, will be auto-translated
  const strengths = [
    "Distributed Systems & Microservices",
    "Low-Latency Systems (C++/Go)",
    "Big Data Pipelines (Spark, Kafka)",
    "Machine Learning & Deep Learning",
    "NLP & TensorFlow",
    "Quantitative Trading Systems",
    "Derivatives Pricing",
    "Real-Time Analytics"
  ]
  
  // Target roles
  const roles = [
    "Quantitative Developer",
    "Trading Systems Engineer",
    "Derivatives Pricing Developer",
    "Quantitative Analyst",
    "Market Data Engineer"
  ]
  
  return (
    <section id="about" className="py-24 px-6 bg-secondary/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <User size={32} className="text-accent" weight="duotone" />
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">{t("About Me")}</h2>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="lg:col-span-2"
          >
            <Card className="h-full p-8 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300">
              <h3 className="text-2xl font-semibold mb-6 text-accent">{t("Professional Summary")}</h3>
              
              <div className="space-y-4 text-card-foreground/90 leading-relaxed">
                <p>
                  {t("I'm a multidisciplinary technologist with 4.5 years of experience spanning software engineering, data engineering, machine learning, and quantitative finance. My expertise bridges distributed systems architecture, high-throughput data pipelines, deep learning models, and quantitative trading systems—building production infrastructure that powers data-driven financial decisions.")}
                </p>

                <p>
                  <strong className="text-foreground">{t("Software Engineering:")}</strong> {t("Built microservices using MCP frameworks, architected distributed systems with event-driven architectures, and developed C++ market data feeds processing 50K+ ticks/second with sub-5ms latency. Designed Go-based order management systems with real-time Black-Scholes Greeks computation, leveraging concurrent programming patterns and lock-free data structures.")}
                </p>

                <p>
                  <strong className="text-foreground">{t("Data Engineering & Big Data:")}</strong> {t("Engineered high-throughput data pipelines processing 200TB+ daily using Spark and AWS EMR, optimized distributed ETL workflows supporting 100M+ transactions, and built real-time streaming architectures with Kafka. Reduced infrastructure costs by 25% while improving system reliability and data processing efficiency.")}
                </p>

                <p>
                  <strong className="text-foreground">{t("Machine Learning:")}</strong> {t("Developed deep learning models using TensorFlow for time series prediction and classification tasks, implemented NLP pipelines for text analysis and sentiment modeling, and applied machine learning techniques to financial markets—building predictive models for trading signals, regime detection, and risk assessment.")}
                </p>

                <p>
                  {t("Currently pursuing MS Financial Engineering at WorldQuant University, I'm integrating my software engineering, data engineering, and ML expertise with rigorous quantitative finance theory—derivatives pricing, stochastic modeling, and portfolio optimization. This unique combination positions me to build the next generation of quantitative trading infrastructure that leverages modern ML/data engineering practices.")}
                </p>

                <p className="pt-2">
                  {t("I'm seeking quantitative developer roles where I can apply my comprehensive skill set in algorithmic trading systems, quantitative research platforms, or ML-driven trading infrastructure. Open to relocation globally for the right opportunity.")}
                </p>
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="space-y-6"
          >
            <Card className="p-6 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300">
              <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <TrendUp size={24} className="text-accent" weight="duotone" />
                <h3 className="text-lg font-semibold">{t("Core Strengths")}</h3>
              </div>
              <ul className="space-y-3">
                {strengths.map((strength, i) => (
                  <li key={i} className={`flex items-center gap-2 text-card-foreground/80 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-accent">▸</span>
                    <span>{t(strength)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300">
              <div className={`flex items-center gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Rocket size={24} className="text-accent" weight="duotone" />
                <h3 className="text-lg font-semibold">{t("Target Roles")}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {roles.map((role, i) => (
                  <Badge
                    key={i}
                    className="bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors"
                  >
                    {t(role)}
                  </Badge>
                ))}
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
