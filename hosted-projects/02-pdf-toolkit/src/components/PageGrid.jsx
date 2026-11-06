import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { THUMB_PAGE_LIMIT, openDocument, renderThumbnails } from '../lib/pdf.js'

/**
 * Renders every page of a document as a thumbnail, progressively — a 300-page
 * file fills in from the top rather than freezing until it is done.
 */
export default function PageGrid({ doc, selected, onToggle }) {
  const [thumbs, setThumbs] = useState({})
  const [rendering, setRendering] = useState(true)
  const stopped = useRef(false)

  useEffect(() => {
    stopped.current = false
    setThumbs({})
    setRendering(true)
    const urls = []
    let pdfDoc = null

    ;(async () => {
      try {
        pdfDoc = await openDocument(doc.bytes, doc.name)
        await renderThumbnails(pdfDoc, {
          width: 150,
          shouldStop: () => stopped.current,
          onThumb: ({ pageNumber, url }) => {
            if (url) urls.push(url)
            setThumbs((prev) => ({ ...prev, [pageNumber]: url }))
          },
        })
      } catch {
        /* the parent already surfaced the load error */
      } finally {
        if (!stopped.current) setRendering(false)
        pdfDoc?.destroy()
      }
    })()

    return () => {
      stopped.current = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [doc.id, doc.bytes, doc.name])

  const pages = Array.from({ length: Math.min(doc.pageCount, THUMB_PAGE_LIMIT) }, (_, i) => i + 1)

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(118px,1fr))]">
        {pages.map((n) => {
          const on = selected.has(n)
          return (
            <button
              key={n}
              type="button"
              onClick={() => onToggle(n)}
              aria-pressed={on}
              aria-label={`Page ${n}`}
              className="group relative block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermillion-600"
            >
              <span
                className={`sheet relative block aspect-[1/1.35] overflow-hidden rounded-sm transition ${
                  on ? '!border-vermillion-600 ring-2 ring-vermillion-600/30' : 'group-hover:!border-ink-400'
                }`}
              >
                {thumbs[n] ? (
                  <img src={thumbs[n]} alt="" className="size-full object-contain" />
                ) : (
                  <span className="grid size-full place-items-center">
                    <Loader2 className="size-4 animate-spin text-ink-300" strokeWidth={2} />
                  </span>
                )}
                {on && (
                  <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-vermillion-600 text-paper-50">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </span>
              <span
                className={`mt-1.5 block text-center font-mono text-[11px] tnum ${
                  on ? 'font-medium text-vermillion-700' : 'text-ink-400'
                }`}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      {rendering && (
        <p className="mt-4 flex items-center gap-2 font-mono text-[11px] text-ink-400">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
          Rendering previews…
        </p>
      )}
      {doc.pageCount > THUMB_PAGE_LIMIT && (
        <p className="mt-4 font-mono text-[11px] text-ink-400">
          Showing the first {THUMB_PAGE_LIMIT} of {doc.pageCount} pages. Range selection still covers the
          whole document.
        </p>
      )}
    </div>
  )
}
