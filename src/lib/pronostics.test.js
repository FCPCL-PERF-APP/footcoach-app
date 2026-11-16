import { describe, it, expect, vi } from 'vitest'
vi.mock('./supabase', () => ({ supabase: {} }))
import { pointsPronostic } from './pronostics'

describe('pointsPronostic', () => {
  it('3 points score exact, 1 bonne tendance, 0 sinon', () => {
    expect(pointsPronostic({ score_domicile: 2, score_exterieur: 1 }, 2, 1)).toBe(3)
    expect(pointsPronostic({ score_domicile: 3, score_exterieur: 0 }, 2, 1)).toBe(1)
    expect(pointsPronostic({ score_domicile: 1, score_exterieur: 1 }, 0, 0)).toBe(1)
    expect(pointsPronostic({ score_domicile: 0, score_exterieur: 2 }, 2, 1)).toBe(0)
  })
})
