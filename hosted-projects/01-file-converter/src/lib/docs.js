/**
 * Document conversions: PDF, Word, Markdown, HTML and plain text.
 *
 * Every reader turns its input into one small block model, and every writer
 * turns that model back out. That keeps the routing table honest: adding a
 * reader makes every writer available to it, and the other way round.
 *
 *   run    { text, bold?, italic?, code?, strike?, href? }   ('\n' = line break)
 *   block  heading   { level 1-6, runs }
 *          paragraph { runs }
 *          list      { ordered, items: [{ runs, level }] }
 *          quote     { runs }
 *          code      { text }
 *          table     { rows: [{ header, cells: [runs] }] }
 *          image     { bytes, mime, width, height, alt }
 *          hr | pagebreak
 *
 * Heavy libraries (pdf.js, docx, pdfmake, mammoth, marked) load on first use.
 */

import { ConversionError } from './errors.js'

/* ------------------------------------------------------------------ *
 * Lazy libraries
 * ------------------------------------------------------------------ */

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

async function getMammoth() {
  // The prebuilt browser bundle avoids pulling Node's zlib/buffer polyfills
  // into the graph. It is UMD, so unwrap whatever the interop layer hands back.
  const mod = await import('mammoth/mammoth.browser.js')
  return mod.default ?? mod
}

const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/
const GEORGIAN_SPLIT = /([Ⴀ-ჿᲐ-Ჿⴀ-⴯]+)/

let pdfMakePromise = null
function getPdfMake() {
  pdfMakePromise ??= (async () => {
    const [mod, vfs] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
    const pdfMake = mod.default ?? mod
    pdfMake.addVirtualFileSystem(vfs.default ?? vfs)
    return pdfMake
  })()
  return pdfMakePromise
}

let georgianPromise = null
/** Roboto has no Georgian glyphs, so Georgian runs switch to Noto Sans Georgian. */
function loadGeorgianFont(pdfMake) {
  georgianPromise ??= (async () => {
    const [regular, bold] = await Promise.all([
      import('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-400-normal.woff?url'),
      import('@fontsource/noto-sans-georgian/files/noto-sans-georgian-georgian-700-normal.woff?url'),
    ])
    const toBase64 = async (url) => {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
      let s = ''
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      return btoa(s)
    }
    pdfMake.addVirtualFileSystem({
      'NotoGeorgian-Regular.woff': await toBase64(regular.default),
      'NotoGeorgian-Bold.woff': await toBase64(bold.default),
    })
    pdfMake.addFonts({
      NotoGeorgian: {
        normal: 'NotoGeorgian-Regular.woff',
        bold: 'NotoGeorgian-Bold.woff',
        italics: 'NotoGeorgian-Regular.woff',
        bolditalics: 'NotoGeorgian-Bold.woff',
      },
    })
  })()
  return georgianPromise
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const plain = (runs) => runs.map((r) => r.text).join('')
const sameStyle = (a, b) =>
  !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.code === !!b.code && !!a.strike === !!b.strike && a.href === b.href

/** Merge neighbouring runs that look the same, and trim the edges. */
function tidyRuns(runs) {
  const out = []
  for (const run of runs) {
    if (!run.text) continue
    const last = out[out.length - 1]
    if (last && last.text !== '\n' && run.text !== '\n' && sameStyle(last, run)) last.text += run.text
    else out.push({ ...run })
  }
  while (out.length && /^\s*$/.test(out[0].text) && out[0].text !== '\n') out.shift()
  while (out.length && (out[out.length - 1].text === '\n' || /^\s*$/.test(out[out.length - 1].text))) out.pop()
  if (out.length) {
    out[0].text = out[0].text.replace(/^\s+/, '')
    out[out.length - 1].text = out[out.length - 1].text.replace(/\s+$/, '')
  }
  // Styled runs never start or end in a space ("**state **without" breaks Markdown and Word alike).
  const final = []
  for (const run of out) {
    const styled = run.bold || run.italic || run.code || run.strike || run.href
    const m = styled && run.text !== '\n' && /^(\s*)(.*?)(\s*)$/s.exec(run.text)
    if (!m || (!m[1] && !m[3])) {
      final.push(run)
      continue
    }
    if (m[1]) final.push({ text: m[1] })
    if (m[2]) final.push({ ...run, text: m[2] })
    if (m[3]) final.push({ text: m[3] })
  }
  return final
}

function dataUriToBytes(uri) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri)
  if (!match) return null
  const [, mime, b64, payload] = match
  if (!b64) return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) }
  const bin = atob(payload)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { mime, bytes }
}

function bytesToDataUri(bytes, mime) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${mime};base64,${btoa(s)}`
}

/** Decode once to learn the size, and re-encode anything that isn't PNG/JPEG. */
async function normaliseImage(bytes, mime) {
  let bitmap
  try {
    bitmap = await createImageBitmap(new Blob([bytes], { type: mime }))
  } catch {
    return null
  }
  const { width, height } = bitmap
  if (mime === 'image/png' || mime === 'image/jpeg') {
    bitmap.close?.()
    return { bytes, mime, width, height }
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)
  bitmap.close?.()
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return null
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png', width, height }
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ------------------------------------------------------------------ *
 * Readers
 * ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'HR', 'IMG', 'FIGURE'])

/** HTML (from mammoth, marked, or a dropped .html file) to blocks. */
export async function htmlToBlocks(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style, noscript, template, iframe, object, head').forEach((n) => n.remove())
  const blocks = []
  const pendingImages = []

  const inline = (node, style = {}, out = []) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent.replace(/\s+/g, ' ')
        if (text) out.push({ text, ...style })
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      const tag = child.tagName
      if (tag === 'BR') out.push({ text: '\n' })
      else if (tag === 'IMG') pendingImages.push(child)
      else if (tag === 'STRONG' || tag === 'B') inline(child, { ...style, bold: true }, out)
      else if (tag === 'EM' || tag === 'I') inline(child, { ...style, italic: true }, out)
      else if (tag === 'CODE' || tag === 'KBD' || tag === 'SAMP') inline(child, { ...style, code: true }, out)
      else if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') inline(child, { ...style, strike: true }, out)
      else if (tag === 'A') {
        const href = child.getAttribute('href')
        inline(child, href && /^(https?:|mailto:)/i.test(href) ? { ...style, href } : style, out)
      } else inline(child, style, out)
    }
    return out
  }

  const flushImages = async () => {
    while (pendingImages.length) {
      const img = pendingImages.shift()
      const decoded = dataUriToBytes(img.getAttribute('src') || '')
      const alt = img.getAttribute('alt') || ''
      const norm = decoded && (await normaliseImage(decoded.bytes, decoded.mime))
      // Remote images are not fetched: nothing leaves the tab. Keep the alt text.
      if (norm) blocks.push({ type: 'image', ...norm, alt })
      else if (alt) blocks.push({ type: 'paragraph', runs: [{ text: `[${alt}]`, italic: true }] })
    }
  }

  const list = (el, ordered, level, items) => {
    for (const li of el.children) {
      if (li.tagName !== 'LI') continue
      const clone = li.cloneNode(true)
      clone.querySelectorAll(':scope > ul, :scope > ol').forEach((n) => n.remove())
      const runs = tidyRuns(inline(clone))
      if (runs.length) items.push({ runs, level })
      for (const sub of li.children) {
        if (sub.tagName === 'UL' || sub.tagName === 'OL') list(sub, sub.tagName === 'OL', Math.min(level + 1, 4), items)
      }
    }
    return items
  }

  const walk = async (parent) => {
    let loose = []
    const flushLoose = () => {
      const runs = tidyRuns(loose)
      if (runs.length) blocks.push({ type: 'paragraph', runs })
      loose = []
    }
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        loose.push({ text: node.textContent.replace(/\s+/g, ' ') })
        continue
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue
      const tag = node.tagName
      if (!BLOCK_TAGS.has(tag) && !['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'HEADER', 'FOOTER', 'NAV', 'ASIDE', 'BODY', 'DL', 'DD', 'DT'].includes(tag)) {
        loose.push(...inline({ childNodes: [node] }))
        continue
      }
      flushLoose()
      if (/^H[1-6]$/.test(tag)) {
        const runs = tidyRuns(inline(node))
        if (runs.length) blocks.push({ type: 'heading', level: Number(tag[1]), runs })
      } else if (tag === 'P' || tag === 'DT' || tag === 'DD') {
        const runs = tidyRuns(inline(node))
        if (runs.length) blocks.push({ type: 'paragraph', runs })
      } else if (tag === 'UL' || tag === 'OL') {
        const items = list(node, tag === 'OL', 0, [])
        if (items.length) blocks.push({ type: 'list', ordered: tag === 'OL', items })
      } else if (tag === 'BLOCKQUOTE') {
        const paras = node.querySelectorAll('p').length ? [...node.querySelectorAll('p')] : [node]
        for (const p of paras) {
          const runs = tidyRuns(inline(p))
          if (runs.length) blocks.push({ type: 'quote', runs })
        }
      } else if (tag === 'PRE') {
        blocks.push({ type: 'code', text: node.textContent.replace(/\n$/, '') })
      } else if (tag === 'TABLE') {
        const rows = [...node.querySelectorAll('tr')].map((tr) => ({
          header: tr.parentElement?.tagName === 'THEAD' || [...tr.children].every((c) => c.tagName === 'TH'),
          cells: [...tr.children].map((cell) => tidyRuns(inline(cell))),
        }))
        if (rows.length) blocks.push({ type: 'table', rows })
      } else if (tag === 'HR') {
        blocks.push({ type: 'hr' })
      } else if (tag === 'IMG') {
        pendingImages.push(node)
      } else {
        await walk(node)
      }
      await flushImages()
    }
    flushLoose()
    await flushImages()
  }

  await walk(doc.body)
  return blocks
}

export async function markdownToBlocks(text) {
  const { marked } = await import('marked')
  return htmlToBlocks(marked.parse(text, { gfm: true }))
}

export function textToBlocks(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.replace(/\s+$/, ''))
    .filter((chunk) => chunk.trim())
    .map((chunk) => ({
      type: 'paragraph',
      runs: chunk.split('\n').flatMap((line, i) => (i ? [{ text: '\n' }, { text: line }] : [{ text: line }])),
    }))
}

export async function docxToBlocks(file) {
  const mammoth = await getMammoth()
  try {
    const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
    return htmlToBlocks(value)
  } catch {
    throw new ConversionError('Could not read this .docx — the document could not be parsed. Old .doc files are not supported.')
  }
}

const MAX_PDF_PAGES = 500

async function openPdf(file) {
  const pdfjs = await getPdfjs()
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise
  } catch (err) {
    if (err?.name === 'PasswordException') throw new ConversionError('This PDF is password-protected. Remove the password and try again.')
    throw new ConversionError('Could not open this PDF — it may be corrupt.')
  }
}

const BULLET = /^\s*([•●▪◦‣∙·○■□➢►–\-*\uF0B7\uF0A7\uF0D8\uF076])\s+/
const ORDERED = /^\s*(\d{1,3}|[a-z]|[ivx]{1,4})[.)]\s+/i

/**
 * PDF to blocks. A PDF stores positioned glyph runs, not paragraphs, so this
 * rebuilds structure from geometry: items on one baseline form a line, lines
 * close together with the same size form a paragraph, larger type becomes a
 * heading, and a leading bullet or number starts a list item. Running headers,
 * footers and page numbers that repeat on most pages are dropped.
 */
export async function pdfToBlocks(file) {
  const pdf = await openPdf(file)
  if (pdf.numPages > MAX_PDF_PAGES) throw new ConversionError(`This PDF has ${pdf.numPages} pages — the limit is ${MAX_PDF_PAGES}.`)

  const pages = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    // Font objects (with their real PostScript names) appear once the operator list is built.
    await page.getOperatorList().catch(() => {})
    const fontInfo = new Map()
    const fontOf = (name) => {
      if (!fontInfo.has(name)) {
        let real = ''
        try {
          real = page.commonObjs.get(name)?.name ?? ''
        } catch {
          /* not loaded */
        }
        fontInfo.set(name, {
          bold: /bold|black|heavy|semibold|demi|medium/i.test(real),
          italic: /italic|oblique/i.test(real),
          mono: /mono|courier|consol|code/i.test(real) || /monospace/i.test(content.styles[name]?.fontFamily ?? ''),
        })
      }
      return fontInfo.get(name)
    }

    const items = content.items
      .filter((it) => typeof it.str === 'string' && it.str.length)
      .map((it) => {
        const [, , c, d, x, y] = it.transform
        const size = Math.round(Math.hypot(c, d) * 10) / 10 || it.height || 10
        return { str: it.str, x, y, w: it.width, size, ...fontOf(it.fontName) }
      })
      .sort((a, b) => b.y - a.y || a.x - b.x)

    const lines = []
    for (const it of items) {
      const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(l.size, it.size) * 0.45)
      if (line) {
        line.items.push(it)
        line.size = Math.max(line.size, it.size)
      } else lines.push({ y: it.y, size: it.size, items: [it] })
    }
    lines.sort((a, b) => b.y - a.y)
    // A wide gap on one baseline means separate columns (a name left, a date right):
    // split them into their own lines rather than gluing them into one sentence.
    const split = []
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x)
      let seg = null
      for (const it of line.items) {
        if (!seg || it.x - (seg.items[seg.items.length - 1].x + seg.items[seg.items.length - 1].w) > it.size * 3) {
          seg = { y: line.y, size: 0, items: [] }
          split.push(seg)
        }
        seg.items.push(it)
        seg.size = Math.max(seg.size, it.size)
      }
    }
    for (const line of split) {
      const runs = []
      let end = null
      for (const it of line.items) {
        if (end !== null && it.x - end > it.size * 0.18 && !/\s$/.test(runs[runs.length - 1]?.text ?? '') && !/^\s/.test(it.str)) {
          runs.push({ text: ' ' })
        }
        runs.push({ text: it.str, bold: it.bold || undefined, italic: it.italic || undefined, code: it.mono || undefined })
        end = it.x + it.w
      }
      line.runs = tidyRuns(runs)
      line.text = plain(line.runs)
      line.x = line.items[0].x
      line.right = end
    }
    lines.length = 0
    lines.push(...split)
    pages.push(lines.filter((l) => l.text.trim()))
  }

  if (!pages.some((p) => p.length)) {
    throw new ConversionError('This PDF has no text layer — it is probably a scan. Convert it to PNG or JPG instead.')
  }

  // Running headers and footers: the same first/last line text on most pages.
  const edgeKey = (l) => l.text.replace(/\d+/g, '#').trim()
  const counts = new Map()
  for (const lines of pages) {
    for (const l of [lines[0], lines[lines.length - 1]]) if (l) counts.set(edgeKey(l), (counts.get(edgeKey(l)) ?? 0) + 1)
  }
  const repeated = (l) => pages.length >= 3 && counts.get(edgeKey(l)) >= Math.ceil(pages.length * 0.6)
  for (let p = 0; p < pages.length; p++) {
    pages[p] = pages[p].filter((l, i, arr) => {
      const edge = i === 0 || i === arr.length - 1
      if (!edge) return true
      if (/^\s*(page\s*)?\d+(\s*(of|\/)\s*\d+)?\s*$/i.test(l.text)) return false
      return !repeated(l)
    })
  }

  // Body size: the size carrying the most characters.
  const weight = new Map()
  for (const lines of pages) for (const l of lines) weight.set(l.size, (weight.get(l.size) ?? 0) + l.text.length)
  const body = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10
  const headingSizes = [...weight.keys()].filter((s) => s >= body * 1.15).sort((a, b) => b - a)
  const levelOf = (size) => Math.min(headingSizes.indexOf(size) + 1, 3) || 3

  const blocks = []
  let current = null
  const close = () => {
    if (!current) return
    current.runs = tidyRuns(current.runs)
    if (current.type === 'listitem') {
      const last = blocks[blocks.length - 1]
      const item = { runs: current.runs, level: 0 }
      if (last?.type === 'list' && last.ordered === current.ordered) last.items.push(item)
      else blocks.push({ type: 'list', ordered: current.ordered, items: [item] })
    } else if (current.runs.length) {
      // A short, all-capitals line standing on its own is a section label.
      const text = plain(current.runs)
      if (current.type === 'paragraph' && (current.lines ?? 1) === 1 && text.length <= 40 && /^[^a-z]*[A-Z]{3}[^a-z]*$/.test(text)) {
        current = { type: 'heading', level: Math.min(headingSizes.length + 1, 3), runs: current.runs }
      }
      // Headings are bold already; bold runs inside them are noise.
      if (current.type === 'heading') current.runs = current.runs.map(({ bold, ...r }) => r)
      blocks.push(current)
    }
    current = null
  }
  const append = (runs) => {
    const prev = current.runs[current.runs.length - 1]
    if (prev && /[A-Za-z]-$/.test(prev.text) && /^[a-z]/.test(runs[0]?.text ?? '')) prev.text = prev.text.slice(0, -1)
    else if (prev && runs[0] && sameStyle(prev, runs[0])) prev.text += ' '
    else current.runs.push({ text: ' ' })
    current.runs.push(...runs)
    current.lines = (current.lines ?? 1) + 1
  }

  for (const lines of pages) {
    const widest = Math.max(...lines.map((l) => l.right - l.x), 1)
    const left = Math.min(...lines.map((l) => l.x))
    let prev = null
    for (const line of lines) {
      const isHeading = line.size >= body * 1.15 && line.text.length < 160
      const bullet = BULLET.exec(line.text)
      const ordered = !bullet && ORDERED.exec(line.text)
      const gap = prev ? prev.y - line.y : 0
      const newPara =
        !current ||
        !prev ||
        gap > Math.max(prev.size, line.size) * 1.75 ||
        Math.abs(line.size - (current.size ?? line.size)) > body * 0.08 ||
        (current.type === 'paragraph' && prev.right - left < widest * 0.72 && /[.!?:"”)]$/.test(prev.text)) ||
        (current.type === 'heading') !== isHeading

      if (bullet || ordered) {
        close()
        const strip = (bullet ?? ordered)[0].length
        const runs = tidyRuns(stripLead(line.runs, strip))
        current = { type: 'listitem', ordered: !!ordered, runs, size: line.size }
      } else if (current?.type === 'listitem' && !newPara && line.x > left + 2) {
        append(line.runs)
      } else if (newPara) {
        close()
        current = isHeading
          ? { type: 'heading', level: levelOf(line.size), runs: [...line.runs], size: line.size }
          : { type: 'paragraph', runs: [...line.runs], size: line.size }
      } else {
        append(line.runs)
      }
      prev = line
    }
  }
  close()
  for (const b of blocks) {
    delete b.size
    delete b.lines
  }
  return blocks
}

function stripLead(runs, count) {
  const out = runs.map((r) => ({ ...r }))
  let left = count
  while (left > 0 && out.length) {
    const first = out[0]
    if (first.text.length <= left) {
      left -= first.text.length
      out.shift()
    } else {
      first.text = first.text.slice(left)
      left = 0
    }
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Writers
 * ------------------------------------------------------------------ */

export function blocksToText(blocks) {
  const out = []
  for (const b of blocks) {
    if (b.type === 'list') b.items.forEach((it, i) => out.push(`${'  '.repeat(it.level)}${b.ordered ? `${i + 1}.` : '•'} ${plain(it.runs)}`))
    else if (b.type === 'table') out.push(b.rows.map((r) => r.cells.map(plain).join('\t')).join('\n'))
    else if (b.type === 'code') out.push(b.text)
    else if (b.type === 'hr') out.push('—'.repeat(12))
    else if (b.type === 'image') out.push(b.alt ? `[${b.alt}]` : '')
    else if (b.runs) out.push(plain(b.runs))
    out.push('')
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function runsToMarkdown(runs) {
  return runs
    .map((r) => {
      if (r.text === '\n') return '  \n'
      // Keep whitespace outside the markers: "*word *" is not emphasis in Markdown.
      const [, lead, core, trail] = /^(\s*)(.*?)(\s*)$/s.exec(r.text)
      if (!core) return r.text
      let t = r.code ? `\`${core}\`` : core.replace(/([\\`*_[\]])/g, '\\$1')
      if (r.bold && t.trim()) t = `**${t}**`
      if (r.italic && t.trim()) t = `*${t}*`
      if (r.strike && t.trim()) t = `~~${t}~~`
      if (r.href) t = `[${t}](${r.href})`
      return lead + t + trail
    })
    .join('')
}

export function blocksToMarkdown(blocks) {
  const out = []
  for (const b of blocks) {
    if (b.type === 'heading') out.push(`${'#'.repeat(b.level)} ${runsToMarkdown(b.runs)}`)
    else if (b.type === 'paragraph') out.push(runsToMarkdown(b.runs))
    else if (b.type === 'quote') out.push(`> ${runsToMarkdown(b.runs)}`)
    else if (b.type === 'code') out.push('```\n' + b.text + '\n```')
    else if (b.type === 'hr') out.push('---')
    else if (b.type === 'image') out.push(`![${b.alt || 'image'}](${bytesToDataUri(b.bytes, b.mime)})`)
    else if (b.type === 'list') {
      const counters = []
      out.push(
        b.items
          .map((it) => {
            counters[it.level] = (counters[it.level] ?? 0) + 1
            counters.length = it.level + 1
            return `${'   '.repeat(it.level)}${b.ordered ? `${counters[it.level]}.` : '-'} ${runsToMarkdown(it.runs)}`
          })
          .join('\n'),
      )
    } else if (b.type === 'table') {
      const width = Math.max(...b.rows.map((r) => r.cells.length))
      const row = (cells) => `| ${Array.from({ length: width }, (_, i) => runsToMarkdown(cells[i] ?? []).replace(/\|/g, '\\|')).join(' | ')} |`
      const [head, ...rest] = b.rows
      out.push([row(head.cells), `| ${Array(width).fill('---').join(' | ')} |`, ...rest.map((r) => row(r.cells))].join('\n'))
    }
    out.push('')
  }
  return out.join('\n').trim() + '\n'
}

function runsToHtml(runs) {
  return runs
    .map((r) => {
      if (r.text === '\n') return '<br>'
      let t = escapeHtml(r.text)
      if (r.code) t = `<code>${t}</code>`
      if (r.bold) t = `<strong>${t}</strong>`
      if (r.italic) t = `<em>${t}</em>`
      if (r.strike) t = `<s>${t}</s>`
      if (r.href) t = `<a href="${escapeHtml(r.href)}">${t}</a>`
      return t
    })
    .join('')
}

export function blocksToHtml(blocks) {
  const out = []
  for (const b of blocks) {
    if (b.type === 'heading') out.push(`<h${b.level}>${runsToHtml(b.runs)}</h${b.level}>`)
    else if (b.type === 'paragraph') out.push(`<p>${runsToHtml(b.runs)}</p>`)
    else if (b.type === 'quote') out.push(`<blockquote><p>${runsToHtml(b.runs)}</p></blockquote>`)
    else if (b.type === 'code') out.push(`<pre><code>${escapeHtml(b.text)}</code></pre>`)
    else if (b.type === 'hr') out.push('<hr>')
    else if (b.type === 'pagebreak') out.push('<hr style="page-break-after:always;border:0">')
    else if (b.type === 'image') out.push(`<p><img src="${bytesToDataUri(b.bytes, b.mime)}" alt="${escapeHtml(b.alt || '')}" width="${b.width}" height="${b.height}"></p>`)
    else if (b.type === 'list') {
      const tag = b.ordered ? 'ol' : 'ul'
      let depth = -1
      let html = ''
      for (const it of b.items) {
        while (depth < it.level) { html += `<${tag}>`; depth++ }
        while (depth > it.level) { html += `</${tag}>`; depth-- }
        html += `<li>${runsToHtml(it.runs)}</li>`
      }
      while (depth >= 0) { html += `</${tag}>`; depth-- }
      out.push(html)
    } else if (b.type === 'table') {
      const rows = b.rows
        .map((r) => `<tr>${r.cells.map((c) => (r.header ? `<th>${runsToHtml(c)}</th>` : `<td>${runsToHtml(c)}</td>`)).join('')}</tr>`)
        .join('\n')
      out.push(`<table>\n${rows}\n</table>`)
    }
  }
  return out.join('\n')
}

/* ---- DOCX ---------------------------------------------------------- */

const DOCX_IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/bmp': 'bmp' }

export async function blocksToDocx(blocks, { title } = {}) {
  const d = await import('docx')
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink, Table, TableRow, TableCell, WidthType, ImageRun, BorderStyle, LevelFormat, AlignmentType, ShadingType, PageBreak } = d

  const textRun = (r, extra = {}) =>
    r.text === '\n'
      ? new TextRun({ break: 1 })
      : new TextRun({
          text: r.text,
          bold: r.bold || extra.bold,
          italics: r.italic || extra.italic,
          strike: r.strike,
          font: r.code ? 'Consolas' : undefined,
          shading: r.code ? { type: ShadingType.CLEAR, fill: 'F1F1EE', color: 'auto' } : undefined,
          style: r.href ? 'Hyperlink' : undefined,
        })
  const children = (runs, extra) =>
    runs.map((r) => (r.href && r.text !== '\n' ? new ExternalHyperlink({ link: r.href, children: [textRun(r, extra)] }) : textRun(r, extra)))

  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
  const body = []
  let orderedInstance = 0
  const MAX_W = 600 // ~6.25in at 96 dpi, inside default margins

  for (const b of blocks) {
    if (b.type === 'heading') body.push(new Paragraph({ heading: HEADINGS[b.level - 1], children: children(b.runs) }))
    else if (b.type === 'paragraph') body.push(new Paragraph({ children: children(b.runs) }))
    else if (b.type === 'quote')
      body.push(
        new Paragraph({
          children: children(b.runs, { italic: true }),
          indent: { left: 480 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'C9C4B8', space: 12 } },
        }),
      )
    else if (b.type === 'code')
      b.text.split('\n').forEach((line, i, all) =>
        body.push(
          new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 19 })],
            shading: { type: ShadingType.CLEAR, fill: 'F4F3EF', color: 'auto' },
            spacing: { before: i ? 0 : 120, after: i === all.length - 1 ? 120 : 0, line: 260 },
          }),
        ),
      )
    else if (b.type === 'hr')
      body.push(new Paragraph({ children: [], border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } } }))
    else if (b.type === 'pagebreak') body.push(new Paragraph({ children: [new PageBreak()] }))
    else if (b.type === 'list') {
      const instance = b.ordered ? ++orderedInstance : 0
      for (const it of b.items) {
        body.push(
          new Paragraph({
            children: children(it.runs),
            numbering: { reference: b.ordered ? 'ordered' : 'bullets', level: it.level, ...(b.ordered ? { instance } : {}) },
          }),
        )
      }
    } else if (b.type === 'table') {
      const width = Math.max(...b.rows.map((r) => r.cells.length))
      body.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: b.rows.map(
            (r) =>
              new TableRow({
                tableHeader: r.header,
                children: Array.from(
                  { length: width },
                  (_, i) =>
                    new TableCell({
                      shading: r.header ? { type: ShadingType.CLEAR, fill: 'F1EFEA', color: 'auto' } : undefined,
                      margins: { top: 60, bottom: 60, left: 100, right: 100 },
                      children: [new Paragraph({ children: children(r.cells[i] ?? [], { bold: r.header }) })],
                    }),
                ),
              }),
          ),
        }),
      )
      body.push(new Paragraph({ children: [] }))
    } else if (b.type === 'image' && DOCX_IMAGE_TYPES[b.mime]) {
      const scale = Math.min(1, MAX_W / b.width)
      body.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: DOCX_IMAGE_TYPES[b.mime],
              data: b.bytes,
              transformation: { width: Math.round(b.width * scale), height: Math.round(b.height * scale) },
              altText: b.alt ? { name: b.alt, description: b.alt, title: b.alt } : undefined,
            }),
          ],
        }),
      )
    }
  }

  const levels = (ordered) =>
    Array.from({ length: 5 }, (_, level) => ({
      level,
      format: ordered ? [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3] : LevelFormat.BULLET,
      text: ordered ? `%${level + 1}.` : ['•', '◦', '▪'][level % 3],
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
    }))

  const doc = new Document({
    title,
    creator: 'Transmute',
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 140, line: 300 } } } },
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: levels(false) },
        { reference: 'ordered', levels: levels(true) },
      ],
    },
    sections: [{ children: body.length ? body : [new Paragraph({ children: [] })] }],
  })
  return Packer.toBlob(doc)
}

/* ---- PDF ----------------------------------------------------------- */

function runsToPdf(runs, extra = {}) {
  const out = []
  for (const r of runs) {
    if (r.text === '\n') {
      out.push({ text: '\n' })
      continue
    }
    const style = {
      bold: r.bold || extra.bold || undefined,
      italics: r.italic || extra.italic || undefined,
      decoration: r.strike ? 'lineThrough' : r.href ? 'underline' : undefined,
      link: r.href,
      color: r.href ? '#1d4ed8' : extra.color,
      background: r.code ? '#efeee9' : undefined,
      fontSize: r.code ? 9.5 : undefined,
    }
    // Split out Georgian so it renders in a font that has the glyphs.
    for (const part of r.text.split(GEORGIAN_SPLIT)) {
      if (!part) continue
      out.push(GEORGIAN.test(part) ? { text: part, font: 'NotoGeorgian', ...style } : { text: part, ...style })
    }
  }
  return out
}

const PDF_PAGES = { a4: 'A4', letter: 'LETTER' }

export async function blocksToPdf(blocks, { pageSize = 'a4', title } = {}) {
  const pdfMake = await getPdfMake()
  const usesGeorgian = blocks.some((b) => GEORGIAN.test(JSON.stringify(b, (k, v) => (k === 'bytes' ? undefined : v))))
  if (usesGeorgian) await loadGeorgianFont(pdfMake)

  const size = PDF_PAGES[pageSize] ?? 'A4'
  const contentWidth = (size === 'A4' ? 595.28 : 612) - 2 * 64
  const content = []

  for (const b of blocks) {
    if (b.type === 'heading') content.push({ text: runsToPdf(b.runs), style: `h${Math.min(b.level, 4)}` })
    else if (b.type === 'paragraph') content.push({ text: runsToPdf(b.runs), style: 'p' })
    else if (b.type === 'quote')
      content.push({
        table: { widths: ['*'], body: [[{ text: runsToPdf(b.runs, { italic: true, color: '#55534c' }), margin: [10, 2, 0, 2] }]] },
        layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 2.5 : 0), vLineColor: () => '#cfc9bb', paddingLeft: () => 0 },
        margin: [0, 2, 0, 10],
      })
    else if (b.type === 'code')
      content.push({
        table: { widths: ['*'], body: [[{ text: b.text, style: 'code' }]] },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => '#f4f3ef', paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 8, paddingBottom: () => 8 },
        margin: [0, 2, 0, 12],
      })
    else if (b.type === 'hr')
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.6, lineColor: '#cccccc' }], margin: [0, 6, 0, 14] })
    else if (b.type === 'pagebreak') content.push({ text: '', pageBreak: 'after' })
    else if (b.type === 'image')
      content.push({ image: bytesToDataUri(b.bytes, b.mime), width: Math.min(contentWidth, b.width * 0.75), alignment: 'center', margin: [0, 4, 0, 12] })
    else if (b.type === 'list') {
      // Rebuild nesting from the flat level list.
      const root = []
      const stack = [root]
      for (const it of b.items) {
        while (stack.length - 1 < it.level) {
          const parent = stack[stack.length - 1]
          const nested = []
          parent.push(b.ordered ? { ol: nested } : { ul: nested })
          stack.push(nested)
        }
        while (stack.length - 1 > it.level) stack.pop()
        stack[stack.length - 1].push({ text: runsToPdf(it.runs) })
      }
      content.push({ [b.ordered ? 'ol' : 'ul']: root, style: 'list' })
    } else if (b.type === 'table') {
      const width = Math.max(...b.rows.map((r) => r.cells.length))
      const headerRows = b.rows[0]?.header ? 1 : 0
      content.push({
        table: {
          headerRows,
          widths: Array(width).fill('*'),
          body: b.rows.map((r) =>
            Array.from({ length: width }, (_, i) => ({ text: runsToPdf(r.cells[i] ?? [], { bold: r.header }), fillColor: r.header ? '#f1efea' : undefined })),
          ),
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#d6d3cb',
          vLineColor: () => '#d6d3cb',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
        style: 'table',
      })
    }
  }

  const def = {
    pageSize: size,
    pageMargins: [64, 64, 64, 72],
    info: { title, creator: 'Transmute', producer: 'Transmute (pdfmake)' },
    content: content.length ? content : [{ text: ' ' }],
    defaultStyle: { font: 'Roboto', fontSize: 10.5, lineHeight: 1.35, color: '#1b1a17' },
    styles: {
      h1: { fontSize: 22, bold: true, margin: [0, 6, 0, 10], lineHeight: 1.15 },
      h2: { fontSize: 16, bold: true, margin: [0, 14, 0, 6], lineHeight: 1.2 },
      h3: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] },
      h4: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
      p: { margin: [0, 0, 0, 8] },
      list: { margin: [0, 0, 0, 10] },
      code: { fontSize: 8.8, lineHeight: 1.3, preserveLeadingSpaces: true },
      table: { fontSize: 9.5, margin: [0, 4, 0, 14] },
    },
    footer: (page, pages) => (pages > 1 ? { text: `${page} / ${pages}`, alignment: 'center', fontSize: 8, color: '#9a978e', margin: [0, 28, 0, 0] } : null),
  }
  return pdfMake.createPdf(def).getBlob()
}

/* ---- PDF pages to images ------------------------------------------ */

export async function pdfToImages(file, { mime, quality, scale = 2, onPage } = {}) {
  const pdf = await openPdf(file)
  if (pdf.numPages > 200) throw new ConversionError(`This PDF has ${pdf.numPages} pages — the image export limit is 200.`)
  const out = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, canvas, viewport }).promise
    const blob = await new Promise((r) => canvas.toBlob(r, mime, quality))
    canvas.width = canvas.height = 0
    if (!blob) throw new ConversionError('The browser returned an empty image while rendering a page.')
    out.push(blob)
    onPage?.(n, pdf.numPages)
  }
  return { blobs: out, pages: pdf.numPages }
}
