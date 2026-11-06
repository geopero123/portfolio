// Captures current screenshots of the five live tools for the portfolio previews.
// The repos' docs/screenshot.png files predate the redesigns, so the live apps are the source.
// Usage: node scripts/capture-tools.mjs [outDir]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const out = process.argv[2] ?? 'src/assets/projects';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });

const tools = [
  ['quire', 'https://quire.madebygio.dev/'],
  ['kilo', 'https://kilo.madebygio.dev/'],
  ['folio', 'https://folio.madebygio.dev/'],
  ['convert', 'https://convert.madebygio.dev/'],
  ['qr', 'https://qr.madebygio.dev/'],
];

for (const [name, url] of tools) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.mouse.move(5, 5);
  const alive = await page.evaluate(() => document.body.querySelectorAll('*').length);
  if (alive < 30) throw new Error(`${name}: page looks empty`);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, '·', await page.evaluate(() => document.title));
  await ctx.close();
}
await browser.close();
