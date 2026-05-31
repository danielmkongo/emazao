import { lazy, type ComponentType } from 'react'

/**
 * lazy() that self-heals across deploys.
 *
 * When a new build ships, Vite emits new hashed chunk filenames and deletes the
 * old ones. A client still holding a stale index.html will try to import a chunk
 * that no longer exists → 404 → the dynamic import rejects → blank screen (there
 * is no error boundary on routes). Here we catch that failure and force ONE full
 * reload, which fetches the fresh index.html and its new chunk names, so the route
 * loads instead of dying. A short sessionStorage guard prevents an infinite reload
 * loop when the failure is real (e.g. the user is offline).
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory()
    } catch (err) {
      const KEY = 'chunk-reload-ts'
      const last = Number(sessionStorage.getItem(KEY) || 0)
      const now = Date.now()
      if (now - last > 10_000) {
        sessionStorage.setItem(KEY, String(now))
        window.location.reload()
        // Keep React on the Suspense fallback while the page reloads
        return await new Promise<{ default: T }>(() => {})
      }
      throw err
    }
  })
}
