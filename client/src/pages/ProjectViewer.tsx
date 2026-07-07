import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CSSProperties } from 'react'
import { findProject } from '../data/projects'
import { site } from '../data/site'
import './viewer.css'

export function ProjectViewer() {
  const { slug } = useParams()
  const { t } = useTranslation()
  const project = findProject(slug)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    document.title = project ? `${project.name} — ${site.name}` : `404 — ${site.name}`
  }, [project])

  // reset the loading veil when navigating between projects
  useEffect(() => {
    setLoaded(false)
  }, [slug])

  if (!project) {
    return (
      <div className="viewer-missing">
        <p className="eyebrow">404</p>
        <h1>{t('viewer.notFound')}</h1>
        <p className="viewer-missing-hint">{t('viewer.notFoundHint')}</p>
        <Link className="btn primary" to="/">
          {t('viewer.backHome')}
        </Link>
      </div>
    )
  }

  return (
    <div className="viewer" style={{ '--card-accent': project.accent } as CSSProperties}>
      <header className="viewer-bar">
        <Link className="btn ghost sm" to="/">
          ← {t('viewer.back')}
        </Link>
        <div className="viewer-id">
          <span className="viewer-glyph" aria-hidden="true">
            {project.glyph}
          </span>
          <div className="viewer-name">
            <h1>{project.name}</h1>
            <p>{project.tagline}</p>
          </div>
        </div>
        <ul className="viewer-tags">
          {project.tags.map((tag) => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>
        <a className="btn primary sm" href={project.url} target="_blank" rel="noreferrer">
          {t('viewer.standalone')} ↗
        </a>
      </header>
      <div className="viewer-stage">
        {!loaded && <p className="viewer-loading">{t('viewer.loading')}</p>}
        <iframe
          key={project.slug}
          title={project.title}
          src={project.url}
          onLoad={() => setLoaded(true)}
        />
      </div>
    </div>
  )
}
