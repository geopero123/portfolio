import { ArrowRight, Check, Download, TriangleAlert, X } from 'lucide-react'
import Thumb from './Thumb.jsx'
import { formatBytes } from '../lib/formats.js'

function DeltaChip({ from, to }) {
  if (!from || !to) return null
  const pct = Math.round((1 - to / from) * 100)
  if (Math.abs(pct) < 1) {
    return <span className="rounded bg-shell-800 px-1.5 py-0.5 font-mono text-[11px] text-shell-400">±0%</span>
  }
  const smaller = pct > 0
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-medium tnum ${
        smaller ? 'bg-signal-900 text-signal-400' : 'bg-alert-900 text-alert-400'
      }`}
    >
      {smaller ? '−' : '+'}
      {Math.abs(pct)}%
    </span>
  )
}

export default function FileRow({ item, onRemove, onDownload }) {
  const { file, source, status, result, error } = item

  return (
    <li className="group animate-pop-in flex items-center gap-3.5 border-b border-shell-800 px-4 py-3 transition-colors hover:bg-shell-900/60 sm:px-6">
      <Thumb item={item} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium leading-tight text-shell-100">{file.name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] leading-none text-shell-400">
          <span className="uppercase tracking-wider text-shell-300">{source.label}</span>
          <span className="text-shell-600">/</span>
          {/* On narrow screens the numbers ride along with the name; from `sm`
              up they move into their own aligned column on the right. */}
          <span className="tnum sm:hidden">{formatBytes(file.size)}</span>
          {result && (
            <>
              <ArrowRight className="size-3 text-shell-600 sm:hidden" strokeWidth={2.2} />
              <span className="tnum text-shell-100 sm:hidden">{formatBytes(result.size)}</span>
              <span className="sm:hidden">
                <DeltaChip from={file.size} to={result.size} />
              </span>
            </>
          )}
          <span className="hidden truncate sm:inline">{result ? result.name : 'ready'}</span>
          {result?.meta?.warning && <span className="text-alert-400">{result.meta.warning}</span>}
        </p>
        {status === 'error' && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-alert-400">
            <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </p>
        )}
      </div>

      <div className="hidden shrink-0 items-center gap-2.5 font-mono text-[11px] tnum sm:flex">
        <span className="w-[4.5rem] text-right text-shell-400">{formatBytes(file.size)}</span>
        <ArrowRight className={`size-3 ${result ? 'text-shell-600' : 'text-shell-800'}`} strokeWidth={2.2} />
        <span className="w-[4.5rem] text-right text-shell-100">{result ? formatBytes(result.size) : '—'}</span>
        <span className="flex w-14 justify-end">
          <DeltaChip from={file.size} to={result?.size} />
        </span>
      </div>

      <div className="flex w-[6.5rem] shrink-0 items-center justify-end gap-1">
        {status === 'working' && (
          <div className="relative h-0.5 w-12 overflow-hidden rounded-full bg-shell-700">
            <div className="animate-sweep absolute inset-y-0 w-1/2 rounded-full bg-signal-500" />
          </div>
        )}

        {status === 'done' && (
          <button
            type="button"
            onClick={() => onDownload(item)}
            className="flex items-center gap-1.5 rounded-md border border-signal-500/35 bg-signal-500/10 px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-signal-400 transition hover:border-signal-500 hover:bg-signal-500 hover:text-shell-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500"
          >
            <Download className="size-3.5" strokeWidth={2.2} />
            <span className="hidden sm:inline">Save</span>
          </button>
        )}

        {status === 'idle' && <Check className="size-4 text-shell-700" strokeWidth={2.2} />}

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${file.name}`}
          className="grid size-7 place-items-center rounded-md text-shell-600 transition hover:bg-shell-800 hover:text-shell-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shell-600 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="size-4" strokeWidth={2.2} />
        </button>
      </div>
    </li>
  )
}
