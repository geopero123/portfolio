/**
 * QR geometry.
 *
 * `qrcode` gives us the module matrix; everything drawn from it is ours, which
 * is what makes custom module shapes, styled finder patterns and a logo cut-out
 * possible. The geometry is emitted once as SVG path data and then consumed by
 * both renderers — React `<path>` for the live preview and `Path2D` on a canvas
 * for PNG export — so the preview and the download cannot drift apart.
 */

import QRCode from 'qrcode'

export class QrError extends Error {
  constructor(message) {
    super(message)
    this.name = 'QrError'
  }
}

export const MODULE_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'dots', label: 'Dots' },
]

export const EYE_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
]

export const ECC_LEVELS = [
  { value: 'L', label: 'L', note: '~7% recoverable — smallest code' },
  { value: 'M', label: 'M', note: '~15% recoverable — a good default' },
  { value: 'Q', label: 'Q', note: '~25% recoverable' },
  { value: 'H', label: 'H', note: '~30% recoverable — required for a logo' },
]

/* ------------------------------------------------------------- shapes --- */

function rectPath(x, y, w, h) {
  return `M${x} ${y}h${w}v${h}h${-w}z`
}

function roundedPath(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  return (
    `M${x + rad} ${y}h${w - rad * 2}a${rad} ${rad} 0 0 1 ${rad} ${rad}` +
    `v${h - rad * 2}a${rad} ${rad} 0 0 1 ${-rad} ${rad}` +
    `h${-(w - rad * 2)}a${rad} ${rad} 0 0 1 ${-rad} ${-rad}` +
    `v${-(h - rad * 2)}a${rad} ${rad} 0 0 1 ${rad} ${-rad}z`
  )
}

function circlePath(cx, cy, r) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`
}

function modulePath(style, x, y) {
  if (style === 'dots') return circlePath(x + 0.5, y + 0.5, 0.46)
  if (style === 'rounded') return roundedPath(x + 0.04, y + 0.04, 0.92, 0.92, 0.3)
  // A hair of overlap stops hairline seams appearing between adjacent modules
  // when the SVG is scaled to a non-integer size.
  return rectPath(x, y, 1.02, 1.02)
}

/**
 * The finder patterns, drawn as one even-odd path per ring so the hole is a real
 * hole. Punching it with a background-coloured shape would break the moment the
 * background is transparent.
 */
function eyePaths(style, ox, oy) {
  const shapes = []
  if (style === 'circle') {
    shapes.push(`${circlePath(ox + 3.5, oy + 3.5, 3.5)}${circlePath(ox + 3.5, oy + 3.5, 2.5)}`)
    shapes.push(circlePath(ox + 3.5, oy + 3.5, 1.5))
  } else if (style === 'rounded') {
    shapes.push(`${roundedPath(ox, oy, 7, 7, 2)}${roundedPath(ox + 1, oy + 1, 5, 5, 1.4)}`)
    shapes.push(roundedPath(ox + 2, oy + 2, 3, 3, 0.9))
  } else {
    shapes.push(`${rectPath(ox, oy, 7, 7)}${rectPath(ox + 1, oy + 1, 5, 5)}`)
    shapes.push(rectPath(ox + 2, oy + 2, 3, 3))
  }
  return shapes
}

/**
 * Centres of the alignment patterns for a given version, per the QR spec's
 * placement rule. Computed here rather than reached for inside the `qrcode`
 * package so nothing depends on that library's internal file layout.
 */
function alignmentCoords(version) {
  if (version <= 1) return []
  const size = version * 4 + 17
  const count = Math.floor(version / 7) + 2
  const interval = count === 2 ? size - 13 : Math.ceil((size - 13) / (2 * count - 2)) * 2
  const positions = [size - 7]
  for (let i = 1; i < count - 1; i++) positions.push(positions[i - 1] - interval)
  positions.push(6)
  return positions.reverse()
}

/**
 * The modules a decoder measures against rather than reads: the timing lines
 * along row and column 6, and the alignment patterns.
 *
 * These are always drawn as solid squares whatever module shape is chosen.
 * Rendering them as separated dots leaves no continuous runs for a scanner's
 * run-length locator to lock onto, and the code stops decoding altogether —
 * verified against jsQR, which failed on every dotted code before this.
 */
function functionalModules(size, version) {
  const set = new Set()
  const add = (x, y) => {
    if (x >= 0 && y >= 0 && x < size && y < size) set.add(y * size + x)
  }
  for (let i = 0; i < size; i++) {
    add(i, 6)
    add(6, i)
  }
  const coords = alignmentCoords(version)
  for (const cy of coords) {
    for (const cx of coords) {
      const nearFinder =
        (cx <= 7 && cy <= 7) || (cx >= size - 8 && cy <= 7) || (cx <= 7 && cy >= size - 8)
      if (nearFinder) continue
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) add(cx + dx, cy + dy)
    }
  }
  return set
}

/* ---------------------------------------------------------- geometry --- */

export function qrGeometry(text, opts) {
  const {
    ecc = 'M',
    margin = 4,
    moduleStyle = 'square',
    eyeStyle = 'square',
    foreground = '#000000',
    background = '#ffffff',
    transparent = false,
    logo = null,
    logoScale = 0.22,
    logoPad = true,
  } = opts

  if (!text) throw new QrError('Nothing to encode yet — fill in the fields on the right.')

  let qr
  try {
    // A logo covers modules, so it only works with the strongest recovery level.
    qr = QRCode.create(text, { errorCorrectionLevel: logo ? 'H' : ecc })
  } catch (err) {
    if (/too big|too long/i.test(err?.message ?? '')) {
      const bytes = new TextEncoder().encode(text).length
      throw new QrError(
        `That is ${bytes} bytes — more than a QR code can hold at this error-correction level. Shorten it, or drop to level L.`,
      )
    }
    throw new QrError(err?.message ?? 'This content could not be encoded.')
  }

  const size = qr.modules.size
  const data = qr.modules.data
  const at = (x, y) => data[y * size + x] === 1
  const extent = size + margin * 2

  // The three 7×7 finder patterns are drawn separately, so skip their modules.
  const inEye = (x, y) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)

  const functional = functionalModules(size, qr.version)

  let body = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!at(x, y) || inEye(x, y)) continue
      const shape = functional.has(y * size + x) ? 'square' : moduleStyle
      body += modulePath(shape, x + margin, y + margin)
    }
  }

  const paths = []
  if (!transparent) {
    paths.push({ d: rectPath(0, 0, extent, extent), fill: background, fillRule: 'nonzero' })
  }
  if (body) paths.push({ d: body, fill: foreground, fillRule: 'nonzero' })

  for (const [ex, ey] of [
    [margin, margin],
    [size - 7 + margin, margin],
    [margin, size - 7 + margin],
  ]) {
    const [ring, core] = eyePaths(eyeStyle, ex, ey)
    paths.push({ d: ring, fill: foreground, fillRule: 'evenodd' })
    paths.push({ d: core, fill: foreground, fillRule: 'nonzero' })
  }

  let logoBox = null
  let padPath = null
  if (logo) {
    const w = size * logoScale
    const x = (extent - w) / 2
    logoBox = { x, y: x, w, h: w }
    if (logoPad) {
      const p = w * 0.14
      padPath = {
        d: roundedPath(x - p, x - p, w + p * 2, w + p * 2, w * 0.16),
        fill: transparent ? '#ffffff' : background,
      }
    }
  }

  return { size, extent, paths, logoBox, padPath, ecc: logo ? 'H' : ecc }
}

/* --------------------------------------------------------- renderers --- */

export function geometryToSvg(geo, { pixels = 1024, logoHref = null } = {}) {
  const body = geo.paths
    .map((p) => `<path d="${p.d}" fill="${p.fill}"${p.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : ''}/>`)
    .join('')
  const pad = geo.padPath ? `<path d="${geo.padPath.d}" fill="${geo.padPath.fill}"/>` : ''
  const logo =
    geo.logoBox && logoHref
      ? `<image href="${logoHref}" x="${geo.logoBox.x}" y="${geo.logoBox.y}" width="${geo.logoBox.w}" height="${geo.logoBox.h}" preserveAspectRatio="xMidYMid meet"/>`
      : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" ` +
    `viewBox="0 0 ${geo.extent} ${geo.extent}" shape-rendering="crispEdges">` +
    `${body}${pad}${logo}</svg>`
  )
}

export async function geometryToCanvas(geo, { pixels = 1024, logoImage = null } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = pixels
  canvas.height = pixels
  const ctx = canvas.getContext('2d')
  const scale = pixels / geo.extent
  ctx.scale(scale, scale)

  for (const p of geo.paths) {
    ctx.fillStyle = p.fill
    ctx.fill(new Path2D(p.d), p.fillRule)
  }
  if (geo.padPath) {
    ctx.fillStyle = geo.padPath.fill
    ctx.fill(new Path2D(geo.padPath.d))
  }
  if (geo.logoBox && logoImage) {
    const { x, y, w, h } = geo.logoBox
    // Match the SVG's preserveAspectRatio="meet": contain, centred.
    const ratio = Math.min(w / logoImage.width, h / logoImage.height)
    const dw = logoImage.width * ratio
    const dh = logoImage.height * ratio
    ctx.drawImage(logoImage, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  }
  return canvas
}
