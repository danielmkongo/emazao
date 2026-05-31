import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Belt-and-suspenders for stale-deploy chunk failures: if Vite fails to preload a
// lazy chunk (old hashed file gone after a redeploy), reload once to get the new
// index.html. Shares the guard key with lazyWithReload so we never double-reload.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'chunk-reload-ts'
  const last = Number(sessionStorage.getItem(KEY) || 0)
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()))
    window.location.reload()
  }
})

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
