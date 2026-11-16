// Attribution des points des pronostics (Fun & Jeux) une fois le score d'un match connu :
// 3 points pour le score exact, 1 point pour la bonne tendance. Retourne le nombre d'échecs.
import { supabase } from './supabase'

export function pointsPronostic(prono, scoreDom, scoreExt) {
  if (prono.score_domicile === scoreDom && prono.score_exterieur === scoreExt) return 3
  const t = (a, b) => (a > b ? 'V' : a < b ? 'D' : 'N')
  return t(prono.score_domicile, prono.score_exterieur) === t(scoreDom, scoreExt) ? 1 : 0
}

export async function noterPronostics(evenementId, domicile, butsMarques, butsEncaisses) {
  const { data: pronos } = await supabase.from('pronostics').select('*').eq('evenement_id', evenementId)
  if (!pronos?.length) return 0
  // score_domicile/score_exterieur = équipe qui reçoit / qui se déplace (au sens propre).
  const dom = domicile !== false ? butsMarques : butsEncaisses
  const ext = domicile !== false ? butsEncaisses : butsMarques
  let echecs = 0
  for (const prono of pronos) {
    const { error } = await supabase.from('pronostics').update({ score_points: pointsPronostic(prono, dom, ext) }).eq('id', prono.id)
    if (error) echecs++
  }
  return echecs
}
