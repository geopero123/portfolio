import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import type { Project } from '../../data/projects'

export function ProjectCard({ project, flavor }: { project: Project; flavor: number }) {
  const { t } = useTranslation()
  const viewerPath = `/work/${project.slug}`

  return (
    <article
      className="project-card"
      data-flavor={flavor % 3}
      style={{ '--card-accent': project.accent } as CSSProperties}
    >
      <Link className="card-cover" to={viewerPath} tabIndex={-1} aria-hidden="true">
        <span className="cover-tagline">{project.tagline}</span>
        <span className="cover-glyph">{project.glyph}</span>
        <span className="cover-name">{project.name}</span>
      </Link>
      <div className="card-body">
        <div className="card-title-row">
          <h3>
            <Link to={viewerPath}>{project.name}</Link>
          </h3>
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            {t('work.live')}
          </span>
        </div>
        <p className="card-desc">{t(`projects.${project.slug}.desc`)}</p>
        <ul className="card-tags">
          {project.tags.map((tag) => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>
        <div className="card-actions">
          <Link className="btn primary sm" to={viewerPath}>
            {t('work.open')}
          </Link>
          <a className="btn ghost sm" href={project.url} target="_blank" rel="noreferrer">
            {t('work.standalone')} ↗
          </a>
        </div>
      </div>
    </article>
  )
}
