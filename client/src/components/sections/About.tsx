import { useTranslation } from 'react-i18next'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import './sections.css'

const FACTS = ['factLocation', 'factFocus', 'factStack'] as const

export function About() {
  const { t } = useTranslation()
  const reveal = useScrollReveal<HTMLDivElement>()

  return (
    <section className="section" id="about" aria-labelledby="about-title">
      <div className="wrap about-grid reveal-3d" ref={reveal}>
        <div className="section-head">
          <p className="eyebrow">{t('about.eyebrow')}</p>
          <h2 id="about-title">{t('about.title')}</h2>
          <p className="about-p">{t('about.p1')}</p>
          <p className="about-p">{t('about.p2')}</p>
        </div>
        <dl className="about-facts">
          {FACTS.map((fact) => (
            <div className="fact" key={fact}>
              <dt>{t(`about.${fact}`)}</dt>
              <dd>{t(`about.${fact}Value`)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
