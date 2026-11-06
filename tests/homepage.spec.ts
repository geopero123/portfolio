import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

function watch(page: Page) {
  const errors: string[] = [], failed: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', response => { if (response.status() >= 400) failed.push(response.url()); });
  return { errors, failed };
}

test('home loads without browser errors, missing assets, or broken anchors', async ({page}) => {
  const {errors, failed} = watch(page);
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Serious code.Playful details.');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('#flagship')).toContainText('Tempest');
  await expect(page.locator('.pindex-item')).toHaveCount(6);
  await expect(page.locator('article.spot')).toHaveCount(5);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].filter(a => !document.querySelector(a.hash)).map(a => a.hash))).toEqual([]);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('Tempest Archive is the flagship: live link, real stack, case study route', async ({page}) => {
  await page.goto('/');
  const flagship = page.locator('#flagship');
  await expect(flagship.getByRole('heading', {level: 2})).toHaveText(/Tempest\s*Archive\./);
  await expect(flagship.getByRole('link', {name: /Visit Tempest Archive/})).toHaveAttribute('href', 'https://tempestarchive.com/');
  await expect(flagship.getByRole('list', {name: 'Built with'}).locator('li')).toContainText(['React', 'Vite', 'Tailwind CSS', 'Motion', 'Supabase', 'Cloudflare']);
  await flagship.getByRole('link', {name: /Read the case study/}).click();
  await expect(page).toHaveURL(/\/projects\/tempest-archive\/?$/);
  await expect(page.locator('h1')).toHaveText(/Tempest\s*Archive/);
  await expect(page.getByRole('link', {name: /Visit the live site/})).toHaveAttribute('href', 'https://tempestarchive.com/');
  // No public repository: no source link may be invented.
  await expect(page.getByRole('link', {name: /View source/})).toHaveCount(0);
});

test('pinned Tempest story: frame stays, chapters change the screen', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');
  const frame = page.locator('.story-frame');
  await page.locator('[data-chapter="0"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-screen="0"]')).toHaveClass(/is-active/);
  // Compare two pinned states (chapter 2 and chapter 3), not the pre-pin natural position.
  await page.locator('[data-chapter="1"]').evaluate(el => el.scrollIntoView({block: 'center'}));
  await expect(page.locator('[data-screen="1"]')).toHaveClass(/is-active/);
  const before = await frame.boundingBox();
  await page.locator('[data-chapter="2"]').evaluate(el => el.scrollIntoView({block: 'center'}));
  await expect(page.locator('[data-screen="2"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-screen="0"]')).not.toHaveClass(/is-active/);
  await expect(page.locator('[data-story-label]')).toHaveText('Character dossier');
  await expect(page.locator('[data-story-n]')).toHaveText('03');
  const after = await frame.boundingBox();
  // Pinned: the frame's viewport position barely moves while the chapters scroll by.
  expect(Math.abs((after!.y) - (before!.y))).toBeLessThan(40);
  await expect(page.locator('[data-chapter="2"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-chapter="2"] .story-tags li').first()).toHaveCSS('opacity', '1');
  await page.waitForTimeout(900);
  await page.screenshot({path: 'test-results/story-1440.png'});
});

test('custom cursor and smooth scroll run for a mouse, grow on hover, and stay off for touch and reduced motion', async ({page, browser}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');
  await page.mouse.move(400, 300);
  await page.mouse.move(420, 320);
  await expect(page.locator('html')).toHaveClass(/has-cursor/);
  await expect(page.locator('html')).toHaveClass(/lenis/);
  await expect(page.locator('[data-cursor]')).toHaveClass(/is-visible/);
  // Dot snaps to the pointer; ring catches up.
  await expect.poll(() => page.locator('.cursor-dot').evaluate(el => el.style.transform)).toContain('420px, 320px');
  await expect.poll(() => page.locator('.cursor-ring').evaluate(el => el.style.transform), {timeout: 3000}).toMatch(/translate3d\(4(19|20)(\.\d+)?px, 3(19|20)(\.\d+)?px/);
  await page.getByRole('link', {name: /Explore my work/}).hover();
  await expect(page.locator('[data-cursor]')).toHaveClass(/is-hover/);
  await expect(page.locator('.cursor-ring')).toHaveCSS('width', '64px');
  // Wheel input eases rather than jumping: a few frames after one tick, scroll is in progress, not settled.
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(80);
  const early = await page.evaluate(() => scrollY);
  await page.waitForTimeout(900);
  const late = await page.evaluate(() => scrollY);
  expect(early).toBeGreaterThan(0);
  expect(late).toBeGreaterThan(early);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  await page.mouse.move(400, 300);
  await expect(page.locator('html')).not.toHaveClass(/has-cursor/);
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  const touch = await browser.newContext({baseURL: 'http://127.0.0.1:4322', viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const tp = await touch.newPage();
  await tp.goto('/');
  await expect(tp.locator('html')).not.toHaveClass(/has-cursor/);
  await touch.close();
});

test('project index swaps the preview on hover and links to detail pages', async ({page}) => {
  await page.goto('/');
  await page.locator('#projects').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-index-preview="tempest-archive"]')).toHaveClass(/is-active/);
  await page.locator('[data-index-item="kilo"]').hover();
  await expect(page.locator('[data-index-preview="kilo"]')).toHaveClass(/is-active/);
  await expect(page.locator('[data-index-preview="tempest-archive"]')).not.toHaveClass(/is-active/);
  await expect(page.locator('[data-index-number]')).toHaveText('03');
  await page.locator('[data-index-item="kilo"]').click();
  await expect(page).toHaveURL(/\/projects\/kilo\/?$/);
});

for (const width of [320,390,768,1024,1440,1920]) {
  test(`no overflow or clipped headings at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const path of ['/', '/about', '/projects/tempest-archive']) {
      await page.goto(path);
      await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${path} overflows at ${width}`).toBe(true);
      const clipped = await page.locator('h1,h2,h3').evaluateAll(elements=>elements.filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.textContent));
      expect(clipped, `${path} clipped at ${width}`).toEqual([]);
    }
    if (width === 390 || width === 1440) {
      await page.goto('/');
      // Walk the page so lazy images request, then wait for the network to settle before capturing.
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } scrollTo(0, 0); });
      await page.waitForLoadState('networkidle');
      await page.getByRole('link',{name:'Made by Gio, home',exact:true}).click();
      await page.screenshot({path:`test-results/home-${width}.png`, fullPage:true});
      await page.goto('/about');
      await page.screenshot({path:`test-results/about-${width}.png`, fullPage:true});
      await page.goto('/projects/tempest-archive');
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); } scrollTo(0, 0); });
      await page.waitForLoadState('networkidle');
      expect(await page.locator('.screens img').evaluateAll(imgs => imgs.every(i => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0)), 'case-study screenshots load').toBe(true);
      await page.screenshot({path:`test-results/tempest-${width}.png`, fullPage:true});
    }
  });
}

test('desktop navigation: section links activate, About is a real page, back button works', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  for (const id of ['projects','contact','home']) {
    await page.locator(`[data-nav="${id}"]`).click();
    await expect(page).toHaveURL(id === 'home' ? /\/(#home)?$/ : new RegExp(`#${id}$`));
    await expect(page.locator(`[data-nav="${id}"]`)).toHaveAttribute('aria-current','location');
  }
  await page.locator('[data-nav="about"]').click();
  await expect(page).toHaveURL(/\/about\/?$/);
  await expect(page.locator('[data-nav="about"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('h1')).toHaveText(/I build things/);
  await page.goBack();
  await expect(page).toHaveURL(/\/(#home)?$/);
  await expect(page.locator('h1')).toHaveText('Serious code.Playful details.');
});

test('mobile menu traps focus, closes with Escape, navigates, and resets on resize', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  const toggle = page.getByRole('button',{name:'Open menu',exact:true});
  await toggle.click();
  await expect(page.locator('main')).toHaveAttribute('inert','');
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await page.locator('#mobile-menu a').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Made by Gio, home',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await toggle.click();
  await page.getByRole('link',{name:'04 Contact',exact:true}).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator('#contact')).toBeFocused();
  await expect(page.locator('main')).not.toHaveAttribute('inert');
  await toggle.click();
  await page.setViewportSize({width:1280,height:900});
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/menu-open/);
});

test('sculpture morphs, shows guides, reacts to pointer, and stops at rest', async ({page}) => {
  await page.goto('/');
  const ring=page.locator('[data-ring="0"]');
  const initial=await ring.getAttribute('d');
  await page.getByRole('button',{name:'02 Orbit',exact:true}).click();
  await expect(page.getByRole('button',{name:'02 Orbit',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>ring.getAttribute('d')).not.toBe(initial);
  await page.getByRole('button',{name:'Show construction guides'}).click();
  await expect(page.locator('[data-shape-study]')).toHaveClass(/is-inspecting/);
  const stage=await page.locator('[data-shape-stage]').boundingBox();
  await page.mouse.move(stage!.x+stage!.width*.7,stage!.y+stage!.height*.35);
  await page.mouse.move(1,1);
  await page.waitForTimeout(1200);
  const settled=await ring.getAttribute('d');
  await page.waitForTimeout(200);
  expect(await ring.getAttribute('d')).toBe(settled);
});

test('reduced motion keeps every section visible and disables pointer motion', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('[data-m]:not(.in)')).toHaveCount(0);
  expect(await page.locator('html').evaluate(el=>getComputedStyle(el).scrollBehavior)).toBe('auto');
  const hidden = await page.locator('h2, .flagship-lead, .pindex-item').evaluateAll(els => els.filter(el => { const s = getComputedStyle(el); return s.opacity === '0' || s.clipPath.includes('100%'); }).length);
  expect(hidden).toBe(0);
  const ring=page.locator('[data-ring="0"]');
  const initial=await ring.getAttribute('d');
  const stage=await page.locator('[data-shape-stage]').boundingBox();
  await page.mouse.move(stage!.x+stage!.width*.8,stage!.y+stage!.height*.3);
  await page.waitForTimeout(150);
  expect(await ring.getAttribute('d')).toBe(initial);
  expect(await page.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').length)).toBe(0);
});

test('touch: index taps preview first then navigate; menu works; no sideways scroll', async ({browser}) => {
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4322', viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto('/');
  await page.getByRole('button',{name:'02 Orbit',exact:true}).tap();
  await expect(page.getByRole('button',{name:'02 Orbit',exact:true})).toHaveAttribute('aria-pressed','true');
  const folio = page.locator('[data-index-item="folio"]');
  await folio.scrollIntoViewIfNeeded();
  await folio.tap();
  await expect(page.locator('[data-index-preview="folio"]')).toHaveClass(/is-active/);
  await expect(page).toHaveURL(/\/(#\w+)?$/);
  await folio.tap();
  await expect(page).toHaveURL(/\/projects\/folio\/?$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.goto('/');
  await page.getByRole('button',{name:'Open menu',exact:true}).tap();
  await page.getByRole('link',{name:'04 Contact',exact:true}).tap();
  await expect(page).toHaveURL(/#contact$/);
  await context.close();
});

test('the pages remain useful with JavaScript disabled', async ({browser}) => {
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4322',javaScriptEnabled:false,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.sculpture')).toBeVisible();
  await expect(page.locator('#flagship h2')).toBeVisible();
  await expect(page.locator('.flagship-lead')).toBeVisible();
  await page.getByRole('link',{name:'Contact',exact:true}).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator('#contact h2')).toBeVisible();
  await page.goto('/about');
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#panel-frontend')).toBeVisible();
  await context.close();
});

test('about page: tabs, workflow, and source list work', async ({page}) => {
  const {errors, failed} = watch(page);
  await page.goto('/about');
  await expect(page.locator('h1')).toHaveText(/I build things\s*for the web\./);
  await page.getByRole('tab', {name: /Web tools/}).click();
  await expect(page.locator('#panel-tools')).toBeVisible();
  await expect(page.locator('#panel-frontend')).toBeHidden();
  await expect(page.locator('#panel-tools')).toContainText('QUIRE');
  // Pinned workflow: scrolling to the last explanation lights the last step.
  await page.locator('#flow-ship').evaluate(el => el.scrollIntoView({block: 'center'}));
  await expect(page.locator('#flow-ship')).toHaveClass(/is-active/);
  await expect(page.locator('.flow-step[data-screen="4"]')).toHaveClass(/is-active/);
  await expect(page.locator('#flow-ship')).toContainText('real domain');
  await expect(page.locator('.story-flow [data-story-label]')).toHaveText('Ship');
  await expect(page.getByRole('link', {name: /Portfolio-setup/})).toHaveAttribute('href', /github\.com\/geopero123\/Portfolio-setup/);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('every project page renders with live link, real stack and metadata', async ({page}) => {
  const {errors, failed} = watch(page);
  for (const slug of ['tempest-archive', 'quire', 'kilo', 'folio', 'transmute', 'signal']) {
    await page.goto(`/projects/${slug}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', {name: /Visit the live site/})).toHaveAttribute('href', /^https:\/\//);
    await expect(page.getByRole('list', {name: 'Built with'}).locator('li').first()).toBeVisible();
    expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toContain(`og-${slug}.png`);
    // The pinned story exists on every project page and its first chapter starts active.
    await expect(page.locator('.story-project [data-chapter="0"]')).toHaveClass(/is-active/);
    if (slug === 'tempest-archive') {
      await page.locator('.story-project [data-chapter="2"]').evaluate(el => el.scrollIntoView({block: 'center'}));
      await expect(page.locator('.story-project [data-screen="2"]')).toHaveClass(/is-active/);
    }
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBe(`https://madebygio.dev/projects/${slug}/`);
    if (slug !== 'tempest-archive') await expect(page.getByRole('link', {name: /View source/}).first()).toHaveAttribute('href', /github\.com/);
  }
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('structured data and discoverability files are valid', async ({page, request}) => {
  await page.goto('/');
  const graph = await page.locator('script[type="application/ld+json"]').first().evaluate(el => JSON.parse(el.textContent!));
  expect(graph['@graph'].map((n: any) => n['@type'])).toEqual(expect.arrayContaining(['Person', 'WebSite']));
  await page.goto('/projects/tempest-archive');
  const work = await page.locator('script[type="application/ld+json"]').first().evaluate(el => JSON.parse(el.textContent!));
  expect(work['@graph'][0]).toMatchObject({'@type': 'CreativeWork', url: 'https://tempestarchive.com/'});
  expect((await request.get('/robots.txt')).ok()).toBe(true);
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  for (const path of ['/about/', '/projects/tempest-archive/', '/projects/quire/', '/projects/transmute/', '/projects/signal/']) expect(sitemap).toContain(`https://madebygio.dev${path}`);
});

test('no serious accessibility violations on desktop or mobile, all pages', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const path of ['/', '/about', '/projects/tempest-archive']) for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(path);
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(JSON.stringify(results.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map(n=>n.target)})), null, 1), `${path} @ ${width}`).toBe('[]');
  }
});

test('no cumulative layout shift while fonts and initial content load', async ({page}) => {
  await page.addInitScript(()=>{
    (window as any).__shifts=0;
    new PerformanceObserver(list=>{ for(const entry of list.getEntries()) if(!(entry as any).hadRecentInput) (window as any).__shifts+=(entry as any).value; }).observe({type:'layout-shift', buffered:true});
  });
  await page.goto('/');
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1600);
  expect(await page.evaluate(()=>(window as any).__shifts)).toBeLessThan(.02);
});
