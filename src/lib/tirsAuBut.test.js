import { describe, it, expect } from 'vitest'
import { tabPossible, tabReussis, resumeTab } from './tirsAuBut'

describe('tirs au but', () => {
  it('seulement en coupe et sur un nul saisi', () => {
    expect(tabPossible('coupe', '1', '1')).toBe(true)
    expect(tabPossible('coupe', 2, 1)).toBe(false)
    expect(tabPossible('championnat', 1, 1)).toBe(false)
    expect(tabPossible('coupe', '', '')).toBe(false)
  })
  it('compte les réussis', () => {
    expect(tabReussis([{ reussi: true }, { reussi: false }, { reussi: true }])).toBe(2)
    expect(tabReussis(null)).toBe(0)
  })
  it('résumé qualifié / éliminé', () => {
    expect(resumeTab({ buts_marques: 1, buts_encaisses: 1, tab_marques: 4, tab_encaisses: 3 })).toEqual({ marques: 4, encaisses: 3, qualifie: true, label: 'TAB 4-3' })
    expect(resumeTab({ buts_marques: 0, buts_encaisses: 0, tab_marques: 2, tab_encaisses: 4 }).qualifie).toBe(false)
  })
  it('ignore les données incohérentes', () => {
    expect(resumeTab({ buts_marques: 2, buts_encaisses: 1, tab_marques: 4, tab_encaisses: 3 })).toBeNull()
    expect(resumeTab({ buts_marques: 1, buts_encaisses: 1, tab_marques: 3, tab_encaisses: 3 })).toBeNull()
    expect(resumeTab({ buts_marques: 1, buts_encaisses: 1 })).toBeNull()
  })
})

import { bilanTabJoueur } from './tirsAuBut'
describe('bilanTabJoueur', () => {
  it('compte les tirs du joueur avec leur ordre de passage', () => {
    const lignes = [
      { evenement_id: 'm1', evenements: { titre: 'Coupe 1', date_heure: '2026-10-01' }, tab_tireurs: [{ joueur_id: 'a', reussi: true }, { joueur_id: 'b', reussi: false }] },
      { evenement_id: 'm2', evenements: { titre: 'Coupe 2', date_heure: '2026-11-01' }, tab_tireurs: [{ joueur_id: 'c', reussi: true }, { joueur_id: 'b', reussi: true }] },
      { evenement_id: 'm3', tab_tireurs: null },
    ]
    const r = bilanTabJoueur(lignes, 'b')
    expect([r.tires, r.reussis, r.rates]).toEqual([2, 1, 1])
    expect(r.tirs.map(t => [t.titre, t.ordre, t.reussi])).toEqual([['Coupe 2', 2, true], ['Coupe 1', 2, false]])
    expect(bilanTabJoueur(lignes, 'z').tires).toBe(0)
  })
})
