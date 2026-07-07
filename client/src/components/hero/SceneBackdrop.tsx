import { lazy, Suspense } from 'react'
import { useTheme } from '../../theme/context'
import { SceneBoundary } from './SceneBoundary'
import type { HeroCapability } from './capability'

// three.js and @react-three/fiber live in this chunk only — devices that get
// the CSS fallback never download them.
const ScrollScene = lazy(() => import('./ScrollScene'))

/** Fixed, full-viewport, scroll-driven WebGL backdrop behind the home page. */
export function SceneBackdrop({ capability }: { capability: HeroCapability }) {
  const { theme } = useTheme()

  return (
    <div className="scene-backdrop" aria-hidden="true">
      <SceneBoundary>
        <Suspense fallback={null}>
          <ScrollScene tier={capability.tier} animate={capability.animate} theme={theme} />
        </Suspense>
      </SceneBoundary>
    </div>
  )
}
