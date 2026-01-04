import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Cpu, Code, Database, ChartLine, Brain } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/i18n"

interface SkillCategory {
  title: string
  icon: typeof Code
  skills: string[]
}

const skillCategories: SkillCategory[] = [
  {
    title: "Software Engineering & Systems",
    icon: Code,
    skills: ["C++", "Go", "Python", "SQL", "Microservices (MCP)", "Distributed Systems", "Event-Driven Architecture", "Lock-Free Queues", "UDP Multicast", "Concurrency", "Thread Safety"]
  },
  {
    title: "Data Engineering & Big Data",
    icon: Database,
    skills: [
      "Python (PySpark, Pandas)",
      "SQL (PostgreSQL, Redshift)",
      "Apache Spark",
      "Kafka Streaming",
      "High-Throughput Pipelines (200TB+)",
      "AWS (ECS, EMR, Redshift)",
      "ETL/ELT Workflows",
      "Real-Time Data Processing",
      "Data Lake Architecture",
      "Redis",
      "QuestDB"
    ]
  },
  {
    title: "Machine Learning & AI",
    icon: Brain,
    skills: [
      "Python (TensorFlow, scikit-learn)",
      "Deep Learning Models",
      "NLP (Natural Language Processing)",
      "Time Series Forecasting",
      "Feature Engineering",
      "Model Deployment",
      "ML in Finance",
      "Predictive Modeling",
      "PyTorch"
    ]
  },
  {
    title: "Quantitative Finance",
    icon: ChartLine,
    skills: [
      "Python (NumPy, QuantLib)",
      "Derivatives Pricing",
      "Black-Scholes & Greeks",
      "Stochastic Volatility Models",
      "Statistical Arbitrage",
      "Cointegration Testing",
      "Monte Carlo Simulation",
      "Time Series Analysis",
      "Risk Management",
      "Portfolio Optimization",
      "Backtesting Frameworks"
    ]
  }
]

export function Skills() {
  const { t, isRTL } = useTranslation()
  
  return (
    <section id="skills" className="py-24 px-6 bg-secondary/30" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <Cpu size={32} className="text-accent" weight="duotone" />
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">{t("Technical Skills")}</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            {t("Comprehensive expertise spanning software engineering, data engineering, machine learning, and quantitative finance—optimized for building production-grade trading systems")}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {skillCategories.map((category, index) => {
            const IconComponent = category.icon
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
              >
                <Card className="p-6 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <IconComponent size={28} className="text-accent" weight="duotone" />
                    <h3 className="text-xl font-semibold">{t(category.title)}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {category.skills.map((skill, i) => (
                      <Badge
                        key={i}
                        variant="secondary"
                        className="bg-muted/50 text-foreground/80 border border-border/30 hover:border-accent/50 hover:text-accent transition-all cursor-default"
                      >
                        {t(skill)}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-8"
        >
          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur">
            <h3 className="text-lg font-semibold mb-4">{t("Additional Expertise")}</h3>
            <div className="flex flex-wrap gap-2">
              {[
                "Order Management Systems",
                "Market Data Feeds",
                "Real-Time OHLCV Aggregation",
                "WebSocket",
                "FIX Protocol",
                "Kubernetes",
                "Docker",
                "Terraform",
                "Prometheus",
                "Grafana",
                "Financial Modeling",
                "Algorithmic Trading",
                "Market Microstructure",
                "Quantitative Research",
                "Performance Optimization",
                "System Design"
              ].map((skill, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="border-accent/30 text-foreground/70"
                >
                  {t(skill)}
                </Badge>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}