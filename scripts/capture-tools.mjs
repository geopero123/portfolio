// Captures current screenshots of the live projects for the portfolio previews.
// The repos' docs/screenshot.png files predate the redesigns, so the live apps are the source.
// Usage: node scripts/capture-tools.mjs [outDir] [name ...]
//   node scripts/capture-tools.mjs                       all projects
//   node scripts/capture-tools.mjs src/assets/projects rebirth siteforge   only those
// Set PW_CHANNEL= (empty) to use Playwright's bundled Chromium instead of installed Chrome.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const [out = 'src/assets/projects', ...only] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const channel = process.env.PW_CHANNEL ?? 'chrome';
// The game renders with WebGL; software GL keeps headless captures working without a GPU.
const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const tools = [
  ['quire', 'https://quire.madebygio.dev/'],
  ['kilo', 'https://kilo.madebygio.dev/'],
  ['folio', 'https://folio.madebygio.dev/'],
  ['convert', 'https://convert.madebygio.dev/'],
  ['qr', 'https://qr.madebygio.dev/'],
  // The game repaints every frame, so it is captured at 1x with a longer screenshot timeout.
  ['rebirth', 'https://play.tempestarchive.com/', 6000, 1],
  ['siteforge', 'https://siteforge.madebygio.dev/'],
];

for (const [name, url, settle = 1500, scale = 2] of tools) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.waitForLoadState('load'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settle);
  await page.mouse.move(5, 5);
  const alive = await page.evaluate(() => document.body.querySelectorAll('*').length);
  if (alive < 30) throw new Error(`${name}: page looks empty`);
  await page.screenshot({ path: `${out}/${name}.png`, timeout: 120000, animations: 'disabled' });
  console.log(name, '·', await page.evaluate(() => document.title));
  await ctx.close();
}
await browser.close();
