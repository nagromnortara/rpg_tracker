import { useEffect } from 'react'

export function useVersionCheck() {
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/version.json?_=' + Date.now())
        if (!res.ok) return
        const { v } = await res.json()
        if (v && v !== __BUILD_VERSION__) window.location.reload()
      } catch {
        // dev mode or network error — ignore
      }
    }
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [])
}
