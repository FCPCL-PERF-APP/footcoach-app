import { describe, it, expect } from 'vitest'
import { periodeButs, statsCollectivesDepuisChrono, butsPassesParJoueur, cartonsParJoueur, tempsDeJeuParJoueur } from './chronologie'

describe('periodeButs — bornes inclusives en fin de période', () => {
  it.each([
    [0, '0_15'], [15, '0_15'], [16, '15_30'], [30, '15_30'], [31, '30_45'],
    [45, '30_45'], // but à la 45' = fin de 1ère mi-temps, pas début de la 2nde
    [46, '45_60'], [60, '45_60'], [61, '60_75'], [75, '60_75'], [76, '75_90'], [90, '75_90'], [95, '75_90'],
  ])('minute %i → %s', (minute, attendu) => {
    expect(periodeButs(minute, '')).toBe(attendu)
  })
  it('gère minute absente et préfixe', () => {
    expect(periodeButs(undefined, 'buts_')).toBe('buts_0_15')
    expect(periodeButs(46, 'buts_enc_')).toBe('buts_enc_45_60')
  })
})

describe('statsCollectivesDepuisChrono', () => {
  it('renvoie null sans aucun but (la saisie manuelle reste la source)', () => {
    expect(statsCollectivesDepuisChrono([])).toBeNull()
    expect(statsCollectivesDepuisChrono([{ type: 'carton_jaune', minute: 10 }])).toBeNull()
    expect(statsCollectivesDepuisChrono(null)).toBeNull()
  })

  it('compte buts marqués par phase et par période', () => {
    const r = statsCollectivesDepuisChrono([
      { type: 'but_pour', minute: 12, phase: 'corner' },
      { type: 'but_pour', minute: 45, phase: 'attaque_placee' },
      { type: 'but_pour', minute: 46, phase: 'attaque_placee' },
      { type: 'but_pour', minute: 80 },
    ])
    expect(r.buts_marques).toBe(4)
    expect(r.but_marque_corner).toBe(1)
    expect(r.but_marque_attaque_placee).toBe(2)
    expect(r.but_marque_penalty).toBe(0)
    expect(r.buts_0_15).toBe(1)
    expect(r.buts_30_45).toBe(1)
    expect(r.buts_45_60).toBe(1)
    expect(r.buts_75_90).toBe(1)
  })

  it("ne renseigne que le côté présent (marqués seulement → pas de clés d'encaissés)", () => {
    const r = statsCollectivesDepuisChrono([{ type: 'but_pour', minute: 5 }])
    expect(r.buts_encaisses).toBeUndefined()
    expect(r.buts_enc_0_15).toBeUndefined()
  })

  it('compte les buts encaissés avec leurs propres clés', () => {
    const r = statsCollectivesDepuisChrono([
      { type: 'but_contre', minute: 30, phase: 'coup_franc' },
      { type: 'but_contre', minute: 31, phase: 'contre_attaque' },
    ])
    expect(r.buts_encaisses).toBe(2)
    expect(r.but_enc_coup_franc).toBe(1)
    expect(r.but_enc_contre_attaque).toBe(1)
    expect(r.buts_enc_15_30).toBe(1)
    expect(r.buts_enc_30_45).toBe(1)
    expect(r.buts_marques).toBeUndefined()
  })

  it('ignore une phase inconnue sans planter', () => {
    const r = statsCollectivesDepuisChrono([{ type: 'but_pour', minute: 5, phase: 'bizarre' }])
    expect(r.buts_marques).toBe(1)
    expect(Object.entries(r).filter(([k]) => k.startsWith('but_marque_')).every(([, v]) => v === 0)).toBe(true)
  })
})

describe('butsPassesParJoueur', () => {
  it('cumule buts et passes, et remet à 0 les joueurs déjà connus non cités', () => {
    const r = butsPassesParJoueur([
      { type: 'but_pour', buteur_id: 'A', passeur_id: 'B' },
      { type: 'but_pour', buteur_id: 'A' },
      { type: 'but_pour', buteur_id: 'C', passeur_id: 'A' },
    ], ['D'])
    const par = Object.fromEntries(r.map(x => [x.joueur_id, x]))
    expect(par.A).toMatchObject({ buts: 2, passes_decisives: 1 })
    expect(par.B).toMatchObject({ buts: 0, passes_decisives: 1 })
    expect(par.C).toMatchObject({ buts: 1, passes_decisives: 0 })
    expect(par.D).toMatchObject({ buts: 0, passes_decisives: 0 })
  })
  it('ne touche à rien sans but pour', () => {
    expect(butsPassesParJoueur([{ type: 'but_contre' }], ['A'])).toEqual([])
  })
})

describe('cartonsParJoueur', () => {
  it('distingue jaune et rouge et remet à faux les autres', () => {
    const r = cartonsParJoueur([
      { type: 'carton_jaune', joueur_id: 'A' },
      { type: 'carton_rouge', joueur_id: 'B' },
    ], ['C'])
    const par = Object.fromEntries(r.map(x => [x.joueur_id, x]))
    expect(par.A).toMatchObject({ carton_jaune: true, carton_rouge: false })
    expect(par.B).toMatchObject({ carton_jaune: false, carton_rouge: true })
    expect(par.C).toMatchObject({ carton_jaune: false, carton_rouge: false })
  })
  it('ignore un carton sans joueur désigné', () => {
    expect(cartonsParJoueur([{ type: 'carton_jaune' }], [])).toEqual([])
  })
})

describe('tempsDeJeuParJoueur', () => {
  const temps = (res, id) => res.find(x => x.joueur_id === id)

  it('titulaire de la compo sans mouvement : match entier (90 par défaut)', () => {
    const r = tempsDeJeuParJoueur({ entries: [], compo: { GK: 'A' } })
    expect(temps(r, 'A')).toEqual({ joueur_id: 'A', temps_jeu: 90, titulaire: true })
  })

  it('respecte une durée de match personnalisée', () => {
    const r = tempsDeJeuParJoueur({ entries: [], compo: { GK: 'A' }, duree: 80 })
    expect(temps(r, 'A').temps_jeu).toBe(80)
  })

  it('titulaire remplacé à la 60e → 60 min', () => {
    const r = tempsDeJeuParJoueur({
      entries: [{ type: 'changement', minute: 60, sortant_id: 'A', entrant_id: 'B' }],
      compo: { GK: 'A' },
    })
    expect(temps(r, 'A')).toMatchObject({ temps_jeu: 60, titulaire: true })
    expect(temps(r, 'B')).toMatchObject({ temps_jeu: 30, titulaire: false })
  })

  it('joueur sorti puis rentré : cumule tous ses passages (cas « Tual » : 52 min)', () => {
    const r = tempsDeJeuParJoueur({
      entries: [
        { type: 'changement', minute: 30, sortant_id: 'T', entrant_id: 'X' },
        { type: 'changement', minute: 60, sortant_id: 'Y', entrant_id: 'T' },
        { type: 'changement', minute: 82, sortant_id: 'T', entrant_id: 'Z' },
      ],
      compo: { ST: 'T' },
    })
    expect(temps(r, 'T')).toMatchObject({ temps_jeu: 52, titulaire: true }) // 0-30 puis 60-82
  })

  it('remplaçant entré qui ressort puis revient', () => {
    const r = tempsDeJeuParJoueur({
      entries: [
        { type: 'changement', minute: 20, sortant_id: 'A', entrant_id: 'R' },
        { type: 'changement', minute: 50, sortant_id: 'R', entrant_id: 'A' },
      ],
      compo: { GK: 'A' },
    })
    expect(temps(r, 'R')).toMatchObject({ temps_jeu: 30, titulaire: false })
    expect(temps(r, 'A')).toMatchObject({ temps_jeu: 20 + 40, titulaire: true })
  })

  it("buteur jamais cité dans un changement : joue le match entier (cas « Rohée »)", () => {
    const r = tempsDeJeuParJoueur({ entries: [{ type: 'but_pour', minute: 33, buteur_id: 'R' }], compo: {} })
    expect(temps(r, 'R')).toEqual({ joueur_id: 'R', temps_jeu: 90, titulaire: true })
  })

  it('passeur et joueur averti sont aussi pris en compte', () => {
    const r = tempsDeJeuParJoueur({
      entries: [
        { type: 'but_pour', minute: 10, buteur_id: 'A', passeur_id: 'P' },
        { type: 'carton_jaune', minute: 20, joueur_id: 'C' },
      ],
    })
    expect(r.map(x => x.joueur_id).sort()).toEqual(['A', 'C', 'P'])
  })

  it('un remplaçant entré sans jamais ressortir joue de son entrée à la fin', () => {
    const r = tempsDeJeuParJoueur({
      entries: [{ type: 'changement', minute: 70, sortant_id: 'A', entrant_id: 'B' }],
      compo: { GK: 'A' },
    })
    expect(temps(r, 'B')).toMatchObject({ temps_jeu: 20, titulaire: false })
  })

  it('titulaire connu en base (compo non remplie) reste titulaire', () => {
    const r = tempsDeJeuParJoueur({ entries: [], titulairesConnus: ['A'] })
    expect(temps(r, 'A')).toMatchObject({ temps_jeu: 90, titulaire: true })
  })

  it('un joueur du banc absent de la chronologie n\'apparaît pas (le banc n\'est pas la compo)', () => {
    const r = tempsDeJeuParJoueur({ entries: [], compo: { GK: 'A' } })
    expect(r.map(x => x.joueur_id)).toEqual(['A'])
  })

  it('ne produit jamais de temps négatif sur des minutes incohérentes', () => {
    const r = tempsDeJeuParJoueur({
      entries: [{ type: 'changement', minute: 120, sortant_id: 'A', entrant_id: 'B' }],
      compo: { GK: 'A' },
    })
    expect(temps(r, 'A').temps_jeu).toBeGreaterThanOrEqual(0)
    expect(temps(r, 'B').temps_jeu).toBeGreaterThanOrEqual(0)
  })
})
