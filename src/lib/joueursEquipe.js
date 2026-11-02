import { supabase } from './supabase'

// Lecture de la liste « effectif » vue par TOUS les comptes (joueurs compris) : noms,
// poste, numéro, photo — jamais e-mail, date de naissance, etc. La table `joueurs` elle-même
// n'est plus lisible que par le staff et par le joueur concerné (cf. supabase-rls-joueurs.sql) ;
// la vue `joueurs_equipe` expose uniquement ces champs publics. Repli sur `joueurs` si la
// vue n'existe pas encore (migration pas encore lancée) pour ne rien casser entre-temps.
export async function queryEquipe(columns, { archive = false } = {}) {
  const build = table => {
    let q = supabase.from(table).select(columns).order('nom')
    if (archive !== null) q = q.eq('archive', archive)
    return q
  }
  const res = await build('joueurs_equipe')
  if (!res.error) return res
  return build('joueurs')
}

// { id → { id, nom, prenom } } pour rattacher les noms à des lignes (convocations,
// présences, pronostics...) sans passer par un join `joueurs(...)`, bloqué pour les
// autres joueurs par la protection de la table.
export async function equipeParId() {
  const { data } = await queryEquipe('id, nom, prenom', { archive: null })
  return Object.fromEntries((data || []).map(j => [j.id, j]))
}

export async function avecJoueurs(rows) {
  const map = await equipeParId()
  return (rows || []).map(r => ({ ...r, joueurs: map[r.joueur_id] || null }))
}
