// Rapport hebdomadaire automatique — envoyé chaque lundi matin
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

webpush.setVapidDetails(
  'mailto:contact@fcpcl.fr',
  process.env.VITE_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    // RPE semaine écoulée
    const { data: rpeData } = await supabase
      .from('rpe')
      .select('difficulte, fatigue, implication, motivation, perf_individuelle, perf_collective, joueur_id')
      .gte('created_at', since.toISOString())

    const rpeVals = (rpeData || []).map(r => {
      const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
      return items.length ? items.reduce((a,b) => a+b, 0) / items.length : null
    }).filter(v => v !== null)
    const rpeMoy = rpeVals.length ? (rpeVals.reduce((a,b) => a+b, 0) / rpeVals.length).toFixed(1) : null

    // Présences semaine
    const { data: presData } = await supabase
      .from('presences')
      .select('statut, joueur_id')
      .gte('created_at', since.toISOString())
    const presents = (presData || []).filter(p => p.statut === 'present').length
    const total = (presData || []).length
    const tauxPresence = total ? Math.round(presents / total * 100) : null

    // Alertes actives
    const { data: blessures } = await supabase
      .from('blessures')
      .select('joueur_id, zone')
      .is('date_retour_effective', null)

    // Joueurs sans RPE cette semaine
    const { data: joueurs } = await supabase.from('joueurs').select('id, nom')
    const joueursAvecRpe = new Set((rpeData || []).map(r => r.joueur_id))
    const sansRpe = (joueurs || []).filter(j => !joueursAvecRpe.has(j.id)).length

    // Construit le message
    let body = `📊 Semaine écoulée :\n`
    if (rpeMoy) body += `❤️ RPE moyen : ${rpeMoy}/5\n`
    if (tauxPresence) body += `✅ Présence : ${tauxPresence}%\n`
    if (blessures?.length) body += `🤕 ${blessures.length} blessé(s)\n`
    if (sansRpe > 0) body += `⚠️ ${sansRpe} joueur(s) sans RPE\n`

    const rpeNum = parseFloat(rpeMoy)
    const alerte = rpeNum >= 4.2 ? '🔴 Surcharge détectée' :
                   rpeNum >= 3.5 ? '🟠 Charge élevée' :
                   rpeNum < 2.5 ? '🟡 Charge faible' : '🟢 Charge normale'
    body += alerte

    // Récupère les abonnements du coach
    const { data: coachSubs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_role', 'coach')

    const payload = JSON.stringify({
      title: '📋 Rapport hebdomadaire FC PCL',
      body,
      url: '/dashboard',
      tag: 'rapport-hebdo'
    })

    const results = await Promise.allSettled(
      (coachSubs || []).map(sub => webpush.sendNotification(JSON.parse(sub.subscription), payload))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    res.status(200).json({ success: true, sent, rpeMoy, tauxPresence })
  } catch (err) {
    console.error('Erreur rapport hebdo:', err)
    res.status(500).json({ error: err.message })
  }
}
