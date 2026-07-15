import webpush from 'web-push'
import { adminClient, sendPushToSubscriptions, captureError } from './_lib.js'

const supabase = adminClient()

// Joueurs concernés par un événement : tous pour une séance, seulement les convoqués
// pour un match. Partagé entre le rappel J-1/J-2 et le rappel de présence non confirmée.
async function getCandidats(ev, tousJoueurs) {
  if (ev.type === 'seance') return tousJoueurs
  const { data: convocs } = await supabase.from('convocations').select('joueur_id')
    .eq('evenement_id', ev.id).eq('convoque', true)
  const convoqueIds = new Set((convocs || []).map(c => c.joueur_id))
  return tousJoueurs.filter(j => convoqueIds.has(j.id))
}

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
  const dans1j = new Date(now.getTime() + 24*60*60*1000).toISOString().split('T')[0]
  const dans2j = new Date(now.getTime() + 2*24*60*60*1000).toISOString().split('T')[0]

  let sent = 0

  try {
    // 1. Rappels événements J-1 et J-2 — uniquement au staff et aux joueurs concernés
    // (convoqués pour un match, tous pour une séance), pas à tous les abonnés du club.
    const { data: events } = await supabase.from('evenements').select('*')
      .gte('date_heure', `${dans1j}T00:00:00`)
      .lte('date_heure', `${dans2j}T23:59:59`)

    const { data: tousJoueurs } = await supabase.from('joueurs').select('id, auth_id, prenom').not('auth_id', 'is', null)
    const { data: staffRows } = await supabase.from('staff').select('auth_id').not('auth_id', 'is', null)
    const staffIds = (staffRows || []).map(s => s.auth_id)

    if (events?.length) {
      for (const ev of events) {
        const dateStr = new Date(ev.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        const isJ1 = ev.date_heure.startsWith(dans1j)
        const title = `${isJ1 ? '⏰ Demain' : '📅 Dans 2 jours'} — ${ev.titre}`
        const body = `${ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · ${dateStr}${ev.lieu ? ` · ${ev.lieu}` : ''}`

        const candidats = await getCandidats(ev, tousJoueurs || [])
        const destinataires = [...staffIds, ...candidats.map(j => j.auth_id)]

        const r = await sendPushToSubscriptions(webpush, supabase, destinataires, {
          title, body, url: '/calendrier', icon: '/icons/logo.jpg', tag: 'event-rappel'
        })
        sent += r.sent
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
            url: '/mon-suivi',
            icon: '/icons/logo.jpg',
            tag: 'rpe-rappel'
          })
          sent += r.sent
        }
      }
      // Le Footbar est facultatif (capteur pas toujours dispo, club amateur) : pas de
      // relance automatique dédiée, contrairement au RPE ci-dessus.
    }

    // 4. Rappel présence non confirmée — événements des 2 prochains jours (même fenêtre que la section 1)
    if (events?.length) {
      for (const ev of events) {
        const candidats = await getCandidats(ev, tousJoueurs || [])

        const { data: pres } = await supabase.from('presences').select('joueur_id').eq('evenement_id', ev.id)
        const reponduIds = new Set((pres || []).map(p => p.joueur_id))
        const sansReponse = candidats.filter(j => !reponduIds.has(j.id))

        for (const joueur of sansReponse) {
          const r = await sendPushToSubscriptions(webpush, supabase, [joueur.auth_id], {
            title: `❓ Confirme ta présence`,
            body: `${joueur.prenom}, le coach attend ta réponse pour ${ev.titre} !`,
            url: '/calendrier',
            icon: '/icons/logo.jpg',
            tag: 'presence-rappel'
          })
          sent += r.sent
        }
      }
    }

    res.status(200).json({ success: true, sent })
  } catch (err) {
    console.error('Cron error:', err)
    captureError(err, { endpoint: 'cron-notifications' })
    res.status(500).json({ error: err.message })
  }
}
