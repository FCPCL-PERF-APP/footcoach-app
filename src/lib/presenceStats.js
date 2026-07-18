// Calcul unique de la présence, réutilisé sur tous les écrans qui affichent une
// statistique de présence — jusqu'ici chaque page réinventait sa propre règle
// (certaines comptaient "extérieur" comme une présence, d'autres non, aucune
// n'excluait les blessures du dénominateur), ce qui donnait des pourcentages
// différents pour la même donnée selon l'écran.
//
// - présent   : justifie la séance/le match et l'investissement collectif
// - extérieur : justifie un apport athlétique individuel (préparateur physique,
//               reprise progressive...), compte comme un investissement réel
// - blessé    : absence justifiée, indépendante de la volonté du joueur — exclue
//               du dénominateur du taux d'engagement pour ne pas la pénaliser
// - absent    : seul statut qui traduit un manque d'investissement

export function computePresenceBreakdown(presencesRows) {
  const present = presencesRows.filter(p => p.statut === 'present').length
  const exterieur = presencesRows.filter(p => p.statut === 'exterieur').length
  const blesse = presencesRows.filter(p => p.statut === 'blesse').length
  const absent = presencesRows.filter(p => p.statut === 'absent').length
  const inconnu = presencesRows.filter(p => !p.statut || p.statut === 'inconnu').length
  const total = presencesRows.length

  // Les blessures sont exclues du dénominateur : un joueur blessé n'a pas le choix
  // de son absence, elle ne doit pas faire baisser son taux d'engagement.
  const denomEngagement = total - blesse
  const tauxEngagement = denomEngagement > 0 ? Math.round((present + exterieur) / denomEngagement * 100) : null

  return { present, exterieur, blesse, absent, inconnu, total, tauxEngagement }
}
