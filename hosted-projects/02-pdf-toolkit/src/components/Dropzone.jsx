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
      } ${over ? 'border-vermillion-600 bg-vermillion-50' : 'border-rule-strong bg-paper-200/60'}`}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex w-full flex-col items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-vermillion-600"
      >
        <span
          className={`grid place-items-center rounded-full border transition ${
            compact ? 'size-9' : 'size-12'
          } ${over ? 'border-vermillion-600 bg-paper-50 text-vermillion-600' : 'border-rule bg-paper-50 text-ink-400 group-hover:border-ink-400 group-hover:text-ink-800'}`}
        >
          <FilePlus2 className={compact ? 'size-4' : 'size-5'} strokeWidth={1.7} />
        </span>
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
