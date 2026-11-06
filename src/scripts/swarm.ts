/** Independent cursor workers build the real DOM, then disappear until more work arrives. */
const COLORS = ['#ff986f', '#a899ff', '#6edbc0', '#75bcff', '#f4d36f', '#f38cb7'];
type Job = { el: HTMLElement; state: 'waiting' | 'working' | 'done'; rect: DOMRect; start: number; duration: number; progress: number; lines: number; kind: 'type' | 'place' | 'draw' };
type Agent = { x: number; y: number; vx: number; vy: number; angle: number; color: string; size: number; job: Job | null; phase: number };

export function initCursorSwarm(): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-swarm-canvas]');
  const ctx = canvas?.getContext('2d', { alpha: true });
  const controls = document.querySelector<HTMLElement>('[data-swarm-controls]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-swarm-toggle]');
  const replay = document.querySelector<HTMLButtonElement>('[data-swarm-replay]');
  if (!canvas || !ctx || !controls || !toggle || !replay) {
    document.documentElement.classList.remove('swarm-pending');
    return () => {};
  }
  const surface = canvas, pen = ctx;
  const host = surface.parentElement!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const { signal } = abort;
  let width = innerWidth, height = innerHeight, dpr = 1;
  let frame = 0, last = 0, clock = 0, startAt = performance.now();
  let enabled = host.dataset.swarmPaused !== 'true', dirty = true, destroyed = false;
  let nextAssignment = 0, jobs: Job[] = [];
  const agents: Agent[] = Array.from({ length: 24 }, (_, i) => ({
    x: width * .5 + Math.cos(i * 2.4) * 25, y: height * .5 + Math.sin(i * 2.4) * 25,
    vx: 0, vy: 0, angle: i * 2.4, color: COLORS[i % COLORS.length], size: 11 + i % 4,
    job: null, phase: i * 2.39996,
  }));
  const arrow = new Path2D('M 0 0 L -8 20 L -1 16 L 5 22 L 9 18 L 3 12 L 12 11 Z');
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  function resize() {
    width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
    surface.width = Math.round(width * dpr); surface.height = Math.round(height * dpr);
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
  }
  function reveal(job: Job) {
    job.state = 'done'; job.progress = 1;
    job.el.removeAttribute('data-swarm-piece');
    job.el.style.removeProperty('--swarm-reveal');
    job.el.style.removeProperty('--swarm-clip');
  }
  function finish() {
    jobs.forEach(reveal);
    agents.forEach(agent => agent.job = null);
    surface.hidden = true;
    surface.dataset.swarmState = 'idle';
    document.documentElement.classList.remove('swarm-pending');
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
  function schedule() {
    if (!frame && !destroyed && enabled && !document.hidden && !reduced.matches) {
      frame = requestAnimationFrame(time => {
        try { tick(time); }
        catch (error) {
          // If an enhancement fails, leave the actual site completely available.
          finish(); stop(); enabled = false; updateControls(); pen.clearRect(0, 0, width, height);
          console.error('Cursor assembly stopped safely.', error);
        }
      });
    }
  }
  function plan() {
    finish();
    if (reduced.matches || !enabled) return;
    document.documentElement.classList.add('swarm-active');
    // Select semantic blocks, excluding nested candidates so clipping is never doubled.
    const selectors = [
      '.site-header .wordmark', '.desktop-nav > a', '.site-header .github-link', '.site-header .menu-toggle',
      '.hero-intro', '.hero h1 .line-mask', '.hero-description', '.hero-actions', '.hero-role',
      '.study-heading', '.shape-stage', '.study-controls', '.hero-baseline > *',
      'main [data-m]', 'main .section-topline', 'main p', 'main h1:not(.hero h1)', 'main h2', 'main h3',
      'main .flagship-visual', 'main .story-visual', 'main .story-chapter', 'main .pindex-preview',
      'main .spot-links', 'main .stack-rail', 'main .tech-strip', 'main a.button', 'main a.text-link',
      'footer.site-footer > *',
    ];
    const candidates = [...document.querySelectorAll<HTMLElement>(selectors.join(','))]
      .filter(el => !el.closest('[hidden], .story-screen:not(.is-active), .pindex-shot[aria-hidden="true"]'));
    const set = new Set(candidates);
    jobs = candidates.filter(el => {
      for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      const r = el.getBoundingClientRect();
      return r.width > .5 && r.height > .5;
    }).map(el => {
      const rect = el.getBoundingClientRect();
      const visual = !!el.querySelector('img, canvas, svg.sculpture') || el.matches('.shape-stage');
      const kind: Job['kind'] = visual ? 'place' : el.matches('.section-topline, .tech-strip, .study-controls, .hero-actions, .flagship-actions, [aria-hidden="true"]') ? 'draw' : 'type';
      el.dataset.swarmPiece = kind;
      el.style.setProperty('--swarm-reveal', '100%');
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || rect.height;
      const lines = kind === 'type' && el.matches('p, h1, h2, h3, .line-mask') ? Math.max(1, Math.round(rect.height / lineHeight)) : 1;
      return { el, rect, lines, kind, state: 'waiting', progress: 0, start: 0,
        duration: visual ? 1100 : clamp((el.textContent?.trim().length || 20) * 9 + 300, 430, 1400) };
    });
    agents.forEach((a, i) => {
      a.job = null; a.x = width * .5 + Math.cos(a.phase) * 30; a.y = height * .48 + Math.sin(a.phase) * 30;
      a.vx = Math.cos(a.phase) * 80; a.vy = Math.sin(a.phase) * 80; a.angle = i;
    });
    startAt = performance.now(); nextAssignment = startAt + 180; clock = 0; dirty = true;
    document.documentElement.classList.remove('swarm-pending');
    surface.hidden = false;
    surface.dataset.swarmState = 'building';
    controls!.hidden = false;
    schedule();
  }
  function markDirty() { dirty = true; schedule(); }
  function updateControls() {
    host.dataset.swarmPaused = String(!enabled);
    toggle!.setAttribute('aria-pressed', String(enabled));
    toggle!.setAttribute('aria-label', enabled ? 'Pause cursor swarm and finish building' : 'Enable cursor swarm');
    controls!.hidden = reduced.matches;
  }
  function toggleSwarm() {
    enabled = !enabled;
    if (!enabled) { finish(); stop(); pen.clearRect(0, 0, width, height); }
    else schedule();
    updateControls();
  }
  function replayBuild() {
    enabled = true; updateControls();
    // Replay at the current position; no forced scrolling or focus changes.
    plan();
  }
  function preference() {
    if (reduced.matches) { finish(); stop(); pen.clearRect(0, 0, width, height); }
    else schedule();
    updateControls();
  }
  function focus(event: FocusEvent) {
    // Keyboard and anchor navigation must never land on an invisible control.
    const target = event.target as HTMLElement;
    jobs.filter(job => job.el.contains(target)).forEach(reveal);
  }
  function measure() {
    for (const job of jobs) if (job.state !== 'done') {
      job.rect = job.el.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(job.el).lineHeight) || job.rect.height;
      if (job.kind === 'type' && job.el.matches('p, h1, h2, h3, .line-mask')) job.lines = Math.max(1, Math.round(job.rect.height / lineHeight));
    }
    dirty = false;
  }
  function guide(job: Job, color: string) {
    const r = job.rect, p = job.progress;
    const fade = Math.min(1, p * 8, (1 - p) * 7);
    if (fade <= 0 || r.bottom < 0 || r.top > height) return;
    pen.save(); pen.globalAlpha = fade * .65; pen.strokeStyle = color; pen.lineWidth = .75;
    pen.setLineDash([3, 4]); pen.strokeRect(r.x - 3, r.y - 3, r.width + 6, r.height + 6); pen.setLineDash([]);
    const line = Math.min(job.lines - 1, Math.floor(p * job.lines));
    const edge = r.x + r.width * (p * job.lines - line);
    const lineTop = r.y + r.height * line / job.lines;
    pen.globalAlpha = fade * .85; pen.beginPath(); pen.moveTo(edge, lineTop - 5); pen.lineTo(edge, lineTop + r.height / job.lines + 5); pen.stroke();
    pen.fillStyle = color;
    for (const [x, y] of [[r.x - 3, r.y - 3], [r.right + 3, r.bottom + 3]]) { pen.fillRect(x - 2, y - 2, 4, 4); }
    if (r.height > 35 && r.top > 25) {
      pen.font = '9px "JetBrains Mono Variable", monospace';
      pen.fillText(`${job.kind} / ${Math.round(r.width)} × ${Math.round(r.height)}`, r.x, r.y - 11);
    }
    pen.restore();
  }
  function tick(time: number) {
    frame = 0;
    if (destroyed || document.hidden || !enabled || reduced.matches) return;
    const dt = Math.min((time - last) / 1000 || 1 / 60, 1 / 30); last = time; clock += dt;
    if (dirty) measure();
    pen.clearRect(0, 0, width, height);
    const elapsed = time - startAt;
    const available = jobs.filter(j => j.state === 'waiting' && j.rect.top < height + 40 && j.rect.bottom > -40);
    // Never leave skipped, already-scrolled content invisible.
    jobs.filter(j => j.state !== 'done' && j.rect.bottom < -40).forEach(reveal);
    if (elapsed > 180 && time >= nextAssignment) {
      let assigned = 0;
      for (const a of agents) {
        if (a.job || !available.length || assigned >= 2) continue;
        const job = available.shift()!;
        job.state = 'working'; job.start = time + 160; a.job = job; assigned++;
      }
      if (assigned) nextAssignment = time + 110;
    }
    let working = jobs.filter(j => j.state === 'working');
    for (const job of working) {
      job.progress = clamp((time - job.start) / job.duration, 0, 1);
      if (job.kind === 'type') {
        const chars = Math.max(1, job.el.textContent?.trim().length || 1);
        job.progress = Math.floor(job.progress * chars) / chars;
        const line = Math.min(job.lines - 1, Math.floor(job.progress * job.lines));
        const x = ((job.progress * job.lines - line) * 100).toFixed(2);
        const top = (line / job.lines * 100).toFixed(2), bottom = ((line + 1) / job.lines * 100).toFixed(2);
        job.el.style.setProperty('--swarm-clip', `polygon(0 0,100% 0,100% ${top}%,${x}% ${top}%,${x}% ${bottom}%,0 ${bottom}%)`);
      } else job.el.style.setProperty('--swarm-reveal', `${((1 - job.progress) * 100).toFixed(2)}%`);
      if (job.progress >= 1) reveal(job);
    }
    working = working.filter(job => job.state === 'working');
    const building = available.length > 0 || working.length > 0 || elapsed < 400;
    surface.dataset.swarmState = building ? 'building' : 'idle';
    surface.hidden = !building;
    // Completed content gets no cursor overlay or animation loop. Only new build jobs wake it.
    if (!building) { last = 0; return; }
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      if (a.job?.state === 'done') a.job = null;
      let tx: number, ty: number;
      let alpha = 1;
      if (a.job) {
        const r = a.job.rect;
        const line = Math.min(a.job.lines - 1, Math.floor(a.job.progress * a.job.lines));
        tx = r.x + r.width * (a.job.progress * a.job.lines - line);
        ty = r.y + (a.job.kind === 'place' ? r.height * (.2 + (i % 3) * .3) : r.height * (line + .8) / a.job.lines);
        guide(a.job, a.color);
      } else if (building && working.length) {
        const job = working[i % working.length], r = job.rect;
        // Extra workers drag the lower corners of large visual blocks into place.
        tx = r.x + r.width * job.progress + Math.cos(a.phase + clock * 2) * 20;
        ty = r.y + r.height * ((i % 5) / 4);
        alpha = .75;
      } else if (building) {
        tx = width * .5 + Math.cos(a.phase + clock) * 45;
        ty = height * .45 + Math.sin(a.phase + clock) * 45;
        alpha = Math.min(1, elapsed / 180);
      } else {
        tx = a.x; ty = a.y; alpha = 0;
      }
      tx = clamp(tx, 12, width - 12);
      ty = clamp(ty, 14, height - 12);
      const spring = a.job ? 95 : 72, damping = a.job ? 17 : 14;
      a.vx += ((tx - a.x) * spring - a.vx * damping) * dt;
      a.vy += ((ty - a.y) * spring - a.vy * damping) * dt;
      // Local separation keeps the flock readable without a heavy physics dependency.
      for (let k = i + 1; k < agents.length; k++) {
        const b = agents[k], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > .01 && d2 < 400) {
          const push = (1 - Math.sqrt(d2) / 20) * 35 * dt;
          a.vx += dx * push; a.vy += dy * push; b.vx -= dx * push; b.vy -= dy * push;
        }
      }
      const speed = Math.hypot(a.vx, a.vy), limit = 1600;
      if (speed > limit) { a.vx *= limit / speed; a.vy *= limit / speed; }
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (speed > 15) {
        const heading = Math.atan2(a.vy, a.vx) + Math.PI / 3;
        const difference = Math.atan2(Math.sin(heading - a.angle), Math.cos(heading - a.angle));
        a.angle += difference * (1 - Math.exp(-dt * 18));
      }
      if (alpha < .01) continue;
      pen.save(); pen.translate(a.x, a.y); pen.rotate(a.angle); pen.scale(a.size / 15, a.size / 15);
      pen.globalAlpha = alpha; pen.lineJoin = 'round'; pen.lineWidth = 2.2;
      pen.shadowColor = '#00000030'; pen.shadowBlur = 3; pen.shadowOffsetY = 2;
      pen.fillStyle = a.color; pen.strokeStyle = '#fff8ee'; pen.fill(arrow); pen.stroke(arrow); pen.restore();
    }
    schedule();
  }

  addEventListener('scroll', markDirty, { passive: true, signal });
  addEventListener('resize', () => { resize(); schedule(); }, { passive: true, signal });
  document.addEventListener('focusin', focus, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else { dirty = true; schedule(); } }, { signal });
  toggle.addEventListener('click', toggleSwarm, { signal });
  replay.addEventListener('click', replayBuild, { signal });
  reduced.addEventListener('change', preference, { signal });
  // A safety valve also reveals any unfinished offscreen blocks after a script interruption.
  document.addEventListener('astro:before-swap', finish, { signal });
  resize(); plan(); updateControls();
  return () => {
    destroyed = true; stop(); abort.abort(); finish();
    document.documentElement.classList.remove('swarm-active');
    pen.clearRect(0, 0, width, height);
  };
}
