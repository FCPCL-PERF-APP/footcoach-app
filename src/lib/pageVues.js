// Normalise un chemin pour la mesure d'usage : les identifiants (uuid, nombres)
// deviennent ":id" pour regrouper toutes les fiches joueur, tous les matchs, etc.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normaliserChemin(pathname = '/') {
  const segs = pathname.split('?')[0].split('/').filter(Boolean)
    .map(s => (UUID.test(s) || /^\d+$/.test(s) ? ':id' : s))
  return ('/' + segs.join('/')).slice(0, 100)
}

// Évite de compter plusieurs fois la même page ouverte en boucle (retours arrière,
// rechargements) : une ouverture par page toutes les 10 minutes au plus.
const DELAI = 10 * 60 * 1000
export function doitEnregistrer(dernieres, chemin, maintenant = Date.now()) {
  const t = dernieres.get(chemin)
  if (t !== undefined && maintenant - t < DELAI) return false
  dernieres.set(chemin, maintenant)
  return true
}
