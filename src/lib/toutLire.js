// Supabase renvoie au plus 1 000 lignes par requête et coupe le reste sans erreur.
// toutLire relance la requête par paquets jusqu'à tout récupérer.
// `construire` doit renvoyer une NOUVELLE requête à chaque appel (ex. () => supabase.from('rpe').select('*')).
// Le tri sur (evenement_id, joueur_id) rend l'ordre stable d'un paquet à l'autre :
// sans lui, des lignes pourraient être sautées ou lues deux fois.
export const TAILLE_PAQUET = 1000

export async function toutLire(construire, { taille = TAILLE_PAQUET, cles = ['evenement_id', 'joueur_id'] } = {}) {
  const lignes = []
  for (let debut = 0; ; debut += taille) {
    let q = construire()
    for (const c of cles) q = q.order(c, { ascending: true })
    const { data, error } = await q.range(debut, debut + taille - 1)
    if (error) return { data: null, error }
    if (data?.length) lignes.push(...data)
    if (!data || data.length < taille) return { data: lignes, error: null }
  }
}
