import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react'
import { formatBytes } from '../lib/download.js'

/**
 * Ordered list of loaded PDFs. Drag to reorder, with arrow buttons alongside so
 * the same thing is possible by keyboard and on touch.
 */
export default function DocList({ docs, onRemove, onMove, reorderable = true }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  return (
    <ol className="space-y-2.5">
      {docs.map((doc, i) => (
        <li
          key={doc.id}
          draggable={reorderable}
          onDragStart={(e) => {
            setDragIndex(i)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            if (dragIndex == null) return
            e.preventDefault()
            setOverIndex(i)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            if (dragIndex != null && dragIndex !== i) onMove(dragIndex, i)
            setDragIndex(null)
            setOverIndex(null)
          }}
          className={`animate-rise sheet flex items-center gap-3 rounded-lg p-2.5 transition ${
            dragIndex === i ? 'opacity-40' : ''
          } ${overIndex === i && dragIndex !== i ? '!border-vermillion-600' : ''}`}
        >
          {reorderable && (
            <GripVertical className="size-4 shrink-0 cursor-grab text-ink-300" strokeWidth={2} aria-hidden />
          )}

          <span className="w-6 shrink-0 text-center font-mono text-[12px] tnum text-ink-300">{i + 1}</span>

          <span className="sheet block h-14 w-11 shrink-0 overflow-hidden rounded-[3px] !shadow-none">
            {doc.thumbUrl && <img src={doc.thumbUrl} alt="" className="size-full object-cover object-top" />}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-ink-900">{doc.name}</span>
            <span className="mt-0.5 block font-mono text-[11px] tnum text-ink-400">
              {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(doc.size)} ·{' '}
              {doc.dims.width}×{doc.dims.height} pt
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-0.5">
            {reorderable && (
              <>
                <button
                  type="button"
                  onClick={() => onMove(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move ${doc.name} up`}
                  className="grid size-7 place-items-center rounded text-ink-400 transition hover:bg-paper-200 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-400 disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  <ChevronUp className="size-4" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => onMove(i, i + 1)}
                  disabled={i === docs.length - 1}
                  aria-label={`Move ${doc.name} down`}
                  className="grid size-7 place-items-center rounded text-ink-400 transition hover:bg-paper-200 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-400 disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  <ChevronDown className="size-4" strokeWidth={2.2} />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onRemove(doc.id)}
              aria-label={`Remove ${doc.name}`}
              className="grid size-7 place-items-center rounded text-ink-300 transition hover:bg-vermillion-50 hover:text-vermillion-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-400"
            >
              <X className="size-4" strokeWidth={2.2} />
            </button>
          </span>
        </li>
      ))}
    </ol>
  )
}
