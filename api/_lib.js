import { createClient } from '@supabase/supabase-js'

export function adminClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
}

export async function requireUser(req, supabase) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

export async function requireCoach(req, supabase) {
  const user = await requireUser(req, supabase)
  if (!user) return null
  const { data: staffRow } = await supabase
    .from('staff').select('role').eq('auth_id', user.id).maybeSingle()
  return staffRow?.role === 'coach' ? user : null
}
