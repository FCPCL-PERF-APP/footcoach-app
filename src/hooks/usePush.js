import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function usePush(userId) {
  const [pushSupported, setPushSupported] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  // Détail de la dernière erreur d'activation, affiché par PushToggle — sans ça, un
  // échec silencieux (permission refusée, abonnement corrompu, erreur serveur...) ne
  // laisse qu'un message générique "vérifie les autorisations" impossible à diagnostiquer
  // à distance quand la personne n'a pas accès à la console du navigateur (ex. iPhone).
  const [pushError, setPushError] = useState(null)

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
      if (sub) {
        const currentKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        const subKey = sub.options?.applicationServerKey
        const matches = currentKey && subKey && arraysEqual(new Uint8Array(subKey), urlBase64ToUint8Array(currentKey))
        if (!matches) {
          // La clé VAPID a été régénérée côté serveur : l'abonnement existant est mort
          // (les push échoueront silencieusement). On le remplace directement plutôt que
          // de laisser l'utilisateur croire que les notifications sont actives.
          await sub.unsubscribe()
          await enablePush()
          return
        }
      }
      setPushEnabled(!!sub)
    } catch (err) {
      console.error('Erreur vérification push:', err)
    }
  }

  async function enablePush() {
    if (!pushSupported) return false
    setPushError(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('VAPID public key manquante')
        setPushError('Configuration serveur incomplète (clé VAPID manquante).')
        return false
      }

      // Convertir la clé VAPID
      const keyBytes = urlBase64ToUint8Array(vapidKey)

      // Un abonnement navigateur existant (ex. tentative précédente restée dans un état
      // incohérent) fait échouer subscribe() avec "already subscribed with a different
      // applicationServerKey" même quand la permission iOS est bien accordée — sans
      // rapport avec les réglages de notifications. On repart d'un état propre à chaque
      // activation plutôt que de laisser cette erreur silencieuse bloquer le bouton.
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes
      })

      // Sauvegarder dans Supabase — l'abonnement complet (endpoint + clés) est stocké
      // tel quel dans la colonne jsonb "subscription", cette table n'a jamais eu de
      // colonnes séparées endpoint/p256dh/auth (schéma réel vérifié via
      // information_schema.columns). L'erreur n'était par ailleurs jusqu'ici jamais
      // vérifiée : le bouton affichait "Activées" même quand rien n'était enregistré.
      const subJson = sub.toJSON()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: subJson,
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

      if (error) {
        console.error('Erreur enregistrement abonnement push:', error)
        setPushError(`Erreur serveur : ${error.message}`)
        await sub.unsubscribe()
        return false
      }

      setPushEnabled(true)
      return true
    } catch (err) {
      console.error('Erreur activation push:', err)
      setPushError(err.name === 'NotAllowedError'
        ? 'Permission refusée par le téléphone/navigateur.'
        : `${err.name || 'Erreur'} : ${err.message}`)
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

  return { pushSupported, pushEnabled, pushError, enablePush, disablePush }
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
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
