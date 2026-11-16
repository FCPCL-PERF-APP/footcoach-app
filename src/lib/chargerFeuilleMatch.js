// Charge tout ce qu'il faut pour la Feuille de match d'un événement (une requête par table).
import { supabase } from './supabase'
import { joueursDuMatch, etapesFeuille } from './feuilleMatch'

export async function chargerFeuilleMatch(evenementId) {
  const [ev, jrs, conv, pres, rap, sc, notes, rpe, foot, si] = await Promise.all([
    supabase.from('evenements').select('*').eq('id', evenementId).single(),
    supabase.from('joueurs').select('id, nom, prenom, poste, archive').order('nom'),
    supabase.from('convocations').select('joueur_id').eq('evenement_id', evenementId).eq('convoque', true),
    supabase.from('presences').select('joueur_id, statut').eq('evenement_id', evenementId),
    supabase.from('rapports_match').select('compo_visuelle, banc, chronologie, points_forts_globaux, points_faibles_globaux, notes_libres, recap_mi_temps').eq('evenement_id', evenementId).maybeSingle(),
    supabase.from('stats_collectives').select('*').eq('evenement_id', evenementId).maybeSingle(),
    supabase.from('rpe_coach').select('*').eq('evenement_id', evenementId),
    supabase.from('rpe').select('joueur_id').eq('evenement_id', evenementId),
    supabase.from('footbar').select('joueur_id').eq('evenement_id', evenementId),
    supabase.from('stats_match').select('joueur_id').eq('evenement_id', evenementId),
  ])
  const erreur = [ev, jrs, conv, pres, sc, notes, rpe, foot, si].find(r => r.error)?.error
  if (erreur) return { erreur: erreur.message }

  const convoques = new Set((conv.data || []).map(c => c.joueur_id))
  const absents = new Set((pres.data || []).filter(p => p.statut === 'absent' || p.statut === 'blesse').map(p => p.joueur_id))
  const rapport = rap.data || null
  const cibles = joueursDuMatch({ joueurs: jrs.data || [], convoques, absents, compo: rapport?.compo_visuelle, banc: rapport?.banc })
  const rpeIds = new Set((rpe.data || []).map(r => r.joueur_id))
  const avancement = etapesFeuille({
    nbConvoques: convoques.size, rapport, score: sc.data, cibles, notes: notes.data || [],
    rpeIds, footIds: new Set((foot.data || []).map(f => f.joueur_id)), nbStatsIndiv: (si.data || []).length,
  })
  return { event: ev.data, cibles, rapport, score: sc.data, notes: notes.data || [], rpeIds, ...avancement }
}

// Dernier match joué (dans les 7 jours) dont la feuille n'est pas complète — pour l'accueil staff.
export async function dernierMatchACompleter() {
  const maintenant = new Date()
  const ilYa7j = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000)
  const { data } = await supabase.from('evenements').select('id')
    .eq('type', 'match').lte('date_heure', maintenant.toISOString()).gte('date_heure', ilYa7j.toISOString())
    .order('date_heure', { ascending: false }).limit(1)
  if (!data?.length) return null
  const f = await chargerFeuilleMatch(data[0].id)
  if (f.erreur || f.faites >= f.total) return null
  return f
}
