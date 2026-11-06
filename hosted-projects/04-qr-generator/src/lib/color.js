/** Contrast helpers — a QR code with too little contrast simply will not scan. */

function channel(v) {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function parseHex(hex) {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex ?? '')
  if (!m) return null
  let s = m[1]
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

export function luminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Scanners need a dark-on-light code with real separation. Below about 3:1 they
 * start failing outright; inverted (light modules on a dark field) is read by
 * some apps and not others, so it is a warning rather than an error.
 */
export function scanAdvice(foreground, background, transparent) {
  const bg = transparent ? '#ffffff' : background
  const ratio = contrastRatio(foreground, bg)
  if (ratio < 3) {
    return { level: 'error', ratio, message: `Contrast is only ${ratio.toFixed(1)}:1. Most scanners will fail below 3:1.` }
  }
  if (luminance(foreground) > luminance(bg)) {
    return {
      level: 'warn',
      ratio,
      message: 'Light modules on a dark field. Many phone cameras read this, but plenty of dedicated scanners will not.',
    }
  }
  if (ratio < 7) {
    return { level: 'warn', ratio, message: `Contrast is ${ratio.toFixed(1)}:1. It should scan, but more separation is safer in print.` }
  }
  return { level: 'ok', ratio, message: `Contrast ${ratio.toFixed(1)}:1 — good.` }
}
