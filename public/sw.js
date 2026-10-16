// The Book Nook Service Worker for PWA Installation and Asset Caching
const CACHE_NAME = 'book-nook-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key)
        })
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Let Supabase Auth and Storage signed URLs stream directly without interception
  if (
    event.request.url.includes('supabase.co') ||
    event.request.method !== 'GET'
  ) {
    return
  }

  // Network-first strategy for app shell
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
