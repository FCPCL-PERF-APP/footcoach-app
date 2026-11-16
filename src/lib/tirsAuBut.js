// Tirs au but : seulement pour un match de coupe terminé sur un score nul.
// Le match reste compté comme « nul » dans les statistiques (score du temps réglementaire) ;
// les tirs au but disent seulement qui s'est qualifié.

export function tabPossible(matchType, butsMarques, butsEncaisses) {
  return matchType === 'coupe' && butsMarques !== '' && butsMarques != null &&
    butsEncaisses !== '' && butsEncaisses != null && Number(butsMarques) === Number(butsEncaisses)
}

// Tirs réussis par notre équipe, d'après la liste des tireurs.
export function tabReussis(tireurs) {
  return (tireurs || []).filter(t => t?.reussi === true).length
}

// Résumé d'une ligne stats_collectives : null s'il n'y a pas eu de tirs au but.
export function resumeTab(sc) {
  if (!sc || sc.tab_marques == null || sc.tab_encaisses == null) return null
  if (sc.buts_marques == null || sc.buts_marques !== sc.buts_encaisses) return null
  const marques = Number(sc.tab_marques), encaisses = Number(sc.tab_encaisses)
  if (marques === encaisses) return null // séance incomplète ou mal saisie
  return { marques, encaisses, qualifie: marques > encaisses, label: `TAB ${marques}-${encaisses}` }
}

// Bilan des tirs au but d'un joueur à partir des lignes stats_collectives
// (avec tab_tireurs et, si possible, evenements { titre, date_heure }).
export function bilanTabJoueur(lignes, joueurId) {
  const tirs = []
  for (const sc of lignes || []) {
    (sc.tab_tireurs || []).forEach((t, i) => {
      if (t?.joueur_id === joueurId) tirs.push({ evenement_id: sc.evenement_id, titre: sc.evenements?.titre || '', date: sc.evenements?.date_heure || null, ordre: i + 1, reussi: t.reussi === true })
    })
  }
  tirs.sort((a, b) => String(b.date).localeCompare(String(a.date)))
  const reussis = tirs.filter(t => t.reussi).length
  return { tires: tirs.length, reussis, rates: tirs.length - reussis, tirs }
}
