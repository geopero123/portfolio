import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { projects } from '../../data/projects'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import { ProjectCard } from './ProjectCard'
import './projects.css'

export function ProjectsSection() {
  const { t } = useTranslation()
  const reveal = useScrollReveal<HTMLDivElement>(0.1)

  return (
    <section className="section" id="work" aria-labelledby="work-title">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">{t('work.eyebrow')}</p>
          <h2 id="work-title">{t('work.title')}</h2>
          <p className="sub">{t('work.sub')}</p>
        </div>
        <div className="projects-grid reveal-stagger" ref={reveal}>
          {projects.map((project, index) => (
            <div key={project.slug} style={{ '--reveal-i': index } as CSSProperties}>
              <ProjectCard project={project} flavor={index} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
