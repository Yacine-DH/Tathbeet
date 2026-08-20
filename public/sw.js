/*
 * Offline cache.
 *
 * Navigations (the HTML page) are network-first so a new deploy shows up on
 * the very next open; the cached copy is only the offline fallback. Hashed
 * assets and the Qur'an data are cache-first — their names change when their
 * content does, so a cache hit is always correct.
 */
const CACHE = 'tathbit-v2'
const PRECACHE = ['./', './index.html', './manifest.webmanifest', './fonts/amiri-quran.woff2']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return

  // The app shell: fresh when online, cached when not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('./index.html'))),
    )
    return
  }

  // Everything else: cache-first with background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
