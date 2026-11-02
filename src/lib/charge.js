// Charge d'entraînement « sRPE » (Foster) : intensité ressentie (0-10) × durée (min),
// exprimée en unités arbitraires (UA). Une séance de 90 min à 6/10 = 540 UA.
//
// Indicateurs par joueur, calculés sur des jours calendaires :
// - charge aiguë     : somme des 7 derniers jours
// - charge chronique : moyenne hebdomadaire des 28 derniers jours
// - ACWR             : aiguë / chronique. Repères usuels : < 0,8 sous-charge,
//                      0,8-1,3 zone optimale, 1,3-1,5 vigilance, > 1,5 risque accru de blessure
// - monotonie        : moyenne / écart-type des charges journalières sur 7 jours
//                      (> 2 = semaines trop uniformes, peu de récupération)

export const DUREE_DEFAUT = 90
const JOUR = 24 * 60 * 60 * 1000

// Intensité 0-10. Les RPE saisis avant l'ajout de la question sont estimés à partir de
// la « difficulté » (0-5, doublée), ou à défaut de la « fatigue ».
export function intensiteRpe(r) {
  if (r?.intensite != null) return { valeur: Number(r.intensite), estimee: false }
  const base = r?.difficulte ?? r?.fatigue
  if (base == null) return null
  return { valeur: Math.min(10, Math.max(0, Number(base) * 2)), estimee: true }
}

// Durée effective pour un joueur : temps de jeu réel en match s'il est connu,
// sinon durée saisie pour l'événement, sinon 90 min.
export function dureeJoueur(ev, tempsJeu) {
  if (ev?.type === 'match' && tempsJeu > 0) return tempsJeu
  return ev?.duree_min > 0 ? ev.duree_min : DUREE_DEFAUT
}

export function chargeSeance(intensite, duree) {
  if (intensite == null || !(duree > 0)) return null
  return Math.round(intensite * duree)
}

// Liste des charges { joueur_id, date, charge, estimee } à partir des RPE.
// evenements : [{ id, type, date_heure, duree_min }], stats : [{ evenement_id, joueur_id, temps_jeu }]
export function chargesDepuisRpe({ rpe = [], evenements = [], stats = [] }) {
  const evMap = new Map(evenements.map(e => [e.id, e]))
  const tj = new Map(stats.map(s => [`${s.evenement_id}|${s.joueur_id}`, s.temps_jeu]))
  const out = []
  for (const r of rpe) {
    const ev = evMap.get(r.evenement_id)
    if (!ev?.date_heure) continue
    const i = intensiteRpe(r)
    if (!i) continue
    const charge = chargeSeance(i.valeur, dureeJoueur(ev, tj.get(`${r.evenement_id}|${r.joueur_id}`)))
    if (charge == null) continue
    out.push({ joueur_id: r.joueur_id, evenement_id: r.evenement_id, date: new Date(ev.date_heure), charge, estimee: i.estimee })
  }
  return out
}

function debutJour(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// Charges journalières des `nbJours` jours qui finissent à `fin` (inclus), jours sans séance = 0.
export function chargesJournalieres(charges, fin, nbJours) {
  const finJ = debutJour(fin).getTime()
  const jours = new Array(nbJours).fill(0)
  for (const c of charges) {
    const idx = nbJours - 1 - Math.round((finJ - debutJour(c.date).getTime()) / JOUR)
    if (idx >= 0 && idx < nbJours) jours[idx] += c.charge
  }
  return jours
}

// Indicateurs d'un joueur à la date `fin`. `charges` = ses seules charges.
export function indicateursJoueur(charges, fin = new Date()) {
  const j28 = chargesJournalieres(charges, fin, 28)
  const j7 = j28.slice(21)
  const aigue = j7.reduce((a, b) => a + b, 0)
  const chronique = j28.reduce((a, b) => a + b, 0) / 4
  // Moins de 3 semaines avec des données : l'ACWR n'a pas de sens (chronique trop faible).
  const semainesActives = [0, 7, 14, 21].filter(s => j28.slice(s, s + 7).some(v => v > 0)).length
  const acwr = chronique > 0 && semainesActives >= 3 ? Math.round(aigue / chronique * 100) / 100 : null
  const moy = aigue / 7
  const ecart = Math.sqrt(j7.reduce((a, v) => a + (v - moy) ** 2, 0) / 7)
  const monotonie = aigue > 0 && ecart > 0 ? Math.round(moy / ecart * 100) / 100 : null
  const contrainte = monotonie != null ? Math.round(aigue * monotonie) : null
  return { aigue, chronique: Math.round(chronique), acwr, monotonie, contrainte }
}

export function zoneAcwr(acwr) {
  if (acwr == null) return null
  if (acwr > 1.5) return { cle: 'risque', label: 'Risque', couleur: 'var(--danger)' }
  if (acwr > 1.3) return { cle: 'vigilance', label: 'Vigilance', couleur: 'var(--warning)' }
  if (acwr >= 0.8) return { cle: 'optimal', label: 'Optimal', couleur: 'var(--success)' }
  return { cle: 'sous-charge', label: 'Sous-charge', couleur: 'var(--text-muted)' }
}
