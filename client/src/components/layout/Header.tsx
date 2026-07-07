import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { site } from '../../data/site'
import { LangSwitcher } from './LangSwitcher'
import { ThemeToggle } from './ThemeToggle'
import './layout.css'

export function Header() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const links = [
    { href: '#work', label: t('nav.work') },
    { href: '#about', label: t('nav.about') },
    { href: '#contact', label: t('nav.contact') },
  ]

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a className="brand" href="#top">
          <span className="brand-glyph" aria-hidden="true">
            &lt;/&gt;
          </span>
          {site.name.toLowerCase()}
          <span className="brand-cursor" aria-hidden="true">
            _
          </span>
        </a>
        <nav id="site-nav" className={open ? 'site-nav open' : 'site-nav'} aria-label="Main">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="header-tools">
          <LangSwitcher />
          <ThemeToggle />
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label={t('nav.menu')}
            onClick={() => setOpen((value) => !value)}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 7h18M3 12h18M3 17h18" />}
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
