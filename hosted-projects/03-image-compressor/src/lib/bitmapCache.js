import { decodeFile } from './encode.js'

/**
 * Keeps a few decoded images around.
 *
 * Dragging the quality slider re-encodes the same picture over and over; without
 * this, every frame would re-decode the file from disk. Bitmaps are large, so
 * the cache is small and evicts least-recently-used.
 */
export default class BitmapCache {
  constructor(max = 6) {
    this.max = max
    this.map = new Map()
  }

  async get(id, file) {
    const hit = this.map.get(id)
    if (hit) {
      this.map.delete(id)
      this.map.set(id, hit) // refresh recency
      return hit
    }
    const bitmap = await decodeFile(file)
    this.map.set(id, bitmap)
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value
      this.map.get(oldest)?.close?.()
      this.map.delete(oldest)
    }
    return bitmap
  }

  drop(id) {
    this.map.get(id)?.close?.()
    this.map.delete(id)
  }

  clear() {
    for (const bitmap of this.map.values()) bitmap.close?.()
    this.map.clear()
  }
}
