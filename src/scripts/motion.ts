import { initCursorSwarm } from './swarm';

/**
 * Motion system. Elements declare *what they are* with `data-m`, and CSS decides
 * how that kind of thing enters. This file only observes, measures and sets variables:
 *
 *   data-m="mask | clip | draw | slide | scale | stagger | count"   entrance, via IntersectionObserver → `.in`
 *                                                                   (count markup is server-rendered by SectionIndex.astro)
 *   data-depth                                                      pointer depth: sets --mx/--my on the container
 *   data-magnetic                                                   buttons drift toward the pointer
 *   data-velocity                                                   headings skew with scroll velocity (--vel)
 *
 * Hidden states only apply under `html.js`, so a failed script leaves everything visible.
 * Everything is idempotent per element (`data-motion-ready`) because pages are swapped by the router.
 */
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const cleanups: Array<() => void> = [];

export function initMotion() {
  cleanups.splice(0).forEach(fn => fn());
  document.documentElement.classList.add('js');
  // Controls that need scripts ship hidden; each page swap brings new ones (the footer, for one).
  document.querySelectorAll<HTMLElement>('[data-enhancement]').forEach(el => el.hidden = false);
  entrances();
  depth();
  magnetic();
  velocity();
  story();
  cursor();
  heroType();
  footerArrival();
  devGrid();
  console.info('%cmadebygio.%c press . for the grid', 'font-weight:700', 'color:#888');
}

// ── Entrances ───────────────────────────────────────────────────
function entrances() {
  const targets = [...document.querySelectorAll<HTMLElement>('[data-m]:not([data-motion-ready])')];
  targets.forEach(el => el.dataset.motionReady = '1');
  if (reduced.matches || !('IntersectionObserver' in window)) { targets.forEach(el => el.classList.add('in')); return; }
  // Anything already on screen at load enters immediately; the hero handles its own choreography.
  // Threshold 0: hidden states are nearly zero-area (1px slivers), so any visible pixel counts.
  const pending = new Set(targets);
  const show = (el: HTMLElement) => { el.classList.add('in'); pending.delete(el); io.unobserve(el); };
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) show(e.target as HTMLElement);
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  targets.forEach(el => io.observe(el));
  // Anchor jumps and fast scrolls can pass an element without it ever intersecting; anything
  // now above the viewport has been "seen" and should simply be visible when scrolled back to.
  let frame = 0;
  const sweep = () => {
    frame = 0;
    for (const el of pending) if (el.getBoundingClientRect().bottom < 0) show(el);
  };
  const onScroll = () => { if (!frame && pending.size) frame = requestAnimationFrame(sweep); };
  addEventListener('scroll', onScroll, { passive: true });
  const onChange = () => { if (reduced.matches) { io.disconnect(); targets.forEach(el => el.classList.add('in')); } };
  reduced.addEventListener('change', onChange);
  cleanups.push(() => { io.disconnect(); removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); reduced.removeEventListener('change', onChange); });
}

// Section numbers (`data-m="count"`) are rendered as odometers at build time by
// SectionIndex.astro; they only need the `.in` class from `entrances()` to roll.

// ── Pointer depth for layered previews (mobile uses scroll-driven CSS instead) ──
function depth() {
  if (!fine.matches) return;
  document.querySelectorAll<HTMLElement>('[data-depth]:not([data-depth-ready])').forEach(el => {
    el.dataset.depthReady = '1';
    let frame = 0, mx = 0, my = 0;
    const move = (e: PointerEvent) => {
      if (reduced.matches) return;
      const r = el.getBoundingClientRect();
      mx = (e.clientX - r.left) / r.width - .5; my = (e.clientY - r.top) / r.height - .5;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; el.style.setProperty('--mx', mx.toFixed(3)); el.style.setProperty('--my', my.toFixed(3)); });
    };
    const leave = () => { cancelAnimationFrame(frame); frame = 0; el.style.setProperty('--mx', '0'); el.style.setProperty('--my', '0'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    cleanups.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); });
  });
}

// ── Magnetic controls: the button drifts a little, the arrow inside drifts more ──
function magnetic() {
  if (!fine.matches) return;
  document.querySelectorAll<HTMLElement>('[data-magnetic]:not([data-magnetic-ready])').forEach(el => {
    el.dataset.magneticReady = '1';
    const icon = el.querySelector<HTMLElement>('svg');
    let frame = 0, x = 0, y = 0;
    const move = (e: PointerEvent) => {
      if (reduced.matches) return;
      const r = el.getBoundingClientRect();
      x = (e.clientX - r.left) / r.width - .5; y = (e.clientY - r.top) / r.height - .5;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.transform = `translate(${x * 8}px, ${y * 8}px)`;
        if (icon) icon.style.transform = `translate(${x * 6}px, ${y * 6}px)`;
      });
    };
    const leave = () => { cancelAnimationFrame(frame); frame = 0; el.style.removeProperty('transform'); icon?.style.removeProperty('transform'); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
    cleanups.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); leave(); });
  });
}

// ── Scroll velocity → a faint skew on large headings. Felt, not seen. ──
function velocity() {
  const els = [...document.querySelectorAll<HTMLElement>('[data-velocity]')];
  if (!els.length || reduced.matches || !fine.matches) return;
  let last = scrollY, vel = 0, frame = 0, idle = 0;
  const tick = () => {
    frame = 0;
    vel *= .82;
    const v = Math.max(-1, Math.min(1, vel / 60));
    els.forEach(el => el.style.setProperty('--vel', Math.abs(v) < .01 ? '0' : v.toFixed(3)));
    if (Math.abs(v) >= .01) frame = requestAnimationFrame(tick);
  };
  const onScroll = () => {
    const y = scrollY; vel += (y - last) * .5; last = y;
    clearTimeout(idle); if (!frame) frame = requestAnimationFrame(tick);
  };
  addEventListener('scroll', onScroll, {passive:true});
  cleanups.push(() => { removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); els.forEach(el => el.style.removeProperty('--vel')); });
}

// ── Pinned story: the frame stays while chapters scroll; the chapter nearest the
//    viewport centre owns the screen. Progress is measured, not animated by JS. ──
function story() {
  document.querySelectorAll<HTMLElement>('[data-story]:not([data-story-ready])').forEach(root => {
    root.dataset.storyReady = '1';
    const chapters = [...root.querySelectorAll<HTMLElement>('[data-chapter]')];
    const screens = [...root.querySelectorAll<HTMLElement>('[data-screen]')];
    const n = root.querySelector<HTMLElement>('[data-story-n]');
    const label = root.querySelector<HTMLElement>('[data-story-label]');
    const progress = root.querySelector<HTMLElement>('.story-progress');
    let active = 0;
    const go = (i: number) => {
      if (i === active) return;
      const prev = active; active = i;
      chapters.forEach((c, k) => c.classList.toggle('is-active', k === i));
      screens.forEach((s, k) => {
        s.classList.toggle('is-active', k === i);
        s.classList.toggle('is-prev', k === prev);
        s.toggleAttribute('aria-hidden', k !== i);
      });
      if (label) label.textContent = chapters[i].dataset.caption ?? '';
      if (n) {
        n.classList.add('is-rolling');
        setTimeout(() => { n.textContent = String(i + 1).padStart(2, '0'); n.classList.remove('is-rolling'); }, reduced.matches ? 0 : 180);
      }
    };
    if ('IntersectionObserver' in window) {
      // A band in the upper-middle of the viewport decides which chapter is "current" - that is
      // where the pinned frame sits, so the live chapter lines up with it.
      const io = new IntersectionObserver(entries => {
        for (const e of entries) if (e.isIntersecting) go(Number((e.target as HTMLElement).dataset.chapter));
      }, { rootMargin: '-28% 0px -52% 0px', threshold: 0 });
      chapters.forEach(c => io.observe(c));
      cleanups.push(() => io.disconnect());
    }
    // Progress line: fraction of the story scrolled past the viewport centre.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = root.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = Math.min(1, Math.max(0, (innerHeight * .5 - r.top) / Math.max(1, r.height - innerHeight * .4)));
      progress?.style.setProperty('--sp', p.toFixed(3));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    addEventListener('scroll', onScroll, { passive: true });
    measure();
    cleanups.push(() => { removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); });
  });
}

// Each route gets fresh build jobs; the canvas persists across page swaps.
function cursor() {
  cleanups.push(initCursorSwarm());
}

// ── Hero headline: weight follows the pointer across the line ──
function heroType() {
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const line = hero?.querySelector<HTMLElement>('[data-weight]');
  if (!hero || !line || !fine.matches) return;
  let frame = 0, t = .5;
  const move = (e: PointerEvent) => {
    if (reduced.matches) return;
    const r = line.getBoundingClientRect();
    t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; line.style.setProperty('--wght', String(Math.round(430 + t * 170))); });
  };
  const leave = () => { cancelAnimationFrame(frame); frame = 0; line.style.removeProperty('--wght'); };
  hero.addEventListener('pointermove', move); hero.addEventListener('pointerleave', leave);
  cleanups.push(() => { hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', leave); leave(); });
}

// ── Footer: the wordmark's dot lights up once you've actually reached the end ──
function footerArrival() {
  const footer = document.querySelector<HTMLElement>('footer');
  if (!footer || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(([e]) => footer.classList.toggle('is-arrived', e.isIntersecting), { threshold: .6 });
  io.observe(footer);
  cleanups.push(() => io.disconnect());
}

// ── Developer easter egg: "." toggles a layout grid overlay ──
let gridBound = false;
function devGrid() {
  if (gridBound) return; gridBound = true;
  addEventListener('keydown', e => {
    if (e.key !== '.' || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    const grid = document.querySelector<HTMLElement>('[data-dev-grid]');
    if (grid) grid.hidden = !grid.hidden;
  });
}
