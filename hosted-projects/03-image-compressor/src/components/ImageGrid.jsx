import { Download, Loader2, TriangleAlert, X } from 'lucide-react'
import { formatBytes } from '../lib/download.js'

function Delta({ from, to, kept }) {
  if (kept) return <span className="stamp bg-paper-sunk px-1 py-0.5 text-ink-soft">kept</span>
  if (!from || !to) return null
  const pct = Math.round((1 - to / from) * 100)
  if (Math.abs(pct) < 1) return <span className="stamp bg-paper-sunk px-1 py-0.5 text-ink-soft">±0%</span>
  const smaller = pct > 0
  return (
    <span className={`stamp px-1 py-0.5 tnum ${smaller ? 'bg-hot text-paper-bright' : 'bg-ink text-paper'}`}>
      {smaller ? '−' : '+'}
      {Math.abs(pct)}%
    </span>
  )
}

export default function ImageGrid({ items, selectedId, onSelect, onRemove, onDownload }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => {
        const on = item.id === selectedId
        return (
          <li key={item.id} className="animate-snap">
            <div
              className={`block-edge group relative bg-paper-bright transition ${
                on ? 'block-shadow' : 'hover:block-shadow-sm'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={on}
                className="block w-full text-left"
              >
                <span className="checker block aspect-4/3 overflow-hidden border-b-2 border-ink">
                  <img src={item.url} alt="" className="size-full object-contain" loading="lazy" />
                </span>

                <span className="block p-2">
                  <span className="block truncate text-[12px] font-medium">{item.file.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px] tnum text-mute">
                    <span>{formatBytes(item.file.size)}</span>
                    {item.result && (
                      <>
                        <span aria-hidden>→</span>
                        <span className="font-medium text-ink">{formatBytes(item.result.size)}</span>
                        <Delta from={item.file.size} to={item.result.size} kept={item.result.keptOriginal} />
                      </>
                    )}
                    {item.status === 'working' && (
                      <Loader2 className="size-3 animate-spin text-ink" strokeWidth={2.4} />
                    )}
                  </span>
                  {item.error && (
                    <span className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-hot-deep">
                      <TriangleAlert className="mt-px size-3 shrink-0" strokeWidth={2.2} />
                      {item.error}
                    </span>
                  )}
                </span>
              </button>

              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                {item.result && (
                  <button
                    type="button"
                    onClick={() => onDownload(item)}
                    aria-label={`Download ${item.file.name}`}
                    className="block-edge grid size-7 place-items-center bg-acid text-ink transition hover:bg-ink hover:text-acid"
                  >
                    <Download className="size-3.5" strokeWidth={2.4} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  aria-label={`Remove ${item.file.name}`}
                  className="block-edge grid size-7 place-items-center bg-paper-bright text-ink transition hover:bg-hot hover:text-paper-bright"
                >
                  <X className="size-3.5" strokeWidth={2.4} />
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
