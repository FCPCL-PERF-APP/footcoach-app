// Vercel Serverless Function — Envoi notifications push
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

  const { title, body, url = '/', target } = req.body
  // target: 'all' | 'joueurs' | 'staff' | userId

  try {
    // Récupère les abonnements depuis Supabase
    let query = supabase.from('push_subscriptions').select('*')
    if (target && target !== 'all') {
      if (['coach','adjoint','gardien'].includes(target)) {
        query = query.eq('user_role', target)
      } else {
        query = query.eq('user_id', target)
      }
    }
    const { data: subscriptions } = await query

    const payload = JSON.stringify({ title, body, url, tag: 'fcpcl' })
    const results = await Promise.allSettled(
      (subscriptions || []).map(sub =>
        webpush.sendNotification(JSON.parse(sub.subscription), payload)
      )
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    res.status(200).json({ sent, failed })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
