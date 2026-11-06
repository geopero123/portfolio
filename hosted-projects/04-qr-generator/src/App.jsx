import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileCode2, ImagePlus, QrCode, ScanBarcode, Shield, Trash2 } from 'lucide-react'
import ContentForm from './components/ContentForm.jsx'
import QrPreview from './components/QrPreview.jsx'
import BarcodePreview from './components/BarcodePreview.jsx'
import { Label, Notice, Pills, Range, Section, Swatches, Text, Toggle } from './components/ui.jsx'
import { CONTENT_TYPES } from './lib/payloads.js'
import { ECC_LEVELS, EYE_STYLES, MODULE_STYLES, QrError, geometryToCanvas, geometryToSvg, qrGeometry } from './lib/qr.js'
import { BARCODE_FORMATS, drawBarcode, formatRule } from './lib/barcode.js'
import { scanAdvice } from './lib/color.js'
import { canvasToBlob, fileToDataUrl, loadImage, saveBlob, saveSvg } from './lib/download.js'

const FG_PRESETS = ['#0b1510', '#000000', '#1d3f6e', '#7a2233', '#2f5d3f']
const BG_PRESETS = ['#ffffff', '#f4f1e8', '#eaf1eb', '#fef3d7']
const PNG_SIZES = [
  { value: 512, label: '512' },
  { value: 1024, label: '1024' },
  { value: 2048, label: '2048' },
]
const MAX_LOGO_BYTES = 4 * 1024 * 1024

const initialFields = Object.fromEntries(
  Object.entries(CONTENT_TYPES).map(([id, t]) => [id, { ...t.empty }]),
)

export default function App() {
  const [mode, setMode] = useState('qr')
  const [type, setType] = useState('url')
  const [fields, setFields] = useState(initialFields)
  const [style, setStyle] = useState({
    foreground: '#0b1510',
    background: '#ffffff',
    transparent: false,
    moduleStyle: 'square',
    eyeStyle: 'square',
    ecc: 'M',
    margin: 4,
    logoScale: 0.22,
    logoPad: true,
  })
  const [logo, setLogo] = useState(null)
  const [logoError, setLogoError] = useState(null)
  const [pngSize, setPngSize] = useState(1024)
  const [showPayload, setShowPayload] = useState(false)

  const [barcode, setBarcode] = useState({
    format: 'CODE128',
    value: 'SIGNAL-2024',
    barWidth: 2,
    height: 90,
    showText: true,
    fontSize: 18,
    margin: 10,
  })
  const [barcodeValid, setBarcodeValid] = useState(true)
  const logoInput = useRef(null)

  useEffect(() => () => logo?.dataUrl && undefined, [logo])

  /* ------------------------------------------------------------ payload -- */

  const payload = useMemo(() => CONTENT_TYPES[type].build(fields[type]), [type, fields])

  const { geo, geoError } = useMemo(() => {
    if (mode !== 'qr') return { geo: null, geoError: null }
    try {
      return { geo: qrGeometry(payload, { ...style, logo: logo?.dataUrl ?? null }), geoError: null }
    } catch (err) {
      return { geo: null, geoError: err instanceof QrError ? err.message : 'Could not build this code.' }
    }
  }, [mode, payload, style, logo])

  const advice = useMemo(
    () => scanAdvice(style.foreground, style.background, style.transparent),
    [style.foreground, style.background, style.transparent],
  )

  const barcodeOptions = useMemo(
    () => ({
      format: barcode.format,
      barWidth: barcode.barWidth,
      height: barcode.height,
      showText: barcode.showText,
      fontSize: barcode.fontSize,
      margin: barcode.margin,
      background: style.background,
      foreground: style.foreground,
      transparent: style.transparent,
    }),
    [barcode, style.background, style.foreground, style.transparent],
  )

  /* ----------------------------------------------------------- the logo -- */

  const pickLogo = useCallback(async (file) => {
    setLogoError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLogoError('That is not an image.')
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logos are capped at 4 MB — the file is embedded in the SVG, so smaller is better.')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      const image = await loadImage(dataUrl)
      setLogo({ name: file.name, dataUrl, image })
    } catch {
      setLogoError('Could not read that image.')
    }
  }, [])

  /* ---------------------------------------------------------- downloads -- */

  const baseName = mode === 'qr' ? `qr-${type}` : `barcode-${barcode.format.toLowerCase()}`

  const downloadPng = useCallback(async () => {
    if (mode === 'qr') {
      if (!geo) return
      const canvas = await geometryToCanvas(geo, { pixels: pngSize, logoImage: logo?.image ?? null })
      saveBlob(await canvasToBlob(canvas), `${baseName}.png`)
      return
    }
    // Barcodes have no natural pixel size, so scale the drawing parameters
    // rather than upscaling a small bitmap.
    const scale = pngSize / 512
    const canvas = document.createElement('canvas')
    const ok = drawBarcode(canvas, barcode.value, {
      ...barcodeOptions,
      barWidth: barcodeOptions.barWidth * scale,
      height: barcodeOptions.height * scale,
      fontSize: barcodeOptions.fontSize * scale,
      margin: barcodeOptions.margin * scale,
    })
    if (!ok) return
    saveBlob(await canvasToBlob(canvas), `${baseName}.png`)
  }, [mode, geo, pngSize, logo, baseName, barcode.value, barcodeOptions])

  const downloadSvg = useCallback(() => {
    if (mode === 'qr') {
      if (!geo) return
      saveSvg(geometryToSvg(geo, { pixels: pngSize, logoHref: logo?.dataUrl ?? null }), `${baseName}.svg`)
      return
    }
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    if (!drawBarcode(el, barcode.value, barcodeOptions)) return
    el.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    saveSvg(new XMLSerializer().serializeToString(el), `${baseName}.svg`)
  }, [mode, geo, pngSize, logo, baseName, barcode.value, barcodeOptions])

  const ready = mode === 'qr' ? Boolean(geo) : Boolean(barcode.value) && barcodeValid

  /* --------------------------------------------------------------- view -- */

  const checkerStyle = style.transparent
    ? {
        backgroundImage:
          'linear-gradient(45deg,#24402f 25%,transparent 25%),linear-gradient(-45deg,#24402f 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#24402f 75%),linear-gradient(-45deg,transparent 75%,#24402f 75%)',
        backgroundSize: '16px 16px',
        backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
        backgroundColor: '#1a3025',
      }
    : undefined

  return (
    <div className="min-h-dvh">
      <header className="border-b border-forest-800 bg-forest-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="text-[19px] font-semibold tracking-[-0.03em] text-forest-50">SIGNAL</span>
            <span className="hidden h-4 w-px bg-forest-700 sm:block" />
            <span className="eyebrow hidden sm:block">QR &amp; barcode generator</span>
          </div>

          <div className="flex items-center gap-4">
            <div role="radiogroup" aria-label="Code type" className="flex rounded-full border border-forest-700 bg-forest-850 p-0.5">
              {[
                { id: 'qr', label: 'QR code', Icon: QrCode },
                { id: 'barcode', label: 'Barcode', Icon: ScanBarcode },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={mode === id}
                  onClick={() => setMode(id)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot-400 ${
                    mode === id ? 'bg-apricot-400 font-medium text-forest-950' : 'text-forest-300 hover:text-forest-50'
                  }`}
                >
                  <Icon className="size-3.5" strokeWidth={2.2} />
                  {label}
                </button>
              ))}
            </div>
            <span className="eyebrow hidden items-center gap-1.5 md:flex">
              <Shield className="size-3.5 text-apricot-400" strokeWidth={2.2} />
              On-device
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)] lg:gap-8 lg:py-10">
        {/* Preview leads: it is the artefact being made, not a side panel. */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="panel rings grid place-items-center p-5 sm:p-8">
            {mode === 'qr' ? (
              geo ? (
                <div
                  className="aspect-square w-full max-w-[330px] overflow-hidden rounded-xl"
                  style={checkerStyle}
                >
                  <QrPreview geo={geo} logoHref={logo?.dataUrl} />
                </div>
              ) : (
                <div className="grid aspect-square w-full max-w-[330px] place-items-center rounded-xl border border-dashed border-forest-700 px-6 text-center">
                  <p className="text-[13px] leading-relaxed text-forest-400">
                    {geoError ?? 'Fill in the fields to build a code.'}
                  </p>
                </div>
              )
            ) : (
              <div
                className="grid min-h-[200px] w-full place-items-center overflow-x-auto rounded-xl p-3"
                style={checkerStyle ?? { backgroundColor: style.background }}
              >
                <BarcodePreview value={barcode.value} options={barcodeOptions} onValidity={setBarcodeValid} />
              </div>
            )}
          </div>

          <div className="mt-3 space-y-2.5">
            {mode === 'qr' && geo && <Notice level={advice.level}>{advice.message}</Notice>}
            {mode === 'qr' && logo && (
              <Notice level="info">
                A logo needs the highest error correction, so level H is used automatically — the code is a
                little denser as a result.
              </Notice>
            )}
            {mode === 'barcode' && barcode.value && !barcodeValid && (
              <Notice level="error">
                {`"${barcode.value}" is not valid for ${barcode.format}. ${formatRule(barcode.format)}`}
              </Notice>
            )}

            <div className="panel flex flex-wrap items-center gap-2 p-3">
              <div className="mr-auto flex items-center gap-2">
                <span className="eyebrow">PNG size</span>
                <Pills
                  name="PNG size"
                  size="sm"
                  options={PNG_SIZES}
                  value={pngSize}
                  onChange={setPngSize}
                />
              </div>
              <button
                type="button"
                onClick={downloadPng}
                disabled={!ready}
                className="flex items-center gap-1.5 rounded-lg bg-apricot-400 px-3.5 py-2 text-[13px] font-semibold text-forest-950 transition hover:bg-apricot-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot-400 disabled:cursor-not-allowed disabled:bg-forest-800 disabled:text-forest-600"
              >
                <Download className="size-4" strokeWidth={2.4} />
                PNG
              </button>
              <button
                type="button"
                onClick={downloadSvg}
                disabled={!ready}
                className="flex items-center gap-1.5 rounded-lg border border-forest-700 px-3.5 py-2 text-[13px] font-medium text-forest-100 transition hover:border-forest-600 hover:bg-forest-850 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FileCode2 className="size-4" strokeWidth={2.2} />
                SVG
              </button>
            </div>

            {/* Always mounted, with its open state held here: unmounting it when
                the payload is momentarily empty would snap it shut mid-edit. */}
            {mode === 'qr' && (
              <details
                className="panel group p-3"
                open={showPayload}
                onToggle={(e) => setShowPayload(e.currentTarget.open)}
              >
                <summary className="eyebrow cursor-pointer list-none transition hover:text-forest-100">
                  What gets encoded
                  <span className="ml-1.5 inline-block transition group-open:rotate-90">›</span>
                </summary>
                <pre className="scroll-slim mt-2.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-forest-850 p-3 font-mono text-[11.5px] leading-relaxed text-forest-300">
                  {payload || 'Nothing yet.'}
                </pre>
                <p className="mt-2 font-mono text-[10.5px] text-forest-400">
                  {new TextEncoder().encode(payload).length} bytes
                  {geo ? ` · ${geo.size}×${geo.size} modules · level ${geo.ecc}` : ''}
                </p>
              </details>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          {mode === 'qr' ? (
            <>
              <Section title="Content">
                <Pills
                  name="Content type"
                  options={Object.values(CONTENT_TYPES).map((t) => ({ value: t.id, label: t.label }))}
                  value={type}
                  onChange={setType}
                />
                <p className="text-[12px] text-forest-400">{CONTENT_TYPES[type].hint}</p>
                <div className="space-y-3.5 border-t border-forest-800 pt-4">
                  <ContentForm
                    key={type}
                    type={type}
                    values={fields[type]}
                    onChange={(v) => setFields((f) => ({ ...f, [type]: v }))}
                  />
                </div>
              </Section>

              <Section title="Appearance">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Swatches
                    id="fg"
                    label="Modules"
                    presets={FG_PRESETS}
                    value={style.foreground}
                    onChange={(foreground) => setStyle((s) => ({ ...s, foreground }))}
                  />
                  <Swatches
                    id="bg"
                    label="Background"
                    presets={BG_PRESETS}
                    value={style.background}
                    onChange={(background) => setStyle((s) => ({ ...s, background }))}
                  />
                </div>
                <Toggle
                  label="Transparent background"
                  description="Useful over artwork. The preview shows a chequerboard where the page will show through."
                  checked={style.transparent}
                  onChange={(transparent) => setStyle((s) => ({ ...s, transparent }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Module shape</Label>
                    <Pills
                      name="Module shape"
                      size="sm"
                      options={MODULE_STYLES}
                      value={style.moduleStyle}
                      onChange={(moduleStyle) => setStyle((s) => ({ ...s, moduleStyle }))}
                    />
                  </div>
                  <div>
                    <Label>Corner markers</Label>
                    <Pills
                      name="Corner marker shape"
                      size="sm"
                      options={EYE_STYLES}
                      value={style.eyeStyle}
                      onChange={(eyeStyle) => setStyle((s) => ({ ...s, eyeStyle }))}
                    />
                  </div>
                </div>
                <Range
                  id="margin"
                  label="Quiet zone"
                  hint={`${style.margin} modules`}
                  min={0}
                  max={8}
                  value={style.margin}
                  onChange={(margin) => setStyle((s) => ({ ...s, margin }))}
                />
                {style.margin < 4 && (
                  <Notice level="warn">
                    The spec asks for a quiet zone of at least 4 modules. Below that, scanners can struggle
                    to find the code against a busy background.
                  </Notice>
                )}
                <div>
                  <Label hint={logo ? 'forced to H by the logo' : ECC_LEVELS.find((e) => e.value === style.ecc)?.note}>
                    Error correction
                  </Label>
                  <div className={logo ? 'pointer-events-none opacity-40' : ''}>
                    <Pills
                      name="Error correction level"
                      size="sm"
                      options={ECC_LEVELS}
                      value={logo ? 'H' : style.ecc}
                      onChange={(ecc) => setStyle((s) => ({ ...s, ecc }))}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Logo">
                {logo ? (
                  <>
                    <div className="flex items-center gap-3 rounded-lg border border-forest-700 bg-forest-850 p-2.5">
                      <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-white p-1">
                        <img src={logo.dataUrl} alt="" className="size-full object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{logo.name}</span>
                        <span className="block font-mono text-[11px] text-forest-400">
                          {logo.image.width}×{logo.image.height}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setLogo(null)}
                        aria-label="Remove logo"
                        className="grid size-8 place-items-center rounded-md text-forest-400 transition hover:bg-coral-900 hover:text-coral-400"
                      >
                        <Trash2 className="size-4" strokeWidth={2.2} />
                      </button>
                    </div>
                    <Range
                      id="logoscale"
                      label="Logo size"
                      hint={`${Math.round(style.logoScale * 100)}% of the code`}
                      min={0.1}
                      max={0.3}
                      step={0.01}
                      value={style.logoScale}
                      onChange={(logoScale) => setStyle((s) => ({ ...s, logoScale }))}
                    />
                    <Toggle
                      label="Clear space behind the logo"
                      description="A small padded plate so the logo is not read as part of the pattern."
                      checked={style.logoPad}
                      onChange={(logoPad) => setStyle((s) => ({ ...s, logoPad }))}
                    />
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoInput.current?.click()}
                    className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-forest-700 px-4 py-7 transition hover:border-apricot-400/60 hover:bg-forest-850 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apricot-400"
                  >
                    <ImagePlus className="size-5 text-forest-400" strokeWidth={1.8} />
                    <span className="text-[13px] font-medium">Add a logo</span>
                    <span className="text-[11.5px] text-forest-400">PNG or SVG with a transparent background works best</span>
                  </button>
                )}
                {logoError && <Notice level="error">{logoError}</Notice>}
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    pickLogo(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </Section>
            </>
          ) : (
            <>
              <Section title="Barcode">
                <div>
                  <Label>Symbology</Label>
                  <Pills
                    name="Barcode format"
                    size="sm"
                    options={BARCODE_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
                    value={barcode.format}
                    onChange={(format) => {
                      const spec = BARCODE_FORMATS.find((f) => f.value === format)
                      // Switching symbology almost always invalidates the old
                      // value, so drop in that format's own sample instead of
                      // leaving an error on screen.
                      setBarcode((b) => ({ ...b, format, value: spec?.sample ?? b.value }))
                    }}
                  />
                  <p className="mt-2 text-[12px] leading-snug text-forest-400">{formatRule(barcode.format)}</p>
                </div>
                <Text
                  id="bc-value"
                  label="Value"
                  value={barcode.value}
                  onChange={(value) => setBarcode((b) => ({ ...b, value }))}
                  placeholder={BARCODE_FORMATS.find((f) => f.value === barcode.format)?.sample}
                  spellCheck={false}
                />
              </Section>

              <Section title="Appearance">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Swatches
                    id="bfg"
                    label="Bars"
                    presets={FG_PRESETS}
                    value={style.foreground}
                    onChange={(foreground) => setStyle((s) => ({ ...s, foreground }))}
                  />
                  <Swatches
                    id="bbg"
                    label="Background"
                    presets={BG_PRESETS}
                    value={style.background}
                    onChange={(background) => setStyle((s) => ({ ...s, background }))}
                  />
                </div>
                <Toggle
                  label="Transparent background"
                  checked={style.transparent}
                  onChange={(transparent) => setStyle((s) => ({ ...s, transparent }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Range
                    id="bw"
                    label="Bar width"
                    hint={`${barcode.barWidth}px`}
                    min={1}
                    max={5}
                    step={0.5}
                    value={barcode.barWidth}
                    onChange={(barWidth) => setBarcode((b) => ({ ...b, barWidth }))}
                  />
                  <Range
                    id="bh"
                    label="Height"
                    hint={`${barcode.height}px`}
                    min={30}
                    max={200}
                    step={5}
                    value={barcode.height}
                    onChange={(height) => setBarcode((b) => ({ ...b, height }))}
                  />
                </div>
                <Toggle
                  label="Print the value underneath"
                  checked={barcode.showText}
                  onChange={(showText) => setBarcode((b) => ({ ...b, showText }))}
                />
                {barcode.showText && (
                  <Range
                    id="bfs"
                    label="Text size"
                    hint={`${barcode.fontSize}px`}
                    min={10}
                    max={32}
                    value={barcode.fontSize}
                    onChange={(fontSize) => setBarcode((b) => ({ ...b, fontSize }))}
                  />
                )}
                <Range
                  id="bm"
                  label="Quiet zone"
                  hint={`${barcode.margin}px`}
                  min={0}
                  max={40}
                  step={2}
                  value={barcode.margin}
                  onChange={(margin) => setBarcode((b) => ({ ...b, margin }))}
                />
              </Section>
            </>
          )}
        </div>
      </main>

      <footer className="mt-8 border-t border-forest-800 bg-forest-900">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-forest-400">
            Codes are drawn from the raw module matrix rather than a stock image, so the preview, the PNG
            and the SVG are all the same geometry at different resolutions. Nothing is sent anywhere — Wi-Fi
            passwords and contact details never leave this tab.
          </p>
        </div>
      </footer>
    </div>
  )
}
