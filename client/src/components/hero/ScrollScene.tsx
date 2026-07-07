import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { HeroTier } from './capability'
import type { Theme } from '../../theme/context'
import { ProjectPanels } from './ProjectPanels'

interface ScrollSceneProps {
  tier: HeroTier
  animate: boolean
  theme: Theme
}

const TIER_SETTINGS: Record<HeroTier, { segments: number; particles: number }> = {
  high: { segments: 110, particles: 320 },
  mid: { segments: 80, particles: 200 },
  low: { segments: 52, particles: 110 },
}

// Keep in sync with --accent in styles/tokens.css. Read as constants (not from
// getComputedStyle) so the value is correct regardless of effect ordering.
const ACCENT: Record<Theme, string> = {
  dark: '#f5b942',
  light: '#8a6200',
}

// On paper the dark-gold wireframe reads heavier than gold-on-ink does, so the
// light theme runs the terrain at reduced opacity to keep the page text primary.
const BASE_OPACITY: Record<Theme, number> = {
  dark: 1,
  light: 0.5,
}

/** How bright the scene is at a given scroll progress: full in the hero,
 *  dimmed while reading the middle sections, half-back near the footer. */
function dimFor(progress: number): number {
  if (progress < 0.1) return 1
  if (progress < 0.3) return 1 - ((progress - 0.1) / 0.2) * 0.72
  if (progress < 0.75) return 0.28
  return 0.28 + ((progress - 0.75) / 0.25) * 0.25
}

const terrainVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying float vHeight;
  varying float vDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  void main() {
    vec3 p = position;
    // uTime drifts the terrain on its own; uScroll flies over it as the page scrolls
    vec2 q = vec2(p.x * 0.16, p.y * 0.16 - uTime * 0.10 - uScroll);
    float h = noise(q) * 0.62 + noise(q * 2.1) * 0.26 + noise(q * 4.7) * 0.12;
    h = pow(h, 1.7);
    // Flat corridor down the middle, ridges rising toward the edges
    float corridor = smoothstep(0.10, 0.85, abs(p.x) / 20.0);
    p.z = h * mix(0.6, 7.0, corridor);
    vHeight = p.z;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const terrainFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vHeight;
  varying float vDepth;

  void main() {
    float heightGlow = clamp(vHeight / 5.0, 0.0, 1.0);
    float fade = 1.0 - smoothstep(6.0, 30.0, vDepth);
    vec3 color = mix(uColor * 0.45, uColor, heightGlow);
    float alpha = fade * mix(0.16, 0.85, heightGlow) * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`

// Waypoint markers roughly line up with page sections (hero, work, about,
// skills, contact) so the flythrough reads as passing each one, not just a
// generic drift. x alternates sides so the path feels like it winds.
const WAYPOINTS = [
  { band: 0.06, x: -5.5, y: 2.2, scale: 1.1 },
  { band: 0.28, x: 6, y: 3.4, scale: 0.85 },
  { band: 0.5, x: -6.5, y: 4.4, scale: 1.3 },
  { band: 0.72, x: 5.5, y: 3, scale: 0.9 },
  { band: 0.92, x: -4.5, y: 2.6, scale: 1.05 },
]

function WaypointMarkers({
  accent,
  scroll,
}: {
  accent: string
  scroll: { current: { value: number } }
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const color = useMemo(() => new THREE.Color(accent), [accent])

  useFrame((state) => {
    const progress = scroll.current.value
    WAYPOINTS.forEach((wp, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      // distance from the current scroll band, in [0,1] — 0 means "right here"
      const dist = Math.abs(progress - wp.band)
      // marker flies from far behind (+z) to close in front (-z) as you approach its band
      mesh.position.set(wp.x, wp.y, 14 - dist * 46)
      const near = THREE.MathUtils.clamp(1 - dist * 7, 0, 1)
      const s = wp.scale * (0.6 + near * 0.8)
      mesh.scale.setScalar(s)
      mesh.rotation.x = state.clock.elapsedTime * 0.25 + i
      mesh.rotation.y = state.clock.elapsedTime * 0.18 + i * 1.7
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = near * 0.85
    })
  })

  return (
    <>
      {WAYPOINTS.map((wp, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} position={[wp.x, wp.y, 14]}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0} />
        </mesh>
      ))}
    </>
  )
}

function SceneContents({
  segments,
  particles,
  accent,
  baseOpacity,
  animate,
}: {
  segments: number
  particles: number
  accent: string
  baseOpacity: number
  animate: boolean
}) {
  const { invalidate } = useThree()
  const group = useRef<THREE.Group>(null)
  const points = useRef<THREE.Points>(null)
  const scroll = useRef({ target: 0, value: 0 })

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColor: { value: new THREE.Color(accent) },
      uOpacity: { value: baseOpacity },
    }),
    // Uniform objects must survive re-renders; values are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    uniforms.uColor.value.set(accent)
    invalidate()
  }, [accent, uniforms, invalidate])

  // dev-only introspection hook (used by automated verification)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__sceneDebug = {
        uniforms,
        scroll: scroll.current,
      }
    }
  }, [uniforms])

  // Page scroll drives the flyover. Passive listener; in reduced-motion
  // (demand) mode each scroll event invalidates exactly one frame.
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      scroll.current.target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      invalidate()
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [invalidate])

  const dustPositions = useMemo(() => {
    const array = new Float32Array(particles * 3)
    for (let i = 0; i < particles; i++) {
      array[i * 3] = (Math.random() - 0.5) * 40
      array[i * 3 + 1] = Math.random() * 9 + 0.2
      array[i * 3 + 2] = 6 - Math.random() * 26
    }
    return array
  }, [particles])

  useFrame((state, delta) => {
    const s = scroll.current
    s.value = animate ? THREE.MathUtils.damp(s.value, s.target, 3.5, delta) : s.target
    const progress = s.value

    if (animate) {
      uniforms.uTime.value += Math.min(delta, 0.05)
    }
    uniforms.uScroll.value = progress * 4.0
    uniforms.uOpacity.value = baseOpacity * dimFor(progress)

    // camera flies a winding path as the page scrolls: rises, weaves left/right,
    // dollies in slightly, and banks into the turns — a real flythrough rather
    // than a static rig that only tips.
    const weave = Math.sin(progress * Math.PI * 2.4)
    state.camera.position.y = 3.1 + progress * 1.6
    state.camera.position.x = weave * 1.4
    state.camera.position.z = 9 - progress * 2.2
    state.camera.rotation.x = -0.04 - progress * 0.1
    state.camera.rotation.z = -weave * 0.035

    if (points.current) {
      points.current.rotation.y = progress * 0.6 + (animate ? state.clock.elapsedTime * 0.016 : 0)
      points.current.position.y = animate ? Math.sin(state.clock.elapsedTime * 0.25) * 0.35 : 0
    }

    // gentle pointer parallax on top of the scroll motion
    if (group.current && animate) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        state.pointer.x * 0.05,
        0.04,
      )
    }
  })

  return (
    <group ref={group}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, -4]}>
        <planeGeometry args={[44, 34, segments, Math.round(segments * 0.77)]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={terrainVertex}
          fragmentShader={terrainFragment}
          wireframe
          transparent
          depthWrite={false}
        />
      </mesh>
      <points ref={points} position={[0, 0, -4]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={accent}
          size={0.055}
          sizeAttenuation
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </points>
      <WaypointMarkers accent={accent} scroll={scroll} />
      <ProjectPanels scroll={scroll} />
    </group>
  )
}

export default function ScrollScene({ tier, animate, theme }: ScrollSceneProps) {
  const { segments, particles } = TIER_SETTINGS[tier]

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={animate ? 'always' : 'demand'}
      camera={{ position: [0, 3.1, 9], fov: 60, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <SceneContents
        segments={segments}
        particles={particles}
        accent={ACCENT[theme]}
        baseOpacity={BASE_OPACITY[theme]}
        animate={animate}
      />
    </Canvas>
  )
}
