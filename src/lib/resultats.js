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
