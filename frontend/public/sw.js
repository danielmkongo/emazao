const CACHE = 'emazao-v1'
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

  // Cache-first for static assets
  if (request.destination === 'image' || url.pathname.match(/\.(js|css|woff2?)$/)) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
        return res
      }))
    )
    return
  }

  // Network-first for HTML navigation
  e.respondWith(
    fetch(request).catch(() => caches.match('/') || caches.match(request))
  )
})
