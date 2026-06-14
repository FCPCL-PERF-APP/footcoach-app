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

  const { destinataireId, expediteurNom, contenu } = req.body
  if (!destinataireId) return res.status(400).json({ error: 'destinataireId requis' })

  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', destinataireId)

    if (!subs?.length) return res.status(200).json({ sent: 0 })

    const payload = JSON.stringify({
      title: `💬 Message de ${expediteurNom}`,
      body: contenu?.length > 80 ? contenu.slice(0, 80) + '...' : contenu,
      url: '/messages',
      tag: 'message-prive'
    })

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(JSON.parse(sub.subscription), payload))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    res.status(200).json({ success: true, sent })
  } catch (err) {
    console.error('Erreur notif message:', err)
    res.status(500).json({ error: err.message })
  }
}
