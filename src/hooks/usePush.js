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
    if (!user || !profile || !VAPID_PUBLIC_KEY) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    registerPush(user, profile)
  }, [user, profile])
}

async function registerPush(user, profile) {
  try {
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    if (existing) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      user_role: profile.role || 'joueur',
      subscription: JSON.stringify(subscription)
    }, { onConflict: 'user_id' })

  } catch (err) {
    console.error('Erreur push:', err)
  }
}

// Fonction pour envoyer une notification depuis l'app (coach)
export async function sendPushNotification({ title, body, url = '/', target = 'all' }) {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url, target })
    })
    return await response.json()
  } catch (err) {
    console.error('Erreur envoi notification:', err)
  }
}

// Notifications automatiques selon le type d'événement
export async function notifyEvent(event, type) {
  const messages = {
    creation_match: {
      title: `⚽ Match programmé — ${event.titre}`,
      body: `${new Date(event.date_heure).toLocaleDateString('fr-FR')} · ${event.lieu || ''}`,
      url: '/calendrier'
    },
    rappel_j2: {
      title: `⏰ Rappel — ${event.titre} dans 2 jours`,
      body: `Confirme ta présence dans l'application`,
      url: '/calendrier'
    },
    rappel_j1: {
      title: `📢 ${event.titre} demain !`,
      body: `N'oublie pas : ${new Date(event.date_heure).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}`,
      url: '/calendrier'
    },
    invitation_rpe: {
      title: `📝 RPE à remplir — ${event.titre}`,
      body: `Prends 2 minutes pour évaluer ta séance`,
      url: '/mon-rpe'
    },
    nouveau_message: {
      title: `💬 Nouveau message du coach`,
      body: event.contenu || 'Tu as reçu un nouveau message',
      url: '/messages'
    },
    nouveau_document: {
      title: `📄 Nouveau document disponible`,
      body: event.titre || 'Un document a été partagé',
      url: '/ressources'
    }
  }

  const msg = messages[type]
  if (!msg) return
  return sendPushNotification({ ...msg, target: 'all' })
}
