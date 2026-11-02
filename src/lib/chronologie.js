// Calculs purs dérivés de la chronologie du Suivi live (buts, passes, cartons, temps de jeu).
// Extraits de StatsPage.jsx pour pouvoir être testés (cf. chronologie.test.js) : ils
// décident des stats officielles d'un match, une erreur ici fausse tous les bilans.

export const PHASES_BUT = [
  { key: 'attaque_placee', label: 'Attaque placée' },
  { key: 'contre_attaque', label: 'Contre-attaque' },
  { key: 'corner',         label: 'Corner' },
  { key: 'penalty',        label: 'Penalty' },
  { key: 'coup_franc',     label: 'Coup franc' },
]

// Découpage en périodes de 15' — identique à "Buts marqués/encaissés — par période"
// dans l'onglet Collectif, déduit automatiquement de la minute saisie sur l'événement.
export function periodeButs(minute, prefix) {
  const m = minute || 0
  // Bornes inclusives sur la fin de période — un but à la 45' (souvent le cas, fin de
  // 1ère mi-temps/temps additionnel) doit tomber dans la période 30-45, pas 45-60 qui
  // est en réalité le début de la 2nde mi-temps (46').
  if (m <= 15) return `${prefix}0_15`
  if (m <= 30) return `${prefix}15_30`
  if (m <= 45) return `${prefix}30_45`
  if (m <= 60) return `${prefix}45_60`
  if (m <= 75) return `${prefix}60_75`
  return `${prefix}75_90`
}

// Stats collectives (buts marqués/encaissés, par phase de jeu et par période). Un côté
// (marqués ou encaissés) n'est renseigné que s'il y a au moins un but de ce côté dans la
// chronologie ; sinon la saisie manuelle de l'onglet Collectif reste la source.
// Retourne null s'il n'y a aucun but.
export function statsCollectivesDepuisChrono(entries) {
  const butsPour = (entries || []).filter(e => e.type === 'but_pour')
  const butsContre = (entries || []).filter(e => e.type === 'but_contre')
  if (!butsPour.length && !butsContre.length) return null
  const payload = {}
  const cote = (buts, cle, clePhase, clePeriode) => {
    payload[cle] = buts.length
    const phase = { attaque_placee: 0, contre_attaque: 0, corner: 0, penalty: 0, coup_franc: 0 }
    const periode = { '0_15': 0, '15_30': 0, '30_45': 0, '45_60': 0, '60_75': 0, '75_90': 0 }
    for (const e of buts) {
      if (e.phase && phase[e.phase] !== undefined) phase[e.phase]++
      periode[periodeButs(e.minute, '')]++
    }
    for (const [k, v] of Object.entries(phase)) payload[`${clePhase}_${k}`] = v
    for (const [k, v] of Object.entries(periode)) payload[`${clePeriode}_${k}`] = v
  }
  if (butsPour.length) cote(butsPour, 'buts_marques', 'but_marque', 'buts')
  if (butsContre.length) cote(butsContre, 'buts_encaisses', 'but_enc', 'buts_enc')
  return payload
}

// Buts et passes décisives par joueur. `dejaConnus` : joueurs ayant déjà une ligne de stats
// sur ce match, remis à 0 s'ils n'apparaissent plus (le calcul repart de zéro à chaque
// enregistrement, il n'incrémente jamais).
export function butsPassesParJoueur(entries, dejaConnus = []) {
  const butsPour = (entries || []).filter(e => e.type === 'but_pour')
  if (!butsPour.length) return []
  const buts = {}, passes = {}
  for (const e of butsPour) {
    if (e.buteur_id) buts[e.buteur_id] = (buts[e.buteur_id] || 0) + 1
    if (e.passeur_id) passes[e.passeur_id] = (passes[e.passeur_id] || 0) + 1
  }
  const concernes = new Set([...Object.keys(buts), ...Object.keys(passes), ...dejaConnus])
  return [...concernes].map(joueur_id => ({ joueur_id, buts: buts[joueur_id] || 0, passes_decisives: passes[joueur_id] || 0 }))
}

export function cartonsParJoueur(entries, dejaConnus = []) {
  const cartons = (entries || []).filter(e => e.type === 'carton_jaune' || e.type === 'carton_rouge')
  if (!cartons.length) return []
  const jaune = new Set(cartons.filter(e => e.type === 'carton_jaune' && e.joueur_id).map(e => e.joueur_id))
  const rouge = new Set(cartons.filter(e => e.type === 'carton_rouge' && e.joueur_id).map(e => e.joueur_id))
  const concernes = new Set([...jaune, ...rouge, ...dejaConnus])
  return [...concernes].map(joueur_id => ({ joueur_id, carton_jaune: jaune.has(joueur_id), carton_rouge: rouge.has(joueur_id) }))
}

// Temps de jeu et titularisation.
// Un joueur qui marque, passe ou prend un carton a forcément été sur le terrain à ce
// moment-là, même sans changement le concernant (cas le plus fréquent : un titulaire
// qui joue le match entier n'apparaît jamais dans un événement "changement"). Chaque
// joueur mentionné n'importe où dans la chronologie est donc par défaut supposé avoir
// débuté à la 0' et être resté jusqu'à la fin, sauf indication contraire.
// Gère aussi les allers-retours (sorti puis rentré plus tard dans le match) : les
// événements sortant/entrant du joueur sont rejoués dans l'ordre chronologique pour
// cumuler tous ses passages sur le terrain, pas juste une seule sortie/entrée.
// `compo` : { poste → joueur_id } (titulaires uniquement, jamais le banc) ;
// `titulairesConnus` : joueurs déjà marqués titulaires en base (compo non remplie).
export function tempsDeJeuParJoueur({ entries, compo = {}, titulairesConnus = [], duree = 90 }) {
  const titulaireIds = new Set([...Object.values(compo).filter(Boolean), ...titulairesConnus])
  const vus = new Set()
  const mouvementsParJoueur = {}
  for (const e of (entries || [])) {
    for (const id of [e.buteur_id, e.passeur_id, e.joueur_id, e.sortant_id, e.entrant_id]) {
      if (id) vus.add(id)
    }
    if (e.type === 'changement') {
      if (e.sortant_id) (mouvementsParJoueur[e.sortant_id] ||= []).push({ minute: e.minute || 0, sens: 'sort' })
      if (e.entrant_id) (mouvementsParJoueur[e.entrant_id] ||= []).push({ minute: e.minute || 0, sens: 'entre' })
    }
  }
  const concernes = new Set([...titulaireIds, ...vus])
  const fin = duree || 90
  return [...concernes].map(joueur_id => {
    const mouvements = (mouvementsParJoueur[joueur_id] || []).slice().sort((a, b) => a.minute - b.minute)
    // Titulaire = déjà connu comme tel, ou aucun mouvement "entre" avant un premier
    // mouvement "sort" (on ne peut pas sortir sans avoir déjà commencé le match).
    const titulaire = titulaireIds.has(joueur_id) || mouvements[0]?.sens !== 'entre'
    let surLeTerrain = titulaire, depuis = 0, temps_jeu = 0
    for (const m of mouvements) {
      if (m.sens === 'sort' && surLeTerrain) { temps_jeu += Math.max(0, m.minute - depuis); surLeTerrain = false }
      else if (m.sens === 'entre' && !surLeTerrain) { surLeTerrain = true; depuis = m.minute }
    }
    if (surLeTerrain) temps_jeu += Math.max(0, fin - depuis)
    return { joueur_id, temps_jeu, titulaire }
  })
}
