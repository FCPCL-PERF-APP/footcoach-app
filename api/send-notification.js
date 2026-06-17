import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, title, body, url } = req.body
  if (!userId || !title) return res.status(400).json({ error: 'userId et title requis' })

  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@fcpcl.fr'

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Clés VAPID manquantes' })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (!subs?.length) return res.status(200).json({ sent: 0, message: 'Aucun abonnement' })

    const payload = JSON.stringify({ title, body, url: url || '/', icon: '/icons/logo.jpg' })
    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        ).catch(async err => {
          // Supprimer les subscriptions expirées
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          }
          throw err
        })
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    res.status(200).json({ sent, total: subs.length })
  } catch (err) {
    console.error('Erreur push:', err)
    res.status(500).json({ error: err.message })
  }
}
