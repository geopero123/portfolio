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
  await expect(page.locator('h1')).toHaveText(/Giorgi\s*·\s*React Developer/);
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('#tempest')).toContainText('Tempest');
  await expect(page.locator('article.feature')).toHaveCount(2);
  await expect(page.locator('.tool-card')).toHaveCount(4);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')].filter(a => !document.querySelector(a.hash)).map(a => a.hash))).toEqual([]);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('Tempest Archive is featured: role, decision, evidence, live link, case study route', async ({page}) => {
  await page.goto('/');
  const flagship = page.locator('#tempest');
  await expect(flagship.getByRole('heading', {level: 3, name: 'Tempest Archive'})).toBeVisible();
  await expect(flagship.locator('.feature-meta')).toContainText('Design, frontend, data model');
  await expect(flagship.locator('.feature-meta')).toContainText('React, Vite, Tailwind CSS, Motion, Supabase, Cloudflare');
  await expect(flagship.locator('.decision h4')).toContainText('linked records');
  await expect(flagship.locator('.evidence')).toContainText('304 URLs');
  await expect(flagship.getByRole('link', {name: /Project scale/})).toHaveAttribute('href', 'https://tempestarchive.com/sitemap.xml');
  await expect(flagship.getByRole('link', {name: /Visit Tempest Archive/})).toHaveAttribute('href', 'https://tempestarchive.com/');
  await flagship.getByRole('link', {name: /Read the case study/}).click();
  await expect(page).toHaveURL(/\/projects\/tempest-archive\/?$/);
  await expect(page.locator('h1')).toHaveText(/Tempest\s*Archive/);
  await expect(page.getByRole('link', {name: /Visit the live site/})).toHaveAttribute('href', 'https://tempestarchive.com/');
  // No public repository: no source link may be invented.
  await expect(page.getByRole('link', {name: /View source/})).toHaveCount(0);
});

test('spoiler demo: picking a level swaps the real screen, the counts row and the note', async ({page}) => {
  await page.goto('/');
  const demo = page.locator('[data-spoiler-demo]');
  await demo.scrollIntoViewIfNeeded();
  await expect(demo.locator('[data-spoiler-shot="anime"]')).toHaveClass(/is-active/);
  await expect(demo.locator('tr.is-active th')).toHaveText('Anime');
  await demo.getByRole('button', {name: /Full/}).click();
  await expect(demo.getByRole('button', {name: /Full/})).toHaveAttribute('aria-pressed', 'true');
  await expect(demo.locator('[data-spoiler-shot="full"]')).toHaveClass(/is-active/);
  await expect(demo.locator('[data-spoiler-shot="anime"]')).toHaveAttribute('aria-hidden', 'true');
  await expect(demo.locator('tr.is-active')).toContainText('Full');
  await expect(demo.locator('tr.is-active td').first()).toHaveText('84');
  await expect(demo.locator('[data-spoiler-note]')).toContainText('231 entries');
  // Full matches the published sitemap scale.
  await expect(demo.locator('tr[data-spoiler-row="full"] td')).toHaveText(['84', '85', '36', '26', '231']);
});

test('QUIRE is featured with a real exported PDF and links into the PDF engine source', async ({page, request}) => {
  await page.goto('/');
  const quire = page.locator('#quire');
  await expect(quire.getByRole('heading', {level: 3, name: 'QUIRE'})).toBeVisible();
  await expect(quire.locator('.decision')).toContainText('pdf-lib');
  const pdf = await request.get('/samples/quire-field-notes.pdf');
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()['content-type']).toContain('pdf');
  const bytes = await pdf.body();
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeLessThan(15000);
  await expect(quire.getByRole('link', {name: /Sample PDF/})).toHaveAttribute('href', '/samples/quire-field-notes.pdf');
  await expect(quire.getByRole('link', {name: /Link annotations/})).toHaveAttribute('href', /Portfolio-setup\/blob\/claude\/five-utility-react-apps-ajzt9l\/05-markdown-to-pdf\/src\/lib\/pdf\.js#L346$/);
});

test('secondary tools show the names and domains of the live apps', async ({page}) => {
  await page.goto('/');
  const cards = page.locator('.tool-card');
  const expected = [['Smaller', 'kilo.madebygio.dev'], ['Folio', 'folio.madebygio.dev'], ['Transmute', 'convert.madebygio.dev'], ['SIGNAL', 'qr.madebygio.dev']];
  for (const [i, [name, domain]] of expected.entries()) {
    await expect(cards.nth(i).locator('h4')).toHaveText(name);
    await expect(cards.nth(i).getByRole('link', {name: `${name} live at ${domain}`})).toHaveAttribute('href', `https://${domain}`);
    await expect(cards.nth(i).getByRole('link', {name: `${name} source code`})).toHaveAttribute('href', /github\.com\/geopero123\/Portfolio-setup/);
  }
  await expect(page.getByText('KILO', {exact: true})).toHaveCount(0);
  await cards.nth(0).getByRole('link', {name: 'Smaller details'}).click();
  await expect(page).toHaveURL(/\/projects\/kilo\/?$/);
  await expect(page.locator('h1')).toHaveText('Smaller');
});

test('fresh visit: header, headline and project link are visible and usable at once; the build is opt-in', async ({page}) => {
  for (const viewport of [{width: 1440, height: 900}, {width: 390, height: 844}]) {
    await page.setViewportSize(viewport);
    await page.goto('/', {waitUntil: 'commit'});
    await page.waitForSelector('h1');
    // Within the first frames: nothing is hidden or clipped by an intro.
    const state = await page.evaluate(() => {
      const visible = (el: Element | null) => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility === 'visible' && s.opacity === '1' && r.height > 0 && r.top < innerHeight; };
      return {
        header: visible(document.querySelector('.site-header .wordmark')),
        h1: visible(document.querySelector('h1')),
        cta: visible([...document.querySelectorAll('a')].find(a => a.textContent?.includes('See Tempest Archive')) ?? null),
        contact: visible(document.querySelector('.hero-actions a[href="#contact"]')),
        pieces: document.querySelectorAll('[data-swarm-piece]').length,
        pending: document.documentElement.className.includes('swarm'),
      };
    });
    expect(state).toEqual({header: true, h1: true, cta: true, contact: true, pieces: 0, pending: false});
    await expect(page.locator('[data-swarm-canvas]')).toBeHidden();
    await page.getByRole('link', {name: 'See Tempest Archive'}).click();
    await expect(page).toHaveURL(/#tempest$/);
  }
  // Replay build is the only way in, it assembles the current screen, and Escape skips it.
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');
  await page.locator('.study-replay').click();
  await expect.poll(() => page.locator('[data-swarm-piece]').count()).toBeGreaterThan(0);
  await expect(page.getByRole('button', {name: 'Skip build animation'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-swarm-piece]')).toHaveCount(0);
  await expect(page.locator('[data-swarm-canvas]')).toBeHidden();
  await page.locator('#contact').scrollIntoViewIfNeeded();
  await expect(page.locator('#contact h2')).toBeVisible();
});

test('keyboard: skip link, navigation and the primary action are reachable in order', async ({page}) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', {name: 'Skip to content'})).toBeFocused();
  const order: string[] = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => document.activeElement!.getAttribute('aria-label') || (document.activeElement as HTMLElement).innerText.trim().replace(/\s+/g, ' ')));
  }
  expect(order.slice(0, 7)).toEqual(['Made by Gio, home', 'Home', 'Work', 'About', 'Contact', 'Résumé', 'Giorgi on GitHub']);
  expect(order).toContain('See Tempest Archive');
  await page.getByRole('link', {name: 'See Tempest Archive'}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#tempest$/);
});

test('contact shows only verified channels and links to the current site source', async ({page}) => {
  await page.goto('/');
  const contact = page.locator('#contact');
  await expect(contact.getByRole('list', {name: 'Ways to reach Giorgi'}).locator('a').first()).toHaveAttribute('href', /^(mailto:|https:\/\/)/);
  // Nothing renders for an empty value: no blank mailto, no empty résumé link.
  expect(await page.locator('a[href="mailto:"], a[href=""]').count()).toBe(0);
  await expect(contact.getByRole('list', {name: 'Ways to reach Giorgi'}).getByRole('link', {name: /GitHub/})).toHaveAttribute('href', 'https://github.com/geopero123');
  await expect(page.locator('footer').getByRole('link', {name: /Site source/})).toHaveAttribute('href', 'https://github.com/geopero123/portfolio/tree/local/current-site');
  await expect(page.locator('.study-note a').first()).toHaveAttribute('href', 'https://github.com/geopero123/portfolio/blob/local/current-site/src/lib/sculpture.ts');
});

test('résumé is reachable from the first screen, the header and Contact, and is a one-page PDF', async ({page, request}) => {
  await page.goto('/');
  await expect(page.locator('.hero-actions').getByRole('link', {name: /Résumé/})).toHaveAttribute('href', '/giorgi-resume.pdf');
  await expect(page.locator('[data-resume-link]')).toHaveAttribute('href', '/giorgi-resume.pdf');
  await expect(page.locator('#contact').getByRole('link', {name: /Résumé/})).toHaveAttribute('href', '/giorgi-resume.pdf');
  const pdf = await request.get('/giorgi-resume.pdf');
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()['content-type']).toContain('pdf');
  const text = (await pdf.body()).toString('latin1');
  expect(text.startsWith('%PDF-')).toBe(true);
  expect(text.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
});

// The custom cursor was removed when the cursor-swarm build replaced it (commit aa099d2);
// smooth scrolling remains, and must stay off for touch and reduced motion.
test('smooth scroll runs for a mouse and stays off for touch and reduced motion', async ({page, browser}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/lenis/);
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
  await expect(page.locator('html')).not.toHaveClass(/lenis/);
  const touch = await browser.newContext({baseURL: 'http://127.0.0.1:4322', viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const tp = await touch.newPage();
  await tp.goto('/');
  await expect(tp.locator('html')).not.toHaveClass(/lenis/);
  await touch.close();
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
  await expect(page.locator('h1')).toHaveText(/Giorgi\s*·\s*React Developer/);
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
  await expect(page.locator('.study-replay')).toBeHidden();
  await expect(page.locator('.swarm-controls')).toBeHidden();
  const hidden = await page.locator('h2, h3, .feature-does, .tool-card').evaluateAll(els => els.filter(el => { const s = getComputedStyle(el); return s.opacity === '0' || s.clipPath.includes('100%'); }).length);
  expect(hidden).toBe(0);
  const ring=page.locator('[data-ring="0"]');
  const initial=await ring.getAttribute('d');
  const stage=await page.locator('[data-shape-stage]').boundingBox();
  await page.mouse.move(stage!.x+stage!.width*.8,stage!.y+stage!.height*.3);
  await page.waitForTimeout(150);
  expect(await ring.getAttribute('d')).toBe(initial);
  expect(await page.evaluate(()=>document.getAnimations().filter(animation=>animation.playState==='running').length)).toBe(0);
});

test('touch: spoiler demo and tool links respond to taps; menu works; no sideways scroll', async ({browser}) => {
  const context=await browser.newContext({baseURL:'http://127.0.0.1:4322', viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.goto('/');
  await page.getByRole('button',{name:'02 Orbit',exact:true}).tap();
  await expect(page.getByRole('button',{name:'02 Orbit',exact:true})).toHaveAttribute('aria-pressed','true');
  const full = page.locator('[data-spoiler-demo]').getByRole('button', {name: /Full/});
  await full.scrollIntoViewIfNeeded();
  await full.tap();
  await expect(page.locator('[data-spoiler-shot="full"]')).toHaveClass(/is-active/);
  const folio = page.getByRole('link', {name: 'Folio details'});
  await folio.scrollIntoViewIfNeeded();
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
  await expect(page.getByRole('link', {name: 'See Tempest Archive'})).toBeVisible();
  await expect(page.locator('#tempest h3')).toBeVisible();
  await expect(page.locator('.feature-does').first()).toBeVisible();
  await expect(page.locator('.spoiler-table')).toBeVisible();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Contact',exact:true}).click();
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
