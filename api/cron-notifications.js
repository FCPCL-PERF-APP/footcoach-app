import webpush from 'web-push'
import { adminClient, sendPushToSubscriptions } from './_lib.js'

const supabase = adminClient()

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
          const r = await sendPushToSubscriptions(webpush, supabase, [joueur.auth_id], {
            title: `❤️ RPE à compléter`,
            body: `${joueur.prenom}, tu as ${manquants} RPE en attente — ça prend 1 minute !`,
            url: '/mon-rpe',
            icon: '/icons/logo.jpg'
          })
          sent += r.sent
        }
      }

      // 3. Rappel Footbar — mêmes joueurs/événements que le rappel RPE ci-dessus
      for (const joueur of (joueurs || [])) {
        const { data: footbars } = await supabase.from('footbar').select('evenement_id')
          .eq('joueur_id', joueur.id).in('evenement_id', eventIds)

        const footbarIds = new Set((footbars || []).map(f => f.evenement_id))
        const manquants = eventIds.filter(id => !footbarIds.has(id)).length

        if (manquants > 0) {
          const r = await sendPushToSubscriptions(webpush, supabase, [joueur.auth_id], {
            title: `📡 Footbar à compléter`,
            body: `${joueur.prenom}, tu as ${manquants} distance(s) en attente — ça prend 1 minute !`,
            url: '/mon-footbar',
            icon: '/icons/logo.jpg'
          })
          sent += r.sent
        }
      }
    }

    // 4. Rappel présence non confirmée — événements des 2 prochains jours (même fenêtre que la section 1)
    if (events?.length) {
      const { data: tousJoueurs } = await supabase.from('joueurs').select('id, auth_id, prenom').not('auth_id', 'is', null)

      for (const ev of events) {
        let candidats
        if (ev.type === 'seance') {
          candidats = tousJoueurs || []
        } else {
          const { data: convocs } = await supabase.from('convocations').select('joueur_id')
            .eq('evenement_id', ev.id).eq('convoque', true)
          const convoqueIds = new Set((convocs || []).map(c => c.joueur_id))
          candidats = (tousJoueurs || []).filter(j => convoqueIds.has(j.id))
        }

        const { data: pres } = await supabase.from('presences').select('joueur_id').eq('evenement_id', ev.id)
        const reponduIds = new Set((pres || []).map(p => p.joueur_id))
        const sansReponse = candidats.filter(j => !reponduIds.has(j.id))

        for (const joueur of sansReponse) {
          const r = await sendPushToSubscriptions(webpush, supabase, [joueur.auth_id], {
            title: `❓ Confirme ta présence`,
            body: `${joueur.prenom}, le coach attend ta réponse pour ${ev.titre} !`,
            url: '/calendrier',
            icon: '/icons/logo.jpg'
          })
          sent += r.sent
        }
      }
    }

    res.status(200).json({ success: true, sent, errors: errors.length })
  } catch (err) {
    console.error('Cron error:', err)
    res.status(500).json({ error: err.message })
  }
}
