import JsBarcode from 'jsbarcode'

export const BARCODE_FORMATS = [
  { value: 'CODE128', label: 'Code 128', sample: 'SIGNAL-2024', rule: 'Any ASCII text — the general-purpose choice.' },
  { value: 'CODE39', label: 'Code 39', sample: 'SIGNAL 39', rule: 'A–Z, 0–9, space and - . $ / + % only.' },
  { value: 'EAN13', label: 'EAN-13', sample: '5901234123457', rule: '12 digits (a 13th check digit is added) or 13 with a valid check digit.' },
  { value: 'EAN8', label: 'EAN-8', sample: '96385074', rule: '7 digits, or 8 with a valid check digit.' },
  { value: 'UPC', label: 'UPC-A', sample: '036000291452', rule: '11 digits, or 12 with a valid check digit.' },
  { value: 'ITF14', label: 'ITF-14', sample: '15400141288763', rule: '13 digits, or 14 with a valid check digit.' },
  { value: 'MSI', label: 'MSI', sample: '1234567', rule: 'Digits only.' },
  { value: 'pharmacode', label: 'Pharmacode', sample: '1234', rule: 'A whole number from 3 to 131070.' },
  { value: 'codabar', label: 'Codabar', sample: 'A123456A', rule: 'Digits and - $ : / . +, optionally wrapped in A–D start/stop letters.' },
]

/**
 * Draws a barcode into an existing SVG or canvas element.
 *
 * JsBarcode validates per format and reports through a callback rather than
 * throwing, so invalid input is a message rather than a crash.
 */
export function drawBarcode(element, value, options) {
  let valid = true
  try {
    JsBarcode(element, value, {
      format: options.format,
      width: options.barWidth,
      height: options.height,
      displayValue: options.showText,
      text: options.label || undefined,
      fontOptions: 'bold',
      font: 'Roboto Mono Variable, monospace',
      fontSize: options.fontSize,
      textMargin: 4,
      margin: options.margin,
      background: options.transparent ? 'transparent' : options.background,
      lineColor: options.foreground,
      valid: (ok) => {
        valid = ok
      },
    })
  } catch {
    valid = false
  }
  return valid
}

export function formatRule(format) {
  return BARCODE_FORMATS.find((f) => f.value === format)?.rule ?? ''
}
