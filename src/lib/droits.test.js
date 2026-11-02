import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { droitsProfil, peutAcceder, modeleChemin, ACCES_PAGES } from './droits'
import { NAV_COACH_MAIN, NAV_COACH_MORE, NAV_STAFF_MAIN, NAV_STAFF_MORE, NAV_JOUEUR_MAIN, NAV_JOUEUR_MORE } from './menus'

const coach = droitsProfil({ type: 'staff', role: 'coach' })
const admin = droitsProfil({ type: 'staff', role: 'admin' })
const adjoint = droitsProfil({ type: 'staff', role: 'adjoint' })
const prepa = droitsProfil({ type: 'staff', role: 'preparateur' })
const gardien = droitsProfil({ type: 'staff', role: 'gardien' })
const joueur = droitsProfil({ type: 'joueur', role: 'joueur' })

describe('rôles', () => {
  it('coach et admin ont tous les droits', () => {
    for (const d of [coach, admin]) expect(d).toMatchObject({ isCoach: true, isStaff: true, isJoueur: false, canEdit: true })
  })
  it('adjoint, préparateur et gardien : saisie et analyse, pas coach', () => {
    for (const d of [adjoint, prepa, gardien]) expect(d).toMatchObject({ isCoach: false, isAdjoint: true, isStaff: true, isJoueur: false, canEdit: true, canComment: true })
  })
  it('joueur : aucun droit staff', () => {
    expect(joueur).toMatchObject({ isCoach: false, isStaff: false, isJoueur: true, canEdit: false, canComment: false })
  })
  it('profil absent ou rôle inconnu : traité comme joueur, jamais comme staff', () => {
    expect(droitsProfil(null)).toMatchObject({ isStaff: false, isJoueur: true })
    expect(droitsProfil({ type: 'staff', role: 'inconnu' })).toMatchObject({ isStaff: false, isCoach: false })
  })
})

describe('accès aux pages', () => {
  const reserveCoach = ['/joueurs/nouveau', '/joueurs/import', '/archive-saison', '/stats-connexion', '/export']
  const reserveStaff = ['/rpe', '/footbar', '/dashboard', '/stats/:id', '/charge-hebdo', '/bilan-saison', '/analyse', '/joueurs/:id/radar']
  const reserveJoueur = ['/mon-suivi', '/ma-fiche', '/mon-dashboard', '/mon-bilan', '/mes-badges', '/mes-objectifs']

  it('pages du coach principal refusées aux adjoints et aux joueurs', () => {
    for (const p of reserveCoach) {
      expect(peutAcceder(p, coach)).toBe(true)
      expect(peutAcceder(p, adjoint)).toBe(false)
      expect(peutAcceder(p, joueur)).toBe(false)
    }
  })
  it('pages staff ouvertes aux adjoints, refusées aux joueurs', () => {
    for (const p of reserveStaff) {
      expect(peutAcceder(p, adjoint)).toBe(true)
      expect(peutAcceder(p, joueur)).toBe(false)
    }
  })
  it('pages personnelles réservées aux joueurs', () => {
    for (const p of reserveJoueur) {
      expect(peutAcceder(p, joueur)).toBe(true)
      expect(peutAcceder(p, coach)).toBe(false)
    }
  })
  it('page inconnue refusée par défaut', () => {
    expect(peutAcceder('/nimporte-quoi', coach)).toBe(false)
  })
  it('chemins réels rattachés à leur modèle', () => {
    expect(modeleChemin('/stats/42')).toBe('/stats/:id')
    expect(modeleChemin('/joueurs/abc/radar')).toBe('/joueurs/:id/radar')
    expect(modeleChemin('/joueurs/nouveau')).toBe('/joueurs/nouveau')
  })
})

describe('cohérence menus et routes', () => {
  const chemins = (main, more) => [...main, ...more.flatMap(s => s.items)].map(i => i.path).filter(p => p !== '/plus')
  it.each([
    ['coach', coach, NAV_COACH_MAIN, NAV_COACH_MORE],
    ['adjoint', adjoint, NAV_STAFF_MAIN, NAV_STAFF_MORE],
    ['joueur', joueur, NAV_JOUEUR_MAIN, NAV_JOUEUR_MORE],
  ])('chaque entrée du menu %s mène à une page autorisée', (_, droits, main, more) => {
    for (const p of chemins(main, more)) expect([p, peutAcceder(p, droits)]).toEqual([p, true])
  })
  it('chaque route protégée de App.jsx a un niveau défini', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
    const gardes = [...app.matchAll(/garde\('([^']+)'/g)].map(m => m[1])
    expect(gardes.length).toBeGreaterThan(25)
    for (const p of gardes) expect([p, ACCES_PAGES[p]]).not.toEqual([p, undefined])
  })
})
