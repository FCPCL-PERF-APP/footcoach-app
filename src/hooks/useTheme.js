import { useState, useEffect } from 'react'

export function useTheme() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('fcpcl-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    localStorage.setItem('fcpcl-theme', darkMode ? 'dark' : 'light')
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return { darkMode, toggleTheme: () => setDarkMode(p => !p) }
}
