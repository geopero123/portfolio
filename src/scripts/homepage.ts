import { shapePath } from '../lib/sculpture';

/** The hero sculpture responds to pointer movement, touch scrolling and its controls. */
export function initSculpture() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const study = document.querySelector<HTMLElement>('[data-shape-study]');
  const stage = study?.querySelector<HTMLElement>('[data-shape-stage]');
  if (!study || !stage || study.dataset.ready) return;
  study.dataset.ready = '1';
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const paths = [...study.querySelectorAll<SVGPathElement>('[data-ring]')];
  const buttons = [...study.querySelectorAll<HTMLButtonElement>('[data-shape]')];
  const inspect = study.querySelector<HTMLButtonElement>('[data-inspect]');
  const title = study.querySelector('title');
  let frame = 0, visible = true, lastTime = 0;
  const current = {morph:0,pitch:0,yaw:0};
  const target = {...current};

  function draw() {
    paths.forEach((path,i) => path.setAttribute('d', shapePath(i,current.morph,current.pitch,current.yaw)));
  }
  function animate(time: number) {
    frame = 0;
    if (!visible || document.hidden) return;
    const delta = Math.min(time-lastTime || 16.7,40); lastTime = time;
    const easing = reduced.matches ? 1 : 1-Math.exp(-delta/95);
    let unsettled = false;
    for (const key of ['morph','pitch','yaw'] as const) {
      const difference = target[key]-current[key];
      current[key] = Math.abs(difference) < .001 ? target[key] : current[key]+difference*easing;
      unsettled ||= Math.abs(difference) >= .001;
    }
    draw();
    if (unsettled && !reduced.matches) frame = requestAnimationFrame(animate);
  }
  function schedule() {
    if (!frame && visible && !document.hidden) { lastTime = 0; frame = requestAnimationFrame(animate); }
  }
  stage.addEventListener('pointermove', event => {
    if (reduced.matches || !fine.matches) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX-rect.left)/rect.width-.5, y = (event.clientY-rect.top)/rect.height-.5;
    target.pitch = y*.42; target.yaw = x*.65;
    study.style.setProperty('--light-x', `${x*26}px`);
    study.style.setProperty('--light-y', `${y*26}px`);
    schedule();
  });
  stage.addEventListener('pointerleave', () => {
    if (!fine.matches) return;
    target.pitch = 0;
    target.yaw = 0;
    schedule();
  });
  addEventListener('scroll', () => {
    if (!visible || fine.matches || reduced.matches) return;
    const { top, height } = stage.getBoundingClientRect();
    const center = top + height / 2;
    const tilt = Math.max(-.5, Math.min(.5, center / innerHeight - .5));
    target.pitch = tilt * .42;
    target.yaw = tilt * .65;
    schedule();
  }, { passive: true, signal });
  buttons.forEach(button => button.addEventListener('click', () => {
    target.morph = Number(button.dataset.shape);
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item===button)));
    if (title) title.textContent = target.morph ? 'An orange wire sculpture shaped into a circular orbit' : 'An orange wire sculpture, folded into a continuous ribbon';
    if (reduced.matches) { Object.assign(current,target); draw(); } else schedule();
  }));
  inspect?.addEventListener('click', () => {
    const inspecting = study.classList.toggle('is-inspecting');
    inspect.setAttribute('aria-pressed', String(inspecting));
    inspect.setAttribute('aria-label', inspecting ? 'Hide construction guides' : 'Show construction guides');
  });
  function stop() { cancelAnimationFrame(frame); frame = 0; }
  reduced.addEventListener('change', () => {
    stop(); target.pitch = 0; target.yaw = 0; Object.assign(current,target); draw();
    study.style.removeProperty('--light-x'); study.style.removeProperty('--light-y');
  }, { signal });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) stop(); else schedule();
    }, {threshold:0});
    observer.observe(stage);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else schedule(); }, { signal });
  document.addEventListener('astro:before-swap', () => {
    lifetime.abort();
    stop();
  }, { once: true });
  document.querySelectorAll<HTMLElement>('[data-enhancement]').forEach(el => el.hidden = false);
}
