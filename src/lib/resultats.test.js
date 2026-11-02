import { describe, it, expect } from 'vitest'
import { pointsChampionnat } from './resultats'

const s = (type, bm, be) => ({ buts_marques: bm, buts_encaisses: be, evenements: { match_type: type } })

describe('pointsChampionnat', () => {
  it('ne compte que le championnat (victoires de coupe exclues)', () => {
    const r = pointsChampionnat([s('coupe', 3, 0), s('coupe', 2, 1), s('coupe', 1, 0), s('championnat', 0, 1), s('championnat', 0, 2)])
    expect(r).toMatchObject({ pts: 0, hasChampionnat: true, victoires: 0, nuls: 0, defaites: 2 })
  })
  it('ni préparation ni amical', () => {
    expect(pointsChampionnat([s('preparation', 5, 0)]).hasChampionnat).toBe(false)
  })
  it('3 pts la victoire, 1 le nul', () => {
    expect(pointsChampionnat([s('championnat', 2, 0), s('championnat', 1, 1), s('championnat', 0, 3)]).pts).toBe(4)
  })
  it("une ligne de stats sans score n'est pas un match nul", () => {
    const r = pointsChampionnat([s('championnat', null, null), s('championnat', 1, 0)])
    expect(r).toMatchObject({ pts: 3, nuls: 0, hasChampionnat: true })
  })
  it('un 0-0 compte comme un nul', () => {
    expect(pointsChampionnat([s('championnat', 0, 0)]).pts).toBe(1)
  })
  it('aucun match : pas de tuile points', () => {
    expect(pointsChampionnat([])).toMatchObject({ hasChampionnat: false, pts: 0 })
    expect(pointsChampionnat(null).hasChampionnat).toBe(false)
  })
})
