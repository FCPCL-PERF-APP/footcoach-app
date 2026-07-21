import { adminClient, requireUser, captureError } from './_lib.js'

const supabase = adminClient()

// Met à jour last_seen (staff ou joueur) côté serveur, avec le client admin — la mise
// à jour directe depuis le navigateur (RLS "staff_update_coach_only") ne fonctionne
// que si l'utilisateur est déjà coach, donc un adjoint/éducateur/préparateur qui se
// connecte ne peut pas mettre à jour sa propre ligne : sa dernière connexion réelle
// n'était jamais enregistrée, malgré une utilisation normale de l'appli.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireUser(req, supabase)
  if (!user) return res.status(401).json({ error: 'Authentification requise' })

  try {
    const now = new Date().toISOString()

    const { data: staffRow } = await supabase.from('staff').select('id').eq('auth_id', user.id).maybeSingle()
    if (staffRow) {
      await supabase.from('staff').update({ last_seen: now }).eq('id', staffRow.id)
      return res.status(200).json({ success: true, type: 'staff' })
    }

    const { data: joueurRow } = await supabase.from('joueurs').select('id').eq('auth_id', user.id).maybeSingle()
    if (joueurRow) {
      await supabase.from('joueurs').update({ last_seen: now }).eq('id', joueurRow.id)
      return res.status(200).json({ success: true, type: 'joueur' })
    }

    res.status(200).json({ success: true, type: 'unknown' })
  } catch (err) {
    console.error('Erreur touch-last-seen:', err)
    captureError(err, { endpoint: 'touch-last-seen' })
    res.status(500).json({ error: err.message })
  }
}
