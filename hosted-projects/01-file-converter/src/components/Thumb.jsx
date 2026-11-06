import { FileText, Table2, Braces, FileImage } from 'lucide-react'

const DOC_ICONS = {
  docx: FileText,
  csv: Table2,
  tsv: Table2,
  json: Braces,
}

export default function Thumb({ item }) {
  if (item.url) {
    return (
      <div
        className="size-11 shrink-0 overflow-hidden rounded-md border border-shell-700 bg-shell-800"
        style={{
          // Checkerboard so transparent PNGs don't read as solid dark squares.
          backgroundImage:
            'linear-gradient(45deg,#24262b 25%,transparent 25%),linear-gradient(-45deg,#24262b 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#24262b 75%),linear-gradient(-45deg,transparent 75%,#24262b 75%)',
          backgroundSize: '10px 10px',
          backgroundPosition: '0 0,0 5px,5px -5px,-5px 0',
        }}
      >
        <img src={item.url} alt="" className="size-full object-cover" loading="lazy" />
      </div>
    )
  }
  const Icon = DOC_ICONS[item.source?.id] ?? FileImage
  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-md border border-shell-700 bg-shell-800">
      <Icon className="size-5 text-shell-400" strokeWidth={1.6} />
    </div>
  )
}
