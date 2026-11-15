/**
 * pdf.js plumbing: loading, page rendering, thumbnails.
 *
 * pdf.js does the reading (it can rasterise a page); pdf-lib does the writing
 * (it can assemble documents but cannot render). Every operation in this app is
 * some combination of those two.
 */

/**
 * pdf.js and its worker are ~1.7 MB together, and neither is needed until a file
 * is actually dropped — so they load on first use and are cached after that.
 *
 * The `legacy` build is deliberate: the default one calls very recent JS
 * builtins (`Map.prototype.getOrInsertComputed`) that Safari and any browser
 * more than a few months old do not have, and it fails at render time rather
 * than at import, so the failure looks like a broken PDF. The legacy build
 * carries the polyfills and behaves identically.
 */
let pdfjsPromise = null
function getPdfjs() {
  pdfjsPromise ??= (async () => {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ])
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })()
  return pdfjsPromise
}

export class PdfError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PdfError'
  }
}

/** Human-readable reasons, because "InvalidPDFException" helps nobody. */
function describe(err, filename) {
  const name = err?.name ?? ''
  if (name === 'PasswordException') {
    return `${filename} is password-protected. Remove the password in your PDF reader first.`
  }
  if (name === 'InvalidPDFException') {
    return `${filename} is not a readable PDF — the file may be truncated or corrupt.`
  }
  if (/encrypt/i.test(err?.message ?? '')) {
    return `${filename} is encrypted and cannot be edited.`
  }
  return `${filename} could not be opened: ${err?.message ?? 'unknown error'}`
}

/**
 * pdf.js takes ownership of the buffer it is given, so anything that needs the
 * bytes again (pdf-lib, a second render pass) must hold its own copy.
 */
export async function readBytes(file) {
  return new Uint8Array(await file.arrayBuffer())
}

export async function openDocument(bytes, filename = 'This file') {
  try {
    const pdfjs = await getPdfjs()
    return await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise
  } catch (err) {
    throw new PdfError(describe(err, filename))
  }
}

/** Renders one page onto a fresh canvas at `scale` (1 = 72 dpi). */
export async function renderPageToCanvas(doc, pageNumber, { scale = 1, targetWidth } = {}) {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const effective = targetWidth ? targetWidth / base.width : scale
  const viewport = page.getViewport({ scale: effective })

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d')

  // PDF pages are transparent by default; without this, anything saved as JPEG
  // comes out with a black background.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvasContext: ctx, viewport, background: '#ffffff' }).promise
  page.cleanup()
  return canvas
}

export function canvasToBlob(canvas, mime = 'image/jpeg', quality = 0.72) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new PdfError('The browser failed to encode a page image.'))),
      mime,
      quality,
    )
  })
}

export const THUMB_PAGE_LIMIT = 400

/**
 * Renders page previews one at a time, handing each back as it lands so the
 * grid fills in progressively instead of blocking on a 200-page document.
 */
export async function renderThumbnails(doc, { width = 150, onThumb, shouldStop } = {}) {
  const total = Math.min(doc.numPages, THUMB_PAGE_LIMIT)
  for (let n = 1; n <= total; n++) {
    if (shouldStop?.()) return
    try {
      const canvas = await renderPageToCanvas(doc, n, { targetWidth: width })
      const ratio = canvas.height / canvas.width
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.7)
      canvas.width = canvas.height = 0
      if (shouldStop?.()) return
      onThumb?.({ pageNumber: n, url: URL.createObjectURL(blob), ratio })
    } catch {
      onThumb?.({ pageNumber: n, url: null })
    }
    // Let React paint between pages.
    await new Promise((r) => setTimeout(r, 0))
  }
}

export async function pageDimensions(doc, pageNumber = 1) {
  const page = await doc.getPage(pageNumber)
  const { width, height } = page.getViewport({ scale: 1 })
  page.cleanup()
  return { width: Math.round(width), height: Math.round(height) }
}

/** Loads a document with pdf-lib for writing, with readable failures. */
export async function loadForEditing(bytes, filename = 'This file') {
  const { PDFDocument } = await import('pdf-lib')
  try {
    return await PDFDocument.load(bytes.slice())
  } catch (err) {
    if (/encrypt/i.test(err?.message ?? '')) {
      throw new PdfError(`${filename} is password-protected. Remove the password in your PDF reader first.`)
    }
    throw new PdfError(`${filename} could not be read: ${err?.message ?? 'unknown error'}`)
  }
}

/**
 * Parses "1-3, 5, 8-10" into a sorted, de-duplicated, 1-based page list.
 * Returns null when the text is unparseable so the caller can show a hint.
 */
export function parsePageRanges(text, max) {
  if (!text.trim()) return []
  const pages = new Set()
  for (const chunk of text.split(',')) {
    const part = chunk.trim()
    if (!part) continue
    const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/)
    const single = part.match(/^(\d+)$/)
    if (range) {
      let [, a, b] = range
      a = Number(a)
      b = Number(b)
      if (a < 1 || b < 1) return null
      const [lo, hi] = a <= b ? [a, b] : [b, a]
      for (let n = lo; n <= Math.min(hi, max); n++) pages.add(n)
    } else if (single) {
      const n = Number(single[1])
      if (n < 1) return null
      if (n <= max) pages.add(n)
    } else {
      return null
    }
  }
  return [...pages].sort((a, b) => a - b)
}

export function formatRanges(pages) {
  if (!pages.length) return ''
  const sorted = [...pages].sort((a, b) => a - b)
  const parts = []
  let start = sorted[0]
  let prev = sorted[0]
  for (const n of sorted.slice(1)) {
    if (n === prev + 1) {
      prev = n
      continue
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`)
    start = prev = n
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`)
  return parts.join(', ')
}
