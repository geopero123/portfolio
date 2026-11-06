import { useCallback, useEffect, useRef, useState } from 'react'
import { MoveHorizontal } from 'lucide-react'

/**
 * Two images stacked with the original clipped to a draggable divider.
 *
 * Pointer events handle the drag; the handle is also a real slider for the
 * keyboard, because "compare these images" should not be mouse-only.
 */
export default function CompareSlider({ beforeUrl, afterUrl, width, height, zoom }) {
  const [pos, setPos] = useState(50)
  const [dragging, setDragging] = useState(false)
  const frameRef = useRef(null)

  const setFromClientX = useCallback((clientX) => {
    const el = frameRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const next = ((clientX - rect.left) / rect.width) * 100
    setPos(Math.min(100, Math.max(0, next)))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const move = (e) => setFromClientX(e.clientX)
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [dragging, setFromClientX])

  const onKey = (e) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - step))
    else if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + step))
    else if (e.key === 'Home') setPos(0)
    else if (e.key === 'End') setPos(100)
    else return
    e.preventDefault()
  }

  const imgClass = zoom
    ? 'absolute left-0 top-0 max-w-none'
    : 'absolute inset-0 size-full object-contain'
  const imgStyle = zoom ? { width, height } : undefined

  return (
    <div className={zoom ? 'scroll-hard block-edge overflow-auto bg-paper-bright' : ''}>
      <div
        ref={frameRef}
        onPointerDown={(e) => {
          e.preventDefault()
          setDragging(true)
          setFromClientX(e.clientX)
        }}
        className={`checker relative touch-none select-none ${zoom ? '' : 'block-edge'}`}
        style={
          zoom
            ? { width, height }
            : {
                // Size the frame to the image itself, capped on both axes, so the
                // checkerboard never shows as phantom margins beside the picture.
                aspectRatio: `${width} / ${height}`,
                width: `min(100%, 880px, calc(46vh * ${width / height}))`,
                margin: '0 auto',
              }
        }
      >
        <img src={afterUrl} alt="Compressed result" className={imgClass} style={imgStyle} draggable={false} />

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img src={beforeUrl} alt="Original" className={imgClass} style={imgStyle} draggable={false} />
        </div>

        <span className="stamp pointer-events-none absolute left-2 top-2 bg-ink px-1.5 py-1 text-paper">
          Original
        </span>
        <span className="stamp pointer-events-none absolute right-2 top-2 bg-acid px-1.5 py-1 text-ink">
          Compressed
        </span>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-ink"
          style={{ left: `${pos}%` }}
        />
        <button
          type="button"
          role="slider"
          aria-label="Compare original and compressed"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={`${Math.round(pos)}% original`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            setDragging(true)
          }}
          className={`block-edge absolute top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center bg-acid ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ left: `${pos}%` }}
        >
          <MoveHorizontal className="size-4 text-ink" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
