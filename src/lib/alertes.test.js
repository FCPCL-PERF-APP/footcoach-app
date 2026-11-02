import { describe, it, expect } from 'vitest'
import { computeAlertes, alertKey } from './alertes'

const rpe = (joueurId, nom, evenementId, v, extra = {}) => ({
  joueur_id: joueurId, evenement_id: evenementId, joueurs: { id: joueurId, nom, prenom: 'X' },
  difficulte: v, fatigue: v, implication: v, motivation: v, perf_individuelle: v, perf_collective: v, ...extra,
})
const joueurs = [{ id: 'j1', nom: 'Dupont', prenom: 'A' }, { id: 'j2', nom: 'Martin', prenom: 'B' }]

describe('computeAlertes — individuelles', () => {
  it('surcharge : RPE moyen ≥ 4.5 sur 3 séances', () => {
    const { alertes } = computeAlertes({
      rpeData: [rpe('j1', 'Dupont', 'e1', 5), rpe('j1', 'Dupont', 'e2', 5), rpe('j1', 'Dupont', 'e3', 4.5), rpe('j2', 'Martin', 'e1', 2)],
      joueursData: joueurs, matchResults: [], absencesData: [],
    })
    expect(alertes.some(a => a.title === 'Dupont — Surcharge' && a.type === 'red')).toBe(true)
    expect(alertes.some(a => a.title.startsWith('Martin') && a.title.includes('Surcharge'))).toBe(false)
  })

  it('pas de surcharge sous le seuil', () => {
    const { alertes } = computeAlertes({
      rpeData: [rpe('j1', 'Dupont', 'e1', 4), rpe('j1', 'Dupont', 'e2', 4), rpe('j1', 'Dupont', 'e3', 4)],
      joueursData: [joueurs[0]], matchResults: [], absencesData: [],
    })
    expect(alertes.some(a => a.title.includes('Surcharge'))).toBe(false)
  })

  it('fatigue chronique : fatigue ≥ 4 trois fois de suite', () => {
    const f = (e) => rpe('j1', 'Dupont', e, 3, { fatigue: 4 })
    const { alertes } = computeAlertes({ rpeData: [f('e1'), f('e2'), f('e3')], joueursData: [joueurs[0]], matchResults: [], absencesData: [] })
    expect(alertes.some(a => a.title === 'Dupont — Fatigue chronique')).toBe(true)
  })

  it('un joueur absent/blessé ne déclenche aucune alerte', () => {
    const { alertes } = computeAlertes({
      rpeData: [rpe('j1', 'Dupont', 'e1', 5), rpe('j1', 'Dupont', 'e2', 5), rpe('j1', 'Dupont', 'e3', 5)],
      joueursData: [joueurs[0]], matchResults: [], absencesData: [{ joueur_id: 'j1' }],
    })
    expect(alertes).toEqual([])
  })

  it('RPE manquant : joueur sans aucune donnée', () => {
    const { alertes } = computeAlertes({ rpeData: [], joueursData: joueurs, matchResults: [], absencesData: [] })
    expect(alertes.filter(a => a.type === 'yellow' && a.title.includes('RPE manquant'))).toHaveLength(2)
  })

  it('tolère des listes vides ou nulles', () => {
    expect(() => computeAlertes({ rpeData: null, joueursData: null, matchResults: null, absencesData: null })).not.toThrow()
  })
})

describe('computeAlertes — collectives', () => {
  it('3 défaites consécutives', () => {
    const { alertesCollectives } = computeAlertes({ rpeData: [], joueursData: [], matchResults: ['D', 'D', 'D', 'V'], absencesData: [] })
    expect(alertesCollectives.some(a => a.title === '3 défaites consécutives')).toBe(true)
  })
  it('pas d\'alerte avec une victoire parmi les 3 derniers', () => {
    const { alertesCollectives } = computeAlertes({ rpeData: [], joueursData: [], matchResults: ['D', 'V', 'D'], absencesData: [] })
    expect(alertesCollectives.some(a => a.title === '3 défaites consécutives')).toBe(false)
  })

  it('surcharge collective : RPE moyen équipe ≥ 4.2', () => {
    const data = [rpe('j1', 'Dupont', 'e1', 4.5), rpe('j2', 'Martin', 'e1', 4.5)]
    const { alertesCollectives } = computeAlertes({ rpeData: data, joueursData: joueurs, matchResults: [], absencesData: [] })
    expect(alertesCollectives.some(a => a.title === 'Surcharge collective')).toBe(true)
  })

  it("exclut les saisies « hors convocation » des alertes COLLECTIVES mais pas des individuelles", () => {
    // j2 n'était pas convoqué à e1 mais a rempli un RPE très élevé : il ne doit pas gonfler la moyenne d'équipe
    const data = [rpe('j1', 'Dupont', 'e1', 2), rpe('j2', 'Martin', 'e1', 5), rpe('j2', 'Martin', 'e2', 5), rpe('j2', 'Martin', 'e3', 5)]
    const avec = computeAlertes({ rpeData: data, joueursData: joueurs, matchResults: [], absencesData: [] })
    expect(avec.alertesCollectives.some(a => a.title === 'Surcharge collective')).toBe(true)

    const nonConvoqueSet = new Set(['j2_e1', 'j2_e2', 'j2_e3'])
    const sans = computeAlertes({ rpeData: data, joueursData: joueurs, matchResults: [], absencesData: [], nonConvoqueSet })
    expect(sans.alertesCollectives.some(a => a.title === 'Surcharge collective')).toBe(false)
    // …mais l'alerte individuelle de Martin reste (vue « par joueur »)
    expect(sans.alertes.some(a => a.title === 'Martin — Surcharge')).toBe(true)
  })
})

describe('alertKey', () => {
  it('clé individuelle et collective, avec le palier', () => {
    expect(alertKey({ title: 'Dupont — Surcharge', bucket: 4.5 }, 'j1')).toBe('ind-j1-Dupont — Surcharge-4.5')
    expect(alertKey({ title: 'Surcharge collective', bucket: 4 })).toBe('col-Surcharge collective-4')
    expect(alertKey({ title: '3 défaites consécutives' })).toBe('col-3 défaites consécutives')
  })
})
