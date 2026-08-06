import webpush from 'web-push'
import { adminClient, requireCoach, sendPushToSubscriptions, captureError } from './_lib.js'

const supabase = adminClient()

webpush.setVapidDetails(
  'mailto:contact@fcpcl.fr',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

// Notifie tout le monde (joueurs + staff, sauf l'auteur) qu'un événement vient d'être
// créé ou déplacé — jusqu'ici, créer/modifier un match ou une séance dans l'Agenda
// n'envoyait strictement aucune notification (seuls les rappels automatiques J-1/J-2
// existaient), donc un événement ajouté ou reprogrammé pouvait passer totalement
// inaperçu jusqu'à la veille.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireCoach(req, supabase)
  if (!user) return res.status(403).json({ error: 'Réservé au coach' })

  const { titre, dateStr, reschedule } = req.body
  if (!titre || !dateStr) return res.status(400).json({ error: 'titre et dateStr requis' })

  try {
    const [{ data: joueurs }, { data: staff }] = await Promise.all([
      supabase.from('joueurs').select('auth_id').not('auth_id', 'is', null),
      supabase.from('staff').select('auth_id').not('auth_id', 'is', null),
    ])
    const destinataireIds = [...(joueurs || []), ...(staff || [])]
      .map(r => r.auth_id).filter(id => id && id !== user.id)

    const result = await sendPushToSubscriptions(webpush, supabase, destinataireIds, {
      title: reschedule ? `🔄 Événement déplacé — ${titre}` : `📅 Nouvel événement — ${titre}`,
      body: reschedule ? `Nouvelle date : ${dateStr}` : dateStr,
      url: '/calendrier',
      tag: 'evenement-cree'
    })

    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('Erreur notif événement:', err)
    captureError(err, { endpoint: 'notif-evenement' })
    res.status(500).json({ error: err.message })
  }
}
