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

const TIER_SETTINGS: Record<HeroTier, { segments: number; stars: number }> = {
  high: { segments: 120, stars: 900 },
  mid: { segments: 84, stars: 520 },
  low: { segments: 54, stars: 280 },
}

// Keep in sync with --accent in styles/tokens.css. Read as constants (not from
// getComputedStyle) so the value is correct regardless of effect ordering.
const ACCENT: Record<Theme, string> = {
  dark: '#f5b942',
  light: '#8a6200',
}

// A warmer ember tone that the aurora + terrain blend toward, kept in the gold
// family so the scene never fights the brand.
const EMBER: Record<Theme, string> = {
  dark: '#ff7a3c',
  light: '#b8722a',
}

// On paper the dark-gold wireframe reads heavier than gold-on-ink does, so the
// light theme runs everything at reduced opacity to keep the page text primary.
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

// Shared value-noise + fbm, used by every shader in the scene so the terrain,
// aurora and stars all breathe off the same underlying field.
const noiseGLSL = /* glsl */ `
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
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }
`

const terrainVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  varying float vHeight;
  varying float vDepth;
  varying float vEdge;

  ${noiseGLSL}

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
    vEdge = corridor;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const terrainFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEmber;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uScroll;
  varying float vHeight;
  varying float vDepth;
  varying float vEdge;

  void main() {
    float heightGlow = clamp(vHeight / 5.0, 0.0, 1.0);
    float fade = 1.0 - smoothstep(6.0, 30.0, vDepth);

    // A bright pulse of energy travels down the corridor, timed to depth so it
    // reads as a wave rushing toward the camera.
    float pulse = sin(vDepth * 0.6 - uTime * 2.2 - uScroll * 3.0);
    pulse = pow(max(pulse, 0.0), 6.0);

    vec3 base = mix(uColor * 0.4, uColor, heightGlow);
    // ridges toward the edge lean ember; the pulse flares to near-white
    base = mix(base, uEmber, vEdge * 0.5);
    base += pulse * 0.9;

    float alpha = fade * mix(0.16, 0.85, heightGlow) * uOpacity;
    alpha += pulse * fade * 0.5 * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(base, alpha);
  }
`

// A far, slow-moving nebula that lives behind the terrain. Pure fragment work
// on a single quad — effectively free — but it gives the void real depth.
const auroraVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const auroraFragment = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uEmber;
  varying vec2 vUv;

  ${noiseGLSL}

  void main() {
    vec2 uv = vUv;
    // two fbm layers drifting against each other = slow curling clouds
    vec2 p = uv * 3.0;
    p.y -= uScroll * 0.6;
    float t = uTime * 0.06;
    float f1 = fbm(p + vec2(t, t * 0.5));
    float f2 = fbm(p * 1.7 - vec2(t * 0.7, t));
    float clouds = smoothstep(0.2, 1.1, f1 * 0.65 + f2 * 0.55);

    // curtains of light that ripple horizontally
    float curtain = sin(uv.x * 9.0 + f1 * 6.0 - uTime * 0.5) * 0.5 + 0.5;
    curtain = pow(curtain, 3.0);

    // fade toward the top so text at the top of the page stays clean; brightest
    // low on the horizon
    float vertical = smoothstep(1.0, 0.15, uv.y);

    vec3 col = mix(uColor, uEmber, clouds);
    float glow = (clouds * 0.8 + curtain * 0.35) * vertical;
    gl_FragColor = vec4(col, glow * uOpacity);
  }
`

// GPU starfield: every star's drift + twinkle is computed in the vertex shader,
// so hundreds of them animate with zero per-frame CPU cost.
const starVertex = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aScale;
  varying float vTwinkle;

  void main() {
    vec3 p = position;
    float s = aSeed * 6.2831;
    // lazy drifting so the field feels alive without any obvious direction
    p.x += sin(uTime * 0.25 + s) * 0.6;
    p.y += cos(uTime * 0.2 + s * 1.3) * 0.4;
    // parallax: stars slide back as the page scrolls, deepening the tunnel
    p.z += uScroll * 6.0;
    p.z = mod(p.z + 20.0, 44.0) - 24.0;

    vTwinkle = 0.55 + 0.45 * sin(uTime * 1.6 + s * 3.0);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aScale * uPixelRatio * (140.0 / -mv.z);
  }
`

const starFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vTwinkle;

  void main() {
    // soft round sprite
    float d = length(gl_PointCoord - 0.5);
    float sprite = smoothstep(0.5, 0.0, d);
    sprite *= sprite;
    if (sprite < 0.01) discard;
    gl_FragColor = vec4(uColor, sprite * vTwinkle * uOpacity);
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
  animate,
}: {
  accent: string
  scroll: { current: { value: number } }
  animate: boolean
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const cores = useRef<(THREE.Mesh | null)[]>([])
  const color = useMemo(() => new THREE.Color(accent), [accent])

  useFrame((state) => {
    const progress = scroll.current.value
    const t = state.clock.elapsedTime
    WAYPOINTS.forEach((wp, i) => {
      const mesh = refs.current[i]
      if (!mesh) return
      // distance from the current scroll band, in [0,1] — 0 means "right here"
      const dist = Math.abs(progress - wp.band)
      // marker flies from far behind (+z) to close in front (-z) as you approach its band
      const z = 14 - dist * 46
      mesh.position.set(wp.x, wp.y + (animate ? Math.sin(t * 0.8 + i) * 0.18 : 0), z)
      const near = THREE.MathUtils.clamp(1 - dist * 7, 0, 1)
      const s = wp.scale * (0.6 + near * 0.8)
      mesh.scale.setScalar(s)
      mesh.rotation.x = t * 0.25 + i
      mesh.rotation.y = t * 0.18 + i * 1.7
      const material = mesh.material as THREE.MeshBasicMaterial
      material.opacity = near * 0.85

      // a solid inner core that pulses brighter as the marker nears
      const core = cores.current[i]
      if (core) {
        core.position.copy(mesh.position)
        core.rotation.copy(mesh.rotation)
        const cs = s * (0.32 + (animate ? Math.sin(t * 3 + i) * 0.05 : 0))
        core.scale.setScalar(cs)
        ;(core.material as THREE.MeshBasicMaterial).opacity = near * near * 0.9
      }
    })
  })

  return (
    <>
      {WAYPOINTS.map((wp, i) => (
        <group key={i}>
          <mesh ref={(el) => (refs.current[i] = el)} position={[wp.x, wp.y, 14]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0} />
          </mesh>
          <mesh ref={(el) => (cores.current[i] = el)} position={[wp.x, wp.y, 14]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}

function SceneContents({
  segments,
  stars,
  accent,
  ember,
  baseOpacity,
  animate,
}: {
  segments: number
  stars: number
  accent: string
  ember: string
  baseOpacity: number
  animate: boolean
}) {
  const { invalidate, gl } = useThree()
  const group = useRef<THREE.Group>(null)
  const scroll = useRef({ target: 0, value: 0 })

  const terrainUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColor: { value: new THREE.Color(accent) },
      uEmber: { value: new THREE.Color(ember) },
      uOpacity: { value: baseOpacity },
    }),
    // Uniform objects must survive re-renders; values are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const auroraUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uColor: { value: new THREE.Color(accent) },
      uEmber: { value: new THREE.Color(ember) },
      uOpacity: { value: baseOpacity * 0.5 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // shared reference used by the star layer's pixel ratio uniform
  const pixelRatio = useMemo(() => Math.min(gl.getPixelRatio(), 2), [gl])

  useEffect(() => {
    terrainUniforms.uColor.value.set(accent)
    terrainUniforms.uEmber.value.set(ember)
    auroraUniforms.uColor.value.set(accent)
    auroraUniforms.uEmber.value.set(ember)
    invalidate()
  }, [accent, ember, terrainUniforms, auroraUniforms, invalidate])

  // dev-only introspection hook (used by automated verification)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__sceneDebug = {
        uniforms: terrainUniforms,
        scroll: scroll.current,
      }
    }
  }, [terrainUniforms])

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

  useFrame((state, delta) => {
    const s = scroll.current
    s.value = animate ? THREE.MathUtils.damp(s.value, s.target, 3.5, delta) : s.target
    const progress = s.value
    const dim = dimFor(progress)

    if (animate) {
      const dt = Math.min(delta, 0.05)
      terrainUniforms.uTime.value += dt
      auroraUniforms.uTime.value += dt
    }
    terrainUniforms.uScroll.value = progress * 4.0
    terrainUniforms.uOpacity.value = baseOpacity * dim
    auroraUniforms.uScroll.value = progress
    auroraUniforms.uOpacity.value = baseOpacity * 0.5 * dim

    // camera flies a winding path as the page scrolls: rises, weaves left/right,
    // dollies in slightly, and banks into the turns — a real flythrough rather
    // than a static rig that only tips. A slow FOV breath adds subtle life.
    const weave = Math.sin(progress * Math.PI * 2.4)
    const breath = animate ? Math.sin(state.clock.elapsedTime * 0.4) * 0.6 : 0
    state.camera.position.y = 3.1 + progress * 1.6
    state.camera.position.x = weave * 1.4
    state.camera.position.z = 9 - progress * 2.2
    state.camera.rotation.x = -0.04 - progress * 0.1
    state.camera.rotation.z = -weave * 0.035
    const cam = state.camera as THREE.PerspectiveCamera
    cam.fov = 60 + breath
    cam.updateProjectionMatrix()

    // gentle pointer parallax on top of the scroll motion
    if (group.current && animate) {
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        state.pointer.x * 0.05,
        0.04,
      )
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x,
        -state.pointer.y * 0.025,
        0.04,
      )
    }
  })

  return (
    <group ref={group}>
      {/* far nebula backdrop */}
      <mesh position={[0, 4, -30]} scale={[1, 1, 1]}>
        <planeGeometry args={[90, 46]} />
        <shaderMaterial
          uniforms={auroraUniforms}
          vertexShader={auroraVertex}
          fragmentShader={auroraFragment}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.6, -4]}>
        <planeGeometry args={[44, 34, segments, Math.round(segments * 0.77)]} />
        <shaderMaterial
          uniforms={terrainUniforms}
          vertexShader={terrainVertex}
          fragmentShader={terrainFragment}
          wireframe
          transparent
          depthWrite={false}
        />
      </mesh>

      <StarfieldFrame
        uniforms={{ scroll, pixelRatio }}
        count={stars}
        accent={accent}
        baseOpacity={baseOpacity}
        animate={animate}
      />

      <WaypointMarkers accent={accent} scroll={scroll} animate={animate} />
      <ProjectPanels scroll={scroll} />
    </group>
  )
}

// Thin wrapper so the star layer can read the shared scroll ref each frame and
// feed it into its own shader uniforms.
function StarfieldFrame({
  uniforms,
  count,
  accent,
  baseOpacity,
  animate,
}: {
  uniforms: { scroll: { current: { value: number } }; pixelRatio: number }
  count: number
  accent: string
  baseOpacity: number
  animate: boolean
}) {
  const material = useRef<THREE.ShaderMaterial>(null)

  const { positions, seeds, scales } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const scales = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 46
      positions[i * 3 + 1] = Math.random() * 13 - 1
      positions[i * 3 + 2] = 8 - Math.random() * 40
      seeds[i] = Math.random()
      scales[i] = 0.6 + Math.random() * 2.4
    }
    return { positions, seeds, scales }
  }, [count])

  const starUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uPixelRatio: { value: uniforms.pixelRatio },
      uColor: { value: new THREE.Color(accent) },
      uOpacity: { value: baseOpacity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    starUniforms.uColor.value.set(accent)
  }, [accent, starUniforms])

  useFrame((_, delta) => {
    if (animate) starUniforms.uTime.value += Math.min(delta, 0.05)
    starUniforms.uScroll.value = uniforms.scroll.current.value
    starUniforms.uOpacity.value = baseOpacity * (0.5 + dimFor(uniforms.scroll.current.value) * 0.5)
  })

  return (
    <points position={[0, 0, -4]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        uniforms={starUniforms}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export default function ScrollScene({ tier, animate, theme }: ScrollSceneProps) {
  const { segments, stars } = TIER_SETTINGS[tier]

  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={animate ? 'always' : 'demand'}
      camera={{ position: [0, 3.1, 9], fov: 60, near: 0.1, far: 80 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <SceneContents
        segments={segments}
        stars={stars}
        accent={ACCENT[theme]}
        ember={EMBER[theme]}
        baseOpacity={BASE_OPACITY[theme]}
        animate={animate}
      />
    </Canvas>
  )
}
