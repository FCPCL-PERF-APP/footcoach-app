import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

export function usePushNotifications(user, profile) {
  useEffect(() => {
    if (!user || !profile || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    registerPush(user, profile)
  }, [user, profile])
}

async function registerPush(user, profile) {
  try {
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) return // Déjà abonné

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    // Sauvegarde l'abonnement en base
    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      user_role: profile.role,
      subscription: JSON.stringify(subscription)
    }, { onConflict: 'user_id' })

  } catch (err) {
    console.error('Erreur push:', err)
  }
}

// Envoie une notification locale (sans serveur)
export function sendLocalNotification(title, body, data = {}) {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data,
      vibrate: [100, 50, 100]
    })
  })
}
