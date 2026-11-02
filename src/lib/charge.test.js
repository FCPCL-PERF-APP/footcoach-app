import { describe, it, expect } from 'vitest'
import { intensiteRpe, dureeJoueur, chargeSeance, chargesDepuisRpe, chargesJournalieres, indicateursJoueur, zoneAcwr } from './charge'

const jour = (n, h = 19) => { const d = new Date(2026, 9, 1 + n, h); return d }

describe('intensité', () => {
  it('prend la valeur saisie', () => expect(intensiteRpe({ intensite: 7, difficulte: 2 })).toEqual({ valeur: 7, estimee: false }))
  it('estime depuis la difficulté puis la fatigue', () => {
    expect(intensiteRpe({ difficulte: 3 })).toEqual({ valeur: 6, estimee: true })
    expect(intensiteRpe({ fatigue: 4 })).toEqual({ valeur: 8, estimee: true })
    expect(intensiteRpe({ motivation: 5 })).toBeNull()
  })
  it('garde 0 comme valeur', () => expect(intensiteRpe({ intensite: 0 }).valeur).toBe(0))
})

describe('durée et charge', () => {
  it('match : temps de jeu réel', () => expect(dureeJoueur({ type: 'match' }, 25)).toBe(25))
  it('match sans temps de jeu : 90', () => expect(dureeJoueur({ type: 'match' }, null)).toBe(90))
  it('séance : durée saisie sinon 90', () => {
    expect(dureeJoueur({ type: 'seance', duree_min: 75 })).toBe(75)
    expect(dureeJoueur({ type: 'seance' })).toBe(90)
  })
  it('sRPE', () => expect(chargeSeance(6, 90)).toBe(540))
})

describe('chargesDepuisRpe', () => {
  it('assemble RPE, événement et temps de jeu', () => {
    const c = chargesDepuisRpe({
      rpe: [{ joueur_id: 'a', evenement_id: 'm', intensite: 8 }, { joueur_id: 'b', evenement_id: 's', difficulte: 2 }, { joueur_id: 'c', evenement_id: 'x', intensite: 5 }],
      evenements: [{ id: 'm', type: 'match', date_heure: jour(0).toISOString() }, { id: 's', type: 'seance', duree_min: 60, date_heure: jour(1).toISOString() }],
      stats: [{ evenement_id: 'm', joueur_id: 'a', temps_jeu: 30 }],
    })
    expect(c.map(x => [x.joueur_id, x.charge, x.estimee])).toEqual([['a', 240, false], ['b', 240, true]])
  })
})

describe('indicateurs', () => {
  it('répartit par jour, jours vides à 0', () => {
    const j = chargesJournalieres([{ date: jour(6), charge: 100 }, { date: jour(6, 10), charge: 50 }, { date: jour(0), charge: 10 }], jour(6), 7)
    expect(j).toEqual([10, 0, 0, 0, 0, 0, 150])
  })
  it('ACWR = 1 quand la charge est stable', () => {
    const charges = [0, 7, 14, 21].flatMap(s => [s + 1, s + 3, s + 5].map(d => ({ date: jour(d), charge: 500 })))
    const r = indicateursJoueur(charges, jour(27))
    expect(r.aigue).toBe(1500)
    expect(r.chronique).toBe(1500)
    expect(r.acwr).toBe(1)
    expect(r.monotonie).toBeGreaterThan(0)
  })
  it('ACWR élevé après un pic', () => {
    const charges = [...[0, 7, 14].map(d => ({ date: jour(d + 1), charge: 300 })), ...[22, 23, 24, 25].map(d => ({ date: jour(d), charge: 600 }))]
    expect(indicateursJoueur(charges, jour(27)).acwr).toBeGreaterThan(1.5)
  })
  it('pas d\'ACWR avec moins de 3 semaines de données', () => {
    expect(indicateursJoueur([{ date: jour(26), charge: 500 }], jour(27)).acwr).toBeNull()
  })
  it('zones', () => {
    expect(zoneAcwr(1.6).cle).toBe('risque')
    expect(zoneAcwr(1.4).cle).toBe('vigilance')
    expect(zoneAcwr(1).cle).toBe('optimal')
    expect(zoneAcwr(0.5).cle).toBe('sous-charge')
    expect(zoneAcwr(null)).toBeNull()
  })
})
