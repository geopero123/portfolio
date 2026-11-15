/**
 * Header behaviour. The header persists across page transitions, so this runs once
 * and re-syncs on `astro:page-load`.
 */
export function initNavigation() {
  const found = document.querySelector<HTMLElement>('[data-header]');
  if (!found || found.dataset.ready) return;
  const header: HTMLElement = found;
  header.dataset.ready = '1';

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const toggle = header.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = header.querySelector<HTMLElement>('#mobile-menu');
  const navLinks = [...header.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
  const indicator = header.querySelector<HTMLElement>('[data-nav-indicator]');
  const progress = header.querySelector<HTMLElement>('[data-scroll-progress]');
  const wordmark = header.querySelector<HTMLElement>('[data-wordmark]');
  const main = () => document.querySelector<HTMLElement>('main');
  const footer = () => document.querySelector<HTMLElement>('footer');
  let sections: HTMLElement[] = [];
  let menuOpen = false;

  header.classList.add('is-fixed');

  // ── Mobile menu ────────────────────────────────────────────────
  function closeMenu(returnFocus = false) {
    if (!menu || !toggle) return;
    menu.hidden = true;
    menuOpen = false;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open menu');
    document.body.classList.remove('menu-open');
    main()?.removeAttribute('inert');
    footer()?.removeAttribute('inert');
    if (returnFocus) toggle.focus();
  }
  toggle?.addEventListener('click', () => {
    if (!menu) return;
    if (menuOpen) { closeMenu(true); return; }
    menu.hidden = false;
    menuOpen = true;
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Close menu');
    document.body.classList.add('menu-open');
    main()?.setAttribute('inert', '');
    footer()?.setAttribute('inert', '');
    menu.querySelector<HTMLAnchorElement>('a')?.focus();
  });
  header.addEventListener('click', event => {
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href*="#"]');
    if (!link || !menuOpen) return;
    closeMenu();
    const hash = link.hash;
    if (link.pathname === location.pathname && hash) {
      const target = document.querySelector<HTMLElement>(hash);
      if (target) { target.tabIndex = -1; target.focus({preventScroll:true}); }
    }
  });
  header.addEventListener('keydown', event => {
    if (!menuOpen) return;
    if (event.key === 'Escape') { closeMenu(true); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...header.querySelectorAll<HTMLElement>('a, button')].filter(el => el.getClientRects().length > 0);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  matchMedia('(max-width: 760px)').addEventListener('change', () => closeMenu());
  addEventListener('hashchange', () => { if (menuOpen) closeMenu(); });
  document.addEventListener('astro:before-swap', () => closeMenu());

  // ── Active state + sliding indicator ───────────────────────────
  let indicatorReady = false;
  function moveIndicator(target: HTMLAnchorElement | undefined) {
    if (!indicator) return;
    if (!target) { indicator.style.opacity = '0'; return; }
    const navBox = indicator.parentElement!.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    indicator.style.opacity = '1';
    indicator.style.setProperty('--x', `${box.left - navBox.left + box.width / 2}px`);
    // The first placement snaps; later ones glide.
    if (!indicatorReady) { indicator.style.transition = 'none'; requestAnimationFrame(() => indicator.style.removeProperty('transition')); indicatorReady = true; }
  }
  function setActive(id: string | undefined, kind: 'location' | 'page' = 'location') {
    let target: HTMLAnchorElement | undefined;
    navLinks.forEach(link => {
      const on = link.dataset.nav === id;
      if (on) { link.setAttribute('aria-current', kind); target = link; } else link.removeAttribute('aria-current');
    });
    moveIndicator(target);
  }

  let frame = 0;
  function update() {
    frame = 0;
    const y = scrollY;
    header.classList.toggle('is-scrolled', y > 24);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--p', String(max > 0 ? Math.min(1, y / max) : 0));
    }
    if (location.pathname !== '/') return;
    let active = 'home';
    const line = Math.min(innerHeight * .36, 260);
    for (const section of sections) if (section.getBoundingClientRect().top <= line) active = section.id;
    if (y + innerHeight >= document.documentElement.scrollHeight - 12) active = 'contact';
    // Sections without a nav entry (about teaser, stack) keep the previous item lit.
    if (!navLinks.some(l => l.dataset.nav === active)) active = active === 'stack' || active === 'about' ? 'projects' : active;
    setActive(active);
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', schedule, {passive:true});
  addEventListener('resize', schedule, {passive:true});

  function syncPage() {
    const path = location.pathname;
    sections = path === '/' ? navLinks.map(l => document.getElementById(l.dataset.nav!)).filter((el): el is HTMLElement => !!el) : [];
    if (path === '/') update();
    else {
      header.classList.toggle('is-scrolled', scrollY > 24);
      const match = navLinks.find(l => l.dataset.navPage !== '/' && path.startsWith(l.dataset.navPage!));
      setActive(match?.dataset.nav ?? (path.startsWith('/projects') ? 'projects' : undefined), 'page');
    }
  }
  document.addEventListener('astro:page-load', syncPage);
  document.addEventListener('astro:after-swap', () => { indicatorReady = false; });
  syncPage();

  // ── Wordmark: the dot wanders toward the cursor, then settles ───
  if (wordmark && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const dot = wordmark.querySelector<HTMLElement>('.brand-dot');
    wordmark.addEventListener('pointermove', e => {
      if (reducedMotion.matches || !dot) return;
      const r = wordmark.getBoundingClientRect();
      dot.style.transform = `translate(${((e.clientX - r.left) / r.width - .9) * 6}px, ${((e.clientY - r.top) / r.height - .5) * 5}px)`;
    });
    wordmark.addEventListener('pointerleave', () => dot?.style.removeProperty('transform'));
  }

  document.querySelectorAll<HTMLElement>('[data-enhancement]').forEach(el => el.hidden = false);
}
