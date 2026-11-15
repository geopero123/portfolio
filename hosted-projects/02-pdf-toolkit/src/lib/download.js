import { zipSync } from 'fflate'

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export async function saveAsZip(results, zipName) {
  const entries = {}
  for (const r of results) entries[r.name] = new Uint8Array(await r.blob.arrayBuffer())
  // PDFs and JPEGs are already compressed; deflating again only costs time.
  saveBlob(new Blob([zipSync(entries, { level: 0 })], { type: 'application/zip' }), zipName)
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  if (bytes == null || Number.isNaN(bytes)) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const v = bytes / 1024 ** i
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}
