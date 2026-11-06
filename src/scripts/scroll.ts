/**
 * Smooth scrolling with Lenis - the same approach as gamo.ge. The native scrollbar, keyboard
 * and touch scrolling all stay native; only wheel input is eased. Off under reduced motion.
 * Lenis drives window scroll, so IntersectionObserver, sticky elements and CSS scroll-driven
 * animations keep working unchanged.
 */
import Lenis from 'lenis';

let lenis: Lenis | null = null;

export function initSmoothScroll() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  if (lenis) { lenis.resize(); return; }
  if (reduced.matches || !fine.matches) return;

  lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false, autoRaf: true, anchors: false });

  // In-page anchors ease to their target instead of jumping; the header offset mirrors scroll-padding-top.
  document.addEventListener('click', event => {
    if (!lenis || event.defaultPrevented) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="#"]');
    if (!link || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.pathname !== location.pathname || !url.hash || url.hash === '#') return;
    const target = document.querySelector<HTMLElement>(url.hash);
    if (!target) return;
    event.preventDefault();
    history.pushState(null, '', url.hash);
    const offset = -parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    lenis.scrollTo(target, { offset, duration: 1.1 });
    target.tabIndex = -1; target.focus({ preventScroll: true });
  });

  // The router swaps <main>; the page height changes, so Lenis must re-measure.
  document.addEventListener('astro:after-swap', () => lenis?.resize());
  reduced.addEventListener('change', () => { if (reduced.matches && lenis) { lenis.destroy(); lenis = null; } });
}
