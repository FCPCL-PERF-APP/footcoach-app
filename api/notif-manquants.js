import webpush from 'web-push'
import { adminClient, requireCoach, sendPushToSubscriptions } from './_lib.js'

const supabase = adminClient()

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:contact@fcpcl.fr',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

const MESSAGES = {
  rpe: (eventTitre) => ({
    title: '❤️ RPE à compléter',
    body: `N'oublie pas de remplir ton RPE pour ${eventTitre} !`,
    url: '/mon-rpe',
    tag: 'relance-rpe'
  }),
  footbar: (eventTitre) => ({
    title: '📡 Footbar à compléter',
    body: `N'oublie pas de renseigner ton Footbar pour ${eventTitre} !`,
    url: '/mon-footbar',
    tag: 'relance-footbar'
  }),
  presence: (eventTitre) => ({
    title: '❓ Confirme ta présence',
    body: `Le coach attend ta réponse pour ${eventTitre}.`,
    url: '/calendrier',
    tag: 'relance-presence'
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireCoach(req, supabase)
  if (!user) return res.status(403).json({ error: 'Réservé au coach' })

  const { type, eventTitre, joueurIds } = req.body
  if (!MESSAGES[type] || !joueurIds?.length) {
    return res.status(400).json({ error: 'type et joueurIds requis' })
  }

  try {
    const { data: joueurs } = await supabase
      .from('joueurs').select('auth_id').in('id', joueurIds).not('auth_id', 'is', null)

    const authIds = (joueurs || []).map(j => j.auth_id)
    const result = await sendPushToSubscriptions(webpush, supabase, authIds, MESSAGES[type](eventTitre || ''))

    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('Erreur notif manquants:', err)
    res.status(500).json({ error: err.message })
  }
}
