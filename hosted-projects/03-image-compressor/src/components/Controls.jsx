import { FORMATS, supportsWebp } from '../lib/encode.js'

function Cell({ title, hint, children, span = '' }) {
  return (
    <div className={`block-edge bg-paper-bright p-3.5 ${span}`}>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="stamp text-ink">{title}</h3>
        {hint != null && <span className="font-mono text-[11px] tnum text-mute">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Choice({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={`block-edge px-2.5 py-1.5 font-mono text-[11.5px] font-medium uppercase tracking-wide transition ${
            value === o.value
              ? 'block-shadow-sm bg-acid text-ink'
              : 'bg-paper text-ink-soft hover:bg-paper-sunk'
          } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-paper`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const MATTES = ['#ffffff', '#0b0b0a', '#eaff00', '#ff2d6f']

export default function Controls({ settings, onChange, sourceDims, outputDims }) {
  const set = (patch) => onChange((s) => ({ ...s, ...patch }))
  const lossless = settings.format === 'png'
  const showMatte = settings.format === 'jpg'
  const webp = supportsWebp()

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Cell title="Format">
        <Choice
          name="Output format"
          value={settings.format}
          onChange={(v) => set({ format: v })}
          options={Object.values(FORMATS).map((f) => ({
            value: f.id,
            label: f.label,
            disabled: f.id === 'webp' && !webp,
            title: f.id === 'webp' && !webp ? 'This browser cannot write WEBP' : f.note,
          }))}
        />
        <p className="mt-2.5 text-[11.5px] leading-snug text-mute">{FORMATS[settings.format].note}</p>
      </Cell>

      <Cell title="Quality" hint={lossless ? 'n/a' : Math.round(settings.quality * 100)}>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.01"
          value={settings.quality}
          disabled={lossless}
          aria-label="Quality"
          onChange={(e) => set({ quality: Number(e.target.value) })}
          className="w-full disabled:opacity-35"
        />
        <p className="mt-2.5 text-[11.5px] leading-snug text-mute">
          {lossless
            ? 'PNG is lossless. Reduce size by resizing, or switch to WEBP.'
            : 'Below about 60 the artefacts start to show on flat colour.'}
        </p>
      </Cell>

      <Cell
        title="Resize"
        hint={outputDims ? `${outputDims.width}×${outputDims.height}` : sourceDims ? `${sourceDims.width}×${sourceDims.height}` : null}
      >
        <Choice
          name="Resize mode"
          value={settings.resizeMode}
          onChange={(v) => set({ resizeMode: v })}
          options={[
            { value: 'none', label: 'Original' },
            { value: 'scale', label: 'Scale' },
            { value: 'fit', label: 'Fit box' },
          ]}
        />

        {settings.resizeMode === 'scale' && (
          <div className="mt-3">
            <div className="mb-1.5 flex justify-between font-mono text-[11px] tnum text-mute">
              <span>10%</span>
              <span className="font-medium text-ink">{settings.scale}%</span>
              <span>200%</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="1"
              value={settings.scale}
              aria-label="Scale percentage"
              onChange={(e) => set({ scale: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        )}

        {settings.resizeMode === 'fit' && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="20000"
                value={settings.maxW}
                aria-label="Maximum width"
                onChange={(e) => set({ maxW: Math.max(1, Number(e.target.value) || 1) })}
                className="block-edge w-full bg-paper px-2 py-1.5 font-mono text-[12px] tnum"
              />
              <span className="font-mono text-[12px] text-mute">×</span>
              <input
                type="number"
                min="1"
                max="20000"
                value={settings.maxH}
                aria-label="Maximum height"
                onChange={(e) => set({ maxH: Math.max(1, Number(e.target.value) || 1) })}
                className="block-edge w-full bg-paper px-2 py-1.5 font-mono text-[12px] tnum"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-ink-soft">
              <input
                type="checkbox"
                checked={settings.noUpscale}
                onChange={(e) => set({ noUpscale: e.target.checked })}
                className="block-edge size-4 accent-acid"
              />
              Never enlarge a smaller image
            </label>
          </div>
        )}
      </Cell>

      {/* One cell for everything about the output. The safety toggle lives here
          permanently — it must not disappear just because a format was picked. */}
      <Cell title="Output">
        <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-snug text-ink-soft">
          <input
            type="checkbox"
            checked={settings.keepSmaller}
            onChange={(e) => set({ keepSmaller: e.target.checked })}
            className="block-edge mt-0.5 size-4 shrink-0 accent-acid"
          />
          <span>
            <span className="font-medium text-ink">Never output a bigger file</span>
            <span className="mt-1 block text-[11.5px] text-mute">
              If re-encoding would grow a file, keep the original bytes instead.
            </span>
          </span>
        </label>

        {showMatte && (
          <div className="mt-3.5 border-t-2 border-ink/10 pt-3">
            <h4 className="stamp mb-2 text-mute">Background</h4>
            <div className="flex items-center gap-1.5">
              {MATTES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Background ${c}`}
                  aria-pressed={settings.matte === c}
                  onClick={() => set({ matte: c })}
                  style={{ backgroundColor: c }}
                  className={`size-7 border-2 transition ${
                    settings.matte === c ? 'block-shadow-sm border-ink' : 'border-ink/25 hover:border-ink'
                  }`}
                />
              ))}
              <label className="relative size-7 cursor-pointer overflow-hidden border-2 border-ink/25 hover:border-ink">
                <span className="sr-only">Custom background colour</span>
                <input
                  type="color"
                  value={settings.matte}
                  onChange={(e) => set({ matte: e.target.value })}
                  className="absolute -inset-2 size-11 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
            </div>
            <p className="mt-2 text-[11.5px] leading-snug text-mute">
              JPG has no transparency — this is what shows through.
            </p>
          </div>
        )}
      </Cell>
    </div>
  )
}
