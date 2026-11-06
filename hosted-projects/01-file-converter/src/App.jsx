import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus2, Shield, Sparkles, TriangleAlert, X, Upload } from 'lucide-react'
import FileRow from './components/FileRow.jsx'
import Inspector from './components/Inspector.jsx'
import { convertFile, ConversionError } from './lib/convert.js'
import { saveBlob, saveAllAsZip } from './lib/download.js'
import { ACCEPT_ATTR, MAX_BYTES, TARGETS, commonTargets, detectSource, formatBytes } from './lib/formats.js'

const PREVIEWABLE = new Set(['image', 'svg'])
let uid = 0

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-shell-800" />
        <path
          d="M9 12h9M9 12l3-3M9 12l3 3M23 20h-9m9 0l-3-3m3 3l-3 3"
          className="stroke-signal-500"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <div className="flex items-baseline gap-2.5">
        <span className="text-[15px] font-bold tracking-[-0.02em] text-shell-100">Transmute</span>
        <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.16em] text-shell-400 sm:inline">
          file converter
        </span>
      </div>
    </div>
  )
}

const SUPPORTED = [
  ['Images', 'PNG · JPG · WEBP · GIF · BMP · AVIF · SVG'],
  ['Word', 'DOCX → HTML · Markdown · Text'],
  ['Data', 'CSV · TSV · JSON, any direction'],
]

function EmptyState({ onBrowse }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="grid size-14 place-items-center rounded-xl border border-signal-500/25 bg-signal-500/10">
        <Upload className="size-6 text-signal-500" strokeWidth={1.8} />
      </div>
      <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-shell-100 sm:text-[26px]">
        Drop files anywhere
      </h2>
      <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-shell-400">
        Or paste an image from the clipboard. Files never leave the tab — the conversion happens on your own machine.
      </p>
      <button
        type="button"
        onClick={onBrowse}
        className="mt-6 flex items-center gap-2 rounded-lg border border-shell-700 bg-shell-850 px-4 py-2.5 text-[13px] font-medium text-shell-100 transition hover:border-shell-600 hover:bg-shell-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500"
      >
        <FilePlus2 className="size-4" strokeWidth={2} />
        Browse files
      </button>

      <dl className="mt-12 grid w-full max-w-lg gap-px overflow-hidden rounded-lg border border-shell-800 bg-shell-800 text-left sm:grid-cols-3">
        {SUPPORTED.map(([term, desc]) => (
          <div key={term} className="bg-shell-900 p-3.5">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal-600">{term}</dt>
            <dd className="mt-1.5 font-mono text-[11px] leading-relaxed text-shell-400">{desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default function App() {
  const [items, setItems] = useState([])
  const [rejects, setRejects] = useState([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [options, setOptions] = useState({
    target: 'webp',
    quality: 0.85,
    matte: '#ffffff',
    pageSize: 'fit',
  })
  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const targets = useMemo(() => commonTargets(items), [items])

  // Keep the chosen target reachable: swapping a PNG for a CSV shouldn't leave
  // "WEBP" selected and the convert button silently broken.
  useEffect(() => {
    if (!targets.length || targets.includes(options.target)) return
    const sourceExts = new Set(items.map((i) => TARGETS[i.source.id]?.ext).filter(Boolean))
    const preferred = targets.find((t) => !sourceExts.has(TARGETS[t].ext)) ?? targets[0]
    setOptions((o) => ({ ...o, target: preferred }))
  }, [targets, items, options.target])

  // Validation runs outside the state updater: it allocates object URLs and
  // collects messages, and React may invoke an updater more than once.
  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList ?? [])
    if (!incoming.length) return

    const problems = []
    const accepted = []
    const seen = new Set(itemsRef.current.map((i) => `${i.file.name}:${i.file.size}`))

    for (const file of incoming) {
      const key = `${file.name}:${file.size}`
      if (seen.has(key)) continue
      if (file.size === 0) {
        problems.push(`${file.name} is empty.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_BYTES)}.`)
        continue
      }
      const source = detectSource(file)
      if (!source) {
        problems.push(`${file.name} is not a format this tool can read.`)
        continue
      }
      seen.add(key)
      accepted.push({
        id: ++uid,
        file,
        source,
        status: 'idle',
        result: null,
        error: null,
        url: PREVIEWABLE.has(source.id) ? URL.createObjectURL(file) : null,
      })
    }

    if (accepted.length) setItems((prev) => [...prev, ...accepted])
    setRejects(problems)
  }, [])

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target?.url) URL.revokeObjectURL(target.url)
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const clearAll = useCallback(() => {
    setItems((prev) => {
      prev.forEach((i) => i.url && URL.revokeObjectURL(i.url))
      return []
    })
    setRejects([])
  }, [])

  // Unmount only — revoking on every `items` change would kill the previews of
  // files that are still in the queue.
  useEffect(() => () => itemsRef.current.forEach((i) => i.url && URL.revokeObjectURL(i.url)), [])

  /* ---- drag & paste ------------------------------------------------ */

  useEffect(() => {
    const onDragEnter = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    }
    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
    }
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }
    const onDrop = (e) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      addFiles(e.dataTransfer.files)
    }
    const onPaste = (e) => {
      if (e.clipboardData?.files?.length) addFiles(e.clipboardData.files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [addFiles])

  /* ---- conversion --------------------------------------------------- */

  const patch = (id, changes) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))

  const runConversion = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setRejects([])
    // Snapshot ids up front so files added mid-run aren't half-processed.
    const queue = items.map((i) => i.id)
    setItems((prev) => prev.map((i) => ({ ...i, status: 'working', result: null, error: null })))

    for (const id of queue) {
      const item = items.find((i) => i.id === id)
      if (!item) continue
      try {
        // Yield to the browser so each row's progress bar actually paints.
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
        const result = await convertFile(item, options.target, options)
        patch(id, { status: 'done', result, error: null })
      } catch (err) {
        const message =
          err instanceof ConversionError
            ? err.message
            : 'Something went wrong converting this file. It may be corrupt.'
        if (!(err instanceof ConversionError)) console.error(err)
        patch(id, { status: 'error', result: null, error: message })
      }
    }

    setBusy(false)
  }, [busy, items, options])

  const done = useMemo(() => items.filter((i) => i.status === 'done'), [items])

  const stats = useMemo(
    () => ({
      total: items.length,
      done: done.length,
      bytesIn: done.reduce((n, i) => n + i.file.size, 0),
      bytesOut: done.reduce((n, i) => n + i.result.size, 0),
    }),
    [items, done],
  )

  const downloadAll = useCallback(async () => {
    const results = done.map((i) => i.result)
    if (!results.length) return
    if (results.length === 1) saveBlob(results[0].blob, results[0].name)
    else await saveAllAsZip(results, `transmute-${TARGETS[options.target].ext}.zip`)
  }, [done, options.target])

  return (
    <div className="flex h-dvh flex-col bg-shell-950">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-shell-800 bg-shell-900 px-4 sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-2 rounded-full border border-shell-700 py-1 pl-2.5 pr-3">
          <Shield className="size-3.5 text-signal-500" strokeWidth={2.2} />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-shell-300">
            <span className="hidden sm:inline">100% </span>on-device
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="bg-grid scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {rejects.length > 0 && (
            <div className="animate-pop-in flex items-start gap-3 border-b border-alert-500/25 bg-alert-900/40 px-4 py-3 sm:px-6">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alert-400" strokeWidth={2} />
              <ul className="flex-1 space-y-1 text-[12.5px] leading-snug text-alert-400">
                {rejects.map((r, n) => (
                  <li key={n}>{r}</li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setRejects([])}
                aria-label="Dismiss"
                className="grid size-6 shrink-0 place-items-center rounded text-alert-400 transition hover:bg-alert-500/15"
              >
                <X className="size-3.5" strokeWidth={2.4} />
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState onBrowse={() => inputRef.current?.click()} />
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-shell-800 bg-shell-950/85 px-4 py-2.5 backdrop-blur-md sm:px-6">
                <h2 className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-shell-400">
                  Queue <span className="tnum text-shell-100">{String(items.length).padStart(2, '0')}</span>
                </h2>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-shell-300 transition hover:bg-shell-800 hover:text-signal-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-500"
                >
                  <FilePlus2 className="size-3.5" strokeWidth={2} />
                  Add
                </button>
              </div>
              <ul>
                {items.map((item) => (
                  <FileRow key={item.id} item={item} onRemove={removeItem} onDownload={(i) => saveBlob(i.result.blob, i.result.name)} />
                ))}
              </ul>
              <p className="flex items-center justify-center gap-2 px-6 py-8 font-mono text-[11px] text-shell-600">
                <Sparkles className="size-3.5" strokeWidth={2} />
                Drop or paste more files to add them
              </p>
            </>
          )}
        </main>

        <aside className="z-10 max-h-[62vh] shrink-0 border-t border-shell-800 bg-shell-900 lg:max-h-none lg:w-[344px] lg:border-l lg:border-t-0">
          <Inspector
            targets={targets}
            options={options}
            setOptions={setOptions}
            stats={stats}
            busy={busy}
            hasFiles={items.length > 0}
            doneCount={done.length}
            onConvert={runConversion}
            onDownloadAll={downloadAll}
            onClear={clearAll}
          />
        </aside>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-shell-950/75 backdrop-blur-[2px]">
          <div className="absolute inset-3 rounded-2xl border-2 border-dashed border-signal-500/70" />
          <div className="flex flex-col items-center gap-3">
            <Upload className="size-8 text-signal-500" strokeWidth={1.8} />
            <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-signal-400">Release to add</p>
          </div>
        </div>
      )}
    </div>
  )
}
