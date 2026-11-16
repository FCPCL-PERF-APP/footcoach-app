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
