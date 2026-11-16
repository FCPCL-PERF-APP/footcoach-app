import { describe, it, expect } from 'vitest'
import { noteSur10, joueursDuMatch, etapesFeuille } from './feuilleMatch'

describe('noteSur10', () => {
  it('note rapide ×2', () => expect(noteSur10({ note_globale: 4 })).toBe(8))
  it('les critères détaillés priment', () => expect(noteSur10({ note_globale: 2, perf_individuelle: 4, consignes: 3 })).toBe(7))
  it('rien de saisi', () => expect(noteSur10({})).toBeNull())
})

describe('joueursDuMatch', () => {
  const joueurs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('convoqués moins absents', () => {
    expect(joueursDuMatch({ joueurs, convoques: new Set(['a', 'b']), absents: new Set(['b']) }).map(j => j.id)).toEqual(['a'])
  })
  it('sans convocations : compo + banc', () => {
    expect(joueursDuMatch({ joueurs, compo: { g: 'c' }, banc: ['a', ''] }).map(j => j.id)).toEqual(['a', 'c'])
  })
})

describe('etapesFeuille', () => {
  it('compte les étapes obligatoires faites', () => {
    const cibles = [{ id: 'a' }, { id: 'b' }]
    const r = etapesFeuille({
      nbConvoques: 2, cibles,
      rapport: { compo_visuelle: { g: 'a' }, chronologie: [{ type: 'but_pour' }], points_forts_globaux: '<p> </p>' },
      score: { buts_marques: 2, buts_encaisses: 1 },
      notes: [{ joueur_id: 'a', note_globale: 4 }, { joueur_id: 'b', note_globale: 3 }],
      rpeIds: new Set(['a']),
    })
    const etat = Object.fromEntries(r.etapes.map(e => [e.cle, e.fait]))
    expect(etat).toMatchObject({ convocations: true, compo: true, suivi: true, score: true, notes: true, rpe: false, rapport: false })
    expect([r.faites, r.total]).toEqual([4, 6])
  })
})
