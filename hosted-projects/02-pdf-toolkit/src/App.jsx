import { useState } from 'react'
import { Combine, Scissors, Minimize2, Images, FileImage, Lock } from 'lucide-react'
import MergeTab from './tabs/MergeTab.jsx'
import SplitTab from './tabs/SplitTab.jsx'
import CompressTab from './tabs/CompressTab.jsx'
import ImagesToPdfTab from './tabs/ImagesToPdfTab.jsx'
import PdfToImagesTab from './tabs/PdfToImagesTab.jsx'

const TABS = [
  { id: 'merge', index: '01', label: 'Merge', icon: Combine, Component: MergeTab },
  { id: 'split', index: '02', label: 'Split', icon: Scissors, Component: SplitTab },
  { id: 'compress', index: '03', label: 'Compress', icon: Minimize2, Component: CompressTab },
  { id: 'to-pdf', index: '04', label: 'Images to PDF', icon: Images, Component: ImagesToPdfTab },
  { id: 'to-images', index: '05', label: 'PDF to images', icon: FileImage, Component: PdfToImagesTab },
]

export default function App() {
  const [active, setActive] = useState('merge')
  const tab = TABS.find((t) => t.id === active) ?? TABS[0]
  const { Component } = tab

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-rule bg-paper-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-baseline gap-3">
            <span className="font-wonk text-[27px] leading-none text-ink-900">Folio</span>
            <span className="hidden h-4 w-px bg-rule sm:block" />
            <span className="label hidden sm:block">PDF toolkit</span>
          </div>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-400">
            <Lock className="size-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Nothing leaves this tab</span>
            <span className="sm:hidden">Local only</span>
          </p>
        </div>

        {/* An index rather than a button bar: numbered entries, a rule beneath,
            and a proof-red mark against whichever one is open. */}
        <nav className="scrollbar-slim mx-auto max-w-6xl overflow-x-auto px-5 sm:px-8">
          <ul className="flex min-w-max gap-1">
            {TABS.map((t) => {
              const on = t.id === active
              const Icon = t.icon
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActive(t.id)}
                    aria-current={on ? 'page' : undefined}
                    className={`group flex items-center gap-2 border-b-2 px-3 py-3 transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-vermillion-600 ${
                      on
                        ? 'border-vermillion-600 text-ink-900'
                        : 'border-transparent text-ink-400 hover:border-rule-strong hover:text-ink-800'
                    }`}
                  >
                    <span className={`font-mono text-[10.5px] tnum ${on ? 'text-vermillion-600' : 'text-ink-300'}`}>
                      {t.index}
                    </span>
                    <Icon className="size-4" strokeWidth={1.9} />
                    <span className="text-[13.5px] font-medium">{t.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
        {/* Keying on the tab id gives each operation a clean slate — no stale
            page selections bleeding from one job into the next. */}
        <Component key={tab.id} />
      </main>

      <footer className="mt-8 border-t border-rule bg-paper-50">
        <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8">
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-ink-400">
            Built on <span className="font-mono text-ink-600">pdf-lib</span> for writing and{' '}
            <span className="font-mono text-ink-600">pdf.js</span> for reading. Both run in this tab — your
            documents are never uploaded, and the app keeps working with the network switched off.
          </p>
        </div>
      </footer>
    </div>
  )
}
