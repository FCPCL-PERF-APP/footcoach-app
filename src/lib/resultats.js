// Points de classement : uniquement sur les matchs de CHAMPIONNAT (pas de classement en
// coupe ni en préparation) et uniquement ceux dont le score est renseigné — une ligne de
// stats sans score ne doit jamais compter comme un match nul.
export function pointsChampionnat(statsCollectives) {
  const joues = (statsCollectives || []).filter(s =>
    s.evenements?.match_type === 'championnat' && s.buts_marques != null && s.buts_encaisses != null)
  const victoires = joues.filter(s => s.buts_marques > s.buts_encaisses).length
  const nuls = joues.filter(s => s.buts_marques === s.buts_encaisses).length
  return { hasChampionnat: joues.length > 0, pts: victoires * 3 + nuls, victoires, nuls, defaites: joues.length - victoires - nuls }
}

// Résultat d'un match à partir de sa ligne stats_collectives : null si le score n'est
// pas saisi. code = V / N / D (temps réglementaire) ; tab = tirs au but éventuels.
export function resultatMatch(sc) {
  if (!sc || sc.buts_marques == null || sc.buts_encaisses == null) return null
  const nous = Number(sc.buts_marques), adv = Number(sc.buts_encaisses)
  const code = nous > adv ? 'V' : nous < adv ? 'D' : 'N'
  const tab = nous === adv && sc.tab_marques != null && sc.tab_encaisses != null && Number(sc.tab_marques) !== Number(sc.tab_encaisses)
    ? { nous: Number(sc.tab_marques), adv: Number(sc.tab_encaisses), qualifie: Number(sc.tab_marques) > Number(sc.tab_encaisses) }
    : null
  return { code, nous, adv, tab }
}
