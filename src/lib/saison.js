// Une saison va du 1er juillet au 30 juin. Renvoie les bornes de la saison en cours
// (ou de la saison contenant `now` si fournie), pour filtrer les stats/agrégats.
export function bornesSaison(now = new Date()) {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return { year, debut: new Date(year, 6, 1).toISOString(), fin: now.toISOString() }
}
