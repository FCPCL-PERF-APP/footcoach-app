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
  // Une notification doit TOUJOURS être affichée : iOS révoque l'abonnement push d'une
  // PWA après quelques push reçus sans notification visible (payload vide ou illisible
  // ici), ce qui coupait les notifications sans aucun signe côté appli.
  let data
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
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

// Le navigateur a renouvelé/invalidé l'abonnement push : on en recrée un tout de suite
// pour ne pas rester sans abonnement valide. L'enregistrement en base se fait à la
// prochaine ouverture de l'appli (usePush, autoSync) — le service worker n'a pas de
// session Supabase pour écrire lui-même.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const key = event.oldSubscription?.options?.applicationServerKey
      if (!key) return
      await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
    } catch (err) {
      console.error('pushsubscriptionchange:', err)
    }
  })())
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
