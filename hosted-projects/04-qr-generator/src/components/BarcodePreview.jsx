import { useEffect, useRef } from 'react'
import { drawBarcode } from '../lib/barcode.js'

/**
 * JsBarcode writes directly into a DOM node, so this hands it an SVG element and
 * reports validity back up rather than trying to render through React.
 */
export default function BarcodePreview({ value, options, onValidity }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!value) {
      el.innerHTML = ''
      onValidity(null)
      return
    }
    const ok = drawBarcode(el, value, options)
    if (!ok) el.innerHTML = ''
    onValidity(ok)
  }, [value, options, onValidity])

  return <svg ref={ref} className="max-h-full max-w-full" role="img" aria-label="Barcode preview" />
}
