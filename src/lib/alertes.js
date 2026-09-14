// Calcul unique des alertes coach (surcharge RPE, fatigue chronique, baisse de
// motivation, perf individuelle faible, RPE manquant, alertes collectives) —
// utilisé à la fois par DashboardPage.jsx (détail, avec possibilité de les marquer
// traitées) et BottomNav.jsx (badge du menu "Plus"). Avant, chacun avait sa propre
// version de ce calcul (différente !) et sa propre clé localStorage de dismiss,
// ce qui faisait que traiter une alerte sur le Dashboard ne faisait jamais bouger
// le badge "Plus", qui semblait alors bloqué en permanence.
// Détermine quelles entrées RPE (une seule table concernée pour les alertes collectives)
// correspondent à un match où le joueur n'était PAS convoqué — cf. MonSuiviPage.jsx, qui
// permet désormais à un joueur non convoqué de remplir son RPE/Footbar pour son suivi
// personnel (ex : il a joué avec une autre équipe ce jour-là). Ces entrées doivent rester
// visibles par joueur (fiche, comparatif...) mais ne doivent pas fausser les moyennes
// d'équipe. Absence de ligne `convocations` (match jamais suivi via cette fonctionnalité)
// = comportement historique inchangé, on considère le joueur convoqué par défaut.
export async function fetchNonConvoqueSet(supabase, rows) {
  const matchEventIds = [...new Set((rows || []).filter(r => r.evenements?.type === 'match').map(r => r.evenement_id))]
  if (!matchEventIds.length) return new Set()
  const { data } = await supabase.from('convocations').select('joueur_id, evenement_id, convoque').in('evenement_id', matchEventIds)
  return new Set((data || []).filter(c => c.convoque === false).map(c => `${c.joueur_id}_${c.evenement_id}`))
}

export function computeAlertes({ rpeData, joueursData, matchResults, absencesData, nonConvoqueSet }) {
  // Les alertes INDIVIDUELLES (surcharge d'un joueur, fatigue chronique...) restent
  // calculées sur `rpeData` complet — vues "par joueur", elles doivent inclure les
  // entrées hors convocation comme n'importe quelle autre entrée personnelle.
  // Seules les alertes COLLECTIVES ci-dessous (RPE moyen équipe, motivation, complétion)
  // utilisent la version filtrée, pour ne pas être faussées par un joueur qui a joué
  // avec une autre équipe ce jour-là.
  const rpeDataCollectif = nonConvoqueSet && nonConvoqueSet.size
    ? (rpeData || []).filter(r => !nonConvoqueSet.has(`${r.joueur_id}_${r.evenement_id}`))
    : rpeData
  const joueurMap = {}
  for (const r of (rpeData || [])) {
    if (!r.joueurs) continue
    const id = r.joueurs.id
    const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    if (!vals.length) continue
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length
    if (!joueurMap[id]) joueurMap[id] = { nom: r.joueurs.nom, sessions: [], motivation: [], fatigue: [], perf_ind: [] }
    joueurMap[id].sessions.push(avg)
    joueurMap[id].motivation.push(r.motivation)
    joueurMap[id].fatigue.push(r.fatigue)
    joueurMap[id].perf_ind.push(r.perf_individuelle)
  }

  const joueursAbsentsBlessesSurEvenement = new Set((absencesData || []).map(p => p.joueur_id))

  const alertes = []
  const alertesCollectives = []
  const totalJoueurs = (joueursData || []).length

  for (const [id, j] of Object.entries(joueurMap)) {
    // Ne pas alerter les joueurs absents ou blessés
    if (joueursAbsentsBlessesSurEvenement.has(id)) continue

    const last3 = j.sessions.slice(0, 3)
    const avgLast3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0
    const avgFatLast3 = j.fatigue.slice(0, 3).filter(v => v !== null)
    const avgMotivLast = j.motivation.slice(0, 3).filter(v => v !== null)
    const avgMotivAll = j.motivation.filter(v => v !== null)
    const avgPerfIndLast2 = j.perf_ind.slice(0, 2).filter(v => v !== null)
    // bucket = valeur arrondie au 0.5 près, incluse dans la clé de "traité" : si la
    // situation s'aggrave (bucket différent), l'alerte redevient visible même avant
    // le reset hebdomadaire du lundi.
    if (avgLast3 >= 4.5) alertes.push({ type: 'red', title: `${j.nom} — Surcharge`, message: `RPE ${avgLast3.toFixed(1)}/5 sur 3 sessions.`, joueurId: id, bucket: Math.round(avgLast3 * 2) / 2 })
    if (avgFatLast3.length >= 3 && avgFatLast3.every(v => v >= 4)) {
      const fatMoy = avgFatLast3.reduce((a, b) => a + b, 0) / avgFatLast3.length
      alertes.push({ type: 'red', title: `${j.nom} — Fatigue chronique`, message: `Fatigue ≥ 4/5 sur 3 sessions.`, joueurId: id, bucket: Math.round(fatMoy * 2) / 2 })
    }
    if (avgMotivLast.length >= 2 && avgMotivAll.length >= 4) {
      const motLast = avgMotivLast.reduce((a, b) => a + b, 0) / avgMotivLast.length
      const motAll = avgMotivAll.reduce((a, b) => a + b, 0) / avgMotivAll.length
      if (motAll - motLast >= 1.5) alertes.push({ type: 'orange', title: `${j.nom} — Baisse motivation`, message: `${motLast.toFixed(1)}/5 vs ${motAll.toFixed(1)}/5 en moyenne.`, joueurId: id, bucket: Math.round(motLast * 2) / 2 })
    }
    if (avgPerfIndLast2.length >= 2 && avgPerfIndLast2.every(v => v < 2.5)) {
      const perfMoy = avgPerfIndLast2.reduce((a, b) => a + b, 0) / avgPerfIndLast2.length
      alertes.push({ type: 'orange', title: `${j.nom} — Perf. faible`, message: `Perf. indiv. < 2.5/5 sur 2 sessions.`, joueurId: id, bucket: Math.round(perfMoy * 2) / 2 })
    }
  }

  const joueursAvecRpe = new Set(Object.keys(joueurMap))
  for (const j of (joueursData || [])) {
    if (!joueursAvecRpe.has(j.id) && !joueursAbsentsBlessesSurEvenement.has(j.id)) {
      alertes.push({ type: 'yellow', title: `${j.nom} ${j.prenom} — RPE manquant`, message: `Aucune donnée RPE.`, joueurId: j.id })
    }
  }

  const rpeVals = (rpeDataCollectif || []).map(r => {
    const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    return items.length ? items.reduce((a, b) => a + b, 0) / items.length : null
  }).filter(v => v !== null)
  const rpeMoy = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : 0
  if (rpeMoy >= 4.2) alertesCollectives.push({ type: 'red', title: 'Surcharge collective', message: `RPE moyen : ${rpeMoy.toFixed(1)}/5.`, bucket: Math.round(rpeMoy * 2) / 2 })

  const allMotiv = (rpeDataCollectif || []).map(r => r.motivation).filter(v => v !== null && v !== undefined)
  const avgMotivEquipe = allMotiv.length ? allMotiv.reduce((a, b) => a + b, 0) / allMotiv.length : 0
  if (avgMotivEquipe < 3.0 && allMotiv.length > 0) alertesCollectives.push({ type: 'orange', title: 'Motivation collective faible', message: `Motivation : ${avgMotivEquipe.toFixed(1)}/5.`, bucket: Math.round(avgMotivEquipe * 2) / 2 })

  const nbRpeRecents = new Set((rpeDataCollectif || []).slice(0, 50).map(r => r.joueur_id)).size
  if (totalJoueurs > 0 && nbRpeRecents / totalJoueurs < 0.7) alertesCollectives.push({ type: 'yellow', title: 'Complétion RPE insuffisante', message: `${nbRpeRecents}/${totalJoueurs} joueurs ont rempli.`, bucket: nbRpeRecents })

  const derniers3 = (matchResults || []).slice(0, 3)
  if (derniers3.length >= 3 && derniers3.every(r => r === 'D')) alertesCollectives.push({ type: 'yellow', title: '3 défaites consécutives', message: 'Analyser les rapports.' })

  return { alertes, alertesCollectives }
}

export function alertKey(a, joueurId) {
  const base = joueurId !== undefined ? `ind-${joueurId}-${a.title}` : `col-${a.title}`
  return a.bucket !== undefined ? `${base}-${a.bucket}` : base
}

// Clés d'alertes déjà marquées "traitées" par le coach — reset chaque lundi pour ne
// pas masquer indéfiniment une alerte qui redeviendrait pertinente la semaine
// suivante. Simple lecture (pas de mutation) : utilisée par le badge du menu "Plus",
// qui n'a pas besoin d'écrire dans ce store, seulement de connaître son état actuel.
export function getAlertesTraitees() {
  try {
    const stored = JSON.parse(localStorage.getItem('fcpcl-alertes-v2') || '{}')
    const now = new Date()
    const lundi = new Date(now)
    lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    lundi.setHours(0, 0, 0, 0)
    if (!stored.resetDate || new Date(stored.resetDate) < lundi) return []
    return stored.keys || []
  } catch { return [] }
}
