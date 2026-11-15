import { useMemo, useState } from 'react'
import Dropzone from '../components/Dropzone.jsx'
import DocList from '../components/DocList.jsx'
import { Alert, Label, Progress, Result, RunButton, Segmented, Sidenote, Slider } from '../components/ui.jsx'
import { usePdfDocs, useJob } from '../hooks.js'
import { compressPdf } from '../lib/ops.js'
import { saveAsZip, saveBlob } from '../lib/download.js'

const MODES = [
  { value: 'restructure', label: 'Keep text' },
  { value: 'rasterise', label: 'Rasterise' },
]

export default function CompressTab() {
  const { docs, addFiles, remove, clear, error, setError } = usePdfDocs()
  const job = useJob()
  const [mode, setMode] = useState('restructure')
  const [dpi, setDpi] = useState(120)
  const [quality, setQuality] = useState(0.7)
  const [result, setResult] = useState(null)

  const before = useMemo(() => docs.reduce((n, d) => n + d.size, 0), [docs])

  const run = async () => {
    setResult(null)
    const out = await job.run(async (onProgress) => {
      const outputs = []
      for (const [i, doc] of docs.entries()) {
        const scoped = (p, note) => onProgress((i + p) / docs.length, note ?? doc.name)
        outputs.push(await compressPdf(doc, { mode, dpi, quality, onProgress: scoped }))
      }
      return outputs
    })
    if (out) setResult(out.length === 1 ? out[0] : out)
  }

  const save = () => {
    if (Array.isArray(result)) saveAsZip(result, 'compressed-pdfs.zip')
    else saveBlob(result.blob, result.name)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-12">
      <Sidenote
        index="03"
        title="Compress"
        blurb="Two ways to make a PDF smaller, with different trade-offs. Neither one silently degrades your file — you pick."
      >
        <div>
          <Label>Method</Label>
          <Segmented name="Compression method" value={mode} onChange={setMode} options={MODES} />
          <p className="mt-2 text-[12px] leading-relaxed text-ink-600">
            {mode === 'restructure' ? (
              <>
                Rewrites the file, dropping orphaned objects and edit history. Text stays selectable and
                image quality is untouched. How much this saves depends entirely on what was in the file —
                sometimes a third, sometimes nothing.
              </>
            ) : (
              <>
                Re-renders each page as a JPEG. This shrinks almost anything dramatically, but text becomes
                pixels: no more selecting, searching, or copying.
              </>
            )}
          </p>
        </div>

        {mode === 'rasterise' && (
          <>
            <div>
              <Label hint={`${dpi} dpi`}>Resolution</Label>
              <Slider name="Resolution in dpi" value={dpi} onChange={setDpi} min={72} max={300} step={6} />
              <div className="mt-1.5 flex justify-between font-mono text-[10.5px] text-ink-300">
                <span>screen</span>
                <span>print</span>
              </div>
            </div>
            <div>
              <Label hint={Math.round(quality * 100)}>JPEG quality</Label>
              <Slider
                name="JPEG quality"
                value={quality}
                onChange={setQuality}
                min={0.3}
                max={0.95}
                step={0.01}
              />
            </div>
          </>
        )}

        <RunButton onClick={run} busy={job.busy} disabled={!docs.length}>
          {docs.length ? `Compress ${docs.length > 1 ? `${docs.length} files` : 'PDF'}` : 'Add a PDF'}
        </RunButton>

        <Progress value={job.progress} note={job.note} />
        <Result
          result={result}
          before={before}
          onSave={save}
          saveLabel={Array.isArray(result) ? 'Download zip' : 'Download PDF'}
          growNote={
            mode === 'rasterise'
              ? 'Rasterising made this bigger. Pages that are mostly text and vector art store far more compactly as instructions than as pixels — "Keep text" is the better choice here, or drop the resolution.'
              : 'This file was already tightly packed, so rewriting it added a few bytes of structure. Rasterising will shrink it, at the cost of selectable text.'
          }
        />
      </Sidenote>

      <div className="space-y-4">
        <Alert onDismiss={() => setError(null)}>{error}</Alert>
        <Alert onDismiss={job.clearError}>{job.error}</Alert>

        {docs.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="label">Queue</p>
              <button type="button" onClick={clear} className="label transition hover:!text-vermillion-600">
                Clear all
              </button>
            </div>
            <DocList docs={docs} onRemove={remove} onMove={() => {}} reorderable={false} />
          </>
        )}

        <Dropzone
          onFiles={addFiles}
          accept="application/pdf,.pdf"
          compact={docs.length > 0}
          title={docs.length ? 'Add more PDFs' : 'Drop PDFs to compress'}
          hint={docs.length ? undefined : 'You will see the real before and after'}
        />
      </div>
    </div>
  )
}
