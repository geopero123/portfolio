import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Dropzone from '../components/Dropzone.jsx'
import { Alert, Label, Progress, Result, RunButton, Segmented, Sidenote, Slider } from '../components/ui.jsx'
import { useImageFiles, useJob } from '../hooks.js'
import { imagesToPdf } from '../lib/ops.js'
import { formatBytes, saveBlob } from '../lib/download.js'

const SIZES = [
  { value: 'fit', label: 'Match' },
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
]

export default function ImagesToPdfTab() {
  const { items, addFiles, remove, move, clear, error, setError } = useImageFiles()
  const job = useJob()
  const [pageSize, setPageSize] = useState('a4')
  const [margin, setMargin] = useState(36)
  const [result, setResult] = useState(null)

  const before = items.reduce((n, i) => n + i.file.size, 0)

  const run = async () => {
    setResult(null)
    const out = await job.run((onProgress) => imagesToPdf(items, { pageSize, margin, onProgress }))
    if (out) setResult(out)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-12">
      <Sidenote
        index="04"
        title="Images to PDF"
        blurb="One image per page, in the order you arrange them. Useful for turning a folder of scans or screenshots into a single document."
      >
        <div>
          <Label>Page size</Label>
          <Segmented name="Page size" value={pageSize} onChange={setPageSize} options={SIZES} />
          <p className="mt-2 text-[12px] leading-snug text-ink-600">
            {pageSize === 'fit'
              ? 'Each page is exactly the size of its image.'
              : 'Images are centred and scaled to fit, portrait or landscape to match.'}
          </p>
        </div>

        {pageSize !== 'fit' && (
          <div>
            <Label hint={`${(margin / 72).toFixed(2)} in`}>Margin</Label>
            <Slider name="Page margin" value={margin} onChange={setMargin} min={0} max={108} step={4} />
          </div>
        )}

        <RunButton onClick={run} busy={job.busy} disabled={!items.length}>
          {items.length ? `Build ${items.length}-page PDF` : 'Add images'}
        </RunButton>

        <Progress value={job.progress} note={job.note} />
        <Result result={result} before={before} onSave={() => saveBlob(result.blob, result.name)} saveLabel="Download images.pdf" />
      </Sidenote>

      <div className="space-y-4">
        <Alert onDismiss={() => setError(null)}>{error}</Alert>
        <Alert onDismiss={job.clearError}>{job.error}</Alert>

        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="label">
                {items.length} {items.length === 1 ? 'page' : 'pages'} · {formatBytes(before)}
              </p>
              <button type="button" onClick={clear} className="label transition hover:!text-vermillion-600">
                Clear all
              </button>
            </div>

            <ol className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
              {items.map((item, i) => (
                <li key={item.id} className="animate-rise group relative">
                  <div className="sheet relative aspect-[1/1.3] overflow-hidden rounded-sm">
                    <img src={item.url} alt={item.file.name} className="size-full object-contain" />
                    <span className="absolute left-1.5 top-1.5 rounded bg-ink-900/85 px-1.5 py-0.5 font-mono text-[10px] tnum text-paper-50">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded bg-paper-50/90 text-ink-600 opacity-0 transition hover:bg-vermillion-600 hover:text-paper-50 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3.5" strokeWidth={2.4} />
                    </button>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Move ${item.file.name} earlier`}
                      className="grid size-6 place-items-center rounded text-ink-300 transition hover:bg-paper-200 hover:text-ink-900 disabled:opacity-25 disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="size-3.5" strokeWidth={2.4} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-center font-mono text-[10.5px] text-ink-400">
                      {item.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      disabled={i === items.length - 1}
                      aria-label={`Move ${item.file.name} later`}
                      className="grid size-6 place-items-center rounded text-ink-300 transition hover:bg-paper-200 hover:text-ink-900 disabled:opacity-25 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="size-3.5" strokeWidth={2.4} />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}

        <Dropzone
          onFiles={addFiles}
          accept="image/*"
          compact={items.length > 0}
          title={items.length ? 'Add more images' : 'Drop images'}
          hint={items.length ? undefined : 'PNG, JPG, WEBP, GIF, BMP or AVIF'}
        />
      </div>
    </div>
  )
}
