import { useEffect, useMemo, useState } from 'react'
import Dropzone from '../components/Dropzone.jsx'
import PageGrid from '../components/PageGrid.jsx'
import { Alert, Label, Progress, Result, RunButton, Segmented, Sidenote } from '../components/ui.jsx'
import { usePdfDocs, useJob } from '../hooks.js'
import { burstPages, extractPages } from '../lib/ops.js'
import { formatRanges, parsePageRanges } from '../lib/pdf.js'
import { saveAsZip, saveBlob } from '../lib/download.js'

const MODES = [
  { value: 'extract', label: 'One PDF' },
  { value: 'burst', label: 'One per page' },
]

export default function SplitTab() {
  const { docs, addFiles, clear, error, setError } = usePdfDocs({ multiple: false })
  const job = useJob()
  const doc = docs[0]

  const [selected, setSelected] = useState(() => new Set())
  const [mode, setMode] = useState('extract')
  const [rangeText, setRangeText] = useState('')
  const [rangeValid, setRangeValid] = useState(true)
  const [result, setResult] = useState(null)

  // A new document invalidates every page number that came before it.
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

  const toggle = (n) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      setRangeText(formatRanges([...next]))
      return next
    })
  }

  const applyRange = (text) => {
    setRangeText(text)
    if (!doc) return
    const parsed = parsePageRanges(text, doc.pageCount)
    setRangeValid(parsed !== null)
    if (parsed) setSelected(new Set(parsed))
  }

  const bulk = (kind) => {
    if (!doc) return
    const all = Array.from({ length: doc.pageCount }, (_, i) => i + 1)
    const next =
      kind === 'all' ? all
      : kind === 'none' ? []
      : kind === 'odd' ? all.filter((n) => n % 2 === 1)
      : all.filter((n) => n % 2 === 0)
    setSelected(new Set(next))
    setRangeText(formatRanges(next))
  }

  const run = async () => {
    setResult(null)
    const out = await job.run((onProgress) =>
      mode === 'extract' ? extractPages(doc, pages) : burstPages(doc, pages, { onProgress }),
    )
    if (out) setResult(out)
  }

  const save = () => {
    if (Array.isArray(result)) saveAsZip(result, `${doc.name.replace(/\.pdf$/i, '')}-pages.zip`)
    else saveBlob(result.blob, result.name)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-12">
      <Sidenote
        index="02"
        title="Split"
        blurb="Pick pages by clicking them or by typing ranges. Take them out as one document, or as a separate file per page."
      >
        {doc && (
          <>
            <div>
              <Label>Output</Label>
              <Segmented name="Output shape" value={mode} onChange={setMode} options={MODES} />
              <p className="mt-2 text-[12px] leading-snug text-ink-600">
                {mode === 'extract'
                  ? 'Selected pages become a single new PDF, in page order.'
                  : `Each selected page becomes its own PDF, delivered as a zip.`}
              </p>
            </div>

            <div>
              <Label hint={`${pages.length}/${doc.pageCount}`}>Pages</Label>
              <input
                value={rangeText}
                onChange={(e) => applyRange(e.target.value)}
                placeholder="1-3, 5, 8-10"
                aria-label="Page ranges"
                className={`w-full rounded-md border bg-paper-50 px-2.5 py-2 font-mono text-[12.5px] tnum text-ink-900 placeholder:text-ink-300 focus:outline-2 focus:outline-offset-[-1px] ${
                  rangeValid
                    ? 'border-rule focus:outline-vermillion-600'
                    : 'border-vermillion-600 focus:outline-vermillion-600'
                }`}
              />
              {!rangeValid && (
                <p className="mt-1.5 text-[12px] text-vermillion-700">
                  Use numbers and ranges, e.g. <span className="font-mono">1-3, 5, 8-10</span>.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  ['all', 'All'],
                  ['none', 'None'],
                  ['odd', 'Odd'],
                  ['even', 'Even'],
                ].map(([kind, label]) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => bulk(kind)}
                    className="rounded border border-rule px-2 py-1 font-mono text-[11px] text-ink-600 transition hover:border-ink-400 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <RunButton onClick={run} busy={job.busy} disabled={!pages.length}>
              {!pages.length
                ? 'Select pages first'
                : mode === 'extract'
                  ? `Extract ${pages.length} ${pages.length === 1 ? 'page' : 'pages'}`
                  : `Split into ${pages.length} files`}
            </RunButton>

            <Progress value={job.progress} note={job.note} />
            {/* Pulling pages out is not a size optimisation — comparing the
                extract against the whole original would only ever mislead. */}
            <Result
              result={result}
              compare={false}
              onSave={save}
              saveLabel={Array.isArray(result) ? 'Download zip' : 'Download PDF'}
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
            title="Drop a PDF to split"
            hint="Every page gets a preview you can click"
          />
        )}
      </div>
    </div>
  )
}
