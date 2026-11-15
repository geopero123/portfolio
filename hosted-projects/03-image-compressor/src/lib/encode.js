/**
 * Decode → resize → re-encode, all on a canvas. No library does the work here;
 * the interesting parts are the resampling quality and being honest about when
 * "compressing" actually makes a file bigger.
 */

export class ImageError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImageError'
  }
}

export const MAX_BYTES = 100 * 1024 * 1024
export const MAX_PIXELS = 80_000_000

export const FORMATS = {
  auto: { id: 'auto', label: 'Auto', note: 'Keep each file’s own format' },
  jpg: { id: 'jpg', label: 'JPG', mime: 'image/jpeg', ext: 'jpg', lossy: true, flattens: true, note: 'Best for photos' },
  webp: { id: 'webp', label: 'WEBP', mime: 'image/webp', ext: 'webp', lossy: true, note: 'Smaller than JPG, keeps alpha' },
  png: { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', note: 'Lossless — quality has no effect' },
}

const MIME_TO_FORMAT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** Auto keeps png/jpg/webp as they are; anything else becomes PNG (never lossy by surprise). */
export function resolveFormat(file, format) {
  if (format !== 'auto') return FORMATS[format]
  return FORMATS[MIME_TO_FORMAT[file.type] ?? 'png']
}

let webpSupport = null
export function supportsWebp() {
  if (webpSupport === null) {
    const c = document.createElement('canvas')
    c.width = c.height = 1
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp')
  }
  return webpSupport
}

export async function decodeFile(file) {
  try {
    const bitmap = await createImageBitmap(file)
    if (bitmap.width * bitmap.height > MAX_PIXELS) {
      bitmap.close?.()
      throw new ImageError(
        `${file.name} is ${((bitmap.width * bitmap.height) / 1e6).toFixed(0)} megapixels — too large for a canvas.`,
      )
    }
    return bitmap
  } catch (err) {
    if (err instanceof ImageError) throw err
    throw new ImageError(`${file.name} could not be decoded — it may be corrupt or an unsupported format.`)
  }
}

/* ------------------------------------------------------------------ */

export function targetSize({ width, height }, s) {
  let w = width
  let h = height

  if (s.resizeMode === 'scale') {
    const f = s.scale / 100
    w = Math.round(width * f)
    h = Math.round(height * f)
  } else if (s.resizeMode === 'fit') {
    const maxW = s.maxW || Infinity
    const maxH = s.maxH || Infinity
    let f = Math.min(maxW / width, maxH / height)
    if (s.noUpscale) f = Math.min(f, 1)
    if (Number.isFinite(f) && f > 0) {
      w = Math.round(width * f)
      h = Math.round(height * f)
    }
  }

  return { width: Math.max(1, w), height: Math.max(1, h) }
}

/**
 * Draws at the target size, halving in steps when shrinking a lot.
 *
 * A single drawImage from 4000px to 400px samples too sparsely and comes out
 * aliased and crunchy. Repeated halving costs a few milliseconds and looks
 * dramatically better — this is the difference between a resizer people trust
 * and one they don't.
 */
function drawResized(bitmap, width, height, matte) {
  let src = bitmap
  let sw = bitmap.width
  let sh = bitmap.height
  let scratch = null

  while (sw > width * 2 && sh > height * 2) {
    const nw = Math.max(width, Math.round(sw / 2))
    const nh = Math.max(height, Math.round(sh / 2))
    const step = document.createElement('canvas')
    step.width = nw
    step.height = nh
    const sctx = step.getContext('2d')
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(src, 0, 0, nw, nh)
    if (scratch) scratch.width = scratch.height = 0
    scratch = step
    src = step
    sw = nw
    sh = nh
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('The browser refused to create a canvas.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (matte) {
    ctx.fillStyle = matte
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(src, 0, 0, width, height)
  if (scratch) scratch.width = scratch.height = 0
  return canvas
}

function encodeCanvas(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ImageError('The browser returned nothing while encoding.'))
          return
        }
        if (blob.type && blob.type !== mime) {
          reject(new ImageError(`Your browser cannot write ${mime.split('/')[1].toUpperCase()} files.`))
          return
        }
        resolve(blob)
      },
      mime,
      quality,
    )
  })
}

export function outputName(name, ext) {
  const i = name.lastIndexOf('.')
  return `${i === -1 ? name : name.slice(0, i)}.${ext}`
}

/**
 * Runs one image through the pipeline.
 *
 * `bitmap` is passed in rather than decoded here so a quality slider drag can
 * re-encode the same decoded image dozens of times without touching the file.
 */
export async function compress(file, bitmap, settings) {
  const spec = resolveFormat(file, settings.format)
  if (spec.id === 'webp' && !supportsWebp()) {
    throw new ImageError('This browser cannot write WEBP. Choose JPG or PNG instead.')
  }

  const source = { width: bitmap.width, height: bitmap.height }
  const size = targetSize(source, settings)
  const matte = spec.flattens ? settings.matte : null

  const canvas = drawResized(bitmap, size.width, size.height, matte)
  const blob = await encodeCanvas(canvas, spec.mime, spec.lossy ? settings.quality : undefined)
  canvas.width = canvas.height = 0

  const resized = size.width !== source.width || size.height !== source.height

  // Re-encoding does not always win — a PNG screenshot saved as PNG, or a JPEG
  // already compressed harder than our setting, can come out larger. When the
  // output format matches the input and nothing was resized, handing back the
  // original is strictly better than shipping a bigger "compressed" file.
  const sameFormat = spec.mime === file.type
  if (settings.keepSmaller && blob.size >= file.size && sameFormat && !resized) {
    return {
      blob: file,
      name: file.name,
      size: file.size,
      width: source.width,
      height: source.height,
      keptOriginal: true,
    }
  }

  return {
    blob,
    name: outputName(file.name, spec.ext),
    size: blob.size,
    width: size.width,
    height: size.height,
    keptOriginal: false,
  }
}
