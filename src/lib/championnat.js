// Calculs du classement du championnat (page Championnat). Extraits de ChampionnatPage.jsx
// pour être testés.

export function joue(m) {
  return m.score_dom !== null && m.score_dom !== undefined && m.score_ext !== null && m.score_ext !== undefined
}

// Classement complet + forme à partir des seuls matchs joués. Départage : points, puis
// différence de buts, puis buts marqués, puis nom (ordre stable).
export function calculer(matchs) {
  const equipes = {}
  const get = nom => equipes[nom] || (equipes[nom] = { nom, pts: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, resultats: [] })
  for (const m of matchs) { get(m.equipe_dom); get(m.equipe_ext) }
  const joues = matchs.filter(joue).sort((a, b) => a.journee - b.journee || String(a.date_match || '').localeCompare(String(b.date_match || '')))
  for (const m of joues) {
    for (const [nom, bp, bc] of [[m.equipe_dom, m.score_dom, m.score_ext], [m.equipe_ext, m.score_ext, m.score_dom]]) {
      const e = get(nom)
      e.j++; e.bp += bp; e.bc += bc
      const r = bp > bc ? 'V' : bp === bc ? 'N' : 'D'
      if (r === 'V') { e.g++; e.pts += 3 } else if (r === 'N') { e.n++; e.pts += 1 } else e.p++
      e.resultats.push(r)
    }
  }
  return Object.values(equipes)
    .map(e => ({ ...e, diff: e.bp - e.bc, forme: e.resultats.slice(-5) }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.nom.localeCompare(b.nom))
}

// Clé de comparaison de noms d'équipes (sans accents, casse ni ponctuation) : le site de
// la ligue et le calendrier PDF n'écrivent pas toujours un club exactement pareil.
export function cle(nom) {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Lit un texte collé (une rencontre par ligne) :
//   "Equipe A 2 - 1 Equipe B"  → match joué
//   "Equipe A - Equipe B"      → match à venir
export function analyserTexte(texte) {
  const lignes = texte.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const rows = [], ignorees = []
  for (const l of lignes) {
    let m = l.match(/^(.+?)\s+(\d{1,2})\s*[-–—:]\s*(\d{1,2})\s+(.+)$/)
    if (m) { rows.push({ dom: m[1].trim(), ext: m[4].trim(), sd: parseInt(m[2], 10), se: parseInt(m[3], 10) }); continue }
    m = l.match(/^(.+?)\s+(?:-|–|—|vs\.?|contre)\s+(.+)$/i)
    if (m) { rows.push({ dom: m[1].trim(), ext: m[2].trim(), sd: null, se: null }); continue }
    ignorees.push(l)
  }
  return { rows, ignorees }
}
