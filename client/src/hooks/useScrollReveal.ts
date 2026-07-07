import { useEffect, useRef } from 'react'

/**
 * Attaches an IntersectionObserver to the returned ref and toggles
 * `.is-in` once the element crosses into view. Combined with the
 * `.reveal-3d` CSS class this drives the perspective/translateZ entrance.
 * Fires once — content stays revealed after its first appearance.
 */
export function useScrollReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.add('is-in')
          observer.unobserve(node)
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}
