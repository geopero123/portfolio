import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, ImagePlus, Loader2, Maximize2, Package, Trash2, TriangleAlert, X } from 'lucide-react'
import Controls from './components/Controls.jsx'
import ImageGrid from './components/ImageGrid.jsx'
import CompareSlider from './components/CompareSlider.jsx'
import BitmapCache from './lib/bitmapCache.js'
import { ImageError, MAX_BYTES, compress, targetSize } from './lib/encode.js'
import { formatBytes, saveAsZip, saveBlob } from './lib/download.js'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif,.png,.jpg,.jpeg,.webp,.gif,.bmp,.avif'
const IMAGE_RE = /\.(png|jpe?g|webp|gif|bmp|avif)$/i
let uid = 0

const DEFAULTS = {
  format: 'auto',
  quality: 0.75,
  resizeMode: 'none',
  scale: 100,
  maxW: 1920,
  maxH: 1920,
  noUpscale: true,
  keepSmaller: true,
  matte: '#ffffff',
}

export default function App() {
  const [items, setItems] = useState([])
  const [settings, setSettings] = useState(DEFAULTS)
  const [selectedId, setSelectedId] = useState(null)
  const [rejects, setRejects] = useState([])
  const [running, setRunning] = useState(false)
  const [zoom, setZoom] = useState(false)

  const cache = useRef(new BitmapCache())
  const runToken = useRef(0)
  const itemsRef = useRef(items)
  itemsRef.current = items
  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const bitmaps = cache.current
    return () => {
      bitmaps.clear()
      itemsRef.current.forEach((i) => {
        URL.revokeObjectURL(i.url)
        if (i.resultUrl) URL.revokeObjectURL(i.resultUrl)
      })
    }
  }, [])

  /* ------------------------------------------------------------- intake -- */

  const addFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList ?? [])
    if (!incoming.length) return
    const problems = []
    const staged = []
    const seen = new Set(itemsRef.current.map((i) => `${i.file.name}:${i.file.size}`))

    for (const file of incoming) {
      const key = `${file.name}:${file.size}`
      if (seen.has(key)) continue
      if (!(file.type.startsWith('image/') || IMAGE_RE.test(file.name))) {
        problems.push(`${file.name} is not an image.`)
        continue
      }
      if (file.size === 0) {
        problems.push(`${file.name} is empty.`)
        continue
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_BYTES)}.`)
        continue
      }
      seen.add(key)
      staged.push({
        id: ++uid,
        file,
        url: URL.createObjectURL(file),
        width: null,
        height: null,
        status: 'idle',
        result: null,
        resultUrl: null,
        error: null,
      })
    }

    if (staged.length) {
      setItems((prev) => [...prev, ...staged])
      setSelectedId((cur) => cur ?? staged[0].id)

      // Source dimensions are needed before anything is compressed so the
      // resize panel can show real numbers straight away.
      for (const item of staged) {
        try {
          const bitmap = await cache.current.get(item.id, item.file)
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, width: bitmap.width, height: bitmap.height } : i)),
          )
        } catch (err) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? { ...i, status: 'error', error: err instanceof ImageError ? err.message : 'Could not read this image.' }
                : i,
            ),
          )
        }
      }
    }
    setRejects(problems)
  }, [])

  const removeItem = useCallback((id) => {
    cache.current.drop(id)
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id)
      if (gone) {
        URL.revokeObjectURL(gone.url)
        if (gone.resultUrl) URL.revokeObjectURL(gone.resultUrl)
      }
      const next = prev.filter((i) => i.id !== id)
      setSelectedId((cur) => (cur === id ? (next[0]?.id ?? null) : cur))
      return next
    })
  }, [])

  const clearAll = useCallback(() => {
    cache.current.clear()
    setItems((prev) => {
      prev.forEach((i) => {
        URL.revokeObjectURL(i.url)
        if (i.resultUrl) URL.revokeObjectURL(i.resultUrl)
      })
      return []
    })
    setSelectedId(null)
    setRejects([])
  }, [])

  /* ---------------------------------------------------- drag and paste -- */

  useEffect(() => {
    const enter = (e) => {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    }
    const over = (e) => e.dataTransfer?.types?.includes('Files') && e.preventDefault()
    const leave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (!dragDepth.current) setDragging(false)
    }
    const drop = (e) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      addFiles(e.dataTransfer.files)
    }
    const paste = (e) => e.clipboardData?.files?.length && addFiles(e.clipboardData.files)

    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
      window.removeEventListener('paste', paste)
    }
  }, [addFiles])

  /* ------------------------------------------------------- compression -- */

  const ids = useMemo(() => items.map((i) => i.id).join(','), [items])

  useEffect(() => {
    if (!items.length) return
    const token = ++runToken.current
    const timer = setTimeout(async () => {
      if (runToken.current !== token) return
      setRunning(true)

      // Selected first: whoever is dragging the quality slider is watching that
      // one image, and should not wait on the rest of the batch.
      const queue = itemsRef.current
      const ordered = [
        ...queue.filter((i) => i.id === selectedId),
        ...queue.filter((i) => i.id !== selectedId),
      ]

      setItems((prev) => prev.map((i) => (i.error && !i.result ? i : { ...i, status: 'working' })))

      for (const item of ordered) {
        if (runToken.current !== token) return
        try {
          const bitmap = await cache.current.get(item.id, item.file)
          const result = await compress(item.file, bitmap, settings)
          if (runToken.current !== token) return
          setItems((prev) =>
            prev.map((i) => {
              if (i.id !== item.id) return i
              if (i.resultUrl) URL.revokeObjectURL(i.resultUrl)
              return {
                ...i,
                status: 'done',
                result,
                resultUrl: URL.createObjectURL(result.blob),
                error: null,
                width: bitmap.width,
                height: bitmap.height,
              }
            }),
          )
        } catch (err) {
          if (runToken.current !== token) return
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'error',
                    result: null,
                    error: err instanceof ImageError ? err.message : 'Could not process this image.',
                  }
                : i,
            ),
          )
        }
        await new Promise((r) => setTimeout(r, 0))
      }

      if (runToken.current === token) setRunning(false)
    }, 220)

    return () => clearTimeout(timer)
    // Deliberately keyed on the *set* of files rather than the array identity —
    // otherwise every result written back into state would retrigger the run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, settings, selectedId])

  /* ------------------------------------------------------------ derived -- */

  const selected = items.find((i) => i.id === selectedId) ?? null
  const done = items.filter((i) => i.result)

  const stats = useMemo(() => {
    const before = done.reduce((n, i) => n + i.file.size, 0)
    const after = done.reduce((n, i) => n + i.result.size, 0)
    return {
      count: items.length,
      before,
      after,
      saved: before ? Math.round((1 - after / before) * 100) : 0,
    }
  }, [items.length, done])

  const outputDims =
    selected?.width != null
      ? targetSize({ width: selected.width, height: selected.height }, settings)
      : null

  const downloadAll = useCallback(async () => {
    const results = done.map((i) => i.result)
    if (!results.length) return
    if (results.length === 1) saveBlob(results[0].blob, results[0].name)
    else await saveAsZip(results)
  }, [done])

  return (
    <div className="min-h-dvh">
      <header className="border-b-2 border-ink bg-ink">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="display bg-acid px-2 py-1 text-[22px] text-ink">KILO</span>
            <span className="stamp hidden text-paper-sunk sm:inline">image compressor &amp; resizer</span>
          </div>
          <span className="stamp text-paper-sunk">Runs on your machine · nothing uploaded</span>
        </div>
      </header>

      {/* The headline number. If it isn't making files smaller, that should be
          the most visible fact on the page. */}
      <section className="border-b-2 border-ink bg-paper-bright">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-end justify-between gap-x-8 gap-y-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <p className="stamp text-mute">Images</p>
              <p className="display mt-1 text-[34px] tnum">{String(stats.count).padStart(2, '0')}</p>
            </div>
            <div>
              <p className="stamp text-mute">Before</p>
              <p className="display mt-1 text-[34px] tnum">{formatBytes(stats.before)}</p>
            </div>
            <div>
              <p className="stamp text-mute">After</p>
              <p className="display mt-1 text-[34px] tnum">{formatBytes(stats.after)}</p>
            </div>
            <div>
              {/* When the output is larger this must read "Added +136%", never
                  "Saved 136%". The headline is the one number people trust. */}
              <p className="stamp text-mute">{stats.saved < 0 ? 'Added' : 'Saved'}</p>
              <p
                className={`display mt-1 inline-block px-2 py-0.5 text-[34px] tnum ${
                  stats.saved > 0
                    ? 'bg-hot text-paper-bright'
                    : stats.saved < 0
                      ? 'bg-ink text-acid'
                      : 'bg-paper-sunk text-ink'
                }`}
              >
                {stats.saved > 0 ? '−' : stats.saved < 0 ? '+' : ''}
                {Math.abs(stats.saved)}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {running && (
              <span className="stamp animate-tick flex items-center gap-1.5 text-ink">
                <Loader2 className="size-3.5 animate-spin" strokeWidth={2.4} />
                Working
              </span>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="block-edge block-shadow-sm flex items-center gap-1.5 bg-paper px-3 py-2 text-[13px] font-bold uppercase tracking-wide transition hover:bg-paper-sunk active:translate-x-px active:translate-y-px active:shadow-none"
            >
              <ImagePlus className="size-4" strokeWidth={2.2} />
              Add
            </button>
            <button
              type="button"
              onClick={downloadAll}
              disabled={!done.length}
              className="block-edge block-shadow flex items-center gap-1.5 bg-acid px-3.5 py-2 text-[13px] font-bold uppercase tracking-wide transition hover:bg-acid-deep active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-paper-sunk disabled:text-mute disabled:shadow-none"
            >
              {done.length > 1 ? <Package className="size-4" strokeWidth={2.4} /> : <Download className="size-4" strokeWidth={2.4} />}
              {done.length > 1 ? `Save ${done.length} as zip` : 'Save'}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                aria-label="Remove all images"
                className="block-edge grid size-9 place-items-center bg-paper transition hover:bg-hot hover:text-paper-bright"
              >
                <Trash2 className="size-4" strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        {rejects.length > 0 && (
          <div className="animate-snap block-edge mb-5 flex items-start gap-2.5 bg-hot px-3.5 py-3 text-paper-bright">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
            <ul className="flex-1 space-y-1 text-[12.5px] leading-snug">
              {rejects.map((r, n) => (
                <li key={n}>{r}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setRejects([])} aria-label="Dismiss" className="shrink-0">
              <X className="size-4" strokeWidth={2.4} />
            </button>
          </div>
        )}

        <Controls
          settings={settings}
          onChange={setSettings}
          sourceDims={selected?.width ? { width: selected.width, height: selected.height } : null}
          outputDims={outputDims}
        />

        {selected?.resultUrl && (
          <section className="mt-6">
            <div className="mx-auto mb-3 flex max-w-[880px] flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="stamp text-mute">Comparing</h2>
                <p className="mt-1 truncate text-[15px] font-semibold">{selected.file.name}</p>
                <p className="mt-1 font-mono text-[11.5px] tnum text-mute">
                  {selected.width}×{selected.height} → {selected.result.width}×{selected.result.height} ·{' '}
                  {formatBytes(selected.file.size)} → {formatBytes(selected.result.size)}
                  {selected.result.keptOriginal && ' · original kept, re-encoding was larger'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoom((z) => !z)}
                aria-pressed={zoom}
                className={`block-edge flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wide transition ${
                  zoom ? 'block-shadow-sm bg-acid' : 'bg-paper hover:bg-paper-sunk'
                }`}
              >
                <Maximize2 className="size-3.5" strokeWidth={2.2} />
                {zoom ? 'Actual pixels' : 'Fit to view'}
              </button>
            </div>

            <CompareSlider
              key={selected.id}
              beforeUrl={selected.url}
              afterUrl={selected.resultUrl}
              width={selected.result.width}
              height={selected.result.height}
              zoom={zoom}
            />
            <p className="mt-2 text-center font-mono text-[11px] text-mute">
              Drag the handle, or focus it and use the arrow keys
            </p>
          </section>
        )}

        <section className="mt-6">
          {items.length > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <h2 className="stamp text-mute">
                Batch — click any image to compare it
              </h2>
            </div>
          )}
          <ImageGrid
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRemove={removeItem}
            onDownload={(i) => saveBlob(i.result.blob, i.result.name)}
          />
        </section>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`block-edge mt-4 flex w-full flex-col items-center gap-2 bg-paper-bright px-6 transition hover:bg-paper-sunk ${
            items.length ? 'py-7' : 'py-20'
          } ${dragging ? '!bg-acid' : ''}`}
        >
          <ImagePlus className="size-6" strokeWidth={1.8} />
          <span className="display text-[18px] sm:text-[22px]">
            {dragging ? 'Drop them' : items.length ? 'Add more images' : 'Drop images here'}
          </span>
          {!items.length && (
            <span className="font-mono text-[11.5px] text-mute">
              PNG · JPG · WEBP · GIF · BMP · AVIF — or paste from the clipboard
            </span>
          )}
        </button>
      </main>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files)
          e.target.value = ''
        }}
      />

      <footer className="mt-10 border-t-2 border-ink bg-paper-bright">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
          <p className="max-w-[70ch] text-[12.5px] leading-relaxed text-mute">
            Resizing steps down by halves rather than jumping straight to the target, which avoids the
            aliasing a single-pass downscale produces. Everything runs on this device — no upload, no
            account, no queue.
          </p>
        </div>
      </footer>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 border-[6px] border-acid" />
      )}
    </div>
  )
}
