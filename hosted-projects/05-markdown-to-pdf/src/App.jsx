import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Check, ChevronDown, Columns2, Eye, Moon, PenLine, Share, Sun,
} from 'lucide-react'
import Toolbar from './components/Toolbar.jsx'
import ExportPanel from './components/ExportPanel.jsx'
import { documentStats, ensureLanguages, guessTitle, renderMarkdown, slugify } from './lib/markdown.js'
import { PdfError, markdownToPdf } from './lib/pdf.js'
import { buildHtmlDocument, saveBlob } from './lib/exportHtml.js'
import { TABLE_SNIPPET, indentSelection, insertAt, togglePrefix, toggleWrap } from './lib/editor.js'
import { SAMPLE } from './lib/sample.js'

const STORAGE_KEY = 'quire:document'
const SETTINGS_KEY = 'quire:settings'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const VIEWS = [
  { id: 'write', label: 'Write', Icon: PenLine },
  { id: 'split', label: 'Split', Icon: Columns2 },
  { id: 'read', label: 'Read', Icon: Eye },
]

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export default function App() {
  const [markdown, setMarkdown] = useState(() => loadStored(STORAGE_KEY, null) ?? SAMPLE)
  const [view, setView] = useState('split')
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')
  const [saved, setSaved] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [highlightTick, setHighlightTick] = useState(0)
  const [settings, setSettings] = useState(() =>
    loadStored(SETTINGS_KEY, { preset: 'report', pageSize: 'a4', margin: 64, pageNumbers: true }),
  )

  const editorRef = useRef(null)
  const previewRef = useRef(null)
  const imageInput = useRef(null)
  const exportRef = useRef(null)
  const syncing = useRef(null)

  /* -------------------------------------------------------------- theme -- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem('quire:theme', theme)
    } catch {
      /* private mode */
    }
  }, [theme])

  /* ------------------------------------------------------------ persist -- */

  useEffect(() => {
    setSaved(false)
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(markdown))
        setSaved(true)
      } catch {
        setNotice({ level: 'warn', text: 'This document is too large to keep in browser storage — export it before closing the tab.' })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [markdown])

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings])

  /* ----------------------------------------------------------- rendering -- */

  // Grammars load on demand; when a new one arrives, re-render so the block
  // that needed it is actually highlighted.
  useEffect(() => {
    let cancelled = false
    ensureLanguages(markdown).then((added) => {
      if (added && !cancelled) setHighlightTick((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [markdown])

  const html = useMemo(() => renderMarkdown(markdown), [markdown, highlightTick])
  const stats = useMemo(() => documentStats(markdown), [markdown])
  const title = useMemo(() => guessTitle(markdown), [markdown])

  /* ------------------------------------------------------------- editing -- */

  const apply = useCallback((fn) => {
    const el = editorRef.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e, value } = el
    const result = fn(value, s, e)
    if (!result) return
    setMarkdown(result.value)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(result.start, result.end)
    })
  }, [])

  const insertImage = useCallback(
    async (file) => {
      if (!file?.type.startsWith('image/')) {
        setNotice({ level: 'warn', text: `${file?.name ?? 'That file'} is not an image.` })
        return
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setNotice({
          level: 'warn',
          text: `${file.name} is over 5 MB. Images are embedded in the document, so large ones make it unwieldy.`,
        })
        return
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      }).catch(() => null)
      if (!dataUrl) {
        setNotice({ level: 'warn', text: 'Could not read that image.' })
        return
      }
      const alt = file.name.replace(/\.[^.]+$/, '')
      apply((v, s, e) => insertAt(v, s, e, `\n![${alt}](${dataUrl})\n`))
    },
    [apply],
  )

  const action = useCallback(
    (id) => {
      switch (id) {
        case 'bold':
          return apply((v, s, e) => toggleWrap(v, s, e, '**'))
        case 'italic':
          return apply((v, s, e) => toggleWrap(v, s, e, '*'))
        case 'code':
          return apply((v, s, e) => toggleWrap(v, s, e, '`'))
        case 'link':
          return apply((v, s, e) => {
            const selected = v.slice(s, e)
            return selected
              ? insertAt(v, s, e, `[${selected}](url)`, { selectOffset: selected.length + 3, selectLength: 3 })
              : insertAt(v, s, e, '[text](url)', { selectOffset: 1, selectLength: 4 })
          })
        case 'heading':
          return apply((v, s, e) => togglePrefix(v, s, e, '## '))
        case 'quote':
          return apply((v, s, e) => togglePrefix(v, s, e, '> '))
        case 'ul':
          return apply((v, s, e) => togglePrefix(v, s, e, '- '))
        case 'ol':
          return apply((v, s, e) => togglePrefix(v, s, e, '1. ', { numbered: true }))
        case 'table':
          return apply((v, s, e) => insertAt(v, s, e, TABLE_SNIPPET))
        case 'rule':
          return apply((v, s, e) => insertAt(v, s, e, '\n---\n'))
        case 'image':
          return imageInput.current?.click()
        default:
      }
    },
    [apply],
  )

  const onKeyDown = (e) => {
    const mod = e.metaKey || e.ctrlKey
    if (mod && !e.altKey) {
      const key = e.key.toLowerCase()
      if (key === 'b') {
        e.preventDefault()
        return action('bold')
      }
      if (key === 'i') {
        e.preventDefault()
        return action('italic')
      }
      if (key === 'k') {
        e.preventDefault()
        return action('link')
      }
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      apply((v, s, en) => indentSelection(v, s, en, e.shiftKey))
    }
  }

  /* -------------------------------------------------------- scroll sync -- */

  const linkScroll = (from, to, which) => () => {
    if (view !== 'split') return
    if (syncing.current && syncing.current !== which) return
    const a = from.current
    const b = to.current
    if (!a || !b) return
    syncing.current = which
    const ratio = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight)
    b.scrollTop = ratio * Math.max(0, b.scrollHeight - b.clientHeight)
    // Release after the scroll event the assignment above will provoke.
    requestAnimationFrame(() => {
      syncing.current = null
    })
  }

  /* ------------------------------------------------------------ exports -- */

  const filename = slugify(title, 'document')

  const exportPdf = useCallback(async () => {
    setBusy(true)
    setNotice(null)
    try {
      const result = await markdownToPdf(markdown, { ...settings, title })
      saveBlob(result.blob, `${filename}.pdf`)
      const bits = [`${result.pages} page${result.pages === 1 ? '' : 's'} exported.`]
      if (result.dropped.length) {
        bits.push(
          `${result.dropped.length} character${result.dropped.length === 1 ? '' : 's'} (${result.dropped
            .slice(0, 8)
            .join(' ')}) have no glyph in the built-in PDF fonts and were replaced. Use Print → Save as PDF for those.`,
        )
      }
      bits.push(...result.warnings)
      setNotice({ level: result.dropped.length || result.warnings.length ? 'warn' : 'ok', text: bits.join(' ') })
    } catch (err) {
      setNotice({
        level: 'error',
        text: err instanceof PdfError ? err.message : `The export failed: ${err?.message ?? 'unknown error'}`,
      })
      if (!(err instanceof PdfError)) console.error(err)
    } finally {
      setBusy(false)
      setExportOpen(false)
    }
  }, [markdown, settings, title, filename])

  const exportHtml = useCallback(() => {
    saveBlob(new Blob([buildHtmlDocument(html, title)], { type: 'text/html' }), `${filename}.html`)
    setExportOpen(false)
  }, [html, title, filename])

  const exportMarkdown = useCallback(() => {
    saveBlob(new Blob([markdown], { type: 'text/markdown' }), `${filename}.md`)
    setExportOpen(false)
  }, [markdown, title, filename])

  const print = useCallback(() => {
    setExportOpen(false)
    // The print stylesheet hides everything but the preview, so the browser's
    // own engine lays out the document with the real web fonts.
    requestAnimationFrame(() => window.print())
  }, [])

  /* ----------------------------------------------------------- dismissal -- */

  useEffect(() => {
    if (!exportOpen) return
    const onDown = (e) => {
      if (!exportRef.current?.contains(e.target)) setExportOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setExportOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [exportOpen])

  const showEditor = view !== 'read'
  const showPreview = view !== 'write'

  return (
    <div className="flex h-dvh flex-col">
      <header className="no-print z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-rule bg-sheet px-3 py-2 sm:px-4">
        <div className="flex items-center gap-3">
          <span className="text-[16px] font-semibold tracking-[-0.02em]">QUIRE</span>
          <span className="hidden h-4 w-px bg-rule sm:block" />
          <span className="chrome hidden sm:block">markdown to PDF</span>
        </div>

        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="View" className="flex overflow-hidden rounded-lg border border-rule">
            {VIEWS.map(({ id, label, Icon }, i) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={view === id}
                onClick={() => setView(id)}
                title={label}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12.5px] transition ${
                  i > 0 ? 'border-l border-rule' : ''
                } ${view === id ? 'bg-ink text-ground' : 'text-ink-2 hover:bg-sunk'}`}
              >
                <Icon className="size-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="grid size-8 place-items-center rounded-lg border border-rule text-ink-2 transition hover:bg-sunk hover:text-ink"
          >
            {theme === 'dark' ? <Sun className="size-4" strokeWidth={2} /> : <Moon className="size-4" strokeWidth={2} />}
          </button>

          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              aria-expanded={exportOpen}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-semibold text-sheet transition hover:bg-accent-2"
            >
              <Share className="size-3.5" strokeWidth={2.2} />
              Export
              <ChevronDown className={`size-3.5 transition ${exportOpen ? 'rotate-180' : ''}`} strokeWidth={2.2} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full z-30 mt-2">
                <ExportPanel
                  settings={settings}
                  onChange={setSettings}
                  onPdf={exportPdf}
                  onHtml={exportHtml}
                  onMarkdown={exportMarkdown}
                  onPrint={print}
                  busy={busy}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {notice && (
        <div
          className={`no-print flex shrink-0 items-start gap-2 border-b px-4 py-2.5 text-[12.5px] leading-snug ${
            notice.level === 'error'
              ? 'border-rule bg-danger-soft text-danger'
              : notice.level === 'warn'
                ? 'border-rule bg-sunk text-ink-2'
                : 'border-rule bg-accent-soft text-ink-2'
          }`}
        >
          {notice.level === 'ok' ? (
            <Check className="mt-px size-3.5 shrink-0 text-accent" strokeWidth={2.4} />
          ) : (
            <AlertTriangle className="mt-px size-3.5 shrink-0" strokeWidth={2.2} />
          )}
          <p className="flex-1">{notice.text}</p>
          <button type="button" onClick={() => setNotice(null)} className="chrome shrink-0 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        {showEditor && (
          <section
            className={`no-print flex min-h-0 flex-col border-rule ${
              showPreview ? 'md:w-1/2 md:border-r' : 'flex-1'
            } ${showPreview ? 'h-1/2 border-b md:h-auto md:border-b-0' : 'flex-1'}`}
          >
            <Toolbar onAction={action} />
            <textarea
              ref={editorRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={linkScroll(editorRef, previewRef, 'editor')}
              onPaste={(e) => {
                const file = [...(e.clipboardData?.files ?? [])][0]
                if (file?.type.startsWith('image/')) {
                  e.preventDefault()
                  insertImage(file)
                }
              }}
              onDrop={(e) => {
                const file = e.dataTransfer?.files?.[0]
                if (file) {
                  e.preventDefault()
                  insertImage(file)
                }
              }}
              spellCheck
              aria-label="Markdown source"
              className="scroll-quiet min-h-0 flex-1 resize-none bg-ground px-4 py-5 font-mono text-[13.5px] leading-[1.75] text-ink outline-none sm:px-6"
            />
          </section>
        )}

        {showPreview && (
          <section
            ref={previewRef}
            onScroll={linkScroll(previewRef, editorRef, 'preview')}
            className={`scroll-quiet min-h-0 flex-1 overflow-y-auto bg-ground ${showEditor ? 'md:w-1/2' : ''}`}
          >
            <article
              id="preview"
              className="doc mx-auto max-w-[38rem] px-5 py-8 sm:px-8 sm:py-12"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </section>
        )}
      </main>

      <footer className="no-print flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-rule bg-sheet px-4 py-1.5">
        <p className="chrome tnum">
          {stats.words.toLocaleString()} words · {stats.characters.toLocaleString()} characters · {stats.minutes} min read
        </p>
        <p className="chrome flex items-center gap-1.5">
          {saved ? (
            <>
              <Check className="size-3 text-accent" strokeWidth={3} />
              Saved locally
            </>
          ) : (
            'Saving…'
          )}
        </p>
      </footer>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) insertImage(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
