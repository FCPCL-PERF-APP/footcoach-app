import { adminClient, requireCoach, captureError } from './_lib.js'

const supabase = adminClient()

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const user = await requireCoach(req, supabase)
  if (!user) return res.status(403).json({ error: 'Réservé au coach' })

  const { email, joueurId, nom, prenom } = req.body
  if (!email || !joueurId) return res.status(400).json({ error: 'Email et joueurId requis' })

  try {
    const appUrl = process.env.VITE_APP_URL || 'https://footcoach-fcpcl.vercel.app'

    // Invite via Supabase Auth Admin
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/set-password`,
      data: { joueur_id: joueurId, nom, prenom }
    })

    if (error) {
      // Le compte existe déjà (invitation précédente déjà acceptée, ou ancien bug de
      // redirection qui connectait l'utilisateur sans jamais lui faire créer de mot de
      // passe) : on bascule sur un email de réinitialisation plutôt que de bloquer le coach.
      const alreadyExists = error.code === 'email_exists' || /already registered/i.test(error.message || '')
      if (alreadyExists) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${appUrl}/set-password`
        })
        if (resetError) throw resetError
        return res.status(200).json({ success: true, mode: 'reset' })
      }
      throw error
    }

    // Lie le compte auth au joueur
    if (data?.user?.id) {
      await supabase.from('joueurs')
        .update({ auth_id: data.user.id })
        .eq('id', joueurId)
    }

    res.status(200).json({ success: true, mode: 'invite', userId: data?.user?.id })
  } catch (err) {
    console.error('Erreur invitation:', err)
    captureError(err, { endpoint: 'invite-joueur' })
    res.status(500).json({ error: err.message })
  }
}
