/**
 * The five document operations. Each returns `{ blob, name, size }` or an array
 * of those, and throws `PdfError` with a message meant for a human.
 */

import { PdfError, canvasToBlob, loadForEditing, openDocument, renderPageToCanvas } from './pdf.js'

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
}

function stem(name) {
  return name.replace(/\.[^.]+$/, '')
}

async function finish(pdfDoc, name) {
  const bytes = await pdfDoc.save()
  const blob = new Blob([bytes], { type: 'application/pdf' })
  return { blob, name, size: blob.size }
}

/* ---------------------------------------------------------------- merge --- */

export async function mergePdfs(docs, { outputName = 'merged.pdf', onProgress } = {}) {
  if (docs.length < 2) throw new PdfError('Add at least two PDFs to merge.')
  const { PDFDocument } = await import('pdf-lib')
  const out = await PDFDocument.create()

  for (const [i, doc] of docs.entries()) {
    onProgress?.(i / docs.length, doc.name)
    const src = await loadForEditing(doc.bytes, doc.name)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }

  onProgress?.(1)
  if (out.getPageCount() === 0) throw new PdfError('The merged document came out empty.')
  return finish(out, outputName)
}

/* ---------------------------------------------------------------- split --- */

/** Pulls the given 1-based pages into a single new document, in the order given. */
export async function extractPages(doc, pages, { outputName } = {}) {
  if (!pages.length) throw new PdfError('Select at least one page.')
  const { PDFDocument } = await import('pdf-lib')
  const src = await loadForEditing(doc.bytes, doc.name)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, pages.map((n) => n - 1))
  copied.forEach((p) => out.addPage(p))
  return finish(out, outputName ?? `${stem(doc.name)}-pages-${pages.length}.pdf`)
}

/** One file per page, ready to be zipped. */
export async function burstPages(doc, pages, { onProgress } = {}) {
  if (!pages.length) throw new PdfError('Select at least one page.')
  const { PDFDocument } = await import('pdf-lib')
  const src = await loadForEditing(doc.bytes, doc.name)
  const width = String(Math.max(...pages)).length
  const results = []

  for (const [i, n] of pages.entries()) {
    onProgress?.(i / pages.length, `page ${n}`)
    const out = await PDFDocument.create()
    const [page] = await out.copyPages(src, [n - 1])
    out.addPage(page)
    results.push(await finish(out, `${stem(doc.name)}-${String(n).padStart(width, '0')}.pdf`))
    await new Promise((r) => setTimeout(r, 0))
  }

  onProgress?.(1)
  return results
}

/* ------------------------------------------------------------- compress --- */

/**
 * Two honest strategies:
 *
 * `restructure` rewrites the file with pdf-lib, which drops orphaned objects and
 * incremental-update history. Text stays text and quality is untouched, but the
 * saving is whatever cruft happened to be in there — sometimes a lot, sometimes
 * nothing at all.
 *
 * `rasterise` re-renders every page to a JPEG at a chosen resolution. It shrinks
 * almost anything dramatically, at the cost of turning text into pixels.
 */
export async function compressPdf(doc, { mode, dpi = 120, quality = 0.7, onProgress } = {}) {
  if (mode === 'restructure') {
    onProgress?.(0.15)
    const src = await loadForEditing(doc.bytes, doc.name)
    onProgress?.(0.7)
    const result = await finish(src, `${stem(doc.name)}-optimised.pdf`)
    onProgress?.(1)
    return result
  }

  const { PDFDocument } = await import('pdf-lib')
  const pdfjsDoc = await openDocument(doc.bytes, doc.name)
  const out = await PDFDocument.create()
  const scale = dpi / 72

  try {
    for (let n = 1; n <= pdfjsDoc.numPages; n++) {
      onProgress?.((n - 1) / pdfjsDoc.numPages, `page ${n} of ${pdfjsDoc.numPages}`)
      const canvas = await renderPageToCanvas(pdfjsDoc, n, { scale })
      const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality)
      const embedded = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()))
      // Keep the original page geometry in points so paper size is preserved.
      const page = out.addPage([canvas.width / scale, canvas.height / scale])
      page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
      canvas.width = canvas.height = 0
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    pdfjsDoc.destroy()
  }

  onProgress?.(1)
  return finish(out, `${stem(doc.name)}-compressed.pdf`)
}

/* --------------------------------------------------------- images → pdf --- */

async function decodeImage(file) {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new PdfError(`${file.name} could not be decoded as an image.`)
  }
}

export async function imagesToPdf(items, { pageSize = 'fit', margin = 36, outputName = 'images.pdf', onProgress } = {}) {
  if (!items.length) throw new PdfError('Add at least one image.')
  const { PDFDocument } = await import('pdf-lib')
  const out = await PDFDocument.create()

  for (const [i, item] of items.entries()) {
    onProgress?.(i / items.length, item.file.name)
    const bitmap = await decodeImage(item.file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    // Flatten onto white: PDF has no notion of a transparent page.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close?.()

    const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.88)
    const embedded = await out.embedJpg(new Uint8Array(await jpeg.arrayBuffer()))
    const { width: iw, height: ih } = canvas

    if (pageSize === 'fit') {
      const page = out.addPage([iw, ih])
      page.drawImage(embedded, { x: 0, y: 0, width: iw, height: ih })
    } else {
      const [pw, ph] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.a4
      const [pageW, pageH] = iw > ih ? [ph, pw] : [pw, ph]
      const scale = Math.min((pageW - margin * 2) / iw, (pageH - margin * 2) / ih)
      const w = iw * scale
      const h = ih * scale
      const page = out.addPage([pageW, pageH])
      page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h })
    }

    canvas.width = canvas.height = 0
    await new Promise((r) => setTimeout(r, 0))
  }

  onProgress?.(1)
  return finish(out, outputName)
}

/* --------------------------------------------------------- pdf → images --- */

export async function pdfToImages(doc, { pages, format = 'png', dpi = 150, quality = 0.9, onProgress } = {}) {
  const pdfjsDoc = await openDocument(doc.bytes, doc.name)
  const list = pages?.length ? pages : Array.from({ length: pdfjsDoc.numPages }, (_, i) => i + 1)
  const mime = format === 'png' ? 'image/png' : 'image/jpeg'
  const ext = format === 'png' ? 'png' : 'jpg'
  const width = String(Math.max(...list)).length
  const results = []
  const scale = dpi / 72

  try {
    for (const [i, n] of list.entries()) {
      onProgress?.(i / list.length, `page ${n}`)
      const canvas = await renderPageToCanvas(pdfjsDoc, n, { scale })
      const blob = await canvasToBlob(canvas, mime, quality)
      canvas.width = canvas.height = 0
      results.push({
        blob,
        name: `${stem(doc.name)}-${String(n).padStart(width, '0')}.${ext}`,
        size: blob.size,
      })
      await new Promise((r) => setTimeout(r, 0))
    }
  } finally {
    pdfjsDoc.destroy()
  }

  onProgress?.(1)
  return results
}
