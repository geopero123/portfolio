import { Zap, Loader2, Package, Eraser } from 'lucide-react'
import { TARGETS, formatBytes } from '../lib/formats.js'

function Label({ children, hint }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-shell-400">{children}</h3>
      {hint && <span className="font-mono text-[10.5px] tnum text-shell-300">{hint}</span>}
    </div>
  )
}

const MATTES = [
  { value: '#ffffff', label: 'White' },
  { value: '#0d0e10', label: 'Black' },
  { value: '#f2ece3', label: 'Paper' },
]

const PAGE_SIZES = [
  { value: 'fit', label: 'Match' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
]

function Segmented({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex rounded-lg border border-shell-700 bg-shell-850 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-[5px] px-2 py-1.5 font-mono text-[11px] font-medium tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-500 ${
            value === o.value
              ? 'bg-shell-700 text-shell-100'
              : 'text-shell-400 hover:text-shell-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Inspector({
  targets,
  options,
  setOptions,
  stats,
  busy,
  hasFiles,
  doneCount,
  onConvert,
  onDownloadAll,
  onClear,
}) {
  const spec = TARGETS[options.target]
  const showQuality = spec && (spec.lossy || spec.id === 'pdf')
  const showMatte = spec?.flattens
  const showPage = spec?.id === 'pdf'
  const set = (patch) => setOptions((o) => ({ ...o, ...patch }))

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin flex-1 overflow-y-auto p-5 sm:p-6">
        <section>
          <Label>Convert to</Label>
          {targets.length === 0 ? (
            <p className="rounded-lg border border-dashed border-shell-700 px-3 py-6 text-center text-[12.5px] leading-relaxed text-shell-400">
              {hasFiles
                ? 'These files have no format in common. Remove one to continue.'
                : 'Add a file to see what it can become.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {targets.map((id) => {
                const t = TARGETS[id]
                const active = options.target === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => set({ target: id })}
                    aria-pressed={active}
                    className={`min-h-[66px] rounded-lg border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500 ${
                      active
                        ? 'border-signal-500 bg-signal-500/10'
                        : 'border-shell-700 bg-shell-850 hover:border-shell-600 hover:bg-shell-800'
                    }`}
                  >
                    <span
                      className={`block font-mono text-[12.5px] font-bold tracking-wide ${
                        active ? 'text-signal-400' : 'text-shell-100'
                      }`}
                    >
                      {t.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-shell-400">{t.note}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {showQuality && (
          <section className="mt-7">
            <Label hint={`${Math.round(options.quality * 100)}`}>
              {spec.id === 'pdf' ? 'Embedded image quality' : 'Quality'}
            </Label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.01"
              value={options.quality}
              onChange={(e) => set({ quality: Number(e.target.value) })}
              aria-label="Output quality"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-shell-700 accent-signal-500 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal-500"
            />
            <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-shell-600">
              <span>smaller</span>
              <span>sharper</span>
            </div>
          </section>
        )}

        {showMatte && (
          <section className="mt-7">
            <Label>Background</Label>
            <p className="mb-2.5 text-[11.5px] leading-relaxed text-shell-400">
              JPG has no transparency. Pick what shows through.
            </p>
            <div className="flex items-center gap-1.5">
              {MATTES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set({ matte: m.value })}
                  aria-label={m.label}
                  aria-pressed={options.matte === m.value}
                  title={m.label}
                  className={`size-8 rounded-md border-2 transition ${
                    options.matte === m.value ? 'border-signal-500' : 'border-shell-700 hover:border-shell-600'
                  }`}
                  style={{ backgroundColor: m.value }}
                />
              ))}
              <label className="relative size-8 cursor-pointer overflow-hidden rounded-md border-2 border-shell-700 transition hover:border-shell-600">
                <span className="sr-only">Custom background colour</span>
                <input
                  type="color"
                  value={options.matte}
                  onChange={(e) => set({ matte: e.target.value })}
                  className="absolute -inset-2 size-12 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
              <span className="ml-1 font-mono text-[11px] uppercase text-shell-400">{options.matte}</span>
            </div>
          </section>
        )}

        {showPage && (
          <section className="mt-7">
            <Label>Page size</Label>
            <Segmented
              name="Page size"
              value={options.pageSize}
              onChange={(v) => set({ pageSize: v })}
              options={PAGE_SIZES}
            />
          </section>
        )}

        {stats.done > 0 && (
          <section className="mt-7 rounded-lg border border-shell-700 bg-shell-850 p-4">
            <Label>Result</Label>
            <dl className="space-y-2 font-mono text-[12px]">
              <div className="flex justify-between">
                <dt className="text-shell-400">In</dt>
                <dd className="tnum text-shell-100">{formatBytes(stats.bytesIn)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-shell-400">Out</dt>
                <dd className="tnum text-shell-100">{formatBytes(stats.bytesOut)}</dd>
              </div>
              <div className="flex justify-between border-t border-shell-700 pt-2">
                <dt className="text-shell-400">Difference</dt>
                <dd
                  className={`tnum font-medium ${
                    stats.bytesOut <= stats.bytesIn ? 'text-signal-400' : 'text-alert-400'
                  }`}
                >
                  {stats.bytesOut <= stats.bytesIn ? '−' : '+'}
                  {Math.abs(Math.round((1 - stats.bytesOut / stats.bytesIn) * 100))}%
                </dd>
              </div>
            </dl>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-shell-800 bg-shell-900/95 p-4 backdrop-blur-md sm:p-5">
        <button
          type="button"
          onClick={onConvert}
          disabled={!hasFiles || !targets.length || busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-signal-500 px-4 py-3 text-[14px] font-semibold text-shell-950 transition hover:bg-signal-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500 active:translate-y-px disabled:cursor-not-allowed disabled:bg-shell-800 disabled:text-shell-600"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" strokeWidth={2.4} />
              Converting…
            </>
          ) : (
            <>
              <Zap className="size-4" strokeWidth={2.4} />
              Convert {stats.total > 1 ? `${stats.total} files` : 'file'}
            </>
          )}
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={doneCount < 1}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-shell-700 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-shell-300 transition hover:border-shell-600 hover:bg-shell-800 hover:text-shell-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shell-600 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Package className="size-3.5" strokeWidth={2} />
            {doneCount > 1 ? 'Save zip' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={!hasFiles}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-shell-700 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-wider text-shell-400 transition hover:border-alert-500/50 hover:text-alert-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shell-600 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Eraser className="size-3.5" strokeWidth={2} />
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
