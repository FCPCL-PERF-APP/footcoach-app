import { describe, it, expect } from 'vitest'
import { attendus, bilansRetours, assiduite, presenceSeancesParSemaine } from './suiviRetours'

const joueurs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
const seance = { id: 's1', type: 'seance', date_heure: '2026-11-18T19:00:00Z' }
const match = { id: 'm1', type: 'match', date_heure: '2026-11-15T15:00:00Z' }
const ctx = {
  joueurs,
  convoques: new Map([['m1', new Set(['a', 'b'])]]),
  absents: new Map([['s1', new Set(['c'])]]),
  prochain: '2026-11-22T10:00:00Z',
}
const faits = { rpe: new Map([['s1', new Set(['a'])], ['m1', new Set(['a', 'b'])]]), foot: new Map([['m1', new Set(['a'])]]) }

describe('suivi des retours', () => {
  it('attendus : convoqués en match, effectif en séance, moins absents/blessés', () => {
    expect(attendus(match, ctx).map(j => j.id)).toEqual(['a', 'b'])
    expect(attendus(seance, ctx).map(j => j.id)).toEqual(['a', 'b'])
  })
  it('bilan par événement et clôture quand le suivant a commencé', () => {
    const b = bilansRetours([seance, match], ctx, faits, new Date('2026-11-20T12:00:00Z'))
    expect(b[0]).toMatchObject({ attendus: 2, rpe: 1, foot: 0, clos: false })
    expect(b[0].sansRpe.map(j => j.id)).toEqual(['b'])
    expect(b[1]).toMatchObject({ attendus: 2, rpe: 2, foot: 1, clos: true })
  })
  it('assiduité triée du moins assidu au plus assidu', () => {
    const b = bilansRetours([seance, match], ctx, faits, new Date('2026-11-20T12:00:00Z'))
    const a = assiduite(b, joueurs)
    expect(a.map(s => [s.joueur.id, s.rpe, s.attendus, s.tauxRpe])).toEqual([['b', 1, 2, 50], ['a', 2, 2, 100]])
  })
  it('présence séances : non-réponse = absent, blessés hors effectif', () => {
    const statuts = new Map([['s1', new Map([['a', 'present'], ['c', 'blesse']])]])
    expect(presenceSeancesParSemaine([seance], { joueurs, statuts }, () => 'S47')).toEqual([{ label: 'S47', value: 50 }])
  })
})
