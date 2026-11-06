import { AlertTriangle, Check, Info } from 'lucide-react'

export function Label({ children, hint, htmlFor }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label className="eyebrow" htmlFor={htmlFor}>
        {children}
      </label>
      {hint != null && <span className="font-mono text-[10.5px] tnum text-forest-400">{hint}</span>}
    </div>
  )
}

export function Text({ label, hint, value, onChange, placeholder, type = 'text', multiline, id, ...rest }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint}>
          {label}
        </Label>
      )}
      <Tag
        id={id}
        type={multiline ? undefined : type}
        value={value}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="field resize-y"
        {...rest}
      />
    </div>
  )
}

export function Pills({ options, value, onChange, name, size = 'md' }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.note}
          onClick={() => onChange(o.value)}
          className={`rounded-full border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot-400 ${
            size === 'sm' ? 'px-2.5 py-1 text-[11.5px]' : 'px-3 py-1.5 text-[13px]'
          } ${
            value === o.value
              ? 'border-apricot-400 bg-apricot-400 font-medium text-forest-950'
              : 'border-forest-700 bg-forest-850 text-forest-300 hover:border-forest-600 hover:text-forest-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Swatches({ value, onChange, presets, label, id }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            aria-pressed={value.toLowerCase() === c.toLowerCase()}
            onClick={() => onChange(c)}
            style={{ backgroundColor: c }}
            className={`size-7 rounded-md border-2 transition ${
              value.toLowerCase() === c.toLowerCase()
                ? 'border-apricot-400'
                : 'border-forest-700 hover:border-forest-600'
            }`}
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-md border-2 border-forest-700 hover:border-forest-600">
          <span className="sr-only">Custom {label.toLowerCase()}</span>
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute -inset-2 size-11 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} hex value`}
          spellCheck={false}
          className="field ml-1 w-24 !py-1.5 font-mono text-[12px] uppercase"
        />
      </div>
    </div>
  )
}

export function Range({ label, hint, value, onChange, min, max, step = 1, id }) {
  return (
    <div>
      <Label htmlFor={id} hint={hint}>
        {label}
      </Label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-forest-700 accent-apricot-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-apricot-400"
      />
    </div>
  )
}

export function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded accent-apricot-400"
      />
      <span>
        <span className="block text-[13px] font-medium text-forest-100">{label}</span>
        {description && <span className="mt-0.5 block text-[11.5px] leading-snug text-forest-400">{description}</span>}
      </span>
    </label>
  )
}

const NOTICE_STYLES = {
  ok: 'border-forest-700 bg-forest-850 text-forest-300',
  warn: 'border-apricot-500/40 bg-apricot-900/50 text-apricot-300',
  error: 'border-coral-500/40 bg-coral-900/50 text-coral-400',
  info: 'border-forest-700 bg-forest-850 text-forest-300',
}
const NOTICE_ICONS = { ok: Check, warn: AlertTriangle, error: AlertTriangle, info: Info }

export function Notice({ level = 'info', children }) {
  if (!children) return null
  const Icon = NOTICE_ICONS[level]
  return (
    <p
      className={`animate-lift flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] leading-snug ${NOTICE_STYLES[level]}`}
    >
      <Icon className="mt-px size-3.5 shrink-0" strokeWidth={2.2} />
      <span>{children}</span>
    </p>
  )
}

export function Section({ title, children, aside }) {
  return (
    <section className="panel p-4 sm:p-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-forest-50">{title}</h2>
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
