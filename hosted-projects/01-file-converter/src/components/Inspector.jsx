import { ArrowRight, Loader2, Package, Eraser } from 'lucide-react'
import Element, { SplitFlap } from './Element.jsx'
import { ELEMENTS, FAMILIES } from '../lib/elements.js'
import { TARGETS, formatBytes } from '../lib/formats.js'

const ALL_TARGETS = Object.keys(TARGETS)

function Label({ children, hint }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-ink pb-1.5">
      <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em]">{children}</h3>
      {hint && <span className="font-mono text-[11px] tnum text-ink-2">{hint}</span>}
    </div>
  )
}

const MATTES = [
  { value: '#ffffff', label: 'White' },
  { value: '#17150f', label: 'Ink' },
  { value: '#f3efe5', label: 'Paper' },
]

function Chips({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className="chip">
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Inspector({ targets, sources, options, setOptions, stats, busy, progress, hasFiles, doneCount, onConvert, onDownloadAll, onClear }) {
  const spec = TARGETS[options.target]
  const el = ELEMENTS[options.target]
  const imageSources = sources.length > 0 && sources.every((s) => s === 'image' || s === 'svg')
  const hasPdfSource = sources.includes('pdf')
  const showQuality = spec && (spec.lossy || (spec.id === 'pdf' && imageSources))
  const showMatte = spec?.flattens && !hasPdfSource
  const showPage = spec?.id === 'pdf'
  const showScale = hasPdfSource && (spec?.id === 'png' || spec?.id === 'jpg')
  const set = (patch) => setOptions((o) => ({ ...o, ...patch }))
  const sourceSym = sources.length === 1 ? ELEMENTS[sources[0] === 'image' ? 'png' : sources[0]]?.sym : sources.length ? '··' : '··'
  const fill = el ? FAMILIES[el.family].color : 'var(--c-doc)'

  const note = spec?.id === 'pdf' && imageSources ? 'One page per image' : spec?.note

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-6 pt-5 sm:px-6">
        <div className="mb-6 flex items-center gap-3 font-display text-[34px] leading-none" aria-live="polite">
          <SplitFlap text={hasFiles ? (sourceSym ?? '··') : '··'} />
          <ArrowRight className="size-6 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          <SplitFlap text={hasFiles && el ? el.sym : '··'} />
          <span className="sr-only">{hasFiles && el ? `Converting to ${el.name}` : 'Add files to choose a format'}</span>
        </div>

        <section>
          <Label hint={hasFiles && note ? note : null}>Becomes</Label>
          <div className="grid grid-cols-4 gap-2">
            {ALL_TARGETS.map((id, i) => {
              const available = targets.includes(id)
              const tile = { key: id, ...ELEMENTS[id] }
              return (
                <Element
                  key={id}
                  as="button"
                  type="button"
                  el={tile}
                  className="rise"
                  style={{ '--i': i }}
                  disabled={!available}
                  aria-pressed={available && options.target === id}
                  aria-label={`${TARGETS[id].label}${available ? '' : ' (not available for these files)'}`}
                  title={available ? TARGETS[id].note : 'Not reachable from these files'}
                  onClick={() => set({ target: id })}
                />
              )
            })}
          </div>
          {hasFiles && targets.length === 0 && (
            <p className="pop-in mt-3 text-[13px] leading-snug text-alert">These files have no format in common. Remove one to continue.</p>
          )}
          {!hasFiles && <p className="mt-3 text-[13px] leading-snug text-ink-2">Add a file and the formats it can become light up.</p>}
        </section>

        {showQuality && (
          <section className="pop-in mt-7">
            <Label hint={`${Math.round(options.quality * 100)}`}>{spec.id === 'pdf' ? 'Embedded image quality' : 'Quality'}</Label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.01"
              value={options.quality}
              onChange={(e) => set({ quality: Number(e.target.value) })}
              aria-label="Output quality"
              className="scale"
            />
            <div className="mt-1 flex justify-between font-mono text-[10.5px] text-ink-3">
              <span>smaller</span>
              <span>sharper</span>
            </div>
          </section>
        )}

        {showScale && (
          <section className="pop-in mt-7">
            <Label>Page resolution</Label>
            <Chips
              name="Page resolution"
              value={options.pdfScale}
              onChange={(v) => set({ pdfScale: v })}
              options={[
                { value: 1, label: '72 dpi' },
                { value: 2, label: '144 dpi' },
                { value: 3, label: '216 dpi' },
              ]}
            />
            <p className="mt-2 text-[12px] leading-snug text-ink-3">Each page becomes one image. Several pages download as a zip.</p>
          </section>
        )}

        {showMatte && (
          <section className="pop-in mt-7">
            <Label hint={options.matte.toUpperCase()}>Background</Label>
            <p className="mb-2.5 text-[12.5px] leading-snug text-ink-2">JPG has no transparency. Pick what shows through.</p>
            <div className="flex items-center gap-2">
              {MATTES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set({ matte: m.value })}
                  aria-label={m.label}
                  aria-pressed={options.matte === m.value}
                  title={m.label}
                  className={`size-9 rounded-[3px] border-[1.5px] border-ink transition ${options.matte === m.value ? 'shadow-[3px_3px_0_var(--color-ink)] -translate-x-0.5 -translate-y-0.5' : ''}`}
                  style={{ backgroundColor: m.value }}
                />
              ))}
              <label className="relative size-9 cursor-pointer overflow-hidden rounded-[3px] border-[1.5px] border-dashed border-ink">
                <span className="sr-only">Custom background colour</span>
                <input type="color" value={options.matte} onChange={(e) => set({ matte: e.target.value })} className="absolute -inset-2 size-14 cursor-pointer border-0 bg-transparent p-0" />
              </label>
            </div>
          </section>
        )}

        {showPage && (
          <section className="pop-in mt-7">
            <Label>Page size</Label>
            <Chips
              name="Page size"
              value={imageSources ? options.pageSize : options.pageSize === 'fit' ? 'a4' : options.pageSize}
              onChange={(v) => set({ pageSize: v })}
              options={[...(imageSources ? [{ value: 'fit', label: 'Match image' }] : []), { value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }]}
            />
          </section>
        )}

        {stats.done > 0 && (
          <section className="pop-in mt-7">
            <Label>Result</Label>
            <dl className="grid grid-cols-3 gap-2 font-mono text-[12px]">
              <div>
                <dt className="text-ink-3">In</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tnum">{formatBytes(stats.bytesIn)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Out</dt>
                <dd className="mt-0.5 text-[15px] font-semibold tnum">{formatBytes(stats.bytesOut)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Change</dt>
                <dd className={`mt-0.5 text-[15px] font-semibold tnum ${stats.bytesOut <= stats.bytesIn ? 'text-[var(--c-data)]' : 'text-alert'}`}>
                  {stats.bytesOut <= stats.bytesIn ? '−' : '+'}
                  {Math.abs(Math.round((1 - stats.bytesOut / stats.bytesIn) * 100))}%
                </dd>
              </div>
            </dl>
          </section>
        )}
      </div>

      <div className="space-y-2 border-t-[1.5px] border-ink bg-paper p-4 sm:p-5">
        <button
          type="button"
          onClick={onConvert}
          disabled={!hasFiles || !targets.length || busy}
          className="go"
          style={{ '--go-fill': fill, '--progress': busy ? progress : 0 }}
        >
          <span className="flex items-center gap-2.5">
            {busy && <Loader2 className="size-4 animate-spin" strokeWidth={2.4} />}
            {busy ? `Transmuting ${Math.round(progress * stats.total)}/${stats.total}` : `Transmute ${stats.total > 1 ? `${stats.total} files` : 'file'}`}
          </span>
          <ArrowRight className="go-arrow size-5" strokeWidth={2.4} aria-hidden="true" />
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDownloadAll}
            disabled={doneCount < 1}
            className="chip flex flex-1 items-center justify-center gap-1.5 !rounded-[3px] !py-2.5 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Package className="size-3.5" strokeWidth={2} />
            {doneCount > 1 ? 'Save all as zip' : 'Save'}
          </button>
          <button type="button" onClick={onClear} disabled={!hasFiles} className="chip flex items-center justify-center gap-1.5 !rounded-[3px] !py-2.5 disabled:cursor-not-allowed disabled:opacity-35">
            <Eraser className="size-3.5" strokeWidth={2} />
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}
