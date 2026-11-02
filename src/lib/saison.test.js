import { describe, it, expect } from 'vitest'
import { bornesSaison, labelSaison } from './saison'

describe('saison (1er juillet → 30 juin)', () => {
  it.each([
    [new Date(2026, 6, 1), 2026],   // 1er juillet : nouvelle saison
    [new Date(2026, 5, 30), 2025],  // 30 juin : encore l'ancienne
    [new Date(2026, 8, 15), 2026],
    [new Date(2027, 2, 10), 2026],  // mars 2027 : saison 2026/2027
    [new Date(2026, 0, 1), 2025],
  ])('%s → saison %i', (date, annee) => {
    expect(bornesSaison(date).year).toBe(annee)
  })
  it('le début de saison est le 1er juillet', () => {
    const d = new Date(bornesSaison(new Date(2026, 9, 1)).debut)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 1])
  })
  it('libellé 2026/2027', () => {
    expect(labelSaison(new Date(2026, 9, 1))).toBe('2026/2027')
    expect(labelSaison(new Date(2027, 1, 1))).toBe('2026/2027')
  })
})
