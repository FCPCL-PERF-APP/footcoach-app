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

// presences a désormais une contrainte d'unicité (evenement_id, joueur_id) — cf.
// supabase-offline-upsert-motif.sql — donc un simple upsert suffit, plus besoin du
// delete-puis-insert (ou insert-puis-nettoyage) utilisé avant que cette contrainte
// n'existe.
export async function savePresenceOrQueue(evenementId, joueurId, statut, motif) {
  return upsertOrQueue('presences',
    { evenement_id: evenementId, joueur_id: joueurId, statut, motif: motif || null },
    'evenement_id,joueur_id')
}

async function flushOne(item) {
  if (item.type === 'presence') {
    // Items en attente depuis avant le passage à l'upsert générique (compat ascendante).
    const { error } = await supabase.from('presences')
      .upsert({ evenement_id: item.evenementId, joueur_id: item.joueurId, statut: item.statut, motif: item.motif || null }, { onConflict: 'evenement_id,joueur_id' })
    return error
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
