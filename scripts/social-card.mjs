import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

// Deterministic share images that match the site. No external image service.
// Regenerate with `npm run social-card`.
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rings = (cx, cy, count, color) => `<g fill="none" stroke="${color}" stroke-width=".9" opacity=".75">${Array.from({length: count}, (_, i) => `<ellipse cx="${cx}" cy="${cy}" rx="${104 + i * .9}" ry="${36 + i * 2.4}" transform="rotate(${-48 + i * 1.7} ${cx} ${cy})"/>`).join('')}</g>`;
const frame = (body, {bg = '#131310', foot = 'Thoughtfully designed. Personally built.'} = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${bg}"/>
<text x="70" y="83" fill="#eeeee5" font-family="Arial,sans-serif" font-size="30" letter-spacing="-1.5">madeby<tspan font-weight="700">gio</tspan><tspan fill="#f28b63">.</tspan></text>
<path d="M70 123H1130" stroke="#ffffff22"/>
${body}
<path d="M70 533H1130" stroke="#ffffff22"/>
<text x="70" y="578" fill="#919386" font-family="Arial,sans-serif" font-size="17">${esc(foot)}</text>
<text x="1130" y="578" text-anchor="end" fill="#f28b63" font-family="Arial,sans-serif" font-size="17">madebygio.dev</text></svg>`;

const cards = {
  'social-card': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">Giorgi Giorgashvili <tspan fill="#f28b63">·</tspan></text>
<text x="70" y="365" fill="#f1b296" font-family="Georgia,serif" font-style="italic" font-size="89" letter-spacing="-4">React Developer</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">Tempest Archive, QUIRE and six more live projects</text>
${rings(950, 315, 35, '#f28b63')}`),
  'og-about': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">I build things</text>
<text x="70" y="365" fill="#f1b296" font-family="Georgia,serif" font-style="italic" font-size="89" letter-spacing="-4">for the web.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">About Giorgi Giorgashvili (Gio) - React Developer</text>
${rings(950, 315, 35, '#f28b63')}`, {foot: 'What I build, how I build it, and the stack behind it.'}),
  'og-tempest-archive': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">Tempest</text>
<text x="70" y="365" fill="#bfe3ee" font-family="Georgia,serif" font-style="italic" font-size="89" letter-spacing="-4">Archive.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">A spoiler-aware Tensura companion - React · Vite · Supabase · Cloudflare</text>
<g fill="none" stroke="#c8a35f" stroke-width="1.4" stroke-linejoin="round" opacity=".9" transform="translate(830 195) scale(11)"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/><path d="M12 7.5 16.5 12 12 16.5 7.5 12z"/><path d="M12 10.6v2.8"/></g>
<text x="1130" y="470" text-anchor="end" fill="#7cc7dd" font-family="Arial,sans-serif" font-size="19">tempestarchive.com</text>`, {bg: '#0f1217', foot: 'Featured project - case study on madebygio.dev'}),
  'og-quire': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">QUIRE</text>
<text x="70" y="365" fill="#a8c29a" font-family="Georgia,serif" font-style="italic" font-size="72" letter-spacing="-3">Writing, without the friction.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">Markdown editor with live preview and a real PDF engine - React · pdf-lib</text>
${rings(950, 300, 28, '#a8c29a')}`, {foot: 'quire.madebygio.dev'}),
  'og-siteforge': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">SiteForge</text>
<text x="70" y="365" fill="#7ee2a8" font-family="Georgia,serif" font-style="italic" font-size="46" letter-spacing="-2">Find what breaks before your users do.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">Website and code QA - Next.js · Supabase · Playwright</text>
${rings(1000, 285, 28, '#7ee2a8')}`, {foot: 'siteforge.madebygio.dev'}),
  'og-tempest-rebirth': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">Tempest Rebirth</text>
<text x="70" y="365" fill="#e8c26a" font-family="Georgia,serif" font-style="italic" font-size="56" letter-spacing="-2">A 3D action RPG in the browser.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">TypeScript · Three.js · GLSL · Web Audio</text>
${rings(1000, 285, 28, '#e8c26a')}`, {foot: 'play.tempestarchive.com'}),
  'og-kilo': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">Smaller</text>
<text x="70" y="365" fill="#c9e28a" font-family="Georgia,serif" font-style="italic" font-size="72" letter-spacing="-3">Make images lighter.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">Convert, resize and compress images in the browser - JavaScript · Canvas API</text>
${rings(950, 300, 28, '#c9e28a')}`, {foot: 'kilo.madebygio.dev'}),
  'og-folio': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">Folio</text>
<text x="70" y="365" fill="#d9b48a" font-family="Georgia,serif" font-style="italic" font-size="72" letter-spacing="-3">A better home for your PDFs.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">Merge, split, compress and convert PDFs locally - React · pdf-lib · pdf.js</text>
${rings(950, 300, 28, '#d9b48a')}`, {foot: 'folio.madebygio.dev'}),
  'og-transmute': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">Transmute</text>
<text x="70" y="365" fill="#d8ff3e" font-family="Georgia,serif" font-style="italic" font-size="72" letter-spacing="-3">Files in. Other files out.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">Local-first converter for images, DOCX and CSV/JSON - React · Canvas API · pdf-lib</text>
${rings(950, 300, 28, '#d8ff3e')}`, {foot: 'convert.madebygio.dev'}),
  'og-signal': frame(`
<text x="70" y="267" fill="#f0ede6" font-family="Arial,sans-serif" font-size="85" letter-spacing="-5">SIGNAL</text>
<text x="70" y="365" fill="#f0a868" font-family="Georgia,serif" font-style="italic" font-size="72" letter-spacing="-3">Codes that actually scan.</text>
<text x="73" y="425" fill="#a7a79d" font-family="Arial,sans-serif" font-size="23">QR codes and nine barcode symbologies, generated in the browser - React · qrcode · JsBarcode</text>
${rings(950, 300, 28, '#f0a868')}`, {foot: 'qr.madebygio.dev'}),
};

await mkdir('public', {recursive: true});
for (const [name, svg] of Object.entries(cards)) {
  await sharp(Buffer.from(svg)).png().toFile(`public/${name}.png`);
  console.log(`Created public/${name}.png (1200 × 630)`);
}

const touchIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 64 64">
<rect width="64" height="64" fill="#131310"/>
<g fill="#f28b63">
  <path d="M38 19H27c-8 0-13 5-13 12s5 12 13 12h9v4c0 4-4 6-9 6h-8v-7h8c2 0 3-1 3-3h-3c-12 0-20-4-20-12s8-19 20-19h11v7Zm-8 7h-3c-4 0-6 2-6 5s2 5 6 5h3V26Z"/>
  <circle cx="48" cy="40" r="5"/>
</g>
</svg>`;
await sharp(Buffer.from(touchIcon)).png().toFile('public/apple-touch-icon.png');
console.log('Created public/apple-touch-icon.png (180 × 180)');
