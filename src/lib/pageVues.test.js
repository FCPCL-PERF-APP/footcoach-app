import { describe, it, expect } from 'vitest'
import { normaliserChemin, doitEnregistrer } from './pageVues'

describe('normaliserChemin', () => {
  it('remplace les identifiants', () => {
    expect(normaliserChemin('/joueurs/3f2b8c1e-1234-4abc-9def-0123456789ab/radar')).toBe('/joueurs/:id/radar')
    expect(normaliserChemin('/stats/42?x=1')).toBe('/stats/:id')
    expect(normaliserChemin('/')).toBe('/')
  })
})

describe('doitEnregistrer', () => {
  it('une fois par page toutes les 10 minutes', () => {
    const m = new Map()
    expect(doitEnregistrer(m, '/a', 0)).toBe(true)
    expect(doitEnregistrer(m, '/a', 60000)).toBe(false)
    expect(doitEnregistrer(m, '/b', 60000)).toBe(true)
    expect(doitEnregistrer(m, '/a', 11 * 60000)).toBe(true)
  })
})
