import { useTranslation } from 'react-i18next'
import './layout.css'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="site-footer">
      <div className="wrap footer-row">
        <p className="footer-note">{t('footer.note')}</p>
        <p className="footer-meta">
          <span>{t('footer.rights', { year: new Date().getFullYear() })}</span>
          <span aria-hidden="true"> · </span>
          <span>{t('footer.built')}</span>
        </p>
      </div>
    </footer>
  )
}
