const CACHE = 'emazao-v2'
const STATIC = [
  '/',
  '/feed',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Always go network-first for API calls
  if (url.pathname.startsWith('/api')) {
    e.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ success: false, message: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    )
    return
  }

  // Stale-while-revalidate for static assets: serve cached instantly, but
  // always refresh in the background so changed files self-heal without a
  // hard refresh. (Cache-first was why the logo went stale.)
  if (request.destination === 'image' || url.pathname.match(/\.(js|css|woff2?)$/)) {
    e.respondWith(
      caches.match(request).then(cached => {
        const network = fetch(request).then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(request, clone))
          return res
        }).catch(() => cached)
        return cached || network
      })
    )
    return
  }

  // Network-first for HTML navigation
  e.respondWith(
    fetch(request).catch(() => caches.match('/') || caches.match(request))
  )
})
