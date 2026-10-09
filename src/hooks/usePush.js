import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Marqueur local "ce téléphone doit rester abonné aux notifications" : posé à
// l'activation, retiré à la désactivation volontaire. Sert à savoir si on peut ré-abonner
// silencieusement l'appareil quand son abonnement a disparu (expiré/renouvelé par le
// navigateur ou supprimé côté serveur après une erreur 410) sans réactiver quelqu'un qui
// a volontairement coupé les notifications.
const WANTED_KEY = 'fc-push-wanted'
// Délai minimum entre deux resynchronisations déclenchées par le retour au premier plan.
const RESYNC_MIN_MS = 30 * 60 * 1000

function isWanted() {
  try { return localStorage.getItem(WANTED_KEY) === '1' } catch { return false }
}
function setWanted(v) {
  try { v ? localStorage.setItem(WANTED_KEY, '1') : localStorage.removeItem(WANTED_KEY) } catch { /* stockage indisponible */ }
}

// Enregistre l'abonnement de CET appareil. Un utilisateur peut avoir plusieurs appareils
// (iPhone + iPad...) : l'identifiant d'une ligne est l'endpoint, plus le user_id — avec
// un seul abonnement par utilisateur, activer les notifications sur un appareil écrasait
// celui des autres, qui cessaient alors de recevoir quoi que ce soit sans que rien ne
// l'indique à l'écran. Si la migration multi-appareils n'est pas encore appliquée
// (colonne endpoint absente), repli sur l'ancien fonctionnement (un seul par user).
async function saveSubscription(userId, sub) {
  const subJson = sub.toJSON()
  const row = { user_id: userId, endpoint: subJson.endpoint, subscription: subJson, created_at: new Date().toISOString() }
  let { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
  if (error) {
    const { endpoint: _endpoint, ...legacy } = row
    ;({ error } = await supabase.from('push_subscriptions').upsert(legacy, { onConflict: 'user_id' }))
  }
  return error
}

export function usePush(userId, { autoSync = false } = {}) {
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
    if (!supported) return

    let lastSync = 0
    async function sync() {
      lastSync = Date.now()
      await checkExistingSubscription()
    }
    sync()

    // Une PWA iOS reste souvent en arrière-plan des jours sans être rechargée : sans
    // resynchronisation au retour au premier plan, un abonnement expiré n'était jamais
    // détecté tant que l'appli n'était pas fermée puis rouverte.
    function onVisible() {
      if (autoSync && document.visibilityState === 'visible' && Date.now() - lastSync > RESYNC_MIN_MS) sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])

  // Abonne l'appareil (sans dépendre de l'état React `pushSupported`, qui vaut encore
  // false au premier rendu) et enregistre l'abonnement. Retourne { sub } ou { error }.
  async function subscribeAndSave(reg) {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('VAPID public key manquante')
      return { error: 'Configuration serveur incomplète (clé VAPID manquante).' }
    }

    // Un abonnement navigateur existant (ex. tentative précédente restée dans un état
    // incohérent) fait échouer subscribe() avec "already subscribed with a different
    // applicationServerKey" même quand la permission iOS est bien accordée — sans
    // rapport avec les réglages de notifications. On repart d'un état propre à chaque
    // activation plutôt que de laisser cette erreur silencieuse bloquer le bouton.
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      const oldEndpoint = existing.endpoint
      await existing.unsubscribe()
      await supabase.from('push_subscriptions').delete().eq('endpoint', oldEndpoint)
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    })

    // Sauvegarder dans Supabase — l'abonnement complet (endpoint + clés) est stocké
    // tel quel dans la colonne jsonb "subscription". L'erreur est vérifiée : le bouton
    // ne doit jamais afficher "Activées" quand rien n'est enregistré.
    const error = await saveSubscription(userId, sub)
    if (error) {
      console.error('Erreur enregistrement abonnement push:', error)
      await sub.unsubscribe()
      return { error: `Erreur serveur : ${error.message}` }
    }
    return { sub }
  }

  async function checkExistingSubscription() {
    try {
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()

      if (sub) {
        const currentKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
        const subKey = sub.options?.applicationServerKey
        const matches = currentKey && subKey && arraysEqual(new Uint8Array(subKey), urlBase64ToUint8Array(currentKey))
        if (!matches) {
          // La clé VAPID a été régénérée côté serveur : l'abonnement existant est mort
          // (les push échoueront silencieusement). On le remplace directement plutôt que
          // de laisser l'utilisateur croire que les notifications sont actives.
          if (autoSync || isWanted()) {
            const res = await subscribeAndSave(reg)
            sub = res.sub || null
          } else {
            await sub.unsubscribe()
            sub = null
          }
        } else if (autoSync) {
          // Remet la ligne en base à chaque ouverture : le serveur supprime un abonnement
          // dès qu'un envoi échoue en 404/410, et avant, l'appareil restait affiché
          // "Activées" alors que plus rien n'était enregistré pour lui.
          const error = await saveSubscription(userId, sub)
          if (error) console.error('Erreur resynchronisation abonnement push:', error)
        }
      } else if (autoSync && isWanted() && 'Notification' in window && Notification.permission === 'granted') {
        // Abonnement disparu (renouvelé/expiré côté navigateur) alors que les
        // notifications avaient été activées et que la permission est toujours accordée :
        // on se réabonne sans rien demander — c'était la cause des notifications qui
        // "se désactivaient" toutes seules jusqu'à une réactivation manuelle.
        const res = await subscribeAndSave(reg)
        sub = res.sub || null
      }

      if (sub) setWanted(true)
      setPushEnabled(!!sub)
    } catch (err) {
      console.error('Erreur vérification push:', err)
    }
  }

  // Retourne { ok: true } ou { ok: false, error } — le motif est renvoyé directement
  // plutôt que lu dans l'état `pushError`, qui n'est pas encore à jour au moment où
  // PushToggle affiche son message (d'où l'ancien message générique inutilisable).
  async function enablePush() {
    if (!pushSupported) return { ok: false, error: 'Notifications non supportées ici.' }
    setPushError(null)
    try {
      if ('Notification' in window && Notification.permission === 'denied') {
        const error = 'Notifications bloquées pour cette appli : Réglages iPhone > Notifications > (nom de l\'appli) > Autoriser, puis réessaie.'
        setPushError(error)
        return { ok: false, error }
      }
      const reg = await navigator.serviceWorker.ready
      const res = await subscribeAndSave(reg)
      if (res.error) {
        setPushError(res.error)
        return { ok: false, error: res.error }
      }
      setWanted(true)
      setPushEnabled(true)
      return { ok: true }
    } catch (err) {
      console.error('Erreur activation push:', err)
      const error = err.name === 'NotAllowedError'
        ? 'Permission refusée par le téléphone/navigateur.'
        : `${err.name || 'Erreur'} : ${err.message}`
      setPushError(error)
      return { ok: false, error }
    }
  }

  async function disablePush() {
    try {
      setWanted(false)
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const endpoint = sub.endpoint
        await sub.unsubscribe()
        // Seulement CET appareil : les autres appareils du même compte gardent leurs
        // notifications. Ancien schéma (pas de colonne endpoint) : repli sur le user_id.
        const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
        if (error) await supabase.from('push_subscriptions').delete().eq('user_id', userId)
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
