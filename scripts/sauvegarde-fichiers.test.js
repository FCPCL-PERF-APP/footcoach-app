import { describe, it, expect } from 'vitest'
import { listerFichiers } from './sauvegarde-fichiers.mjs'

describe('listerFichiers', () => {
  it('parcourt les dossiers récursivement', async () => {
    const arbre = {
      '': [{ name: 'photos', id: null }, { name: 'logo.png', id: '1', metadata: { size: 10 } }],
      'photos': [{ name: 'a.jpg', id: '2', metadata: { size: 5 } }, { name: 'match', id: null }],
      'photos/match': [{ name: 'b.jpg', id: '3', metadata: { size: 7 } }],
    }
    const appel = async (_route, { body }) => arbre[JSON.parse(body).prefix] || []
    const f = await listerFichiers(appel, 'joueurs')
    expect(f.map(x => x.chemin).sort()).toEqual(['logo.png', 'photos/a.jpg', 'photos/match/b.jpg'])
  })
  it('pagine au-delà de 1000 éléments', async () => {
    const tous = Array.from({ length: 1500 }, (_, i) => ({ name: `f${i}`, id: String(i) }))
    const appel = async (_r, { body }) => { const { offset, limit } = JSON.parse(body); return tous.slice(offset, offset + limit) }
    expect(await listerFichiers(appel, 'x')).toHaveLength(1500)
  })
})
