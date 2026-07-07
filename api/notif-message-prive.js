import webpush from 'web-push'
import { adminClient, requireUser, sendPushToSubscriptions } from './_lib.js'

const supabase = adminClient()

webpush.setVapidDetails(
  'mailto:contact@fcpcl.fr',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Authentification requise' })

  const { destinataireId, expediteurNom, contenu } = req.body
  if (!destinataireId) return res.status(400).json({ error: 'destinataireId requis' })

  try {
    const result = await sendPushToSubscriptions(webpush, supabase, [destinataireId], {
      title: `💬 Message de ${expediteurNom}`,
      body: contenu?.length > 80 ? contenu.slice(0, 80) + '...' : contenu,
      url: '/messages',
      tag: 'message-prive'
    })

    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('Erreur notif message:', err)
    res.status(500).json({ error: err.message })
  }
}
