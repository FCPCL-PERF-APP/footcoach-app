import webpush from 'web-push'
import { adminClient, sendPushToSubscriptions } from './_lib.js'

const supabase = adminClient()

// Durée estimée par type d'événement (aucune durée réelle n'est stockée en base)
const DUREE_MIN = { match: 120, seance: 90 }
const DELAI_APRES_MIN = 30

export default async function handler(req, res) {
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const vapidPublic = process.env.VITE_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:contact@fcpcl.fr'
  if (!vapidPublic || !vapidPrivate) return res.status(500).json({ error: 'Clés VAPID manquantes' })
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const now = new Date()
  let sent = 0

  try {
    // Fenêtre large (48h) : le cron GitHub Actions gratuit peut sauter des créneaux
    // (parfois plusieurs heures d'écart au lieu des 15 min prévues). On ne borne donc
    // plus la relance à une fenêtre stricte après l'horaire cible — la déduplication
    // se fait naturellement plus bas via l'absence de RPE/Footbar déjà rempli, donc
    // élargir la recherche ne cause aucun envoi en double.
    const il48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const { data: events } = await supabase.from('evenements').select('*')
      .lte('date_heure', now.toISOString())
      .gte('date_heure', il48h)

    const aRelancer = (events || []).filter(ev => {
      const duree = DUREE_MIN[ev.type] || 90
      const cible = new Date(ev.date_heure).getTime() + (duree + DELAI_APRES_MIN) * 60 * 1000
      return now.getTime() >= cible
    })

    if (aRelancer.length) {
      const { data: joueurs } = await supabase.from('joueurs').select('id, auth_id, prenom').not('auth_id', 'is', null)

      for (const ev of aRelancer) {
        const { data: pres } = await supabase.from('presences').select('joueur_id, statut').eq('evenement_id', ev.id)
        const presMap = {}
        for (const p of (pres || [])) presMap[p.joueur_id] = p.statut
        const eligibles = (joueurs || []).filter(j => presMap[j.id] !== 'absent' && presMap[j.id] !== 'blesse')

        const { data: rpes } = await supabase.from('rpe').select('joueur_id').eq('evenement_id', ev.id)
        const rpeIds = new Set((rpes || []).map(r => r.joueur_id))
        const { data: footbars } = await supabase.from('footbar').select('joueur_id').eq('evenement_id', ev.id)
        const footbarIds = new Set((footbars || []).map(f => f.joueur_id))

        for (const joueur of eligibles) {
          if (!rpeIds.has(joueur.id)) {
            const r = await sendPushToSubscriptions(webpush, supabase, [joueur.auth_id], {
              title: '❤️ RPE à compléter',
              body: `${joueur.prenom}, comment s'est passé(e) ${ev.titre} ? Remplis ton RPE.`,
              url: '/mon-rpe',
              icon: '/icons/logo.jpg',
              tag: 'rpe-rappel'
            })
            sent += r.sent
          }
          if (!footbarIds.has(joueur.id)) {
            const r = await sendPushToSubscriptions(webpush, supabase, [joueur.auth_id], {
              title: '📡 Footbar à compléter',
              body: `${joueur.prenom}, renseigne ton Footbar pour ${ev.titre}.`,
              url: '/mon-footbar',
              icon: '/icons/logo.jpg',
              tag: 'footbar-rappel'
            })
            sent += r.sent
          }
        }
      }
    }

    res.status(200).json({ success: true, sent, events: aRelancer.length })
  } catch (err) {
    console.error('Cron relance error:', err)
    res.status(500).json({ error: err.message })
  }
}
