import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus2, TriangleAlert, X } from 'lucide-react'
import FileRow from './components/FileRow.jsx'
import Inspector from './components/Inspector.jsx'
import Element from './components/Element.jsx'
import { convertFile, ConversionError } from './lib/convert.js'
import { saveBlob, saveAllAsZip } from './lib/download.js'
import { ELEMENTS, FAMILIES, READS } from './lib/elements.js'
import { ACCEPT_ATTR, MAX_BYTES, TARGETS, commonTargets, detectSource, formatBytes } from './lib/formats.js'

const PREVIEWABLE = new Set(['image', 'svg'])
let uid = 0

function Wordmark() {
  return (
    <a href="/" className="flex items-center gap-2.5" aria-label="Transmute home">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="3" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="2" />
        <rect x="1" y="1" width="30" height="5" fill="var(--c-image)" />
        <text x="16" y="24" textAnchor="middle" fontFamily="Bricolage Grotesque Variable, sans-serif" fontWeight="800" fontSize="14" fill="var(--color-ink)">Tm</text>
      </svg>
      <span className="text-[20px] font-extrabold tracking-[-0.045em]">Transmute</span>
    </a>
  )
}

function EmptyState({ onBrowse }) {
  const [hover, setHover] = useState(null)
  const families = Object.keys(FAMILIES)
  return (
    <div className="mx-auto flex max-w-[860px] flex-col px-5 pb-16 pt-10 sm:px-8 sm:pt-14">
      <p className="rise font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-2" style={{ '--i': 0 }}>
        13 formats · 0 uploads
      </p>
      <h1 className="rise mt-3 text-[44px] font-extrabold leading-[.92] tracking-[-0.05em] sm:text-[72px]" style={{ '--i': 1 }}>
        Drop a file.
        <br />
        <span className="text-[var(--c-image)]">Pick what it becomes.</span>
      </h1>
      <p className="rise mt-5 max-w-[46ch] text-[16px] leading-relaxed text-ink-2" style={{ '--i': 2 }}>
        PDF to Word, Word to PDF, images between formats, data between tables. Every conversion runs inside this tab — your files never touch a server.
      </p>
      <div className="rise mt-7 flex flex-wrap items-center gap-3" style={{ '--i': 3 }}>
        <button type="button" onClick={onBrowse} className="go !w-auto gap-6 !text-[16px]" style={{ '--go-fill': 'var(--c-image)' }}>
          <span className="flex items-center gap-2">
            <FilePlus2 className="size-4.5" strokeWidth={2.2} />
            Choose files
          </span>
        </button>
        <span className="font-mono text-[12px] text-ink-3">or drop them anywhere · or paste an image</span>
      </div>

      <div className="mt-14">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3 border-b-[1.5px] border-ink pb-2">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]">The periodic table of formats</h2>
          <ul className="flex gap-4 font-mono text-[11px] text-ink-2">
            {families.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-[1px]" style={{ background: FAMILIES[f].color }} />
                {FAMILIES[f].label}
              </li>
            ))}
          </ul>
        </div>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-[repeat(13,minmax(0,1fr))]">
          {Object.entries(ELEMENTS).map(([key, el], i) => (
            <li key={key}>
              <Element
                el={el}
                as="button"
                type="button"
                className="rise w-full"
                style={{ '--i': i + 4 }}
                data-active={hover === key}
                aria-label={`${el.name}: ${READS[key]}`}
                onMouseEnter={() => setHover(key)}
                onFocus={() => setHover(key)}
                onClick={() => setHover(key)}
              />
            </li>
          ))}
        </ul>
        <p className="mt-4 min-h-[3em] text-[14px] leading-snug text-ink-2" aria-live="polite">
          {hover ? (
            <>
              <strong className="font-bold text-ink">{ELEMENTS[hover].name}</strong>{' '}
              {ELEMENTS[hover].sourceOnly ? READS[hover] : <>is made from {READS[hover]}.</>}
            </>
          ) : (
            'Point at an element to see what it is made from.'
          )}
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [items, setItems] = useState([])
  const [rejects, setRejects] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [options, setOptions] = useState({
    target: 'webp',
    quality: 0.85,
    matte: '#ffffff',
    pageSize: 'fit',
    pdfScale: 2,
  })
  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const targets = useMemo(() => commonTargets(items), [items])
  const sources = useMemo(() => [...new Set(items.map((i) => i.source.id))], [items])

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

  const patch = (id, changes) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...changes } : i)))

  const runConversion = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setProgress(0)
    setRejects([])
    // Snapshot ids up front so files added mid-run aren't half-processed.
    const queue = items.map((i) => i.id)
    setItems((prev) => prev.map((i) => ({ ...i, status: 'working', result: null, error: null })))

    let finished = 0
    for (const id of queue) {
      const item = items.find((i) => i.id === id)
      if (!item) continue
      try {
        // Yield to the browser so each row's progress bar actually paints.
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)))
        const result = await convertFile(item, options.target, options)
        patch(id, { status: 'done', result, error: null })
      } catch (err) {
        const message = err instanceof ConversionError ? err.message : 'Something went wrong converting this file. It may be corrupt.'
        if (!(err instanceof ConversionError)) console.error(err)
        patch(id, { status: 'error', result: null, error: message })
      }
      finished += 1
      setProgress(finished / queue.length)
    }

    setBusy(false)
    setProgress(0)
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
    <div className="paper-grain flex min-h-dvh flex-col bg-paper lg:h-dvh">
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b-[1.5px] border-ink bg-paper px-5 sm:px-8">
        <Wordmark />
        <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-2">
          <span className="relative inline-flex size-2">
            <span className="drop-ring absolute inset-0 rounded-full bg-[var(--c-data)]" />
            <span className="relative size-2 rounded-full bg-[var(--c-data)]" />
          </span>
          <span className="hidden sm:inline">Runs in this tab · nothing uploaded</span>
          <span className="sm:hidden">On-device</span>
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="scrollbar-thin min-h-0 flex-1 lg:overflow-y-auto">
          {rejects.length > 0 && (
            <div className="pop-in mx-5 mt-5 flex items-start gap-3 rounded-[4px] border-[1.5px] border-alert bg-card px-4 py-3 sm:mx-8" role="alert">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-alert" strokeWidth={2.2} />
              <ul className="flex-1 space-y-1 text-[13px] leading-snug text-alert">
                {rejects.map((r, n) => (
                  <li key={n}>{r}</li>
                ))}
              </ul>
              <button type="button" onClick={() => setRejects([])} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded text-alert transition hover:bg-paper-2">
                <X className="size-3.5" strokeWidth={2.4} />
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState onBrowse={() => inputRef.current?.click()} />
          ) : (
            <div className="px-5 py-6 sm:px-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="text-[30px] font-extrabold leading-none tracking-[-0.045em]">
                  Queue <span className="font-mono text-[14px] font-medium tracking-normal text-ink-3 tnum">{String(items.length).padStart(2, '0')}</span>
                </h2>
                <button type="button" onClick={() => inputRef.current?.click()} className="chip flex items-center gap-1.5">
                  <FilePlus2 className="size-3.5" strokeWidth={2} />
                  Add files
                </button>
              </div>
              <ul className="space-y-2.5">
                {items.map((item, i) => (
                  <FileRow key={item.id} index={i} item={item} target={options.target} onRemove={removeItem} onDownload={(it) => saveBlob(it.result.blob, it.result.name)} />
                ))}
              </ul>
              <p className="mt-6 text-center font-mono text-[11.5px] text-ink-3">Drop or paste more files to add them</p>
            </div>
          )}
        </main>

        <aside className="z-10 shrink-0 border-t-[1.5px] border-ink bg-paper lg:w-[380px] lg:border-l-[1.5px] lg:border-t-0">
          <Inspector
            targets={targets}
            sources={sources}
            options={options}
            setOptions={setOptions}
            stats={stats}
            busy={busy}
            progress={progress}
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
        tabIndex={-1}
        aria-label="Choose files to convert"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-paper/85 backdrop-blur-[3px]">
          <div className="absolute inset-4 rounded-[6px] border-[2.5px] border-dashed border-ink" />
          <div className="flex flex-col items-center gap-4">
            <div className="relative grid size-24 place-items-center">
              <span className="drop-ring absolute inset-0 rounded-full border-[2.5px] border-[var(--c-image)]" />
              <span className="text-[44px] font-extrabold tracking-[-0.05em]">↓</span>
            </div>
            <p className="text-[34px] font-extrabold tracking-[-0.045em]">Release to add</p>
          </div>
        </div>
      )}
    </div>
  )
}
