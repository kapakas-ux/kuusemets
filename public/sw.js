// Minimal app-shell service worker for the Kuusemets PWA prototype.
// Caches same-origin app assets only; map/geodata services and vector tiles stay network-only.
const CACHE = 'kuusemets-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Never intercept third-party map / data services.
  if (url.origin !== self.location.origin) return
  // Never cache the (large, frequently updated) vector tiles or the density grid.
  if (url.pathname.includes('/tiles/') || url.pathname.endsWith('.pbf') || url.pathname.endsWith('overview.geojson')) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res.ok && res.type === 'basic') cache.put(req, res.clone())
        return res
      } catch (err) {
        return cached || Response.error()
      }
    }),
  )
})
