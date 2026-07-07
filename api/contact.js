const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 5
const recentByIp = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const hits = (recentByIp.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS)
  if (hits.length >= RATE_MAX) return true
  hits.push(now)
  recentByIp.set(ip, hits)
  return false
}

// Vercel serverless port of server/src/index.js's /api/contact handler.
// Serverless functions have no persistent disk, so this logs to Vercel's
// function logs instead of writing data/messages.json like the dev server.
// TODO: wire real delivery (email/webhook) or a hosted datastore for production.
export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const { name, email, message, company } = req.body ?? {}

  if (typeof company === 'string' && company.trim() !== '') {
    res.status(200).json({ ok: true })
    return
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
    res.status(400).json({ ok: false, error: 'validation' })
    return
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  if (rateLimited(ip)) {
    res.status(429).json({ ok: false, error: 'rate_limited' })
    return
  }

  console.log(
    `[contact] ${new Date().toISOString()} — ${name.trim()} <${email.trim()}>: ${message.trim().slice(0, 80)}`,
  )
  res.status(200).json({ ok: true })
}
