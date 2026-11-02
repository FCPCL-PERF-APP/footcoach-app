// Droits par rôle — source unique utilisée par useAuth (drapeaux) et App.jsx (pages).
//
// Rôles staff : coach et admin = accès complet ; adjoint, gardien et préparateur =
// saisie et analyse, sans la gestion du staff, la création/archivage de joueurs,
// l'archive de saison, l'export et l'adoption de l'app.

export function droitsProfil(profile) {
  const role = profile?.role
  const isCoach = role === 'coach' || role === 'admin'
  const isAdjoint = role === 'adjoint' || role === 'gardien' || role === 'preparateur'
  const isStaff = isCoach || isAdjoint
  const isJoueur = profile?.type === 'joueur' || !isStaff
  return { isCoach, isAdjoint, isStaff, isJoueur, canEdit: isStaff, canComment: isStaff }
}

// Niveau d'accès de chaque page : 'tous', 'staff', 'coach' ou 'joueur'.
export const ACCES_PAGES = {
  '/calendrier': 'tous', '/calendrier-visuel': 'tous', '/calendrier-general': 'tous',
  '/fun': 'tous', '/cpa': 'tous', '/joueurs': 'tous', '/joueurs/:id': 'tous',
  '/joueurs/:id/blessures': 'tous', '/joueurs/:id/objectifs': 'tous',
  '/onboarding-coach': 'tous', '/search': 'tous', '/messages': 'tous',
  '/ressources': 'tous', '/staff': 'tous', '/sondages': 'tous', '/onboarding': 'tous',
  '/set-password': 'tous', '/championnat': 'tous', '/match-live/:id': 'tous',

  '/rpe': 'staff', '/footbar': 'staff', '/dashboard': 'staff', '/export-fiche/:id': 'staff',
  '/stats/:id': 'staff', '/convocations/:id': 'staff', '/presences/:id': 'staff',
  '/presences-recap': 'staff', '/charge-hebdo': 'staff', '/comparatif': 'staff',
  '/bilan-saison': 'staff', '/correlation': 'staff', '/mon-profil': 'staff',
  '/tirage-au-sort': 'staff', '/classement': 'staff', '/stats-matchs': 'staff',
  '/analyse': 'staff', '/joueurs/:id/radar': 'staff',

  '/joueurs/nouveau': 'coach', '/joueurs/import': 'coach', '/archive-saison': 'coach',
  '/stats-connexion': 'coach', '/export': 'coach',

  '/mon-suivi': 'joueur', '/ma-fiche': 'joueur', '/mes-objectifs': 'joueur',
  '/mon-dashboard': 'joueur', '/mes-badges': 'joueur', '/mon-bilan': 'joueur',
}

export function peutAcceder(path, droits) {
  const niveau = ACCES_PAGES[path]
  if (niveau === 'tous') return true
  if (niveau === 'staff') return droits.isStaff
  if (niveau === 'coach') return droits.isCoach
  if (niveau === 'joueur') return droits.isJoueur
  return false // page inconnue : refusée par défaut
}

// Fait correspondre un chemin réel (/stats/42) à son modèle (/stats/:id).
export function modeleChemin(pathname) {
  const p = pathname.split('?')[0]
  if (ACCES_PAGES[p]) return p
  return Object.keys(ACCES_PAGES).find(modele => {
    const a = modele.split('/'), b = p.split('/')
    return a.length === b.length && a.every((s, i) => s.startsWith(':') || s === b[i])
  }) || null
}
