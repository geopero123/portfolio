import { zipSync } from 'fflate'

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Bundles finished results into a zip. Names are de-duplicated, not overwritten. */
export async function saveAllAsZip(results, zipName = 'transmute.zip') {
  const entries = {}
  const seen = new Map()
  for (const r of results) {
    let name = r.name
    if (seen.has(name)) {
      const n = seen.get(name) + 1
      seen.set(name, n)
      const dot = name.lastIndexOf('.')
      name = dot === -1 ? `${name} (${n})` : `${name.slice(0, dot)} (${n})${name.slice(dot)}`
    } else {
      seen.set(name, 1)
    }
    entries[name] = new Uint8Array(await r.blob.arrayBuffer())
  }
  // level 0: these are already-compressed formats, so deflating just burns time.
  const zipped = zipSync(entries, { level: 0 })
  saveBlob(new Blob([zipped], { type: 'application/zip' }), zipName)
}
