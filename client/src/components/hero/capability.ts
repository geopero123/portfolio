export type HeroTier = 'high' | 'mid' | 'low'

export interface HeroCapability {
  /** 'scene' renders the WebGL terrain; 'fallback' the pure-CSS grid. */
  mode: 'scene' | 'fallback'
  tier: HeroTier
  /** false = render a single static frame (reduced motion). */
  animate: boolean
}

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    // release the probe context right away — browsers cap live WebGL contexts
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

/**
 * Decides once, at mount, how much hero the device gets.
 * Small screens and low-memory devices skip WebGL entirely (the three.js
 * chunk is never even downloaded); reduced-motion users get a frozen frame.
 */
export function heroCapability(): HeroCapability {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const smallScreen = window.matchMedia('(max-width: 639px)').matches
  const nav = navigator as Navigator & { deviceMemory?: number }
  const lowMemory = (nav.deviceMemory ?? 8) <= 2

  if (smallScreen || lowMemory || !webglAvailable()) {
    return { mode: 'fallback', tier: 'low', animate: false }
  }

  const cores = navigator.hardwareConcurrency ?? 4
  const tier: HeroTier = cores >= 8 ? 'high' : cores >= 4 ? 'mid' : 'low'
  return { mode: 'scene', tier, animate: !reducedMotion }
}
