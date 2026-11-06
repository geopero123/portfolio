/**
 * Turns form fields into the strings that actually go inside a QR code.
 *
 * Escaping is the whole job here. A password containing a semicolon, or a name
 * containing a comma, silently breaks a Wi-Fi or vCard payload — the code still
 * scans, it just produces the wrong thing, which is worse than failing.
 */

/**
 * Wi-Fi payloads use backslash escapes for the delimiters.
 *
 * The backslash itself has to go first: a password ending in one would
 * otherwise escape the delimiter that follows it and silently corrupt the
 * whole payload.
 */
function escapeWifi(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/([;,:"])/g, '\\$1')
}

/** vCard escapes backslash, comma, semicolon and newline (RFC 6350 §3.3). */
function escapeVcard(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\;')
}

export function buildText({ text }) {
  return (text ?? '').trim()
}

export function buildUrl({ url }) {
  const raw = (url ?? '').trim()
  if (!raw) return ''
  // "example.com" is what people type; a bare domain without a scheme opens as
  // a search on most phones, so add the scheme rather than encoding a dud.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw
  if (/^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(raw)) return `https://${raw}`
  return raw
}

export function buildWifi({ ssid, password, encryption = 'WPA', hidden = false }) {
  if (!ssid?.trim()) return ''
  const parts = [`T:${encryption === 'nopass' ? 'nopass' : encryption}`, `S:${escapeWifi(ssid)}`]
  if (encryption !== 'nopass' && password) parts.push(`P:${escapeWifi(password)}`)
  if (hidden) parts.push('H:true')
  return `WIFI:${parts.join(';')};;`
}

export function buildVcard(f) {
  const first = (f.firstName ?? '').trim()
  const last = (f.lastName ?? '').trim()
  if (!first && !last && !f.org?.trim()) return ''

  const full = [first, last].filter(Boolean).join(' ') || f.org.trim()
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    // N is structured: the semicolons separate fields, so only the values escape.
    `N:${escapeVcard(last)};${escapeVcard(first)};;;`,
    `FN:${escapeVcard(full)}`,
  ]
  if (f.org?.trim()) lines.push(`ORG:${escapeVcard(f.org.trim())}`)
  if (f.title?.trim()) lines.push(`TITLE:${escapeVcard(f.title.trim())}`)
  if (f.phone?.trim()) lines.push(`TEL;TYPE=CELL:${escapeVcard(f.phone.trim())}`)
  if (f.email?.trim()) lines.push(`EMAIL;TYPE=INTERNET:${escapeVcard(f.email.trim())}`)
  if (f.url?.trim()) lines.push(`URL:${escapeVcard(buildUrl({ url: f.url }))}`)
  if (f.address?.trim()) {
    // ADR is structured too; the whole thing goes in the street slot rather than
    // guessing where a free-text address splits.
    lines.push(`ADR;TYPE=WORK:;;${escapeVcard(f.address.trim())};;;;`)
  }
  if (f.note?.trim()) lines.push(`NOTE:${escapeVcard(f.note.trim())}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}

export function buildEmail({ to, subject, body }) {
  const addr = (to ?? '').trim()
  if (!addr) return ''
  const query = []
  if (subject?.trim()) query.push(`subject=${encodeURIComponent(subject.trim())}`)
  if (body?.trim()) query.push(`body=${encodeURIComponent(body.trim())}`)
  return `mailto:${addr}${query.length ? `?${query.join('&')}` : ''}`
}

export function buildSms({ number, message }) {
  const n = (number ?? '').replace(/[^\d+]/g, '')
  if (!n) return ''
  // SMSTO is the form scanners have agreed on; `sms:` handling varies by OS.
  return message?.trim() ? `SMSTO:${n}:${message.trim()}` : `SMSTO:${n}`
}

export const CONTENT_TYPES = {
  url: {
    id: 'url',
    label: 'Link',
    build: buildUrl,
    empty: { url: '' },
    hint: 'A bare domain gets https:// added for you.',
  },
  text: { id: 'text', label: 'Text', build: buildText, empty: { text: '' }, hint: 'Anything at all — it is encoded verbatim.' },
  wifi: {
    id: 'wifi',
    label: 'Wi-Fi',
    build: buildWifi,
    empty: { ssid: '', password: '', encryption: 'WPA', hidden: false },
    hint: 'Scanning joins the network on iOS and Android.',
  },
  vcard: {
    id: 'vcard',
    label: 'Contact',
    build: buildVcard,
    empty: { firstName: '', lastName: '', org: '', title: '', phone: '', email: '', url: '', address: '', note: '' },
    hint: 'vCard 3.0 — opens straight into the contacts app.',
  },
  email: { id: 'email', label: 'Email', build: buildEmail, empty: { to: '', subject: '', body: '' }, hint: 'Opens a pre-filled draft.' },
  sms: { id: 'sms', label: 'SMS', build: buildSms, empty: { number: '', message: '' }, hint: 'Opens a pre-filled message.' },
}
