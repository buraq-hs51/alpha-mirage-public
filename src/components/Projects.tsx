import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Code, ChartLine, Brain, Database, GithubLogo, ChartBar } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useState } from "react"
import { HestonVisualization } from "@/components/visualizations/HestonVisualization"
import { RegimeVisualization } from "@/components/visualizations/RegimeVisualization"
import { VolatilitySurfaceVisualization } from "@/components/visualizations/VolatilitySurfaceVisualization"
import { AlphaSignalsVisualization } from "@/components/visualizations/AlphaSignalsVisualization"
import { MLPerformanceVisualization } from "@/components/visualizations/MLPerformanceVisualization"
import { useTranslation } from "@/i18n"

interface Project {
  id: string
  title: string
  description: string
  details: string[]
  technologies: string[]
  category: "quant" | "ml" | "data"
  icon: typeof Code
  githubUrl: string
  visualization?: React.ComponentType
}

const projects: Project[] = [
  {
    id: "heston",
    title: "Heston Option Pricing Engine",
    description: "Advanced options pricing engine implementing the Heston stochastic volatility model for European options",
    details: [
      "Implemented Heston model with mean-reverting volatility process",
      "Built Monte Carlo simulation engine for option valuation",
      "Calculated option Greeks (Delta, Gamma, Vega) for risk management",
      "Compared results against Black-Scholes benchmark pricing"
    ],
    technologies: ["Python", "NumPy", "SciPy", "Pandas", "Matplotlib"],
    category: "quant",
    icon: ChartLine,
    githubUrl: "https://github.com/buraq-hs51/heston-option-pricing-engine",
    visualization: HestonVisualization
  },
  {
    id: "regime",
    title: "Regime-Based Asset Allocation",
    description: "Dynamic portfolio allocation strategy using Hidden Markov Models to identify market regime shifts",
    details: [
      "Implemented HMM for market regime detection (Bull/Bear/Sideways)",
      "Developed regime-dependent asset allocation strategies",
      "Backtested strategy performance across multiple market cycles",
      "Analyzed risk-adjusted returns and drawdown metrics"
    ],
    technologies: ["Python", "Pandas", "NumPy", "hmmlearn", "yfinance"],
    category: "quant",
    icon: ChartLine,
    githubUrl: "https://github.com/buraq-hs51/regime-allocation-strategy",
    visualization: RegimeVisualization
  },
  {
    id: "dl-trading",
    title: "Deep Learning Trading Signals",
    description: "LSTM neural network for predicting intraday price movements using TensorFlow and technical indicators",
    details: [
      "Built LSTM models with TensorFlow for time series forecasting",
      "Engineered features from market microstructure data and order flow",
      "Implemented attention mechanisms for multi-horizon predictions",
      "Backtested signals with transaction costs and slippage modeling"
    ],
    technologies: ["TensorFlow", "Python", "Keras", "Pandas", "NumPy"],
    category: "ml",
    icon: Brain,
    githubUrl: "https://github.com/buraq-hs51/deep-learning-trading-signals",
    visualization: MLPerformanceVisualization
  },
  {
    id: "nlp-sentiment",
    title: "Financial News Sentiment Analysis",
    description: "NLP pipeline for extracting market sentiment from financial news and social media for trading signals",
    details: [
      "Built NLP pipeline using transformers for sentiment classification",
      "Processed real-time news feeds and social media data streams",
      "Correlated sentiment scores with asset price movements",
      "Developed sentiment-based trading signals with risk controls"
    ],
    technologies: ["Python", "TensorFlow", "Hugging Face", "NLTK", "spaCy"],
    category: "ml",
    icon: Brain,
    githubUrl: "https://github.com/buraq-hs51/financial-sentiment-nlp"
  },
  {
    id: "data-pipeline",
    title: "High-Throughput Market Data Pipeline",
    description: "Distributed data engineering pipeline processing 200TB+ daily market data using Spark and Kafka",
    details: [
      "Architected Spark ETL pipelines on AWS EMR for tick data processing",
      "Built real-time Kafka streaming layer for market data aggregation",
      "Optimized data lake storage with partitioning and compression",
      "Reduced processing time by 60% through distributed compute optimization"
    ],
    technologies: ["Apache Spark", "Kafka", "AWS EMR", "Python", "Parquet"],
    category: "data",
    icon: Database,
    githubUrl: "https://github.com/buraq-hs51/market-data-pipeline"
  },
  {
    id: "fx-volatility",
    title: "FX Volatility Surface Analysis",
    description: "Construction and analysis of implied volatility surfaces for foreign exchange options",
    details: [
      "Built volatility surface from FX option market data",
      "Implemented smile interpolation and extrapolation methods",
      "Analyzed volatility term structure and skew patterns",
      "Visualized 3D volatility surfaces across strikes and maturities"
    ],
    technologies: ["Python", "Pandas", "NumPy", "Matplotlib", "SciPy"],
    category: "quant",
    icon: ChartLine,
    githubUrl: "https://github.com/buraq-hs51/FX-Volatility-Project",
    visualization: VolatilitySurfaceVisualization
  },
  {
    id: "alpha-signals",
    title: "Alpha Signal Regression Analysis",
    description: "Statistical analysis of alpha factors using regression techniques to identify predictive signals",
    details: [
      "Developed multiple alpha factors from market microstructure data",
      "Applied regression analysis to test factor significance",
      "Performed feature selection and multicollinearity analysis",
      "Evaluated factor performance and predictive power"
    ],
    technologies: ["Python", "Pandas", "NumPy", "scikit-learn", "statsmodels"],
    category: "quant",
    icon: ChartLine,
    githubUrl: "https://github.com/buraq-hs51/alpha-signals-regression",
    visualization: AlphaSignalsVisualization
  },
  {
    id: "ml-api",
    title: "ML Microservice API",
    description: "Production-ready microservice architecture for deploying machine learning models via REST API",
    details: [
      "Built containerized ML inference service with FastAPI",
      "Implemented model versioning and A/B testing framework",
      "Added monitoring, logging, and error handling",
      "Deployed with Docker and orchestrated scaling strategies"
    ],
    technologies: ["Python", "FastAPI", "Docker", "scikit-learn", "Redis"],
    category: "ml",
    icon: Brain,
    githubUrl: "https://github.com/buraq-hs51/ML-Microservice-API"
  }
]

const categories = [
  { id: "all", label: "All Projects" },
  { id: "quant", label: "Quantitative Finance" },
  { id: "ml", label: "Machine Learning" },
  { id: "data", label: "Data Engineering" }
]

export function Projects() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const { t, isRTL } = useTranslation()

  const filteredProjects = selectedCategory === "all"
    ? projects
    : projects.filter(p => p.category === selectedCategory)

  return (
    <section id="projects" className="py-24 px-6 bg-secondary/30" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <Code size={32} className="text-accent" weight="duotone" />
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">{t("Projects")}</h2>
          </div>
          <p className="text-lg text-muted-foreground mb-8">
            {t("Quantitative finance, machine learning, and data engineering projects demonstrating end-to-end technical capabilities")}
          </p>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  selectedCategory === cat.id
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-foreground/70 hover:bg-muted"
                }`}
              >
                {t(cat.label)}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {filteredProjects.map((project, index) => {
            const IconComponent = project.icon
            const VisualizationComponent = project.visualization
            const isExpanded = expandedProject === project.id
            
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
              >
                <Card className="h-full p-6 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300 group flex flex-col">
                  <div className="mb-4">
                    <IconComponent size={40} className="text-accent mb-4 group-hover:scale-110 transition-transform" weight="duotone" />
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition-colors">
                      {t(project.title)}
                    </h3>
                    <p className="text-muted-foreground mb-4">{t(project.description)}</p>
                  </div>

                  <ul className="space-y-2 mb-6 flex-grow">
                    {project.details.map((detail, i) => (
                      <li key={i} className="flex gap-2 text-sm text-card-foreground/80 leading-relaxed">
                        <span className="text-accent mt-1 shrink-0 text-xs">•</span>
                        <span>{t(detail)}</span>
                      </li>
                    ))}
                  </ul>

                  {VisualizationComponent && (
                    <div className="mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                        className="w-full text-accent hover:text-accent hover:bg-accent/10 mb-3"
                      >
                        <ChartBar className="mr-2" weight="duotone" />
                        {isExpanded ? t('Hide Visualization') : t('Show Results Visualization')}
                      </Button>
                      
                      <motion.div
                        initial={false}
                        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ overflow: 'hidden' }}
                      >
                        {isExpanded && <VisualizationComponent />}
                      </motion.div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.map((tech, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-xs border-accent/30 text-foreground/70"
                        >
                          {tech}
                        </Badge>
                      ))}
                    </div>
                    
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="w-full border-accent/50 text-accent hover:bg-accent/10"
                    >
                      <a 
                        href={project.githubUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <GithubLogo className="mr-2" weight="fill" />
                        {t("View on GitHub")}
                      </a>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}