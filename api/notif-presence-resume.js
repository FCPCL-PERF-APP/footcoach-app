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

  const { eventId } = req.body
  if (!eventId) return res.status(400).json({ error: 'eventId requis' })

  try {
    const { data: event } = await supabase.from('evenements').select('titre').eq('id', eventId).maybeSingle()
    const eventTitre = event?.titre || 'un événement'

    // Compte les présences pour cet événement
    const { data: presences } = await supabase
      .from('presences')
      .select('statut')
      .eq('evenement_id', eventId)

    const presents = (presences || []).filter(p => p.statut === 'present').length
    const absents = (presences || []).filter(p => p.statut === 'absent').length
    const blesses = (presences || []).filter(p => p.statut === 'blesse').length
    const total = (presences || []).length

    // Le destinataire est dérivé côté serveur (tous les coachs/admins du club) plutôt
    // que fourni par le client, pour empêcher qu'un appel direct à cette API ne notifie
    // n'importe quel utilisateur avec un contenu arbitraire.
    const { data: coachs } = await supabase.from('staff').select('auth_id')
      .in('role', ['coach', 'admin']).not('auth_id', 'is', null)
    const coachIds = (coachs || []).map(c => c.auth_id)
    if (coachIds.length) {
      await sendPushToSubscriptions(webpush, supabase, coachIds, {
        title: `📋 Présences — ${eventTitre}`,
        body: `✅ ${presents} présents · ❌ ${absents} absents · 🤕 ${blesses} blessés (${total} réponses)`,
        url: '/calendrier',
        tag: 'presences'
      })
    }

    res.status(200).json({ success: true, presents, absents, blesses })
  } catch (err) {
    console.error('Erreur notif présences:', err)
    res.status(500).json({ error: err.message })
  }
}
