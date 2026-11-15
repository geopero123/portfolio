import { Marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'

// A deliberate subset. The full highlight.js bundle is ~900 kB and this covers
// what people actually paste into a document.
const LANGUAGES = {
  bash: () => import('highlight.js/lib/languages/bash'),
  c: () => import('highlight.js/lib/languages/c'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  go: () => import('highlight.js/lib/languages/go'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  php: () => import('highlight.js/lib/languages/php'),
  python: () => import('highlight.js/lib/languages/python'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  sql: () => import('highlight.js/lib/languages/sql'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
}

const ALIASES = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', node: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
  py: 'python', rb: 'ruby', rs: 'rust', golang: 'go',
  html: 'xml', svg: 'xml', vue: 'xml',
  yml: 'yaml', 'c++': 'cpp', cs: 'csharp', patch: 'diff',
}

const loaded = new Set()

/**
 * Loads the grammars a document actually uses. Returns true when something new
 * arrived, so the caller knows to re-render.
 */
export async function ensureLanguages(markdown) {
  const found = new Set()
  for (const m of markdown.matchAll(/^[ \t]*```+[ \t]*([\w+#-]+)/gm)) {
    const name = ALIASES[m[1].toLowerCase()] ?? m[1].toLowerCase()
    if (LANGUAGES[name] && !loaded.has(name)) found.add(name)
  }
  if (!found.size) return false
  await Promise.all(
    [...found].map(async (name) => {
      try {
        const mod = await LANGUAGES[name]()
        hljs.registerLanguage(name, mod.default)
        loaded.add(name)
      } catch {
        loaded.add(name) // don't retry a grammar that failed to load
      }
    }),
  )
  return true
}

const marked = new Marked({ gfm: true, breaks: false })

marked.use({
  renderer: {
    code({ text, lang }) {
      const name = ALIASES[(lang ?? '').toLowerCase()] ?? (lang ?? '').toLowerCase()
      let body
      if (name && loaded.has(name) && hljs.getLanguage(name)) {
        try {
          body = hljs.highlight(text, { language: name, ignoreIllegals: true }).value
        } catch {
          body = escapeHtml(text)
        }
      } else {
        body = escapeHtml(text)
      }
      const label = lang ? ` data-lang="${escapeHtml(lang)}"` : ''
      return `<pre${label}><code class="hljs">${body}</code></pre>\n`
    },
  },
})

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Markdown in, safe HTML out.
 *
 * The input is the user's own text, but it may well have been pasted from
 * somewhere else, and the preview renders raw HTML blocks — so it goes through
 * DOMPurify rather than trusting it.
 */
let hooked = false
function installHook() {
  if (hooked) return
  hooked = true
  // Task lists need <input> to survive sanitising, but nothing else about an
  // input should. Every one that gets through is forced to a disabled
  // checkbox, so there is no route to a text field or a submit button.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'INPUT') {
      const checked = node.hasAttribute('checked')
      for (const attr of [...node.attributes]) node.removeAttribute(attr.name)
      node.setAttribute('type', 'checkbox')
      node.setAttribute('disabled', '')
      if (checked) node.setAttribute('checked', '')
    }
    if (node.tagName === 'A' && node.getAttribute('href')?.startsWith('http')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

export function renderMarkdown(markdown) {
  installHook()
  const html = marked.parse(markdown ?? '')
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['target', 'rel', 'data-lang', 'checked', 'disabled', 'type'],
    FORBID_TAGS: ['style', 'form', 'button', 'select', 'textarea'],
  })
}

export function documentStats(markdown) {
  const text = (markdown ?? '').trim()
  const words = text ? text.split(/\s+/).length : 0
  return {
    words,
    characters: text.length,
    lines: markdown ? markdown.split('\n').length : 0,
    // 238 wpm is the usual silent-reading figure for adults.
    minutes: Math.max(1, Math.round(words / 238)),
  }
}

/** Pulls a title out of the first H1, for the filename and PDF metadata. */
export function guessTitle(markdown) {
  const m = /^#\s+(.+)$/m.exec(markdown ?? '')
  return m ? m[1].replace(/[*_`]/g, '').trim() : ''
}

export function slugify(name, fallback = 'document') {
  const s = (name || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return s || fallback
}
