import express from 'express'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// --port=<n> (used by the dev script) beats the PORT env var: dev tooling that
// launches the whole workspace often exports PORT for the *client* dev server,
// and inheriting it here would collide with Vite. Production uses PORT as usual.
const portArg = process.argv.find((arg) => arg.startsWith('--port='))
const PORT = Number(portArg ? portArg.split('=')[1] : (process.env.PORT ?? 5174))

const dataDir = path.resolve(__dirname, '..', 'data')
const messagesFile = path.join(dataDir, 'messages.json')
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist')
const manifestFile = path.resolve(
  __dirname,
  '..',
  '..',
  'client',
  'src',
  'data',
  'projects.generated.json',
)

const app = express()
app.disable('x-powered-by')
// Behind a reverse proxy req.ip would otherwise be the proxy's address, so every
// visitor would share one rate-limit bucket. Trust only the first hop.
app.set('trust proxy', 1)
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() })
})

// Mirrors the manifest the client builds with — kept for future consumers
// (an admin page, an RSS feed, another site) without duplicating data.
app.get('/api/projects', async (_req, res) => {
  try {
    const manifest = JSON.parse(await fsp.readFile(manifestFile, 'utf8'))
    res.json({ ok: true, projects: manifest })
  } catch {
    res.status(503).json({ ok: false, error: 'manifest_missing' })
  }
})

// --- contact form ---

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 5
const recentByIp = new Map()

function rateLimited(ip) {
  const now = Date.now()
  // drop IPs whose window has fully expired so the map doesn't grow forever
  for (const [key, hits] of recentByIp) {
    if (hits.every((at) => now - at >= RATE_WINDOW_MS)) recentByIp.delete(key)
  }
  const hits = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS)
  if (hits.length >= RATE_MAX) return true
  hits.push(now)
  recentByIp.set(ip, hits)
  return false
}

app.post('/api/contact', async (req, res) => {
  const { name, email, message, company } = req.body ?? {}

  // honeypot: bots fill every field; pretend success and drop it
  if (typeof company === 'string' && company.trim() !== '') {
    return res.json({ ok: true })
  }

  const valid =
    typeof name === 'string' &&
    name.trim().length > 0 &&
    name.trim().length <= 120 &&
    typeof email === 'string' &&
    EMAIL_PATTERN.test(email.trim()) &&
    email.trim().length <= 200 &&
    typeof message === 'string' &&
    message.trim().length > 0 &&
    message.trim().length <= 4000

  if (!valid) {
    return res.status(400).json({ ok: false, error: 'validation' })
  }

  if (rateLimited(req.ip)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' })
  }

  const entry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
  }

  try {
    await fsp.mkdir(dataDir, { recursive: true })
    let messages = []
    try {
      messages = JSON.parse(await fsp.readFile(messagesFile, 'utf8'))
      if (!Array.isArray(messages)) messages = []
    } catch {
      /* first message */
    }
    messages.push(entry)
    await fsp.writeFile(messagesFile, JSON.stringify(messages, null, 2) + '\n')
  } catch (error) {
    console.error('[contact] failed to persist message:', error)
    return res.status(500).json({ ok: false, error: 'persistence' })
  }

  // TODO: wire real delivery (e.g. nodemailer + SMTP creds) here.
  console.log(`[contact] ${entry.at} — ${entry.name} <${entry.email}>: ${entry.message.slice(0, 80)}`)
  res.json({ ok: true })
})

app.use('/api', (_req, res) => {
  res.status(404).json({ ok: false, error: 'not_found' })
})

// --- production static hosting (dev uses the Vite server + /api proxy instead) ---

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // SPA fallback for client-side routes like /work/<slug>
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  console.log(`[server] serving client build from ${clientDist}`)
} else {
  console.log('[server] client/dist not found — API-only mode (expected during development)')
}

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})
