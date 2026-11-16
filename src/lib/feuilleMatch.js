// Feuille de match : étapes de saisie d'un match et leur avancement (calculs purs).

export const CRITERES_COACH = [
  { key: 'perf_individuelle', label: 'Performance' },
  { key: 'investissement', label: 'Investissement' },
  { key: 'consignes', label: 'Consignes' },
  { key: 'qualite_technique', label: 'Technique' },
]

// Note /10 de stats_match : moyenne des critères détaillés s'il y en a (×2, échelle 0-5),
// sinon la note rapide (1-5, ×2). null si rien n'est saisi.
export function noteSur10(rc) {
  if (!rc) return null
  const vals = CRITERES_COACH.map(c => rc[c.key]).filter(v => v != null)
  if (vals.length) return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 2 * 10) / 10
  return rc.note_globale != null ? rc.note_globale * 2 : null
}

// Joueurs concernés par le match : convoqués, moins les absents/blessés. Sans
// convocation saisie, les joueurs placés dans la compo ou sur le banc.
export function joueursDuMatch({ joueurs = [], convoques = null, absents = new Set(), compo = {}, banc = [] }) {
  let ids
  if (convoques && convoques.size) ids = convoques
  else ids = new Set([...Object.values(compo || {}), ...(banc || [])].filter(Boolean))
  return joueurs.filter(j => ids.has(j.id) && !absents.has(j.id))
}

const texteRempli = v => typeof v === 'string' && v.replace(/<[^>]*>/g, '').trim() !== ''

// Liste des étapes avec leur état. `obligatoire` = compte dans la progression.
export function etapesFeuille({ nbConvoques = 0, rapport = null, score = null, cibles = [], notes = [], rpeIds = new Set(), footIds = new Set(), nbStatsIndiv = 0 }) {
  const ciblesIds = cibles.map(j => j.id)
  const nbNotes = ciblesIds.filter(id => notes.some(n => n.joueur_id === id && noteSur10(n) != null)).length
  const nbRpe = ciblesIds.filter(id => rpeIds.has(id)).length
  const nbFoot = ciblesIds.filter(id => footIds.has(id)).length
  const chrono = Array.isArray(rapport?.chronologie) ? rapport.chronologie : []
  const compoFaite = Object.values(rapport?.compo_visuelle || {}).some(Boolean)
  const rapportFait = ['points_forts_globaux', 'points_faibles_globaux', 'notes_libres', 'recap_mi_temps'].some(k => texteRempli(rapport?.[k]))
  const scoreFait = score?.buts_marques != null && score?.buts_encaisses != null
  const n = ciblesIds.length
  const etapes = [
    { cle: 'convocations', moment: 'Avant', label: 'Convocations', fait: nbConvoques > 0, detail: nbConvoques ? `${nbConvoques} convoqué(s)` : 'Aucune convocation', obligatoire: true },
    { cle: 'compo', moment: 'Avant', label: 'Compo', fait: compoFaite, detail: compoFaite ? 'Faite' : 'À faire', obligatoire: true },
    { cle: 'suivi', moment: 'Pendant', label: 'Suivi live', fait: chrono.length > 0, detail: chrono.length ? `${chrono.length} événement(s)` : 'Facultatif', obligatoire: false },
    { cle: 'score', moment: 'Après', label: 'Score', fait: scoreFait, detail: scoreFait ? `${score.buts_marques}-${score.buts_encaisses}` : 'À saisir', obligatoire: true },
    { cle: 'notes', moment: 'Après', label: 'Notes des joueurs', fait: n > 0 && nbNotes === n, detail: `${nbNotes}/${n}`, obligatoire: true },
    { cle: 'indiv', moment: 'Après', label: 'Stats individuelles', fait: nbStatsIndiv > 0, detail: chrono.length ? 'Calculées depuis le suivi live' : `${nbStatsIndiv} joueur(s) renseigné(s)`, obligatoire: false },
    { cle: 'rpe', moment: 'Après', label: 'RPE des joueurs', fait: n > 0 && nbRpe === n, detail: `${nbRpe}/${n}`, obligatoire: true },
    { cle: 'footbar', moment: 'Après', label: 'Footbar', fait: n > 0 && nbFoot === n, detail: `${nbFoot}/${n} · facultatif`, obligatoire: false },
    { cle: 'rapport', moment: 'Après', label: 'Rapport', fait: rapportFait, detail: rapportFait ? 'Rédigé' : 'À rédiger', obligatoire: true },
  ]
  const obligatoires = etapes.filter(e => e.obligatoire)
  return { etapes, faites: obligatoires.filter(e => e.fait).length, total: obligatoires.length }
}
