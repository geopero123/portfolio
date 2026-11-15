import { useRef, useState } from 'react'
import { FilePlus2 } from 'lucide-react'

export default function Dropzone({ onFiles, accept, multiple = true, title, hint, compact = false }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  const depth = useRef(0)

  const handle = (files) => {
    if (files?.length) onFiles(Array.from(files))
  }

  return (
    <div
      onDragEnter={(e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return
        e.preventDefault()
        depth.current += 1
        setOver(true)
      }}
      onDragOver={(e) => e.dataTransfer?.types?.includes('Files') && e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (!depth.current) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        depth.current = 0
        setOver(false)
        handle(e.dataTransfer?.files)
      }}
      className={`hatched relative rounded-lg border-2 border-dashed text-center transition ${
        compact ? 'px-4 py-6' : 'px-6 py-14'
      } ${over ? 'scale-[1.01] border-vermillion-600 bg-vermillion-50' : 'border-rule-strong bg-paper-200/60 hover:border-ink-400'}`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex w-full flex-col items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermillion-600"
      >
        {compact ? (
          <span className={`grid size-9 place-items-center rounded-full border transition ${over ? 'border-vermillion-600 bg-paper-50 text-vermillion-600' : 'border-rule bg-paper-50 text-ink-400 group-hover:border-ink-400 group-hover:text-ink-800'}`}>
            <FilePlus2 className="size-4" strokeWidth={1.7} />
          </span>
        ) : (
          /* A little stack of sheets that fans out on hover and when a file is over it. */
          <span className={`relative block h-20 w-16 ${over ? 'is-over' : ''}`} aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="sheet absolute inset-0 rounded-[3px] transition-transform duration-500 [transition-timing-function:cubic-bezier(.16,1,.3,1)] group-hover:[transform:var(--fan)] [.is-over_&]:[transform:var(--fan)]"
                style={{ '--fan': `rotate(${(i - 1) * 11}deg) translate(${(i - 1) * 10}px, ${i === 1 ? -6 : 0}px)`, zIndex: i === 1 ? 2 : 1 }}
              >
                {i === 1 && (
                  <span className="absolute inset-x-2.5 top-3 space-y-1.5">
                    <span className="block h-1 rounded bg-ink-300/60" />
                    <span className="block h-1 w-3/4 rounded bg-ink-300/40" />
                    <span className="block h-1 rounded bg-ink-300/40" />
                    <span className="block h-1 w-1/2 rounded bg-vermillion-500/70" />
                  </span>
                )}
              </span>
            ))}
          </span>
        )}
        <span>
          <span className={`block font-medium text-ink-900 ${compact ? 'text-[13px]' : 'text-[15px]'}`}>
            {over ? 'Release to add' : title}
          </span>
          {hint && <span className="mt-1 block font-mono text-[11px] text-ink-400">{hint}</span>}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
