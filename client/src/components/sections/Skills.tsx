import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useScrollReveal } from '../../hooks/useScrollReveal'
import './sections.css'

// Tool names are proper nouns — only the group labels are translated.
const GROUPS = [
  { key: 'core', items: ['TypeScript', 'JavaScript', 'React', 'HTML & CSS', 'Vite'] },
  { key: 'graphics', items: ['Canvas 2D', 'Three.js / WebGL', 'gif.js', 'MediaRecorder', 'SVG'] },
  { key: 'backend', items: ['Node.js', 'Express', 'REST APIs', 'Git', 'npm workspaces'] },
] as const

export function Skills() {
  const { t } = useTranslation()
  const reveal = useScrollReveal<HTMLDivElement>()

  return (
    <section className="section skills" id="skills" aria-labelledby="skills-title">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">{t('skills.eyebrow')}</p>
          <h2 id="skills-title">{t('skills.title')}</h2>
        </div>
        <div className="skills-groups reveal-stagger" ref={reveal}>
          {GROUPS.map((group, i) => (
            <div
              className="skills-group"
              key={group.key}
              style={{ '--reveal-i': i } as CSSProperties}
            >
              <h3>{t(`skills.${group.key}`)}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item} className="chip">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
