// Une saison va du 1er juillet au 30 juin. Renvoie les bornes de la saison en cours
// (ou de la saison contenant `now` si fournie), pour filtrer les stats/agrégats.
export function bornesSaison(now = new Date()) {
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return { year, debut: new Date(year, 6, 1).toISOString(), fin: now.toISOString() }
}

// Libellé "2026/2027" de la saison en cours — à utiliser partout où ce libellé est
// affiché, plutôt qu'une chaîne écrite en dur qui se désynchronise dès le changement
// de saison suivant (1er juillet).
export function labelSaison(now = new Date()) {
  const { year } = bornesSaison(now)
  return `${year}/${year + 1}`
}
