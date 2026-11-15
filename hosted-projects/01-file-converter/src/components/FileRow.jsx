import { ArrowRight, Download, TriangleAlert, X } from 'lucide-react'
import Thumb from './Thumb.jsx'
import Element from './Element.jsx'
import { ELEMENTS } from '../lib/elements.js'
import { formatBytes } from '../lib/formats.js'

function Delta({ from, to }) {
  if (!from || !to) return null
  const pct = Math.round((1 - to / from) * 100)
  if (Math.abs(pct) < 1) return <span className="font-mono text-[11px] text-ink-3">±0%</span>
  const smaller = pct > 0
  return (
    <span className={`font-mono text-[11px] font-semibold tnum ${smaller ? 'text-[var(--c-data)]' : 'text-alert'}`}>
      {smaller ? '−' : '+'}
      {Math.abs(pct)}%
    </span>
  )
}

export default function FileRow({ item, target, index, onRemove, onDownload }) {
  const { file, status, result, error } = item
  const out = ELEMENTS[target] ? { key: target, ...ELEMENTS[target] } : null

  return (
    <li className="ticket" style={{ animationDelay: `${Math.min(index, 8) * 50}ms`, '--stub': '118px' }}>
      <div className="flex items-center gap-2">
        <Thumb item={item} />
        <ArrowRight className="hidden size-4 text-ink-3 sm:block" strokeWidth={2.2} aria-hidden="true" />
        {out && <Element el={out} small className={`hidden size-[52px] shrink-0 sm:grid ${status === 'done' ? 'stamp' : ''}`} key={`${target}-${status}`} />}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{file.name}</p>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] text-ink-2">
          <span className="tnum">{formatBytes(file.size)}</span>
          {result && (
            <>
              <ArrowRight className="size-3 text-ink-3" strokeWidth={2.2} aria-hidden="true" />
              <span className="tnum font-semibold text-ink">{formatBytes(result.size)}</span>
              <Delta from={file.size} to={result.size} />
              {result.meta?.pages > 1 && <span className="text-ink-3">{result.meta.pages} pages · zip</span>}
            </>
          )}
          {status === 'idle' && <span className="text-ink-3">ready</span>}
        </p>
        {result?.meta?.warning && <p className="mt-1 text-[12px] leading-snug text-ink-3">{result.meta.warning}.</p>}
        {status === 'working' && <div className="working-bar mt-2 w-32" role="progressbar" aria-label={`Converting ${file.name}`} />}
        {status === 'error' && (
          <p className="pop-in mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-alert">
            <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2.2} />
            <span>{error}</span>
          </p>
        )}
      </div>

      <div className="flex w-[100px] items-center justify-end gap-1 pl-3">
        {status === 'done' && (
          <button
            type="button"
            onClick={() => onDownload(item)}
            className="pop-in flex items-center gap-1.5 rounded-[3px] border-[1.5px] border-ink bg-ink px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-paper transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0_var(--c-doc)]"
          >
            <Download className="size-3.5" strokeWidth={2.2} />
            Save
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${file.name}`}
          className="grid size-8 place-items-center rounded-[3px] text-ink-3 transition hover:bg-paper-2 hover:text-ink"
        >
          <X className="size-4" strokeWidth={2.2} />
        </button>
      </div>
    </li>
  )
}
