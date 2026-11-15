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
    <div className="mat relative flex min-h-dvh flex-col overflow-x-clip">
      <div className="mat-diagonal" aria-hidden="true" />
      <div className="ruler-x relative" aria-hidden="true" />
      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-5 pb-6 pt-6 sm:px-8 sm:pt-9">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-paper-200/60">PDF toolkit · No. 05</p>
            <h1 className="font-wonk mt-1 text-[52px] italic leading-[.9] text-paper-100 sm:text-[72px]">
              Folio<span className="text-vermillion-500">.</span>
            </h1>
          </div>
          <p className="flex items-center gap-1.5 pb-2 text-[12.5px] text-paper-200/75">
            <Lock className="size-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Nothing leaves this tab</span>
            <span className="sm:hidden">Local only</span>
          </p>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-3 sm:px-8">
        {/* Each operation is a tab on a manila folder; the open one joins the sheet. */}
        <nav aria-label="Operations" className="scrollbar-slim -mb-px overflow-x-auto px-1 pt-2">
          <ul className="flex min-w-max gap-1.5">
            {TABS.map((t) => {
              const on = t.id === active
              const Icon = t.icon
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActive(t.id)}
                    aria-current={on ? 'page' : undefined}
                    className="folder-tab flex items-center gap-2 px-4 pb-3 pt-2.5 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-vermillion-600"
                  >
                    <span className={`font-mono text-[10.5px] tnum ${on ? 'text-vermillion-600' : 'text-ink-400'}`}>{t.index}</span>
                    <Icon className="size-4" strokeWidth={1.9} />
                    <span className="text-[13.5px] font-medium">{t.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="folder-sheet px-5 py-8 sm:px-10 sm:py-12">
          <span className="crop crop-tl" aria-hidden="true" />
          <span className="crop crop-tr" aria-hidden="true" />
          <span className="crop crop-bl" aria-hidden="true" />
          <span className="crop crop-br" aria-hidden="true" />
          {/* Keying on the tab id gives each operation a clean slate — no stale
              page selections bleeding from one job into the next. */}
          <div key={tab.id} className="sheet-in">
            <Component />
          </div>
        </div>
      </main>

      <footer className="relative mt-10">
        <div className="mx-auto max-w-6xl px-5 pb-10 sm:px-8">
          <p className="max-w-[62ch] text-[12.5px] leading-relaxed text-paper-200/70">
            Built on <span className="font-mono text-paper-100">pdf-lib</span> for writing and{' '}
            <span className="font-mono text-paper-100">pdf.js</span> for reading. Both run in this tab — your
            documents are never uploaded, and the app keeps working with the network switched off.
          </p>
        </div>
      </footer>
    </div>
  )
}
