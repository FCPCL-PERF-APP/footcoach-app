import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, staffId, nom, prenom, role } = req.body
  if (!email || !staffId) return res.status(400).json({ error: 'Email et staffId requis' })

  try {
    const appUrl = process.env.VITE_APP_URL || 'https://footcoach-fcpcl.vercel.app'

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/set-password`,
      data: { staff_id: staffId, nom, prenom, role }
    })

    if (error) throw error

    // Lie le compte auth au staff
    if (data?.user?.id) {
      await supabase.from('staff').update({ auth_id: data.user.id }).eq('id', staffId)
    }

    res.status(200).json({ success: true, userId: data?.user?.id })
  } catch (err) {
    console.error('Erreur invitation staff:', err)
    res.status(500).json({ error: err.message })
  }
}
