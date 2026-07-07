import { Trans, useTranslation } from 'react-i18next'
import { projects } from '../../data/projects'
import { HeroFallback } from './HeroFallback'
import './hero.css'

export function Hero({ showFallback }: { showFallback: boolean }) {
  const { t } = useTranslation()

  return (
    <section className="hero" id="top">
      {showFallback && (
        <div className="hero-backdrop" aria-hidden="true">
          <HeroFallback />
        </div>
      )}

      <div className="wrap hero-inner">
        <p className="eyebrow">{t('hero.eyebrow')}</p>
        <h1 className="hero-title">
          <Trans i18nKey="hero.title" components={{ em: <em /> }} />
        </h1>
        <p className="hero-sub">{t('hero.sub')}</p>
        <div className="hero-cta">
          <a className="btn primary" href="#work">
            {t('hero.ctaWork')}
          </a>
          <a className="btn ghost" href="#contact">
            {t('hero.ctaContact')}
          </a>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <b>{projects.length}</b>
            <span>{t('hero.statTools')}</span>
          </div>
          <div className="stat">
            <b>100%</b>
            <span>{t('hero.statClient')}</span>
          </div>
          <div className="stat">
            <b>2</b>
            <span>{t('hero.statLang')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
