// Renders resume/resume.html to public/giorgi-resume.pdf (A4, selectable text, live links).
// Usage: node scripts/resume-pdf.mjs   (PW_CHANNEL= to use Playwright's bundled Chromium)
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const source = new URL('../resume/resume.html', import.meta.url);
const out = fileURLToPath(new URL('../public/giorgi-resume.pdf', import.meta.url));
const channel = process.env.PW_CHANNEL ?? 'chrome';
const browser = await chromium.launch({ ...(channel ? { channel } : {}), headless: true });
const page = await browser.newPage();
await page.goto(source.href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const missing = await page.evaluate(() => [...document.fonts].filter(f => f.status !== 'loaded').map(f => f.family));
if (missing.length) throw new Error(`Fonts did not load: ${missing.join(', ')}`);
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: false });
await browser.close();
console.log(`Wrote ${out}`);
