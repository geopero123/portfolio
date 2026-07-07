import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as THREE from 'three'
import { projects } from '../../data/projects'

const SIDE_X = 6.2
const NEAR = 0.1
const MAX_PANELS = 5

function bandsFor(count: number): number[] {
  if (count <= 1) return [0.4]
  const start = 0.14
  const end = 0.86
  return Array.from({ length: count }, (_, i) => start + (i * (end - start)) / (count - 1))
}

/**
 * Real, clickable project cards living inside the WebGL scene. They fly in
 * from behind as the page scrolls past their band and become interactive
 * (pointer-events + tab focus) only once close — everywhere else they're
 * decorative duplicates of the real cards in the Work section below.
 */
export function ProjectPanels({ scroll }: { scroll: { current: { value: number } } }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const items = useMemo(() => projects.slice(0, MAX_PANELS), [])
  const bands = useMemo(() => bandsFor(items.length), [items.length])
  const groups = useRef<(THREE.Group | null)[]>([])
  const [active, setActive] = useState<boolean[]>(() => items.map(() => false))
  const activeRef = useRef(active)
  activeRef.current = active

  useFrame(() => {
    const progress = scroll.current.value
    let changed = false
    const next = activeRef.current.slice()
    bands.forEach((band, i) => {
      const group = groups.current[i]
      if (!group) return
      const dist = progress - band
      const side = i % 2 === 0 ? -1 : 1
      group.position.set(side * SIDE_X, 1.7 + Math.sin(band * 11) * 0.7, 15 - Math.abs(dist) * 62)
      group.rotation.y = side * -0.3
      const isNear = Math.abs(dist) < NEAR
      if (isNear !== next[i]) {
        next[i] = isNear
        changed = true
      }
    })
    if (changed) setActive(next)
  })

  if (items.length === 0) return null

  return (
    <>
      {items.map((project, i) => (
        <group key={project.slug} ref={(el) => (groups.current[i] = el)} position={[0, 0, 40]}>
          <Html transform occlude={false} zIndexRange={[10, 0]}>
            <div
              className={`hero-3d-panel${active[i] ? ' is-near' : ''}`}
              style={{ '--panel-accent': project.accent } as CSSProperties}
            >
              <span className="hero-3d-glyph" aria-hidden="true">
                {project.glyph}
              </span>
              <strong className="hero-3d-name">{project.name}</strong>
              <span className="hero-3d-tagline">{project.tagline}</span>
              {/* Plain <a>, not <Link>: drei's Html renders into a separate
                  React root with no Router context, so react-router's <Link>
                  would throw there. navigate() is a closure captured in the
                  outer (context-having) scope, so it's safe to call from here.
                  Mouse/touch shortcut only — a real, keyboard-reachable link
                  for this project lives in the Work section below, so this
                  stays out of tab order and hidden from assistive tech. */}
              <a
                className="hero-3d-open"
                href={`/work/${project.slug}`}
                tabIndex={-1}
                aria-hidden="true"
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/work/${project.slug}`)
                }}
              >
                {t('work.open')} ↗
              </a>
            </div>
          </Html>
        </group>
      ))}
    </>
  )
}
