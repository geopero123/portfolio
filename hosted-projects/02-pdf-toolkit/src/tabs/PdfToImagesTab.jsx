import { useEffect, useMemo, useState } from 'react'
import Dropzone from '../components/Dropzone.jsx'
import PageGrid from '../components/PageGrid.jsx'
import { Alert, Label, Progress, Result, RunButton, Segmented, Sidenote, Slider } from '../components/ui.jsx'
import { usePdfDocs, useJob } from '../hooks.js'
import { pdfToImages } from '../lib/ops.js'
import { formatRanges, parsePageRanges } from '../lib/pdf.js'
import { saveAsZip, saveBlob } from '../lib/download.js'

const FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
]

export default function PdfToImagesTab() {
  const { docs, addFiles, clear, error, setError } = usePdfDocs({ multiple: false })
  const job = useJob()
  const doc = docs[0]

  const [selected, setSelected] = useState(() => new Set())
  const [format, setFormat] = useState('png')
  const [dpi, setDpi] = useState(150)
  const [quality, setQuality] = useState(0.9)
  const [rangeText, setRangeText] = useState('')
  const [rangeValid, setRangeValid] = useState(true)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!doc) return
    const all = Array.from({ length: doc.pageCount }, (_, i) => i + 1)
    setSelected(new Set(all))
    // Show the range that is actually selected rather than an empty box that
    // reads as "nothing chosen" while every page is in fact ticked.
    setRangeText(formatRanges(all))
    setRangeValid(true)
    setResult(null)
  }, [doc?.id, doc?.pageCount])

  const pages = useMemo(() => [...selected].sort((a, b) => a - b), [selected])

  const toggle = (n) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      setRangeText(formatRanges([...next]))
      return next
    })

  const applyRange = (text) => {
    setRangeText(text)
    if (!doc) return
    const parsed = parsePageRanges(text, doc.pageCount)
    setRangeValid(parsed !== null)
    if (parsed) setSelected(new Set(parsed))
  }

  const run = async () => {
    setResult(null)
    const out = await job.run((onProgress) => pdfToImages(doc, { pages, format, dpi, quality, onProgress }))
    if (out) setResult(out.length === 1 ? out[0] : out)
  }

  const save = () => {
    if (Array.isArray(result)) saveAsZip(result, `${doc.name.replace(/\.pdf$/i, '')}-images.zip`)
    else saveBlob(result.blob, result.name)
  }

  // Rough guide so nobody accidentally asks for a 600 dpi render of 200 pages.
  const estimate = doc ? Math.round((doc.dims.width / 72) * (dpi / 72) * 72) : 0

  return (
    <div className="grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-12">
      <Sidenote
        index="05"
        title="PDF to images"
        blurb="Render pages to PNG or JPG at whatever resolution you need — for slides, thumbnails, or dropping a page into a document."
      >
        {doc && (
          <>
            <div>
              <Label>Format</Label>
              <Segmented name="Image format" value={format} onChange={setFormat} options={FORMATS} />
              <p className="mt-2 text-[12px] leading-snug text-ink-600">
                {format === 'png' ? 'Lossless, larger files, crisp text edges.' : 'Much smaller, slight softening around text.'}
              </p>
            </div>

            <div>
              <Label hint={`${dpi} dpi · ~${estimate}px wide`}>Resolution</Label>
              <Slider name="Resolution in dpi" value={dpi} onChange={setDpi} min={72} max={400} step={6} />
            </div>

            {format === 'jpg' && (
              <div>
                <Label hint={Math.round(quality * 100)}>JPEG quality</Label>
                <Slider name="JPEG quality" value={quality} onChange={setQuality} min={0.4} max={1} step={0.01} />
              </div>
            )}

            <div>
              <Label hint={`${pages.length}/${doc.pageCount}`}>Pages</Label>
              <input
                value={rangeText}
                onChange={(e) => applyRange(e.target.value)}
                placeholder="1-3, 5, 8-10"
                aria-label="Page ranges"
                className={`w-full rounded-md border bg-paper-50 px-2.5 py-2 font-mono text-[12.5px] tnum text-ink-900 placeholder:text-ink-300 focus:outline-2 focus:outline-offset-[-1px] focus:outline-vermillion-600 ${
                  rangeValid ? 'border-rule' : 'border-vermillion-600'
                }`}
              />
              {!rangeValid && (
                <p className="mt-1.5 text-[12px] text-vermillion-700">
                  Use numbers and ranges, e.g. <span className="font-mono">1-3, 5</span>.
                </p>
              )}
            </div>

            <RunButton onClick={run} busy={job.busy} disabled={!pages.length}>
              {pages.length ? `Render ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}` : 'Select pages first'}
            </RunButton>

            <Progress value={job.progress} note={job.note} />
            <Result
              result={result}
              onSave={save}
              saveLabel={Array.isArray(result) ? 'Download zip' : `Download ${format.toUpperCase()}`}
            />
          </>
        )}
      </Sidenote>

      <div className="space-y-4">
        <Alert onDismiss={() => setError(null)}>{error}</Alert>
        <Alert onDismiss={job.clearError}>{job.error}</Alert>

        {doc ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule pb-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-ink-900">{doc.name}</p>
                <p className="mt-0.5 font-mono text-[11px] tnum text-ink-400">
                  {doc.pageCount} pages · {doc.dims.width}×{doc.dims.height} pt
                </p>
              </div>
              <button type="button" onClick={clear} className="label transition hover:!text-vermillion-600">
                Choose another
              </button>
            </div>
            <PageGrid doc={doc} selected={selected} onToggle={toggle} />
          </>
        ) : (
          <Dropzone
            onFiles={addFiles}
            accept="application/pdf,.pdf"
            multiple={false}
            title="Drop a PDF to render"
            hint="Click pages to include or exclude them"
          />
        )}
      </div>
    </div>
  )
}
