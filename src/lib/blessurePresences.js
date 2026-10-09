// Synchronisation blessures → présences : un joueur blessé est automatiquement marqué
// "blessé" (statut `blesse`, distinct de `absent`) sur tous les événements de la période
// de sa blessure. On utilise `blesse` plutôt que `absent` car presenceStats.js sort les
// blessés du dénominateur du taux d'engagement : un `absent` serait compté comme un
// manque d'investissement et pénaliserait injustement le joueur.
//
// Période couverte : de la date de survenue (00:00) jusqu'au jour de retour EXCLU (le
// joueur est de nouveau disponible ce jour-là) — retour effectif, sinon retour prévu ;
// sans aucune des deux, sans limite (jusqu'à ce que la blessure soit marquée guérie).

function debutJour(dateStr) {
  return new Date(`${dateStr}T00:00:00`)
}

function bornes(blessure) {
  const retour = blessure.date_retour_effective || blessure.date_retour_prevue || null
  return {
    debut: debutJour(blessure.date_debut),
    finExclue: retour ? debutJour(retour) : null,
  }
}

// Marque `blesse` les événements (séances + matchs) de la période. Retourne le nombre
// d'événements mis à jour. Le jour de survenue, un statut `present` existant est conservé
// (le joueur s'est peut-être blessé pendant cet entraînement ou ce match).
export async function appliquerBlessureAuxPresences(supabase, joueurId, blessure) {
  const { debut, finExclue } = bornes(blessure)
  let q = supabase.from('evenements').select('id, date_heure').in('type', ['seance', 'match']).gte('date_heure', debut.toISOString())
  if (finExclue) q = q.lt('date_heure', finExclue.toISOString())
  const { data: events, error } = await q
  if (error) throw error
  if (!events?.length) return 0

  const { data: existantes, error: errPres } = await supabase.from('presences')
    .select('evenement_id, statut').eq('joueur_id', joueurId).in('evenement_id', events.map(e => e.id))
  if (errPres) throw errPres
  const statutExistant = {}
  for (const p of (existantes || [])) statutExistant[p.evenement_id] = p.statut

  const lendemain = new Date(debut); lendemain.setDate(lendemain.getDate() + 1)
  const rows = events
    .filter(e => !(new Date(e.date_heure) < lendemain && statutExistant[e.id] === 'present'))
    .map(e => ({ evenement_id: e.id, joueur_id: joueurId, statut: 'blesse', motif: null }))
  if (!rows.length) return 0

  const { error: errUp } = await supabase.from('presences').upsert(rows, { onConflict: 'evenement_id,joueur_id' })
  if (errUp) throw errUp
  return rows.length
}

// Blessure guérie avant la fin prévue : retire le statut `blesse` des événements à partir
// du jour de retour (le joueur redevient "sans réponse" pour eux), puis réapplique les
// éventuelles autres blessures encore en cours pour ne pas les effacer.
export async function libererApresRetour(supabase, joueurId, dateRetour) {
  const retour = debutJour(dateRetour)
  const { data: events, error } = await supabase.from('evenements').select('id')
    .in('type', ['seance', 'match']).gte('date_heure', retour.toISOString())
  if (error) throw error
  if (events?.length) {
    const { error: errDel } = await supabase.from('presences').delete()
      .eq('joueur_id', joueurId).eq('statut', 'blesse').in('evenement_id', events.map(e => e.id))
    if (errDel) throw errDel
  }
  const { data: actives } = await supabase.from('blessures').select('*')
    .eq('joueur_id', joueurId).is('date_retour_effective', null)
  for (const b of (actives || [])) await appliquerBlessureAuxPresences(supabase, joueurId, b)
}
