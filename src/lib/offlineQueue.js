import { supabase } from './supabase'

const STORAGE_KEY = 'fc_offline_queue_v1'
const QUEUE_EVENT = 'fc-offline-queue-changed'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function writeQueue(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // quota dépassé ou storage indisponible (navigation privée) : on ignore
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(QUEUE_EVENT))
}

function isNetworkError(error) {
  if (!error) return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = (error.message || '').toLowerCase()
  return msg.includes('fetch') || msg.includes('network')
}

function enqueueItem(item) {
  const items = readQueue()
  items.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    queuedAt: new Date().toISOString(),
    ...item
  })
  writeQueue(items)
}

export async function upsertOrQueue(table, payload, onConflict) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueItem({ type: 'upsert', table, payload, onConflict })
    return { queued: true }
  }

  try {
    const { error } = await supabase.from(table).upsert(payload, { onConflict })
    if (!error) return { queued: false }
    if (isNetworkError(error)) {
      enqueueItem({ type: 'upsert', table, payload, onConflict })
      return { queued: true }
    }
    throw error
  } catch (err) {
    if (isNetworkError(err)) {
      enqueueItem({ type: 'upsert', table, payload, onConflict })
      return { queued: true }
    }
    throw err
  }
}

// La présence n'a pas de contrainte d'unicité connue permettant un upsert simple (le
// reste du code l'écrit toujours en delete + insert) — la queue reproduit donc la même
// séquence plutôt que de supposer un upsert possible.
export async function savePresenceOrQueue(evenementId, joueurId, statut) {
  const item = { type: 'presence', table: 'presences', evenementId, joueurId, statut }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueueItem(item)
    return { queued: true }
  }

  try {
    const { error: delError } = await supabase.from('presences').delete()
      .eq('evenement_id', evenementId).eq('joueur_id', joueurId)
    if (delError) {
      if (isNetworkError(delError)) { enqueueItem(item); return { queued: true } }
      throw delError
    }
    const { error: insError } = await supabase.from('presences')
      .insert({ evenement_id: evenementId, joueur_id: joueurId, statut })
    if (insError) {
      if (isNetworkError(insError)) { enqueueItem(item); return { queued: true } }
      throw insError
    }
    return { queued: false }
  } catch (err) {
    if (isNetworkError(err)) { enqueueItem(item); return { queued: true } }
    throw err
  }
}

async function flushOne(item) {
  if (item.type === 'presence') {
    const { error: delError } = await supabase.from('presences').delete()
      .eq('evenement_id', item.evenementId).eq('joueur_id', item.joueurId)
    if (delError) return delError
    const { error: insError } = await supabase.from('presences')
      .insert({ evenement_id: item.evenementId, joueur_id: item.joueurId, statut: item.statut })
    return insError
  }
  // Type 'upsert' (ou items déjà en queue avant l'ajout du champ `type`, par défaut upsert)
  const { error } = await supabase.from(item.table).upsert(item.payload, { onConflict: item.onConflict })
  return error
}

export async function flushQueue(table) {
  const items = readQueue()
  const toTry = table ? items.filter(i => i.table === table) : items
  if (!toTry.length) return { flushed: 0, remaining: items.length }

  const remaining = [...items]
  let flushed = 0

  for (const item of toTry) {
    try {
      const error = await flushOne(item)
      const idx = remaining.findIndex(i => i.id === item.id)
      if (!error) {
        if (idx !== -1) remaining.splice(idx, 1)
        flushed++
      } else if (!isNetworkError(error)) {
        // erreur non-réseau (ex. donnée devenue invalide) : on ne la retente pas indéfiniment
        console.error('Échec définitif d\'un élément en attente de synchronisation:', item, error)
        if (idx !== -1) remaining.splice(idx, 1)
      }
      // erreur réseau : on laisse l'item en attente, on retentera au prochain flush
    } catch (err) {
      if (!isNetworkError(err)) {
        console.error('Échec définitif d\'un élément en attente de synchronisation:', item, err)
        const idx = remaining.findIndex(i => i.id === item.id)
        if (idx !== -1) remaining.splice(idx, 1)
      }
    }
  }

  writeQueue(remaining)
  return { flushed, remaining: remaining.length }
}

export function getQueueCount(table) {
  const items = readQueue()
  return table ? items.filter(i => i.table === table).length : items.length
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushQueue() })
}
