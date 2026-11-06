import { quantize, applyPalette, GIFEncoder } from 'gifenc'
import { MAX_PIXELS, TARGETS, swapExtension } from './formats.js'

/** An error whose message is safe (and useful) to show the user verbatim. */
export class ConversionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConversionError'
  }
}

/* ------------------------------------------------------------------ *
 * Image decoding
 * ------------------------------------------------------------------ */

const SVG_FALLBACK_WIDTH = 1200

function loadViaElement(file, { isSvg = false } = {}) {
  return new Promise((resolve, reject) => {
    // An <img> needs the blob's MIME type to render SVG. Files arriving from a
    // ZIP, a `file://` drop, or a system with no registered handler often carry
    // an empty type, so restate it from the extension we already matched on.
    const blob = isSvg && file.type !== 'image/svg+xml' ? new Blob([file], { type: 'image/svg+xml' }) : file
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.decoding = 'sync'
    img.onload = () => {
      // Chrome reports 300x150 for SVGs without intrinsic dimensions, and some
      // browsers report 0. Either way, render it at a sane size instead.
      let { naturalWidth: w, naturalHeight: h } = img
      if (isSvg && (!w || !h || (w === 300 && h === 150))) {
        const ratio = w && h ? h / w : 0.75
        w = SVG_FALLBACK_WIDTH
        h = Math.round(SVG_FALLBACK_WIDTH * ratio)
      }
      if (!w || !h) {
        URL.revokeObjectURL(url)
        reject(new ConversionError('This image has no readable dimensions.'))
        return
      }
      resolve({ source: img, width: w, height: h, release: () => URL.revokeObjectURL(url) })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ConversionError('Could not decode this image — it may be corrupt or use a format your browser does not support.'))
    }
    img.src = url
  })
}

async function loadImage(file) {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
  // createImageBitmap rejects SVG in Chrome and Safari, so route it around.
  if (isSvg) return loadViaElement(file, { isSvg: true })
  try {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close?.(),
    }
  } catch {
    return loadViaElement(file)
  }
}

function drawToCanvas(decoded, { matte } = {}) {
  const { width, height } = decoded
  if (width * height > MAX_PIXELS) {
    throw new ConversionError(
      `That image is ${(width * height / 1e6).toFixed(0)} megapixels — too large for the browser to hold on a canvas.`,
    )
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new ConversionError('Your browser refused to create a 2D canvas.')
  ctx.imageSmoothingQuality = 'high'
  if (matte) {
    ctx.fillStyle = matte
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(decoded.source, 0, 0, width, height)
  return { canvas, ctx }
}

/** Cheap alpha probe — samples every 4th pixel, which is plenty to decide. */
function hasTransparency(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height)
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] < 255) return true
  }
  return false
}

/* ------------------------------------------------------------------ *
 * Image encoding
 * ------------------------------------------------------------------ */

function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ConversionError('The browser returned an empty image while encoding.'))
          return
        }
        // Safari silently hands back a PNG when asked for a format it cannot
        // write, so verify rather than shipping a mislabelled file.
        if (blob.type && blob.type !== mime) {
          reject(new ConversionError(`Your browser cannot write ${mime.split('/')[1].toUpperCase()} files.`))
          return
        }
        resolve(blob)
      },
      mime,
      quality,
    )
  })
}

function encodeGif(ctx, width, height) {
  const { data } = ctx.getImageData(0, 0, width, height)
  const palette = quantize(data, 256, { format: 'rgba4444' })
  const index = applyPalette(data, palette, 'rgba4444')
  const gif = GIFEncoder()
  gif.writeFrame(index, width, height, { palette, transparent: true })
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
}

async function encodePdf(canvas, ctx, { quality, pageSize, alpha }) {
  const { PDFDocument } = await import('pdf-lib')
  const { width, height } = canvas

  // PDF can embed PNG or JPEG only. Transparency needs PNG; anything else is
  // far smaller as JPEG, so pick per-image rather than forcing one.
  const useJpeg = !alpha
  const imageBlob = useJpeg
    ? await canvasToBlob(canvas, 'image/jpeg', quality)
    : await canvasToBlob(canvas, 'image/png')
  const bytes = new Uint8Array(await imageBlob.arrayBuffer())

  const doc = await PDFDocument.create()
  const embedded = useJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)

  if (pageSize === 'fit') {
    // 1 image pixel = 1 PDF point, so the page is exactly the image.
    const page = doc.addPage([width, height])
    page.drawImage(embedded, { x: 0, y: 0, width, height })
  } else {
    const [pw, ph] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4
    const landscape = width > height
    const [pageW, pageH] = landscape ? [ph, pw] : [pw, ph]
    const margin = 36 // half an inch
    const scale = Math.min((pageW - margin * 2) / width, (pageH - margin * 2) / height)
    const w = width * scale
    const h = height * scale
    const page = doc.addPage([pageW, pageH])
    page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h })
  }

  const out = await doc.save()
  return new Blob([out], { type: 'application/pdf' })
}

async function convertImage(file, target, options) {
  const decoded = await loadImage(file)
  try {
    const spec = TARGETS[target]
    // JPEG has no alpha channel, so paint the matte underneath rather than
    // letting the browser default transparent pixels to black.
    const matte = spec.flattens ? options.matte : null
    const { canvas, ctx } = drawToCanvas(decoded, { matte })
    const alpha = matte ? false : hasTransparency(ctx, canvas.width, canvas.height)

    let blob
    if (target === 'gif') blob = encodeGif(ctx, canvas.width, canvas.height)
    else if (target === 'pdf') blob = await encodePdf(canvas, ctx, { ...options, alpha })
    else blob = await canvasToBlob(canvas, spec.mime, spec.lossy ? options.quality : undefined)

    canvas.width = canvas.height = 0 // let the backing store go immediately
    return { blob, meta: { width: decoded.width, height: decoded.height } }
  } finally {
    decoded.release?.()
  }
}

/* ------------------------------------------------------------------ *
 * Documents & data
 * ------------------------------------------------------------------ */

const HTML_SHELL = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    max-width: 44rem; margin: 4rem auto; padding: 0 1.5rem;
    font: 16px/1.7 ui-serif, Georgia, "Times New Roman", serif;
    color: #1a1a1a; background: #fdfdfc;
  }
  h1, h2, h3, h4 { font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.25; margin-top: 2.2em; }
  h1 { font-size: 2rem; margin-top: 0; }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.94rem; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.7rem; text-align: left; }
  th { background: #f4f4f2; }
  blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid #ccc; color: #555; }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e6; background: #16171a; }
    th, td { border-color: #333; } th { background: #1e2024; }
    blockquote { border-color: #444; color: #aaa; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`

async function convertDocx(file, target) {
  // The prebuilt browser bundle avoids pulling Node's zlib/buffer polyfills
  // into the graph. It is UMD, so unwrap whatever the interop layer hands back.
  const mod = await import('mammoth/mammoth.browser.js')
  const mammoth = mod.default ?? mod
  const arrayBuffer = await file.arrayBuffer()
  const run = async (fn, label) => {
    try {
      return await fn({ arrayBuffer })
    } catch {
      throw new ConversionError(`Could not read this .docx — ${label}. Old .doc files are not supported.`)
    }
  }

  if (target === 'txt') {
    const { value } = await run(mammoth.extractRawText, 'the text could not be extracted')
    return { blob: new Blob([value], { type: 'text/plain' }), meta: { chars: value.length } }
  }
  if (target === 'md') {
    const { value } = await run(mammoth.convertToMarkdown, 'the document could not be parsed')
    return { blob: new Blob([value], { type: 'text/markdown' }), meta: { chars: value.length } }
  }
  const { value } = await run(mammoth.convertToHtml, 'the document could not be parsed')
  const title = file.name.replace(/\.docx$/i, '')
  const html = HTML_SHELL(title, value)
  return { blob: new Blob([html], { type: 'text/html' }), meta: { chars: value.length } }
}

async function parseDelimited(file, delimiter) {
  const Papa = (await import('papaparse')).default
  const text = await file.text()
  const result = Papa.parse(text, {
    header: true,
    delimiter,
    dynamicTyping: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  })
  if (!result.data.length) {
    throw new ConversionError('No rows found — the file looks empty, or has a header but no data.')
  }
  return { Papa, rows: result.data, errors: result.errors }
}

async function convertTabular(file, target, delimiter) {
  const { Papa, rows, errors } = await parseDelimited(file, delimiter)
  const warning = errors.length ? `${errors.length} malformed row${errors.length > 1 ? 's' : ''} skipped` : null

  if (target === 'json') {
    const text = JSON.stringify(rows, null, 2)
    return { blob: new Blob([text], { type: 'application/json' }), meta: { rows: rows.length, warning } }
  }
  const text = Papa.unparse(rows, { delimiter: target === 'tsv' ? '\t' : ',' })
  return { blob: new Blob([text], { type: TARGETS[target].mime }), meta: { rows: rows.length, warning } }
}

async function convertJson(file, target) {
  const Papa = (await import('papaparse')).default
  const text = await file.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new ConversionError(`Not valid JSON — ${err.message}`)
  }

  let rows
  if (Array.isArray(parsed)) {
    rows = parsed.length && typeof parsed[0] !== 'object' ? parsed.map((v) => ({ value: v })) : parsed
  } else if (parsed && typeof parsed === 'object') {
    // A bare object becomes a single row; a wrapper like { data: [...] } uses
    // its first array property, which covers most API dumps.
    const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]))
    rows = arrayKey ? parsed[arrayKey] : [parsed]
  } else {
    throw new ConversionError('This JSON is a single value — there are no rows to put in a table.')
  }

  if (!rows.length) throw new ConversionError('This JSON contains an empty array — nothing to convert.')

  const out = Papa.unparse(rows, { delimiter: target === 'tsv' ? '\t' : ',' })
  return { blob: new Blob([out], { type: TARGETS[target].mime }), meta: { rows: rows.length } }
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export async function convertFile(item, target, options) {
  const { file, source } = item
  if (!source.targets.includes(target)) {
    throw new ConversionError(`${source.label} files cannot be converted to ${TARGETS[target].label}.`)
  }

  let result
  switch (source.id) {
    case 'image':
    case 'svg':
      result = await convertImage(file, target, options)
      break
    case 'docx':
      result = await convertDocx(file, target)
      break
    case 'csv':
      result = await convertTabular(file, target, ',')
      break
    case 'tsv':
      result = await convertTabular(file, target, '\t')
      break
    case 'json':
      result = await convertJson(file, target)
      break
    default:
      throw new ConversionError('Unsupported file type.')
  }

  return {
    ...result,
    name: swapExtension(file.name, TARGETS[target].ext),
    size: result.blob.size,
  }
}
