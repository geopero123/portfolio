import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '../components/layout/Header'
import { Footer } from '../components/layout/Footer'
import { Hero } from '../components/hero/Hero'
import { SceneBackdrop } from '../components/hero/SceneBackdrop'
import { heroCapability } from '../components/hero/capability'
import { ProjectsSection } from '../components/projects/ProjectsSection'
import { About } from '../components/sections/About'
import { Skills } from '../components/sections/Skills'
import { Contact } from '../components/sections/Contact'
import { site } from '../data/site'

export function Home() {
  const { t } = useTranslation()
  const [capability] = useState(heroCapability)

  useEffect(() => {
    document.title = site.title
  }, [])

  return (
    <>
      {capability.mode === 'scene' && <SceneBackdrop capability={capability} />}
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <Header />
      <main id="main">
        <Hero showFallback={capability.mode === 'fallback'} />
        <ProjectsSection />
        <About />
        <Skills />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
