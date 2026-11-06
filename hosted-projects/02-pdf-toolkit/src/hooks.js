import { useCallback, useEffect, useRef, useState } from 'react'
import { PdfError, openDocument, pageDimensions, readBytes, renderPageToCanvas, canvasToBlob } from './lib/pdf.js'

export const MAX_BYTES = 200 * 1024 * 1024 // 200 MB per file

const isPdf = (file) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

/**
 * Holds loaded PDFs: raw bytes for editing, plus a cover thumbnail and page
 * count for the UI. Bytes are kept because pdf.js consumes the buffer it is
 * handed, and every operation needs to read the file again.
 */
export function usePdfDocs({ multiple = true } = {}) {
  const [docs, setDocs] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const docsRef = useRef(docs)
  docsRef.current = docs

  useEffect(
    () => () => docsRef.current.forEach((d) => d.thumbUrl && URL.revokeObjectURL(d.thumbUrl)),
    [],
  )

  const addFiles = useCallback(
    async (files) => {
      const problems = []
      const pdfs = []
      for (const file of files) {
        if (!isPdf(file)) problems.push(`${file.name} is not a PDF.`)
        else if (file.size === 0) problems.push(`${file.name} is empty.`)
        else if (file.size > MAX_BYTES) problems.push(`${file.name} is larger than 200 MB.`)
        else pdfs.push(file)
      }

      if (!multiple && pdfs.length > 1) {
        problems.push('This step works on one PDF at a time — using the first one.')
        pdfs.length = 1
      }

      setLoading(true)
      const loaded = []
      for (const file of pdfs) {
        try {
          const bytes = await readBytes(file)
          const pdfDoc = await openDocument(bytes, file.name)
          const dims = await pageDimensions(pdfDoc, 1)
          const canvas = await renderPageToCanvas(pdfDoc, 1, { targetWidth: 168 })
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.75)
          canvas.width = canvas.height = 0
          const pageCount = pdfDoc.numPages
          pdfDoc.destroy()
          loaded.push({
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
            name: file.name,
            size: file.size,
            bytes,
            pageCount,
            dims,
            thumbUrl: URL.createObjectURL(blob),
          })
        } catch (err) {
          problems.push(err instanceof PdfError ? err.message : `${file.name} could not be read.`)
        }
      }
      setLoading(false)

      if (loaded.length) {
        setDocs((prev) => {
          if (!multiple) {
            prev.forEach((d) => d.thumbUrl && URL.revokeObjectURL(d.thumbUrl))
            return loaded.slice(0, 1)
          }
          return [...prev, ...loaded]
        })
      }
      setError(problems.length ? problems.join(' ') : null)
    },
    [multiple],
  )

  const remove = useCallback((id) => {
    setDocs((prev) => {
      const gone = prev.find((d) => d.id === id)
      if (gone?.thumbUrl) URL.revokeObjectURL(gone.thumbUrl)
      return prev.filter((d) => d.id !== id)
    })
  }, [])

  const move = useCallback((from, to) => {
    setDocs((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setDocs((prev) => {
      prev.forEach((d) => d.thumbUrl && URL.revokeObjectURL(d.thumbUrl))
      return []
    })
    setError(null)
  }, [])

  return { docs, addFiles, remove, move, clear, setDocs, error, setError, loading }
}

const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i

/** Same shape, but for the images → PDF step. */
export function useImageFiles() {
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const ref = useRef(items)
  ref.current = items

  useEffect(() => () => ref.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  const addFiles = useCallback((files) => {
    const problems = []
    const accepted = []
    const seen = new Set(ref.current.map((i) => `${i.file.name}:${i.file.size}`))
    for (const file of files) {
      const ok = file.type.startsWith('image/') || IMAGE_RE.test(file.name)
      if (!ok) {
        problems.push(`${file.name} is not an image.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is larger than 200 MB.`)
        continue
      }
      const key = `${file.name}:${file.size}`
      if (seen.has(key)) continue
      seen.add(key)
      accepted.push({
        id: `${key}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: URL.createObjectURL(file),
      })
    }
    if (accepted.length) setItems((prev) => [...prev, ...accepted])
    setError(problems.length ? problems.join(' ') : null)
  }, [])

  const remove = useCallback((id) => {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const move = useCallback((from, to) => {
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setItems((prev) => {
      prev.forEach((i) => URL.revokeObjectURL(i.url))
      return []
    })
    setError(null)
  }, [])

  return { items, addFiles, remove, move, clear, error, setError }
}

/** Tracks an async job: busy flag, 0-1 progress, note, and error text. */
export function useJob() {
  const [state, setState] = useState({ busy: false, progress: null, note: null, error: null })

  const run = useCallback(async (fn) => {
    setState({ busy: true, progress: 0, note: null, error: null })
    try {
      const onProgress = (progress, note) => setState((s) => ({ ...s, progress, note: note ?? s.note }))
      const out = await fn(onProgress)
      setState({ busy: false, progress: null, note: null, error: null })
      return out
    } catch (err) {
      const message =
        err?.name === 'PdfError' ? err.message : `Something went wrong: ${err?.message ?? 'unknown error'}`
      if (err?.name !== 'PdfError') console.error(err)
      setState({ busy: false, progress: null, note: null, error: message })
      return null
    }
  }, [])

  const clearError = useCallback(() => setState((s) => ({ ...s, error: null })), [])
  return { ...state, run, clearError }
}
