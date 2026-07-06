import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

self.skipWaiting()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

registerRoute(
  /^https:\/\/.*\.supabase\.co\/.*/i,
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 300 })]
  }),
  'GET'
)

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

// Notification push reçue
self.addEventListener('push', event => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title || 'FootCoach App', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.url || '/',
      vibrate: [100, 50, 100],
      tag: data.tag || 'footcoach',
      renotify: true
    })
  )
})

// Clic sur une notification
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
