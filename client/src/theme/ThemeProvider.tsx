import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext } from './context'
import type { Theme } from './context'

const STORAGE_KEY = 'portfolio-theme'
const LIGHT_QUERY = '(prefers-color-scheme: light)'

function systemTheme(): Theme {
  return window.matchMedia(LIGHT_QUERY).matches ? 'light' : 'dark'
}

function storedTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'dark' || value === 'light' ? value : null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // null preference = follow the OS; an inline script in index.html applies the
  // same resolution before first paint so there is no flash.
  const [preference, setPreference] = useState<Theme | null>(storedTheme)
  const [system, setSystem] = useState<Theme>(systemTheme)

  const theme = preference ?? system

  useEffect(() => {
    const query = window.matchMedia(LIGHT_QUERY)
    const onChange = () => setSystem(systemTheme())
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setPreference(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  const value = useMemo(
    () => ({ theme, isSystem: preference === null, setTheme, toggle }),
    [theme, preference, setTheme, toggle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
