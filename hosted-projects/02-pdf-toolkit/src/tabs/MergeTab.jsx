import { useMemo, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import Dropzone from '../components/Dropzone.jsx'
import DocList from '../components/DocList.jsx'
import { Alert, Progress, Result, RunButton, Sidenote } from '../components/ui.jsx'
import { usePdfDocs, useJob } from '../hooks.js'
import { mergePdfs } from '../lib/ops.js'
import { saveBlob } from '../lib/download.js'

export default function MergeTab() {
  const { docs, addFiles, remove, move, clear, setDocs, error, setError } = usePdfDocs()
  const job = useJob()
  const [result, setResult] = useState(null)

  const totals = useMemo(
    () => ({
      pages: docs.reduce((n, d) => n + d.pageCount, 0),
      bytes: docs.reduce((n, d) => n + d.size, 0),
    }),
    [docs],
  )

  const run = async () => {
    setResult(null)
    const out = await job.run((onProgress) => mergePdfs(docs, { onProgress }))
    if (out) setResult(out)
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-12">
      <Sidenote
        index="01"
        title="Merge"
        blurb="Stack several PDFs into one file. Pages keep their original size and orientation — nothing is re-rendered."
      >
        {docs.length > 0 && (
          <dl className="space-y-1.5 font-mono text-[12px] tnum">
            <div className="flex justify-between">
              <dt className="text-ink-400">Documents</dt>
              <dd>{docs.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-400">Pages out</dt>
              <dd>{totals.pages}</dd>
            </div>
          </dl>
        )}

        <div className="space-y-2">
          <RunButton onClick={run} busy={job.busy} disabled={docs.length < 2}>
            {docs.length < 2 ? 'Add two or more PDFs' : `Merge ${docs.length} PDFs`}
          </RunButton>
          {docs.length > 1 && (
            <button
              type="button"
              onClick={() => setDocs((prev) => [...prev].reverse())}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-rule px-3 py-2 text-[12.5px] text-ink-600 transition hover:border-ink-400 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-400"
            >
              <ArrowDownUp className="size-3.5" strokeWidth={2} />
              Reverse order
            </button>
          )}
        </div>

        <Progress value={job.progress} note={job.note} />
        {/* Merging is not a size optimisation, so a before/after delta here would
            be noise dressed up as a result. */}
        <Result
          result={result}
          compare={false}
          onSave={() => saveBlob(result.blob, result.name)}
          saveLabel="Download merged.pdf"
        />
      </Sidenote>

      <div className="space-y-4">
        <Alert onDismiss={() => setError(null)}>{error}</Alert>
        <Alert onDismiss={job.clearError}>{job.error}</Alert>

        {docs.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="label">Order of assembly</p>
              <button
                type="button"
                onClick={clear}
                className="label transition hover:!text-vermillion-600"
              >
                Clear all
              </button>
            </div>
            <DocList docs={docs} onRemove={remove} onMove={move} />
          </>
        )}

        <Dropzone
          onFiles={addFiles}
          accept="application/pdf,.pdf"
          compact={docs.length > 0}
          title={docs.length ? 'Add more PDFs' : 'Drop PDFs to merge'}
          hint={docs.length ? undefined : 'Drag to reorder them afterwards'}
        />
      </div>
    </div>
  )
}
