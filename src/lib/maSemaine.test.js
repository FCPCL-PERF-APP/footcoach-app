import { describe, it, expect } from 'vitest'
import { resumeSemaine, motRecent } from './maSemaine'

const fin = new Date(2026, 10, 2, 12)
const ilYa = j => new Date(fin.getTime() - j * 86400000)

describe('resumeSemaine', () => {
  it('compte présences et RPE manquants', () => {
    const r = resumeSemaine({
      evenements: [{ id: 'a', type: 'seance' }, { id: 'b', type: 'seance' }, { id: 'm', type: 'match' }],
      presences: [{ evenement_id: 'a', statut: 'present' }, { evenement_id: 'b', statut: 'absent' }, { evenement_id: 'm', statut: 'present' }],
      rpeIds: new Set(['a']), fin,
    })
    expect(r.nbSeances).toBe(2)
    expect(r.nbSeancesPresent).toBe(1)
    expect([r.nbRpe, r.nbRpeAttendus]).toEqual([1, 2])
    expect(r.conseils[0]).toMatch(/manque 1 RPE/)
  })
  it('conseil de récupération après un pic de charge', () => {
    const charges = [...[22, 15, 8].map(j => ({ date: ilYa(j), charge: 300 })), ...[1, 2, 3, 4].map(j => ({ date: ilYa(j), charge: 600 }))]
    const r = resumeSemaine({ charges, fin })
    expect(r.zone.cle).toBe('risque')
    expect(r.conseils.join(' ')).toMatch(/récupération/)
  })
  it('félicite une présence complète', () => {
    const r = resumeSemaine({
      evenements: [{ id: 'a', type: 'seance' }, { id: 'b', type: 'seance' }],
      presences: [{ evenement_id: 'a', statut: 'present' }, { evenement_id: 'b', statut: 'exterieur' }],
      rpeIds: new Set(['a', 'b']), fin,
    })
    expect(r.conseils).toEqual(['Présent à toutes les séances, bravo.'])
  })
})

describe('motRecent', () => {
  it('prend le plus récent de moins de 14 jours', () => {
    const mots = [{ texte: 'vieux', created_at: ilYa(20).toISOString() }, { texte: 'a', created_at: ilYa(5).toISOString() }, { texte: 'b', created_at: ilYa(2).toISOString() }]
    expect(motRecent(mots, fin).texte).toBe('b')
    expect(motRecent([mots[0]], fin)).toBeNull()
  })
})
