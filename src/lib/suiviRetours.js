// Suivi des retours (RPE, Footbar) après chaque événement — calculs purs.
//
// Joueurs attendus sur un événement (même règle que la page RPE) :
// - match : les convoqués ; séance : tout l'effectif actif ;
// - moins les joueurs déclarés absents ou blessés sur cet événement.
// Un événement reste « en cours de collecte » tant que l'événement suivant n'a pas
// commencé ; ensuite il est « clos » et son bilan est définitif.

export function attendus(ev, { joueurs = [], convoques = new Map(), absents = new Map() }) {
  const abs = absents.get(ev.id) || new Set()
  const base = ev.type === 'match' ? joueurs.filter(j => (convoques.get(ev.id) || new Set()).has(j.id)) : joueurs
  return base.filter(j => !abs.has(j.id))
}

export function etatEvenement(ev, ctx, { rpe = new Map(), foot = new Map() }) {
  const att = attendus(ev, ctx)
  const r = rpe.get(ev.id) || new Set(), f = foot.get(ev.id) || new Set()
  return {
    ev,
    attendus: att.length,
    attendusIds: att.map(j => j.id),
    rpe: att.filter(j => r.has(j.id)).length,
    foot: att.filter(j => f.has(j.id)).length,
    sansRpe: att.filter(j => !r.has(j.id)),
    sansFoot: att.filter(j => !f.has(j.id)),
  }
}

// events : événements passés triés du plus récent au plus ancien ; `prochain` : date du
// prochain événement à venir (ou null). Le premier est « en cours » si le suivant n'a
// pas encore commencé.
export function bilansRetours(events, ctx, faits, maintenant = new Date()) {
  return events.map((ev, i) => {
    const suivant = i === 0 ? ctx.prochain : events[i - 1].date_heure
    const clos = suivant ? new Date(suivant) <= maintenant : false
    return { ...etatEvenement(ev, ctx, faits), clos }
  })
}

// Assiduité de chaque joueur sur une liste de bilans : RPE et Footbar remplis / attendus.
// Triée du moins assidu au plus assidu (les joueurs jamais attendus sont ignorés).
export function assiduite(bilans, joueurs) {
  const stats = new Map(joueurs.map(j => [j.id, { joueur: j, attendus: 0, rpe: 0, foot: 0 }]))
  for (const b of bilans) {
    const sansR = new Set(b.sansRpe.map(j => j.id)), sansF = new Set(b.sansFoot.map(j => j.id))
    for (const id of b.attendusIds) {
      const s = stats.get(id)
      if (!s) continue
      s.attendus++
      if (!sansR.has(id)) s.rpe++
      if (!sansF.has(id)) s.foot++
    }
  }
  return [...stats.values()].filter(s => s.attendus > 0)
    .map(s => ({ ...s, tauxRpe: Math.round(s.rpe / s.attendus * 100), tauxFoot: Math.round(s.foot / s.attendus * 100) }))
    .sort((a, b) => a.tauxRpe - b.tauxRpe || a.tauxFoot - b.tauxFoot)
}

// Présence aux entraînements par semaine, en % de l'effectif attendu : pour chaque
// séance passée, (présents + extérieur) / (effectif actif − blessés). Un joueur qui n'a
// rien répondu compte comme absent. Moyenne des séances de la semaine.
export function presenceSeancesParSemaine(seances, { joueurs = [], statuts = new Map() }, cleSemaine) {
  const parSemaine = new Map()
  for (const ev of seances) {
    const st = statuts.get(ev.id) || new Map()
    const blesses = joueurs.filter(j => st.get(j.id) === 'blesse').length
    const effectif = joueurs.length - blesses
    if (effectif <= 0) continue
    const presents = joueurs.filter(j => st.get(j.id) === 'present' || st.get(j.id) === 'exterieur').length
    const k = cleSemaine(ev.date_heure)
    if (!parSemaine.has(k)) parSemaine.set(k, [])
    parSemaine.get(k).push(presents / effectif * 100)
  }
  return [...parSemaine.entries()].map(([label, v]) => ({ label, value: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }))
}
