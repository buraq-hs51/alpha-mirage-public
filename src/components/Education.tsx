import { Card } from "@/components/ui/card"
import { GraduationCap } from "@phosphor-icons/react"
import { motion } from "framer-motion"
import { useTranslation } from "@/i18n"

interface Education {
  degree: string
  field: string
  institution: string
  location?: string
  period: string
  status: "completed" | "ongoing"
  coursework: string[]
}

const education: Education[] = [
  {
    degree: "Master of Science",
    field: "Financial Engineering",
    institution: "WorldQuant University",
    location: "Online",
    period: "Aug 2024 - Present",
    status: "ongoing",
    coursework: [
      "Financial Markets",
      "Financial Data",
      "Financial Econometrics",
      "Derivative Pricing",
      "Stochastic Modeling",
      "Machine Learning in Finance"
    ]
  },
  {
    degree: "Master of Technology",
    field: "Software Engineering",
    institution: "Birla Institute of Technology and Science, Pilani, India",
    location: "Online",
    period: "Aug 2022 - Jul 2024",
    status: "completed",
    coursework: []
      //"Advanced Algorithms & Data Structures",
      //"Software Architecture & Design Patterns",
      //"Distributed Systems & Cloud Computing",
      //"Machine Learning & AI",
      //"Database Systems & Optimization",
      //"Agile Software Development"
    //]
  },
  {
    degree: "Bachelor of Technology",
    field: "Chemical Engineering",
    institution: "National Institute of Technology, India",
    location: "India",
    period: "Jun 2017 - Apr 2021",
    status: "completed",
    coursework: []
  }
]

export function Education() {
  const { t, isRTL } = useTranslation()
  
  return (
    <section id="education" className="py-24 px-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap size={32} className="text-accent" weight="duotone" />
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">{t("Education")}</h2>
          </div>
          <p className="text-lg text-muted-foreground">
            {t("MS Financial Engineering candidate with interdisciplinary background in software and chemical engineering")}
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {education.map((edu, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, duration: 0.6 }}
            >
              <Card className="h-full p-8 border-border/50 bg-card/50 backdrop-blur hover:border-accent/30 transition-all duration-300 relative overflow-hidden">
                {edu.status === "ongoing" && (
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 text-xs font-medium uppercase tracking-wide bg-gold/20 text-gold border border-gold/30 rounded-full glow-gold">
                      {t("In Progress")}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-semibold mb-2">{t(edu.degree)}</h3>
                  <p className="text-xl text-accent mb-3">{t(edu.field)}</p>
                  <p className="text-muted-foreground mb-1">{t(edu.institution)}</p>
                  {edu.location && (
                    <p className="text-sm text-muted-foreground/80 mb-1">{t(edu.location)}</p>
                  )}
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">{edu.period}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-3">
                    {t("Relevant Coursework")}
                  </h4>
                  <ul className="space-y-2">
                    {edu.coursework.map((course, i) => (
                      <li key={i} className="flex gap-2 text-card-foreground/80 leading-relaxed">
                        <span className="text-accent mt-1.5 shrink-0">▸</span>
                        <span>{t(course)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}