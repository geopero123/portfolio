import { AlertTriangle, ArrowRight, Check, Download, Loader2 } from 'lucide-react'
import { formatBytes } from '../lib/download.js'

export function Label({ children, hint }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <span className="label">{children}</span>
      {hint != null && <span className="font-mono text-[11px] tnum text-ink-600">{hint}</span>}
    </div>
  )
}

export function Segmented({ value, onChange, options, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex overflow-hidden rounded-md border border-rule bg-paper-50">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2.5 py-2 text-[12.5px] font-medium transition focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-vermillion-600 ${
            i > 0 ? 'border-l border-rule' : ''
          } ${value === o.value ? 'bg-ink-900 text-paper-50' : 'text-ink-600 hover:bg-paper-200'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ value, onChange, min, max, step = 1, name }) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={name}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-paper-300 accent-vermillion-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermillion-600"
    />
  )
}

export function Alert({ children, onDismiss }) {
  if (!children) return null
  return (
    <div className="animate-rise flex items-start gap-2.5 rounded-md border border-vermillion-100 bg-vermillion-50 px-3.5 py-3 text-[13px] leading-snug text-vermillion-700">
      <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={2} />
      <p className="flex-1">{children}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="label !text-vermillion-600 hover:underline">
          Dismiss
        </button>
      )}
    </div>
  )
}

export function RunButton({ children, onClick, disabled, busy }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-vermillion-600 px-4 py-2.5 text-[14px] font-semibold text-paper-50 shadow-[0_1px_0_var(--color-vermillion-700)] transition hover:bg-vermillion-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vermillion-600 active:translate-y-px disabled:cursor-not-allowed disabled:bg-paper-300 disabled:text-ink-300 disabled:shadow-none"
    >
      {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2.4} /> : null}
      {children}
    </button>
  )
}

export function Progress({ value, note }) {
  if (value == null) return null
  return (
    <div className="mt-3">
      <div className="h-1 w-full overflow-hidden rounded-full bg-paper-300">
        <div
          className="h-full rounded-full bg-vermillion-600 transition-[width] duration-200"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      {note && <p className="mt-1.5 font-mono text-[11px] text-ink-400">{note}</p>}
    </div>
  )
}

/**
 * The outcome panel. Shows the real before/after, and says plainly when a file
 * got *bigger* instead of quietly presenting it as a win.
 */
export function Result({ result, before, onSave, saveLabel = 'Download', compare = true, growNote }) {
  if (!result) return null
  const files = Array.isArray(result) ? result : [result]
  const after = files.reduce((n, f) => n + f.size, 0)
  const pct = compare && before ? Math.round((1 - after / before) * 100) : null
  const grew = pct != null && pct < 0

  return (
    <div className="animate-rise mt-4 rounded-md border border-moss-100 bg-moss-100/40 p-3.5">
      <div className="flex items-center gap-2 text-moss-700">
        <Check className="size-4" strokeWidth={2.6} />
        <span className="label !text-moss-700">
          {files.length > 1 ? `${files.length} files ready` : 'Ready'}
        </span>
      </div>

      <p className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[12px] tnum text-ink-800">
        {compare && before != null && (
          <>
            <span className="text-ink-400">{formatBytes(before)}</span>
            <ArrowRight className="size-3 text-ink-300" strokeWidth={2.4} />
          </>
        )}
        <span className="font-medium">{formatBytes(after)}</span>
        {pct != null && Math.abs(pct) >= 1 && (
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              grew ? 'bg-vermillion-100 text-vermillion-700' : 'bg-moss-100 text-moss-700'
            }`}
          >
            {grew ? '+' : '−'}
            {Math.abs(pct)}%
          </span>
        )}
      </p>

      {grew && growNote && <p className="mt-2 text-[12px] leading-snug text-ink-600">{growNote}</p>}

      <button
        type="button"
        onClick={onSave}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-ink-900 bg-ink-900 px-3 py-2 text-[13px] font-medium text-paper-50 transition hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900"
      >
        <Download className="size-3.5" strokeWidth={2.2} />
        {saveLabel}
      </button>
    </div>
  )
}

/** Left-hand sidenote column: title, standfirst, then whatever controls follow. */
export function Sidenote({ index, title, children, blurb }) {
  return (
    <div className="lg:sticky lg:top-6">
      <p className="label">Operation {index}</p>
      <h2 className="font-wonk mt-1.5 text-[30px] leading-[1.05] text-ink-900">{title}</h2>
      <p className="mt-2.5 max-w-[34ch] text-[13.5px] leading-relaxed text-ink-600">{blurb}</p>
      <hr className="my-5 border-0 border-t border-rule" />
      <div className="space-y-5">{children}</div>
    </div>
  )
}
