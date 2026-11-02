import { describe, it, expect } from 'vitest'
import { computePresenceBreakdown } from './presenceStats'

const rows = (...statuts) => statuts.map(statut => ({ statut }))

describe('computePresenceBreakdown', () => {
  it('présent + extérieur = engagement', () => {
    const r = computePresenceBreakdown(rows('present', 'exterieur', 'absent', 'absent'))
    expect(r).toMatchObject({ present: 1, exterieur: 1, absent: 2, total: 4, tauxEngagement: 50 })
  })
  it('les blessés sortent du dénominateur (pas pénalisés)', () => {
    const r = computePresenceBreakdown(rows('present', 'blesse', 'blesse', 'absent'))
    expect(r.tauxEngagement).toBe(50) // 1 / (4 - 2)
    expect(r.blesse).toBe(2)
  })
  it('taux null si tout le monde est blessé ou si liste vide (pas de division par 0)', () => {
    expect(computePresenceBreakdown(rows('blesse')).tauxEngagement).toBeNull()
    expect(computePresenceBreakdown([]).tauxEngagement).toBeNull()
  })
  it('compte les sans-réponse', () => {
    const r = computePresenceBreakdown([{ statut: null }, { statut: 'inconnu' }, { statut: 'present' }])
    expect(r.inconnu).toBe(2)
  })
  it('arrondit au pourcent', () => {
    expect(computePresenceBreakdown(rows('present', 'absent', 'absent')).tauxEngagement).toBe(33)
  })
})
