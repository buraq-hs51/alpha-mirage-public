import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Code, ChartLineUp, Database, Brain } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/i18n"

interface ExperienceItem {
  title: string
  period: string
  achievements: string[]
  technologies: string[]
}

const experiences: ExperienceItem[] = []

export function Experience() {
  const { t, isRTL } = useTranslation()
  
  return (
    <section id="experience" className="py-24 px-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <Briefcase size={32} className="text-accent" weight="duotone" />
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">{t("Experience")}</h2>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl mb-8">
            {t("4.5 years building production systems across software engineering, data engineering, machine learning, and quantitative finance—delivering measurable impact through distributed microservices, high-throughput data pipelines, deep learning models, and ultra-low-latency trading systems")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mb-12"
        >
          <Card className="p-8 border-accent/30 bg-gradient-to-br from-accent/5 to-card/50 backdrop-blur">
            <h3 className="text-2xl font-semibold mb-6 text-accent">{t("Career Impact Summary")}</h3>
            <p className="text-card-foreground/90 leading-relaxed mb-6">
              {t("Throughout my 4.5-year career spanning software engineering, data engineering, machine learning, and quantitative finance, I've built production systems that bridge modern distributed architectures, scalable data infrastructure, ML-driven intelligence, and computational finance:")}
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Code size={28} className="text-accent" weight="duotone" />
                  <h4 className="font-semibold text-base">{t("Software Engineering")}</h4>
                </div>
                <p className="text-card-foreground/80 text-sm leading-relaxed">
                  {t("Architected microservices with MCP frameworks, built distributed systems with event-driven architectures, and engineered C++ market data feeds (sub-5ms latency) processing 50K+ ticks/second with concurrent programming and lock-free queues.")}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Database size={28} className="text-accent" weight="duotone" />
                  <h4 className="font-semibold text-base">{t("Data Engineering")}</h4>
                </div>
                <p className="text-card-foreground/80 text-sm leading-relaxed">
                  {t("Built high-throughput pipelines processing 200TB+ daily using Spark and AWS EMR, architected real-time streaming with Kafka, optimized ETL workflows supporting 100M+ transactions, and reduced infrastructure costs by 25%.")}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Brain size={28} className="text-accent" weight="duotone" />
                  <h4 className="font-semibold text-base">{t("Machine Learning")}</h4>
                </div>
                <p className="text-card-foreground/80 text-sm leading-relaxed">
                  {t("Developed deep learning models with TensorFlow for time series prediction, implemented NLP pipelines for text analysis, and applied ML to finance—building predictive models for trading signals and regime detection.")}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ChartLineUp size={28} className="text-accent" weight="duotone" />
                  <h4 className="font-semibold text-base">{t("Quantitative Finance")}</h4>
                </div>
                <p className="text-card-foreground/80 text-sm leading-relaxed">
                  {t("Built order management systems with real-time Greeks computation, developed statistical arbitrage engines with cointegration testing, and created backtesting frameworks processing concurrent strategy evaluations.")}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border/30">
              <p className="text-card-foreground/80 text-sm leading-relaxed">
                <strong className="text-foreground">{t("Key Achievement:")}</strong> {t("Reduced critical infrastructure recovery time by 87% (from 2+ hours to under 15 minutes) through automated Terraform-based cluster provisioning—minimizing downtime impact on data pipelines and trading operations. My work consistently focuses on building production-ready, fault-tolerant systems that integrate software engineering best practices, scalable data architectures, ML capabilities, and quantitative rigor.")}
              </p>
            </div>
          </Card>
        </motion.div>

        <div className="space-y-8">
          {experiences.map((exp, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.6 }}
            >
              <Card className="p-8 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold mb-2 text-accent">{exp.title}</h3>
                  </div>
                  <div className="mt-4 md:mt-0">
                    <span className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                      {exp.period}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-6">
                  {exp.achievements.map((achievement, i) => (
                    <li key={i} className="flex gap-3 text-card-foreground/90 leading-relaxed">
                      <span className="text-accent mt-1.5 shrink-0">▸</span>
                      <span>{achievement}</span>
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-2">
                  {exp.technologies.map((tech, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="bg-muted/50 text-foreground/80 border border-border/30 hover:border-accent/50 transition-colors"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}