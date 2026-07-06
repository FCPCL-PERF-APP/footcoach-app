import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // Vérifier le secret cron
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@fcpcl.fr'

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Clés VAPID manquantes' })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const now = new Date()
  const aujourd = now.toISOString().split('T')[0]
  const dans1j = new Date(now.getTime() + 24*60*60*1000).toISOString().split('T')[0]
  const dans2j = new Date(now.getTime() + 2*24*60*60*1000).toISOString().split('T')[0]

  let sent = 0
  const errors = []

  try {
    // 1. Rappels événements J-1 et J-2
    const { data: events } = await supabase.from('evenements').select('*')
      .in('date_heure', [`${dans1j}T00:00:00`, `${dans2j}T00:00:00`])
      .gte('date_heure', `${dans1j}T00:00:00`)
      .lte('date_heure', `${dans2j}T23:59:59`)

    if (events?.length) {
      const { data: subs } = await supabase.from('push_subscriptions').select('*')
      for (const ev of events) {
        const dateStr = new Date(ev.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        const isJ1 = ev.date_heure.startsWith(dans1j)
        const title = `${isJ1 ? '⏰ Demain' : '📅 Dans 2 jours'} — ${ev.titre}`
        const body = `${ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · ${dateStr}${ev.lieu ? ` · ${ev.lieu}` : ''}`

        for (const sub of (subs || [])) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({ title, body, url: '/calendrier', icon: '/icons/logo.jpg' })
            )
            sent++
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
            errors.push(err.message)
          }
        }
      }
    }

    // 2. Rappel RPE — joueurs avec événements sans RPE dans les 3 derniers jours
    const il3j = new Date(now.getTime() - 3*24*60*60*1000).toISOString()
    const { data: eventsRecents } = await supabase.from('evenements').select('id')
      .lte('date_heure', now.toISOString())
      .gte('date_heure', il3j)

    if (eventsRecents?.length) {
      const eventIds = eventsRecents.map(e => e.id)
      const { data: joueurs } = await supabase.from('joueurs').select('id, auth_id, prenom').not('auth_id', 'is', null)

      for (const joueur of (joueurs || [])) {
        const { data: rpes } = await supabase.from('rpe').select('evenement_id')
          .eq('joueur_id', joueur.id).in('evenement_id', eventIds)

        const rpeIds = new Set((rpes || []).map(r => r.evenement_id))
        const manquants = eventIds.filter(id => !rpeIds.has(id)).length

        if (manquants > 0) {
          const { data: subs } = await supabase.from('push_subscriptions').select('*')
            .eq('user_id', joueur.auth_id)

          for (const sub of (subs || [])) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                JSON.stringify({
                  title: `❤️ RPE à compléter`,
                  body: `${joueur.prenom}, tu as ${manquants} RPE en attente — ça prend 1 minute !`,
                  url: '/mon-rpe',
                  icon: '/icons/logo.jpg'
                })
              )
              sent++
            } catch (err) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase.from('push_subscriptions').delete().eq('id', sub.id)
              }
              errors.push(err.message)
            }
          }
        }
      }
    }

    res.status(200).json({ success: true, sent, errors: errors.length })
  } catch (err) {
    console.error('Cron error:', err)
    res.status(500).json({ error: err.message })
  }
}
