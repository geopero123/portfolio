/** The wire paths are static. Interaction moves the composited sculpture layers. */
export function initSculpture() {
  const study = document.querySelector<HTMLElement>('[data-shape-study]');
  const stage = study?.querySelector<HTMLElement>('[data-shape-stage]');
  const model = stage?.querySelector<HTMLElement>('[data-sculpture]');
  if (!study || !stage || !model || study.dataset.ready) return;
  study.dataset.ready = '1';
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const layers = [...model.querySelectorAll<HTMLElement | SVGElement>('[data-shape-layer]')];
  const buttons = [...study.querySelectorAll<HTMLButtonElement>('[data-shape]')];
  const inspect = study.querySelector<HTMLButtonElement>('[data-inspect]');
  let frame = 0;
  let visible = true;
  let manual: number | undefined;
  let active = 0;
  let pointerX = 0;
  let pointerY = 0;

  function blend(position: number) {
    layers.forEach((layer, index) => {
      const opacity = Math.max(0, 1 - Math.abs(position - index));
      layer.style.setProperty('--shape-opacity', opacity.toFixed(3));
    });
    const index = Math.round(position);
    if (index === active) return;
    active = index;
    const button = buttons[index];
    model!.dataset.activeShape = button.dataset.shape;
    model!.setAttribute('aria-label', `Orange wire sculpture: ${button.querySelector('span')?.textContent}`);
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  }

  function draw() {
    frame = 0;
    if (!visible || document.hidden || reduced.matches) return;
    const { top, height } = stage!.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -top / (height * .85)));
    blend(manual ?? progress * (layers.length - 1));
    const tilt = Math.max(-.5, Math.min(.5, (top + height / 2) / innerHeight - .5));
    const x = fine.matches ? pointerX : tilt;
    const y = fine.matches ? pointerY : tilt;
    model!.style.setProperty('--shape-yaw', `${(x * 34).toFixed(2)}deg`);
    model!.style.setProperty('--shape-pitch', `${(y * -26).toFixed(2)}deg`);
    study!.style.setProperty('--light-x', `${(x * 26).toFixed(1)}px`);
    study!.style.setProperty('--light-y', `${(y * 26).toFixed(1)}px`);
  }

  function schedule() {
    if (!frame && visible && !reduced.matches) frame = requestAnimationFrame(draw);
  }
  stage.addEventListener('pointermove', event => {
    if (!fine.matches || reduced.matches) return;
    const rect = stage.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - .5;
    pointerY = (event.clientY - rect.top) / rect.height - .5;
    schedule();
  });
  stage.addEventListener('pointerleave', () => {
    pointerX = pointerY = 0;
    schedule();
  });
  addEventListener('scroll', schedule, { passive: true, signal });
  addEventListener('resize', schedule, { passive: true, signal });
  buttons.forEach((button, index) => button.addEventListener('click', () => {
    manual = index;
    blend(index);
  }));
  inspect?.addEventListener('click', () => {
    const inspecting = study.classList.toggle('is-inspecting');
    inspect.setAttribute('aria-pressed', String(inspecting));
    inspect.setAttribute('aria-label', inspecting ? 'Hide construction guides' : 'Show construction guides');
  });
  reduced.addEventListener('change', () => {
    if (!reduced.matches) { schedule(); return; }
    blend(manual ?? 0);
    model.style.removeProperty('--shape-pitch');
    model.style.removeProperty('--shape-yaw');
    study.style.removeProperty('--light-x');
    study.style.removeProperty('--light-y');
  }, { signal });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    observer.observe(stage);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  }
  document.addEventListener('visibilitychange', schedule, { signal });
  document.addEventListener('astro:before-swap', () => {
    lifetime.abort();
    cancelAnimationFrame(frame);
  }, { once: true });
}
