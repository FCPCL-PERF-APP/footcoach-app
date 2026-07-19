import webpush from 'web-push'
import { adminClient, requireUser, sendPushToSubscriptions, captureError } from './_lib.js'

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

  const { contenu } = req.body
  if (!contenu) return res.status(400).json({ error: 'contenu requis' })

  try {
    // Le nom de l'expéditeur est dérivé côté serveur depuis l'utilisateur authentifié
    // (jamais depuis le corps de la requête), même logique que notif-message-prive.js.
    let expediteurNom = 'Un membre du club'
    const { data: joueur } = await supabase.from('joueurs').select('nom, prenom').eq('auth_id', user.id).maybeSingle()
    if (joueur) {
      expediteurNom = `${joueur.prenom} ${joueur.nom}`.trim()
    } else {
      const { data: staffRow } = await supabase.from('staff').select('nom, prenom').eq('auth_id', user.id).maybeSingle()
      if (staffRow) expediteurNom = `${staffRow.prenom} ${staffRow.nom}`.trim()
    }

    // Tout le monde (joueurs + staff) sauf l'expéditeur lui-même — le destinataire n'est
    // jamais fourni par le client, pour empêcher qu'un appel direct à cette API ne
    // notifie n'importe qui avec un contenu arbitraire.
    const [{ data: joueurs }, { data: staff }] = await Promise.all([
      supabase.from('joueurs').select('auth_id').not('auth_id', 'is', null),
      supabase.from('staff').select('auth_id').not('auth_id', 'is', null),
    ])
    const destinataireIds = [...(joueurs || []), ...(staff || [])]
      .map(r => r.auth_id)
      .filter(id => id && id !== user.id)

    const result = await sendPushToSubscriptions(webpush, supabase, destinataireIds, {
      title: `💬 ${expediteurNom} — Canal groupe`,
      body: contenu.length > 80 ? contenu.slice(0, 80) + '...' : contenu,
      url: '/messages',
      tag: 'message-groupe'
    })

    res.status(200).json({ success: true, ...result })
  } catch (err) {
    console.error('Erreur notif message groupe:', err)
    captureError(err, { endpoint: 'notif-message-groupe' })
    res.status(500).json({ error: err.message })
  }
}
