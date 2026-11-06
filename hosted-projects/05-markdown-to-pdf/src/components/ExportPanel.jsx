import { FileDown, FileText, Printer, Loader2, FileCode2 } from 'lucide-react'
import { PAGE_SIZES, PRESETS } from '../lib/pdf.js'

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="chrome">{label}</span>
      {children}
    </div>
  )
}

function Choice({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex overflow-hidden rounded-md border border-rule">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.note}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-[12px] transition ${i > 0 ? 'border-l border-rule' : ''} ${
            value === o.value ? 'bg-ink text-ground' : 'text-ink-2 hover:bg-sunk'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function ExportPanel({ settings, onChange, onPdf, onHtml, onMarkdown, onPrint, busy }) {
  const set = (patch) => onChange((s) => ({ ...s, ...patch }))

  return (
    <div className="w-[min(92vw,21rem)] rounded-xl border border-rule bg-sheet p-4 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.45)]">
      <Row label="Style">
        <Choice
          name="Document style"
          value={settings.preset}
          onChange={(preset) => set({ preset })}
          options={Object.entries(PRESETS).map(([id, p]) => ({ value: id, label: p.label, note: p.note }))}
        />
      </Row>
      <p className="mb-1 text-[11.5px] leading-snug text-ink-3">{PRESETS[settings.preset].note}</p>

      <Row label="Page">
        <Choice
          name="Page size"
          value={settings.pageSize}
          onChange={(pageSize) => set({ pageSize })}
          options={Object.entries(PAGE_SIZES).map(([id, p]) => ({ value: id, label: p.label }))}
        />
      </Row>

      <Row label={`Margin · ${Math.round(settings.margin)}pt`}>
        <input
          type="range"
          min="32"
          max="110"
          step="2"
          value={settings.margin}
          aria-label="Page margin"
          onChange={(e) => set({ margin: Number(e.target.value) })}
          className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-rule accent-accent"
        />
      </Row>

      <label className="flex cursor-pointer items-center justify-between gap-3 py-1.5">
        <span className="chrome">Page numbers</span>
        <input
          type="checkbox"
          checked={settings.pageNumbers}
          onChange={(e) => set({ pageNumbers: e.target.checked })}
          className="size-4 accent-accent"
        />
      </label>

      <div className="mt-3 space-y-2 border-t border-rule pt-3">
        <button
          type="button"
          onClick={onPdf}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13.5px] font-semibold text-sheet transition hover:bg-accent-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" strokeWidth={2.4} /> : <FileDown className="size-4" strokeWidth={2.2} />}
          Download PDF
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onHtml}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-rule px-2 py-2 text-[12px] text-ink-2 transition hover:bg-sunk hover:text-ink"
          >
            <FileCode2 className="size-3.5" strokeWidth={2} />
            HTML
          </button>
          <button
            type="button"
            onClick={onMarkdown}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-rule px-2 py-2 text-[12px] text-ink-2 transition hover:bg-sunk hover:text-ink"
          >
            <FileText className="size-3.5" strokeWidth={2} />
            .md
          </button>
          <button
            type="button"
            onClick={onPrint}
            title="Uses the browser's own print engine — the route for non-Latin scripts"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-rule px-2 py-2 text-[12px] text-ink-2 transition hover:bg-sunk hover:text-ink"
          >
            <Printer className="size-3.5" strokeWidth={2} />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}
