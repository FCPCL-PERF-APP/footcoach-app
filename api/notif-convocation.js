import webpush from 'web-push'
import { adminClient, requireCoach, sendPushToSubscriptions, captureError } from './_lib.js'

const supabase = adminClient()

webpush.setVapidDetails(
  'mailto:contact@fcpcl.fr',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireCoach(req, supabase)
  if (!user) return res.status(403).json({ error: 'Réservé au coach' })

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

    const rdvStr = rdvHeure ? ` · RDV ${rdvHeure}${rdvLieu ? ` à ${rdvLieu}` : ''}` : ''
    const result = await sendPushToSubscriptions(webpush, supabase, authIds, {
      title: `📢 Convocation — ${eventTitre}`,
      body: `${eventDate}${rdvStr}. Confirme ta présence dans l'app.`,
      url: '/calendrier',
      tag: 'convocation'
    })

    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('Erreur notif convocation:', err)
    captureError(err, { endpoint: 'notif-convocation' })
    res.status(500).json({ error: err.message })
  }
}
