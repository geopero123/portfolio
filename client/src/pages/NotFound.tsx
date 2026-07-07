import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { site } from '../data/site'
import './viewer.css'

export function NotFound() {
  const { t } = useTranslation()

  useEffect(() => {
    document.title = `404 — ${site.name}`
  }, [])

  return (
    <div className="viewer-missing">
      <p className="eyebrow">404</p>
      <h1>{t('notFound.title')}</h1>
      <Link className="btn primary" to="/">
        {t('notFound.back')}
      </Link>
    </div>
  )
}
