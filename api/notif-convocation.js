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

  const { eventId, eventTitre, eventDate, rdvHeure, rdvLieu, joueurIds } = req.body
  if (!eventId || !joueurIds?.length) return res.status(400).json({ error: 'Paramètres manquants' })

  try {
    // Récupère les auth_id des joueurs convoqués
    const { data: joueurs } = await supabase
      .from('joueurs')
      .select('auth_id, nom, prenom')
      .in('id', joueurIds)
      .not('auth_id', 'is', null)

    const authIds = (joueurs || []).map(j => j.auth_id)

    // Récupère les abonnements push de ces joueurs
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', authIds)

    if (!subs?.length) return res.status(200).json({ sent: 0, message: 'Aucun abonnement push trouvé' })

    const rdvStr = rdvHeure ? ` · RDV ${rdvHeure}${rdvLieu ? ` à ${rdvLieu}` : ''}` : ''
    const payload = JSON.stringify({
      title: `📢 Convocation — ${eventTitre}`,
      body: `${eventDate}${rdvStr}. Confirme ta présence dans l'app.`,
      url: '/calendrier',
      tag: 'convocation'
    })

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(JSON.parse(sub.subscription), payload))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    res.status(200).json({ success: true, sent, total: subs.length })
  } catch (err) {
    console.error('Erreur notif convocation:', err)
    res.status(500).json({ error: err.message })
  }
}
