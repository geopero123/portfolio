/**
 * Format registry + routing table.
 *
 * Everything here is browser-native or backed by a client-side library, so the
 * table doubles as the honest list of what this app can actually do. If a
 * target isn't reachable from a source it simply isn't offered in the UI.
 */

export const MAX_BYTES = 100 * 1024 * 1024 // 100 MB per file
export const MAX_PIXELS = 80_000_000 // canvas gives up somewhere past this on most devices

export const TARGETS = {
  png: { id: 'png', label: 'PNG', ext: 'png', mime: 'image/png', group: 'Image', note: 'Lossless, keeps transparency' },
  jpg: { id: 'jpg', label: 'JPG', ext: 'jpg', mime: 'image/jpeg', group: 'Image', lossy: true, flattens: true, note: 'Smallest for photos' },
  webp: { id: 'webp', label: 'WEBP', ext: 'webp', mime: 'image/webp', group: 'Image', lossy: true, note: 'Modern, ~30% under JPG' },
  gif: { id: 'gif', label: 'GIF', ext: 'gif', mime: 'image/gif', group: 'Image', note: '256 colours, single frame' },
  pdf: { id: 'pdf', label: 'PDF', ext: 'pdf', mime: 'application/pdf', group: 'Document', note: 'Paged, prints anywhere' },
  docx: { id: 'docx', label: 'Word', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', group: 'Document', note: 'Editable in Word & Docs' },
  html: { id: 'html', label: 'HTML', ext: 'html', mime: 'text/html', group: 'Document', note: 'Styled, self-contained' },
  md: { id: 'md', label: 'Markdown', ext: 'md', mime: 'text/markdown', group: 'Document', note: 'Headings, lists, links' },
  txt: { id: 'txt', label: 'Text', ext: 'txt', mime: 'text/plain', group: 'Document', note: 'Raw text, no formatting' },
  json: { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json', group: 'Data', note: 'Array of row objects' },
  csv: { id: 'csv', label: 'CSV', ext: 'csv', mime: 'text/csv', group: 'Data', note: 'Comma separated' },
  tsv: { id: 'tsv', label: 'TSV', ext: 'tsv', mime: 'text/tab-separated-values', group: 'Data', note: 'Tab separated' },
}

const RASTER_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/avif',
  'image/tiff',
])

const IMAGE_TARGETS = ['png', 'jpg', 'webp', 'gif', 'pdf']

/** Source kinds, each with the targets it can reach. */
export const SOURCES = {
  image: { id: 'image', label: 'Image', targets: IMAGE_TARGETS },
  svg: { id: 'svg', label: 'SVG', targets: IMAGE_TARGETS },
  pdf: { id: 'pdf', label: 'PDF', targets: ['docx', 'md', 'html', 'txt', 'png', 'jpg'] },
  docx: { id: 'docx', label: 'Word', targets: ['pdf', 'html', 'md', 'txt'] },
  md: { id: 'md', label: 'Markdown', targets: ['pdf', 'docx', 'html', 'txt'] },
  html: { id: 'html', label: 'HTML', targets: ['pdf', 'docx', 'md', 'txt'] },
  txt: { id: 'txt', label: 'Text', targets: ['pdf', 'docx', 'html', 'md'] },
  csv: { id: 'csv', label: 'CSV', targets: ['json', 'tsv'] },
  tsv: { id: 'tsv', label: 'TSV', targets: ['json', 'csv'] },
  json: { id: 'json', label: 'JSON', targets: ['csv', 'tsv'] },
}

function extOf(name) {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}

/**
 * Work out what a dropped file is. MIME type first (browsers are reliable for
 * images), extension as the fallback — Windows in particular hands over CSV and
 * JSON files with an empty or wrong `type`.
 */
export function detectSource(file) {
  const ext = extOf(file.name)
  const mime = (file.type || '').toLowerCase()

  if (mime === 'image/svg+xml' || ext === 'svg') return SOURCES.svg
  if (RASTER_MIMES.has(mime)) return SOURCES.image
  if (!mime && ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return SOURCES.image

  if (ext === 'pdf' || mime === 'application/pdf') return SOURCES.pdf
  if (['md', 'markdown', 'mdown'].includes(ext) || mime === 'text/markdown') return SOURCES.md
  if (['html', 'htm', 'xhtml'].includes(ext) || mime === 'text/html') return SOURCES.html
  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return SOURCES.docx
  }
  if (ext === 'csv' || mime === 'text/csv') return SOURCES.csv
  if (ext === 'tsv' || ext === 'tab' || mime === 'text/tab-separated-values') return SOURCES.tsv
  if (ext === 'json' || mime === 'application/json') return SOURCES.json
  if (ext === 'txt' || ext === 'text' || (mime === 'text/plain' && !ext)) return SOURCES.txt

  return null
}

/** Targets shared by every file in the queue — the UI only offers these. */
export function commonTargets(items) {
  const lists = items.map((it) => it.source?.targets).filter(Boolean)
  if (!lists.length) return []
  return lists.reduce((acc, list) => acc.filter((t) => list.includes(t)))
}

export const ACCEPT_ATTR = [
  'image/*',
  '.svg',
  '.pdf',
  '.docx',
  '.md',
  '.markdown',
  '.html',
  '.htm',
  '.txt',
  '.csv',
  '.tsv',
  '.json',
].join(',')

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  if (bytes == null || Number.isNaN(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  const decimals = i === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(decimals)} ${units[i]}`
}

export function swapExtension(name, ext) {
  const i = name.lastIndexOf('.')
  const stem = i === -1 ? name : name.slice(0, i)
  return `${stem}.${ext}`
}
