// Vercel Cron Job — Notifications automatiques
// S'exécute tous les jours à 8h00
// Configurer dans vercel.json : { "crons": [{ "path": "/api/cron-notifications", "schedule": "0 8 * * *" }] }

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

webpush.setVapidDetails(
  'mailto:contact@fcpcl.fr',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

async function sendPush(subscriptions, title, body, url = '/') {
  const payload = JSON.stringify({ title, body, url, tag: 'fcpcl' })
  const results = await Promise.allSettled(
    subscriptions.map(sub => webpush.sendNotification(JSON.parse(sub.subscription), payload))
  )
  return results.filter(r => r.status === 'fulfilled').length
}

export default async function handler(req, res) {
  // Vérifie que c'est bien Vercel qui appelle
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // Date J+1 et J+2
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const dayAfter = new Date(now)
  dayAfter.setDate(dayAfter.getDate() + 2)
  const dayAfterStr = dayAfter.toISOString().split('T')[0]

  const stats = { rappel_j2: 0, rappel_j1: 0, invitation_rpe: 0 }

  // Récupère tous les abonnements push
  const { data: allSubs } = await supabase.from('push_subscriptions').select('*')
  const joueurSubs = (allSubs || []).filter(s => s.user_role === 'joueur')

  // ============ RAPPEL J-2 ============
  const { data: eventsJ2 } = await supabase
    .from('evenements')
    .select('*')
    .gte('date_heure', `${dayAfterStr}T00:00:00`)
    .lte('date_heure', `${dayAfterStr}T23:59:59`)

  for (const ev of (eventsJ2 || [])) {
    const isMatch = ev.type === 'match'
    const title = isMatch ? `⚽ Match dans 2 jours — ${ev.titre}` : `🏃 Entraînement dans 2 jours`
    const body = `${new Date(ev.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · ${ev.lieu || ''}`
    stats.rappel_j2 += await sendPush(joueurSubs, title, body, '/calendrier')
  }

  // ============ RAPPEL J-1 ============
  const { data: eventsJ1 } = await supabase
    .from('evenements')
    .select('*')
    .gte('date_heure', `${tomorrowStr}T00:00:00`)
    .lte('date_heure', `${tomorrowStr}T23:59:59`)

  for (const ev of (eventsJ1 || [])) {
    const isMatch = ev.type === 'match'
    const heure = new Date(ev.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const rdv = ev.rdv_heure ? ` · RDV ${ev.rdv_heure}` : ''
    const title = isMatch ? `📢 Match demain — ${ev.titre}` : `📢 Entraînement demain`
    const body = `${heure}${rdv} · ${ev.lieu || ''}`
    stats.rappel_j1 += await sendPush(joueurSubs, title, body, '/calendrier')
  }

  // ============ INVITATION RPE (événements d'hier) ============
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data: eventsYesterday } = await supabase
    .from('evenements')
    .select('*')
    .gte('date_heure', `${yesterdayStr}T00:00:00`)
    .lte('date_heure', `${yesterdayStr}T23:59:59`)

  for (const ev of (eventsYesterday || [])) {
    // Trouve les joueurs qui n'ont pas encore rempli leur RPE
    const { data: rpes } = await supabase
      .from('rpe')
      .select('joueur_id')
      .eq('evenement_id', ev.id)
    const rpeJoueurIds = new Set((rpes || []).map(r => r.joueur_id))

    // Récupère les joueurs convoqués sans RPE
    const { data: convocs } = await supabase
      .from('convocations')
      .select('joueur_id, joueurs(auth_id)')
      .eq('evenement_id', ev.id)
      .eq('convoque', true)

    const authIdsManquants = (convocs || [])
      .filter(c => !rpeJoueurIds.has(c.joueur_id) && c.joueurs?.auth_id)
      .map(c => c.joueurs.auth_id)

    const subsManquants = joueurSubs.filter(s => authIdsManquants.includes(s.user_id))

    if (subsManquants.length > 0) {
      const title = `📝 RPE à remplir — ${ev.titre}`
      const body = 'Prends 2 minutes pour évaluer ta séance/match d\'hier'
      stats.invitation_rpe += await sendPush(subsManquants, title, body, '/mon-rpe')
    }
  }

  res.status(200).json({ success: true, date: today, stats })
}
