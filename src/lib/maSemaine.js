// Résumé « Ma semaine » d'un joueur sur les 7 derniers jours : charge, présences,
// RPE remplis et un conseil simple. Calcul pur, réutilisé par l'accueil joueur,
// la fiche joueur côté staff et la notification du lundi.
import { indicateursJoueur, zoneAcwr } from './charge'

const PRESENT = new Set(['present', 'exterieur'])

// charges : charges sRPE du joueur (cf. chargesDepuisRpe) sur au moins 28 jours
// evenements : événements passés des 7 derniers jours [{ id, type }]
// presences : [{ evenement_id, statut }] du joueur ; rpeIds : Set des événements avec RPE
export function resumeSemaine({ charges = [], evenements = [], presences = [], rpeIds = new Set(), fin = new Date() }) {
  const ind = indicateursJoueur(charges, fin)
  const zone = zoneAcwr(ind.acwr)
  const statut = new Map(presences.map(p => [p.evenement_id, p.statut]))
  const seances = evenements.filter(e => e.type === 'seance')
  const nbSeancesPresent = seances.filter(e => PRESENT.has(statut.get(e.id))).length
  const presentsTous = evenements.filter(e => PRESENT.has(statut.get(e.id)))
  const nbRpe = presentsTous.filter(e => rpeIds.has(e.id)).length
  const nbRpeAttendus = presentsTous.length

  const conseils = []
  if (nbRpeAttendus > 0 && nbRpe < nbRpeAttendus) {
    conseils.push(`Il te manque ${nbRpeAttendus - nbRpe} RPE cette semaine : c'est ce qui permet au staff de suivre ta charge.`)
  }
  if (zone?.cle === 'risque') conseils.push('Ta charge a fortement augmenté par rapport à tes semaines habituelles. Priorité à la récupération : sommeil, hydratation, et signale au staff toute douleur.')
  else if (zone?.cle === 'vigilance') conseils.push('Charge en hausse : soigne ta récupération entre les séances.')
  else if (zone?.cle === 'optimal') conseils.push('Charge bien dosée par rapport à tes semaines précédentes, continue comme ça.')
  else if (zone?.cle === 'sous-charge') conseils.push('Charge plus faible que d\'habitude. Si tu as manqué des séances, un peu de travail en autonomie aide à garder le rythme.')
  if (seances.length > 0 && nbSeancesPresent === seances.length && seances.length >= 2) conseils.push('Présent à toutes les séances, bravo.')

  return {
    charge7j: ind.aigue, acwr: ind.acwr, zone,
    nbSeances: seances.length, nbSeancesPresent,
    nbRpe, nbRpeAttendus,
    conseils,
  }
}

// Mot du coach à afficher : le plus récent de moins de 14 jours.
export function motRecent(mots = [], fin = new Date()) {
  const limite = fin.getTime() - 14 * 24 * 60 * 60 * 1000
  return [...mots]
    .filter(m => new Date(m.created_at).getTime() >= limite)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null
}
