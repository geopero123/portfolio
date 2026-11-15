// Regenerates the Tempest Archive preview screenshots in src/assets/projects.
// Usage: node scripts/capture-tempest.mjs [outDir] [--spoilers]
//   --spoilers  only recapture the Characters index at each spoiler level (homepage demo).
// Set PW_CHANNEL= (empty) to use Playwright's bundled Chromium instead of installed Chrome.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const out = args.find(a => !a.startsWith('--')) ?? 'src/assets/projects';
await mkdir(out, { recursive: true });
const channel = process.env.PW_CHANNEL ?? 'chrome';
const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true });

async function shot(name, url, viewport, opts = {}, spoiler) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: 'dark', ...opts });
  // The archive keeps the reader's spoiler level in localStorage; set it before the app boots.
  if (spoiler) await ctx.addInitScript(level => localStorage.setItem('ta_spoiler', level), spoiler);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  // The analytics consent prompt mounts a moment after load; wait for it, then remove it so the
  // capture shows the product, not the dialog.
  await page.getByText('Help improve the archive').first().waitFor({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(400);
  // Hide (never remove, never click) the smallest ancestor that holds both the prompt text and its
  // buttons. Interacting with it triggers the app's own transitions, which blanked earlier captures.
  const hidden = await page.evaluate(() => {
    const leaf = [...document.querySelectorAll('*')].find(el => el.children.length === 0 && el.textContent?.includes('Help improve the archive'));
    let node = leaf?.parentElement ?? null;
    while (node && node !== document.body) {
      const buttons = [...node.querySelectorAll('button')].map(b => b.textContent?.trim());
      const r = node.getBoundingClientRect();
      if (buttons.includes('No thanks') && r.width * r.height < innerWidth * innerHeight * .5) { node.style.visibility = 'hidden'; return node.className || node.tagName; }
      node = node.parentElement;
    }
    return null;
  });
  await page.waitForTimeout(200);
  // Sanity: the h1 must be laid out and not covered by anything.
  const alive = await page.evaluate(() => {
    const h1 = document.querySelector('h1'); if (!h1) return { ok: false, why: 'no h1' };
    const r = h1.getBoundingClientRect(); if (r.height === 0) return { ok: false, why: 'h1 has no height' };
    const top = document.elementFromPoint(Math.min(innerWidth - 1, r.left + 10), Math.min(innerHeight - 1, r.top + r.height / 2));
    return { ok: !!top && (h1.contains(top) || top.contains(h1)), why: top?.tagName, hiddenPrompt: !!document.querySelector('[style*="visibility: hidden"]') };
  });
  console.log(`  prompt hidden: ${hidden ?? 'not present'} · h1 check: ${JSON.stringify(alive)}`);
  if (!alive.ok) throw new Error(`${name}: h1 obstructed or missing`);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log(name, await page.evaluate(() => document.title));
  await ctx.close();
}

const desktop = { width: 1440, height: 900 };
const phone = { width: 390, height: 844 };
const mobile = { isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };

if (args.includes('--spoilers')) {
  // Same page, three reader settings: the count line and the list both change.
  for (const level of ['anime', 'moderate', 'full']) await shot(`tempest-spoiler-${level}`, 'https://tempestarchive.com/characters/', desktop, {}, level);
  await browser.close();
  process.exit(0);
}

await shot('tempest-home', 'https://tempestarchive.com/', desktop);
await shot('tempest-dossier', 'https://tempestarchive.com/characters/rimuru', desktop);
await shot('tempest-timeline', 'https://tempestarchive.com/timeline', desktop);
await shot('tempest-characters', 'https://tempestarchive.com/characters', desktop);
await shot('tempest-mobile', 'https://tempestarchive.com/', phone, mobile);
await shot('tempest-mobile-timeline', 'https://tempestarchive.com/timeline', phone, mobile);

await browser.close();
