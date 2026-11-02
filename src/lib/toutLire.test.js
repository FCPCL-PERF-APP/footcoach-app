import { describe, it, expect } from 'vitest'
import { toutLire } from './toutLire'

// Fausse requête Supabase : garde les appels order/range et sert une tranche de `lignes`.
function fauxClient(lignes, { erreurAuPaquet } = {}) {
  const appels = []
  const construire = () => {
    const q = {
      ordres: [],
      order(c) { this.ordres.push(c); return this },
      async range(a, b) {
        appels.push([a, b, [...this.ordres]])
        if (erreurAuPaquet === appels.length) return { data: null, error: { message: 'boom' } }
        return { data: lignes.slice(a, b + 1), error: null }
      },
    }
    return q
  }
  return { construire, appels }
}

describe('toutLire', () => {
  it('récupère tout au-delà de la limite', async () => {
    const lignes = Array.from({ length: 2500 }, (_, i) => ({ i }))
    const { construire, appels } = fauxClient(lignes)
    const { data, error } = await toutLire(construire)
    expect(error).toBeNull()
    expect(data).toHaveLength(2500)
    expect(appels.map(a => a[0])).toEqual([0, 1000, 2000])
    expect(appels[0][2]).toEqual(['evenement_id', 'joueur_id'])
  })

  it('fait une page de plus quand le total tombe juste', async () => {
    const { construire, appels } = fauxClient(Array.from({ length: 1000 }, (_, i) => i))
    const { data } = await toutLire(construire)
    expect(data).toHaveLength(1000)
    expect(appels).toHaveLength(2)
  })

  it('remonte une erreur au lieu de données partielles', async () => {
    const { construire } = fauxClient(Array.from({ length: 1500 }, (_, i) => i), { erreurAuPaquet: 2 })
    const { data, error } = await toutLire(construire)
    expect(data).toBeNull()
    expect(error.message).toBe('boom')
  })

  it('gère une table vide', async () => {
    const { construire } = fauxClient([])
    expect((await toutLire(construire)).data).toEqual([])
  })
})
