/**
 * Every format as an element on a periodic table. Purely presentational: the
 * routing lives in formats.js, this only says how each format looks.
 */
export const FAMILIES = {
  image: { label: 'Images', color: 'var(--c-image)' },
  doc: { label: 'Documents', color: 'var(--c-doc)' },
  data: { label: 'Data', color: 'var(--c-data)' },
}

export const ELEMENTS = {
  png: { n: 1, sym: 'Pn', name: 'PNG', family: 'image' },
  jpg: { n: 2, sym: 'Jp', name: 'JPG', family: 'image' },
  webp: { n: 3, sym: 'Wb', name: 'WEBP', family: 'image' },
  gif: { n: 4, sym: 'Gf', name: 'GIF', family: 'image' },
  svg: { n: 5, sym: 'Sv', name: 'SVG', family: 'image', sourceOnly: true },
  pdf: { n: 6, sym: 'Pd', name: 'PDF', family: 'doc' },
  docx: { n: 7, sym: 'Dx', name: 'Word', family: 'doc' },
  md: { n: 8, sym: 'Md', name: 'Markdown', family: 'doc' },
  html: { n: 9, sym: 'Ht', name: 'HTML', family: 'doc' },
  txt: { n: 10, sym: 'Tx', name: 'Text', family: 'doc' },
  csv: { n: 11, sym: 'Cv', name: 'CSV', family: 'data' },
  tsv: { n: 12, sym: 'Tv', name: 'TSV', family: 'data' },
  json: { n: 13, sym: 'Js', name: 'JSON', family: 'data' },
}

const EXT_ALIASES = { jpeg: 'jpg', htm: 'html', markdown: 'md', text: 'txt', tab: 'tsv' }

/** The element for a dropped file, from its extension (falling back to its source kind). */
export function elementForFile(file, source) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  const key = EXT_ALIASES[ext] ?? ext
  if (ELEMENTS[key]) return { key, ...ELEMENTS[key] }
  if (source?.id === 'image') return { key: ext, n: 0, sym: (ext.slice(0, 1).toUpperCase() + ext.slice(1, 2)) || 'Im', name: ext.toUpperCase() || 'Image', family: 'image' }
  return { key: source?.id, ...(ELEMENTS[source?.id] ?? { n: 0, sym: '?', name: 'File', family: 'doc' }) }
}

/** What reads into, and what comes out of, each element: for the empty-state table. */
export const READS = {
  png: 'Images, SVG, PDF pages',
  jpg: 'Images, SVG, PDF pages',
  webp: 'Images, SVG',
  gif: 'Images, SVG',
  svg: 'Becomes PNG, JPG, WEBP, GIF or PDF',
  pdf: 'Images, Word, Markdown, HTML, Text',
  docx: 'PDF, Markdown, HTML, Text',
  md: 'PDF, Word, HTML, Text',
  html: 'PDF, Word, Markdown, Text',
  txt: 'PDF, Word, Markdown, HTML',
  csv: 'TSV, JSON',
  tsv: 'CSV, JSON',
  json: 'CSV, TSV',
}
