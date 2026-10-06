import { Resend } from 'resend'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = 5
const recentByIp = new Map()

// Site owner's inbox — kept here rather than as an env var since it's a
// fixed fact about this site, not something that varies per environment.
const TO_EMAIL = 'giorgiminecraftexpert@gmail.com'

// Resend's shared test sender — works without verifying a custom domain.
// Swap for e.g. "contact@yourdomain.com" once a domain is verified in Resend.
const FROM_EMAIL = 'Portfolio Contact <onboarding@resend.dev>'

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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// Vercel serverless port of server/src/index.js's /api/contact handler.
// Serverless functions have no persistent disk, so this sends the message via
// Resend instead of writing data/messages.json like the dev server does.
export default async function handler(req, res) {
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

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  const trimmedMessage = message.trim()

  // Created per request: the Resend constructor throws without a key, which at
  // module scope would crash every request with an unhandled 500.
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[contact] RESEND_API_KEY is not set')
    res.status(502).json({ ok: false, error: 'delivery_failed' })
    return
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: trimmedEmail,
      subject: `Portfolio contact — ${trimmedName}`,
      text: `From: ${trimmedName} <${trimmedEmail}>\n\n${trimmedMessage}`,
      html: `<p><strong>From:</strong> ${escapeHtml(trimmedName)} &lt;${escapeHtml(trimmedEmail)}&gt;</p><p>${escapeHtml(trimmedMessage).replace(/\n/g, '<br>')}</p>`,
    })
    if (error) throw error
  } catch (error) {
    console.error('[contact] Resend send failed:', error)
    res.status(502).json({ ok: false, error: 'delivery_failed' })
    return
  }

  res.status(200).json({ ok: true })
}
