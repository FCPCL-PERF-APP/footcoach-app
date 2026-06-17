import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function usePush(userId) {
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  useEffect(() => {
    if (!userId) return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window
    setPushSupported(supported)
    if (supported) checkExistingSubscription()
  }, [userId])

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setPushEnabled(!!sub)
    } catch (err) {
      console.error('Erreur vérification push:', err)
    }
  }

  async function enablePush() {
    if (!pushSupported) return false
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('VAPID public key manquante')
        return false
      }

      // Convertir la clé VAPID
      const keyBytes = urlBase64ToUint8Array(vapidKey)

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes
      })

      // Sauvegarder dans Supabase
      const subJson = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: subJson.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

      setPushEnabled(true)
      return true
    } catch (err) {
      console.error('Erreur activation push:', err)
      return false
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('user_id', userId)
      }
      setPushEnabled(false)
    } catch (err) {
      console.error('Erreur désactivation push:', err)
    }
  }

  return { pushSupported, pushEnabled, enablePush, disablePush }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
