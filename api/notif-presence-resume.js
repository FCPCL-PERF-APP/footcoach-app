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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { eventId, eventTitre, coachAuthId } = req.body

  try {
    // Compte les présences pour cet événement
    const { data: presences } = await supabase
      .from('presences')
      .select('statut')
      .eq('evenement_id', eventId)

    const presents = (presences || []).filter(p => p.statut === 'present').length
    const absents = (presences || []).filter(p => p.statut === 'absent').length
    const blesses = (presences || []).filter(p => p.statut === 'blesse').length
    const total = (presences || []).length

    // Notifie le coach
    const { data: coachSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', coachAuthId)

    if (coachSubs?.length) {
      const payload = JSON.stringify({
        title: `📋 Présences — ${eventTitre}`,
        body: `✅ ${presents} présents · ❌ ${absents} absents · 🤕 ${blesses} blessés (${total} réponses)`,
        url: '/calendrier',
        tag: 'presences'
      })
      await Promise.allSettled(
        coachSubs.map(sub => webpush.sendNotification(JSON.parse(sub.subscription), payload))
      )
    }

    res.status(200).json({ success: true, presents, absents, blesses })
  } catch (err) {
    console.error('Erreur notif présences:', err)
    res.status(500).json({ error: err.message })
  }
}
