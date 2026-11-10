/**
 * A small layout engine that sets markdown as a real PDF.
 *
 * Not a screenshot: text is embedded as text, so the output is selectable,
 * searchable and copyable, links are real annotations, and file size is
 * kilobytes rather than megabytes. The cost is that everything HTML does for
 * free — line breaking, page breaks, table measurement — has to be done here.
 */

import { marked } from 'marked'

/**
 * pdf-lib is ~435 kB and is only needed the moment someone exports, so it loads
 * on demand. The module handle is kept here because the layout functions below
 * need `rgb`, `PDFName` and `PDFString`, and they only ever run after this
 * resolves.
 */
let pdfLib = null
async function loadPdfLib() {
  pdfLib ??= await import('pdf-lib')
  return pdfLib
}
const rgb = (r, g, b) => pdfLib.rgb(r, g, b)

export class PdfError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PdfError'
  }
}

export const PAGE_SIZES = {
  a4: { label: 'A4', size: [595.28, 841.89] },
  letter: { label: 'US Letter', size: [612, 792] },
  a5: { label: 'A5', size: [419.53, 595.28] },
}

export const PRESETS = {
  book: {
    label: 'Book',
    note: 'Serif throughout, generous leading — for prose you expect someone to read.',
    body: 'Times-Roman',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    boldItalic: 'Times-BoldItalic',
    heading: 'Times-Bold',
    base: 11,
    leading: 1.6,
    headingScale: [2.0, 1.5, 1.24, 1.08, 1, 0.94],
  },
  report: {
    label: 'Report',
    note: 'Sans headings over a serif body — the classic document pairing.',
    body: 'Times-Roman',
    bold: 'Times-Bold',
    italic: 'Times-Italic',
    boldItalic: 'Times-BoldItalic',
    heading: 'Helvetica-Bold',
    base: 10.5,
    leading: 1.55,
    headingScale: [1.85, 1.42, 1.18, 1.04, 1, 0.94],
  },
  technical: {
    label: 'Technical',
    note: 'Sans throughout, tighter and denser — for specs, notes and handbooks.',
    body: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
    heading: 'Helvetica-Bold',
    base: 10,
    leading: 1.48,
    headingScale: [1.8, 1.4, 1.16, 1.02, 1, 0.94],
  },
}

/* ------------------------------------------------------------------ *
 * Text encoding
 * ------------------------------------------------------------------ */

// The Standard 14 PDF fonts are WinAnsi-encoded. Anything outside that has no
// glyph, and pdf-lib throws rather than dropping it silently.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const SUPPORTED = new RegExp(`^[\\x20-\\x7E\\xA0-\\xFF${WIN_ANSI_EXTRA}\\n\\t]$`)

// Characters common enough in technical writing to be worth transliterating
// rather than replacing with a question mark.
const TRANSLITERATE = {
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '⇐': '<=', '⇔': '<=>',
  '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~=', '±': '+/-',
  '∞': 'infinity', '×': 'x', '·': '-', '−': '-', '‑': '-', '​': '',
  '✓': 'v', '✔': 'v', '✗': 'x', '✘': 'x', '★': '*', '☆': '*',
  '⌘': 'Cmd', '⇧': 'Shift', '⌥': 'Alt', '⌃': 'Ctrl', '⏎': 'Enter',
  '“': '“', '”': '”', '‘': '‘', '’': '’', '…': '…', '–': '–', '—': '—',
  ' ': ' ', ' ': ' ', ' ': ' ',
}

/**
 * Makes a string safe for the Standard 14 fonts, collecting whatever had to be
 * dropped so the UI can say so instead of quietly mangling the document.
 */
export function toWinAnsi(text, dropped) {
  let out = ''
  for (const ch of text ?? '') {
    if (ch === '\t') {
      out += '  '
      continue
    }
    if (SUPPORTED.test(ch)) {
      out += ch
      continue
    }
    const swap = TRANSLITERATE[ch]
    if (swap !== undefined) {
      out += swap
      continue
    }
    dropped?.add(ch)
    out += '?'
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Inline tokens → styled runs
 * ------------------------------------------------------------------ */

function flattenInline(tokens, style = {}, out = [], dropped) {
  for (const t of tokens ?? []) {
    switch (t.type) {
      case 'strong':
        flattenInline(t.tokens, { ...style, bold: true }, out, dropped)
        break
      case 'em':
        flattenInline(t.tokens, { ...style, italic: true }, out, dropped)
        break
      case 'del':
        flattenInline(t.tokens, { ...style, strike: true }, out, dropped)
        break
      case 'link':
        flattenInline(t.tokens, { ...style, href: t.href }, out, dropped)
        break
      case 'codespan':
        out.push({ text: toWinAnsi(t.text, dropped), ...style, code: true })
        break
      case 'br':
        out.push({ text: '\n', ...style, hard: true })
        break
      case 'image':
        // An inline image inside a paragraph is rendered as its alt text; block
        // images are handled properly by the paragraph renderer.
        out.push({ text: toWinAnsi(t.text || t.href, dropped), ...style, italic: true })
        break
      case 'html':
        break // stripped: there is no HTML engine here to honour it
      default:
        if (t.tokens?.length) flattenInline(t.tokens, style, out, dropped)
        else if (t.text != null) out.push({ text: toWinAnsi(t.text, dropped), ...style })
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * The renderer
 * ------------------------------------------------------------------ */

class Layout {
  constructor(doc, fonts, opts) {
    this.doc = doc
    this.fonts = fonts
    this.opts = opts
    const [w, h] = PAGE_SIZES[opts.pageSize]?.size ?? PAGE_SIZES.a4.size
    this.pw = w
    this.ph = h
    this.m = opts.margin
    this.width = w - this.m * 2
    this.pages = []
    this.newPage()
  }

  newPage() {
    this.page = this.doc.addPage([this.pw, this.ph])
    this.pages.push(this.page)
    this.y = this.ph - this.m
    return this.page
  }

  get bottom() {
    // Leave room for the folio so body text never collides with it.
    return this.m - (this.opts.pageNumbers ? 6 : 0)
  }

  need(height) {
    if (this.y - height < this.bottom) this.newPage()
  }

  font(run) {
    const f = this.fonts
    if (run.code) return run.bold ? f.monoBold : f.mono
    if (run.bold && run.italic) return f.boldItalic
    if (run.bold) return f.bold
    if (run.italic) return f.italic
    return f.body
  }

  /** Greedy word wrap across styled runs. Returns lines of positioned pieces. */
  wrap(runs, size, maxWidth) {
    const lines = []
    let line = []
    let x = 0

    const push = () => {
      lines.push(line)
      line = []
      x = 0
    }

    for (const run of runs) {
      if (run.hard) {
        push()
        continue
      }
      const font = this.font(run)
      const runSize = run.code ? size * 0.92 : size
      // Keep the spaces as their own pieces so wrapping can drop a trailing one.
      const parts = run.text.split(/(\s+)/).filter((p) => p !== '')
      for (const part of parts) {
        if (/^\s+$/.test(part)) {
          // Any run of whitespace — including the newlines markdown leaves in a
          // soft-wrapped paragraph — collapses to one space. WinAnsi has no
          // glyph for a newline and pdf-lib throws rather than ignoring it.
          if (x === 0) continue // never a leading space on a wrapped line
          const sw = font.widthOfTextAtSize(' ', runSize)
          line.push({ ...run, text: ' ', font, size: runSize, x, width: sw })
          x += sw
          continue
        }
        const w = font.widthOfTextAtSize(part, runSize)
        if (x + w > maxWidth && line.length) push()
        if (w > maxWidth) {
          // A single unbreakable token wider than the column — break it by
          // character rather than letting it run off the page.
          let chunk = ''
          for (const ch of part) {
            const cw = font.widthOfTextAtSize(chunk + ch, runSize)
            if (x + cw > maxWidth && chunk) {
              line.push({ ...run, text: chunk, font, size: runSize, x, width: font.widthOfTextAtSize(chunk, runSize) })
              push()
              chunk = ch
            } else {
              chunk += ch
            }
          }
          if (chunk) {
            const cw = font.widthOfTextAtSize(chunk, runSize)
            line.push({ ...run, text: chunk, font, size: runSize, x, width: cw })
            x += cw
          }
          continue
        }
        line.push({ ...run, text: part, font, size: runSize, x, width: w })
        x += w
      }
    }
    if (line.length) lines.push(line)
    return lines
  }

  /**
   * Wraps a single line of code.
   *
   * The prose wrapper collapses whitespace, which would destroy indentation, so
   * code gets its own: leading spaces are kept, and an over-long line breaks by
   * character onto a hanging indent rather than running off the page.
   */
  wrapMono(text, font, size, maxWidth) {
    const expanded = text.replace(/\t/g, '  ')
    if (font.widthOfTextAtSize(expanded, size) <= maxWidth) return [expanded]

    const indent = (/^ */.exec(expanded) ?? [''])[0]
    const hang = font.widthOfTextAtSize(indent, size) <= maxWidth * 0.5 ? indent : ''
    const lines = []
    let current = ''
    for (const ch of expanded) {
      const candidate = current + ch
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current)
        current = hang + ch
      } else {
        current = candidate
      }
    }
    if (current) lines.push(current)
    return lines
  }

  measure(runs, size, maxWidth, lineHeight) {
    return this.wrap(runs, size, maxWidth).length * lineHeight
  }

  /** Draws wrapped lines, handling page breaks, links and strikethrough. */
  drawRuns(runs, { size, maxWidth, indent = 0, lineHeight, color, align = 'left' }) {
    const lines = this.wrap(runs, size, maxWidth)
    for (const line of lines) {
      this.need(lineHeight)
      this.y -= lineHeight
      const lineWidth = line.reduce((n, p) => n + p.width, 0)
      const offset = align === 'center' ? (maxWidth - lineWidth) / 2 : 0
      for (const piece of line) {
        const blank = !piece.text.trim()
        const x = this.m + indent + piece.x + offset
        const baseline = this.y + lineHeight * 0.22
        if (!blank) {
          this.page.drawText(piece.text, {
            x,
            y: baseline,
            size: piece.size,
            font: piece.font,
            color: piece.href ? this.opts.linkColor : (color ?? this.opts.textColor),
          })
        }
        // Rules and annotations continue through the spaces inside a link, so
        // "full manual" is one underlined phrase rather than two.
        if (piece.href) {
          this.page.drawLine({
            start: { x, y: baseline - 1.6 },
            end: { x: x + piece.width, y: baseline - 1.6 },
            thickness: 0.4,
            color: this.opts.linkColor,
          })
          this.addLink(piece.href, x, baseline - 2, piece.width, piece.size)
        }
        if (piece.strike && !blank) {
          this.page.drawLine({
            start: { x, y: baseline + piece.size * 0.28 },
            end: { x: x + piece.width, y: baseline + piece.size * 0.28 },
            thickness: 0.5,
            color: color ?? this.opts.textColor,
          })
        }
      }
    }
  }

  addLink(href, x, y, width, size) {
    try {
      const annot = this.doc.context.register(
        this.doc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x, y, x + width, y + size],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: pdfLib.PDFString.of(href) },
        }),
      )
      const existing = this.page.node.get(pdfLib.PDFName.of('Annots'))
      if (existing) existing.push(annot)
      else this.page.node.set(pdfLib.PDFName.of('Annots'), this.doc.context.obj([annot]))
    } catch {
      /* a malformed href should not abort the export */
    }
  }
}

/* ------------------------------------------------------------------ *
 * Images
 * ------------------------------------------------------------------ */

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load failed'))
    img.src = src
  })
}

/**
 * PDF can embed PNG and JPEG only, so anything else is re-encoded through a
 * canvas first. Remote images without permissive CORS headers taint the canvas
 * and cannot be embedded at all — that is reported, not swallowed.
 */
async function embedImage(doc, src) {
  if (/^data:image\/png/i.test(src)) {
    return doc.embedPng(src)
  }
  if (/^data:image\/jpe?g/i.test(src)) {
    return doc.embedJpg(src)
  }
  const img = await loadHtmlImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const dataUrl = canvas.toDataURL('image/png') // throws if the canvas is tainted
  return doc.embedPng(dataUrl)
}

/* ------------------------------------------------------------------ *
 * Block rendering
 * ------------------------------------------------------------------ */

async function renderTokens(tokens, L, ctx, indent = 0) {
  const { preset, dropped, warnings } = ctx
  const base = preset.base
  const lh = base * preset.leading
  const width = L.width - indent

  for (const token of tokens) {
    switch (token.type) {
      case 'space':
        break

      case 'heading': {
        const scale = preset.headingScale[token.depth - 1] ?? 1
        const size = base * scale
        const runs = flattenInline(token.tokens, { bold: true, headingFace: true }, [], dropped)
        const height = L.measure(runs, size, width, size * 1.22)
        // Never leave a heading stranded at the foot of a page.
        L.need(height + lh * 1.6)
        L.y -= token.depth === 1 ? base * 0.5 : base * 1.15
        L.drawRuns(runs, {
          size,
          maxWidth: width,
          indent,
          lineHeight: size * 1.22,
          color: ctx.headingColor,
        })
        if (token.depth <= 2) {
          L.page.drawLine({
            start: { x: L.m + indent, y: L.y - base * 0.32 },
            end: { x: L.m + indent + width, y: L.y - base * 0.32 },
            thickness: token.depth === 1 ? 0.9 : 0.4,
            color: ctx.ruleColor,
          })
          L.y -= base * 0.32
        }
        L.y -= base * 0.42
        break
      }

      case 'paragraph': {
        // A paragraph that is nothing but an image is a figure, not a sentence.
        const onlyImage =
          token.tokens?.length === 1 && token.tokens[0].type === 'image' ? token.tokens[0] : null
        if (onlyImage) {
          try {
            const embedded = await embedImage(L.doc, onlyImage.href)
            const scale = Math.min(1, width / embedded.width)
            const w = embedded.width * scale
            const h = embedded.height * scale
            if (h > L.ph - L.m * 2) {
              const fit = (L.ph - L.m * 2) / h
              L.need(h * fit)
              L.y -= h * fit
              L.page.drawImage(embedded, { x: L.m + indent, y: L.y, width: w * fit, height: h * fit })
            } else {
              L.need(h + lh * 0.6)
              L.y -= h
              L.page.drawImage(embedded, { x: L.m + indent + (width - w) / 2, y: L.y, width: w, height: h })
            }
            L.y -= lh * 0.7
          } catch {
            warnings.add(
              'One or more images could not be embedded. Remote images need permissive CORS headers — dropping the file into the editor instead always works.',
            )
            const runs = [{ text: toWinAnsi(`[image: ${onlyImage.text || onlyImage.href}]`, dropped), italic: true }]
            L.drawRuns(runs, { size: base, maxWidth: width, indent, lineHeight: lh, color: ctx.mutedColor })
            L.y -= lh * 0.5
          }
          break
        }
        L.drawRuns(flattenInline(token.tokens, {}, [], dropped), {
          size: base,
          maxWidth: width,
          indent,
          lineHeight: lh,
        })
        L.y -= lh * 0.55
        break
      }

      case 'blockquote': {
        const top = L.y
        const startPage = L.pages.length
        await renderTokens(token.tokens, L, ctx, indent + base * 1.1)
        // Only rule the quote when it did not straddle a page boundary; a bar
        // drawn from a stale y would run the wrong length.
        if (L.pages.length === startPage) {
          L.page.drawLine({
            start: { x: L.m + indent + 2, y: top - 2 },
            end: { x: L.m + indent + 2, y: L.y + lh * 0.3 },
            thickness: 1.6,
            color: ctx.accentColor,
          })
        }
        break
      }

      case 'list': {
        let index = token.start === '' || token.start == null ? 1 : Number(token.start)
        for (const item of token.items) {
          const marker = token.ordered ? `${index}.` : '•'
          const markerWidth = base * (token.ordered ? 1.55 : 1.1)
          L.need(lh)

          const markerY = L.y - lh + lh * 0.22
          if (item.task) {
            // Checkboxes are drawn, not typed: the font has no glyph for them.
            const s = base * 0.72
            L.page.drawRectangle({
              x: L.m + indent + 1,
              y: markerY - s * 0.12,
              width: s,
              height: s,
              borderWidth: 0.7,
              borderColor: ctx.mutedColor,
              color: item.checked ? ctx.accentColor : undefined,
            })
            if (item.checked) {
              L.page.drawText('v', {
                x: L.m + indent + 1 + s * 0.24,
                y: markerY + s * 0.02,
                size: s * 0.8,
                font: L.fonts.bold,
                color: rgb(1, 1, 1),
              })
            }
          } else {
            L.page.drawText(marker, {
              x: L.m + indent,
              y: markerY,
              size: base,
              font: L.fonts.body,
              color: ctx.mutedColor,
            })
          }

          const before = L.y
          await renderTokens(item.tokens, L, ctx, indent + markerWidth)
          if (L.y === before) L.y -= lh
          index += 1
        }
        L.y -= lh * 0.35
        break
      }

      case 'code': {
        const size = base * 0.86
        const codeLh = size * 1.45
        const pad = base * 0.6
        const lines = []
        for (const raw of toWinAnsi(token.text, dropped).split('\n')) {
          lines.push(...L.wrapMono(raw, L.fonts.mono, size, width - pad * 2))
        }

        let i = 0
        while (i < lines.length) {
          // Fit as many lines as the remaining page allows, then continue the
          // block on the next page with its own panel.
          const available = Math.max(1, Math.floor((L.y - L.bottom - pad * 2) / codeLh))
          if (available < 2 && i === 0) L.newPage()
          const room = Math.max(1, Math.floor((L.y - L.bottom - pad * 2) / codeLh))
          const slice = lines.slice(i, i + room)
          const boxHeight = slice.length * codeLh + pad * 2
          L.page.drawRectangle({
            x: L.m + indent,
            y: L.y - boxHeight,
            width,
            height: boxHeight,
            color: ctx.codeBg,
            borderColor: ctx.ruleColor,
            borderWidth: 0.5,
          })
          let ly = L.y - pad
          for (const line of slice) {
            ly -= codeLh
            if (!line.trim()) continue
            L.page.drawText(line, {
              x: L.m + indent + pad,
              y: ly + codeLh * 0.24,
              size,
              font: L.fonts.mono,
              color: ctx.codeColor,
            })
          }
          L.y -= boxHeight
          i += slice.length
          if (i < lines.length) L.newPage()
        }
        L.y -= lh * 0.6
        break
      }

      case 'table': {
        await renderTable(token, L, ctx, indent, width)
        break
      }

      case 'hr':
        L.need(lh)
        L.y -= lh * 0.8
        L.page.drawLine({
          start: { x: L.m + indent, y: L.y },
          end: { x: L.m + indent + width, y: L.y },
          thickness: 0.5,
          color: ctx.ruleColor,
        })
        L.y -= lh * 0.8
        break

      case 'html':
        break

      default: {
        const runs = flattenInline(token.tokens ?? [{ type: 'text', text: token.text ?? '' }], {}, [], dropped)
        if (runs.length) {
          L.drawRuns(runs, { size: base, maxWidth: width, indent, lineHeight: lh })
          L.y -= lh * 0.35
        }
      }
    }
  }
}

async function renderTable(token, L, ctx, indent, width) {
  const { preset, dropped } = ctx
  const size = preset.base * 0.94
  const lh = size * 1.4
  const pad = size * 0.5

  const header = token.header.map((c) => flattenInline(c.tokens, { bold: true }, [], dropped))
  const rows = token.rows.map((r) => r.map((c) => flattenInline(c.tokens, {}, [], dropped)))
  const columns = header.length

  // Natural width per column, then shrink proportionally to fit the measure.
  const natural = header.map((cell, i) => {
    const widest = [cell, ...rows.map((r) => r[i] ?? [])].reduce((max, runs) => {
      const w = runs.reduce((n, run) => n + L.font(run).widthOfTextAtSize(run.text, size), 0)
      return Math.max(max, w)
    }, 0)
    return Math.max(widest + pad * 2, size * 3)
  })

  const total = natural.reduce((a, b) => a + b, 0)
  const widths =
    total <= width ? natural.map((w) => w + (width - total) / columns) : natural.map((w) => (w / total) * width)

  const rowHeightOf = (cells) => {
    const heights = cells.map((runs, i) => L.measure(runs, size, widths[i] - pad * 2, lh))
    return Math.max(lh, ...heights) + pad
  }

  const drawRow = (cells, { bold = false } = {}) => {
    const rowHeight = rowHeightOf(cells)
    L.need(rowHeight + 2)
    const top = L.y
    // Column offset from the left margin. It goes through drawRuns' indent
    // rather than by moving L.m: the page's bottom limit and the top of a new
    // page are both derived from L.m, so shifting it per column made the
    // right-hand cells think the page was full and break mid-row.
    let offset = indent
    for (let i = 0; i < columns; i++) {
      L.drawRuns(cells[i] ?? [], {
        size,
        maxWidth: widths[i] - pad * 2,
        indent: offset + pad,
        lineHeight: lh,
        color: bold ? ctx.headingColor : undefined,
      })
      L.y = top
      offset += widths[i]
    }
    L.y = top - rowHeight
    L.page.drawLine({
      start: { x: L.m + indent, y: L.y },
      end: { x: L.m + indent + width, y: L.y },
      thickness: bold ? 1 : 0.4,
      color: bold ? ctx.mutedColor : ctx.ruleColor,
    })
    return rowHeight
  }

  L.y -= preset.base * 0.5
  L.need(lh * 3)
  drawRow(header, { bold: true })
  for (const row of rows) {
    if (L.y - rowHeightOf(row) - 2 < L.bottom) {
      // Carry the header onto the next page so the columns stay readable.
      L.newPage()
      drawRow(header, { bold: true })
    }
    drawRow(row)
  }
  L.y -= preset.base * 0.9
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

export async function markdownToPdf(markdown, options = {}) {
  const {
    preset: presetId = 'report',
    pageSize = 'a4',
    margin = 64,
    pageNumbers = true,
    title = '',
  } = options

  const preset = PRESETS[presetId] ?? PRESETS.report
  if (!markdown?.trim()) throw new PdfError('There is nothing to export yet.')

  const { PDFDocument } = await loadPdfLib()
  const doc = await PDFDocument.create()
  const fonts = {
    body: await doc.embedFont(preset.body),
    bold: await doc.embedFont(preset.bold),
    italic: await doc.embedFont(preset.italic),
    boldItalic: await doc.embedFont(preset.boldItalic),
    heading: await doc.embedFont(preset.heading),
    mono: await doc.embedFont('Courier'),
    monoBold: await doc.embedFont('Courier-Bold'),
    sans: await doc.embedFont('Helvetica'),
  }

  const ctx = {
    preset,
    dropped: new Set(),
    warnings: new Set(),
    headingColor: rgb(0.08, 0.08, 0.07),
    mutedColor: rgb(0.45, 0.45, 0.42),
    ruleColor: rgb(0.82, 0.81, 0.78),
    accentColor: rgb(0.36, 0.44, 0.29),
    codeBg: rgb(0.965, 0.96, 0.95),
    codeColor: rgb(0.16, 0.16, 0.15),
  }

  const L = new Layout(doc, fonts, {
    pageSize,
    margin,
    pageNumbers,
    textColor: rgb(0.1, 0.1, 0.09),
    linkColor: rgb(0.29, 0.38, 0.24),
  })

  // Headings use the preset's heading face; the run flattener only knows about
  // body weights, so swap the family in for heading runs.
  const originalFont = L.font.bind(L)
  L.font = (run) => (run.headingFace ? fonts.heading : originalFont(run))

  const tokens = marked.lexer(markdown, { gfm: true })
  await renderTokens(tokens, L, ctx)

  if (pageNumbers && L.pages.length > 0) {
    L.pages.forEach((page, i) => {
      const label = `${i + 1}`
      const w = fonts.sans.widthOfTextAtSize(label, 8.5)
      page.drawText(label, {
        x: (L.pw - w) / 2,
        y: margin * 0.48,
        size: 8.5,
        font: fonts.sans,
        color: ctx.mutedColor,
      })
    })
  }

  doc.setTitle(title || 'Document')
  doc.setProducer('QUIRE')
  doc.setCreator('QUIRE — markdown to PDF')
  doc.setCreationDate(new Date())

  const bytes = await doc.save()
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    pages: L.pages.length,
    dropped: [...ctx.dropped],
    warnings: [...ctx.warnings],
  }
}
