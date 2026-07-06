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

export async function sendPushToSubscriptions(webpush, supabase, authIds, payload) {
  if (!authIds?.length) return { sent: 0 }
  const { data: subs } = await supabase
    .from('push_subscriptions').select('*').in('user_id', authIds)

  let sent = 0
  for (const sub of (subs || [])) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      sent++
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
  return { sent, total: subs?.length || 0 }
}
