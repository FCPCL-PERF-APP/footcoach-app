import { describe, it, expect } from 'vitest'
import { noteSur10, joueursDuMatch, etapesFeuille, CASES_APRES_MATCH } from './feuilleMatch'

describe('noteSur10', () => {
  it('note rapide ×2', () => expect(noteSur10({ note_globale: 4 })).toBe(8))
  it('les critères détaillés priment', () => expect(noteSur10({ note_globale: 2, perf_individuelle: 4, consignes: 3 })).toBe(7))
  it('rien de saisi', () => expect(noteSur10({})).toBeNull())
})

describe('joueursDuMatch', () => {
  const joueurs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('convoqués moins absents', () => {
    expect(joueursDuMatch({ joueurs, convoques: new Set(['a', 'b']), absents: new Set(['b']) }).map(j => j.id)).toEqual(['a'])
  })
  it('sans convocations : compo + banc', () => {
    expect(joueursDuMatch({ joueurs, compo: { g: 'c' }, banc: ['a', ''] }).map(j => j.id)).toEqual(['a', 'c'])
  })
})

describe('etapesFeuille', () => {
  it('compte les étapes obligatoires faites', () => {
    const cibles = [{ id: 'a' }, { id: 'b' }]
    const r = etapesFeuille({
      nbConvoques: 2, cibles,
      rapport: { compo_visuelle: { g: 'a' }, chronologie: [{ type: 'but_pour' }], points_forts_globaux: '<p> </p>' },
      score: { buts_marques: 2, buts_encaisses: 1 },
      notes: [{ joueur_id: 'a', note_globale: 4 }, { joueur_id: 'b', note_globale: 3 }],
      rpeIds: new Set(['a']),
    })
    const etat = Object.fromEntries(r.etapes.map(e => [e.cle, e.fait]))
    expect(etat).toMatchObject({ convocations: true, compo: true, suivi: true, score: true, notes: true, rpe: false, rapport: false })
    expect([r.faites, r.total]).toEqual([4, 6])
  })
})

describe('rapport rédigé', () => {
  const base = { cibles: [], rapport: {} }
  it('pas rédigé tant que les 8 cases après-match ne sont pas remplies', () => {
    const rapport = Object.fromEntries(CASES_APRES_MATCH.slice(0, 7).map(k => [k, '<p>texte</p>']))
    rapport.schema_compo_adverse = 'https://img'
    const e = etapesFeuille({ ...base, rapport }).etapes.find(x => x.cle === 'rapport')
    expect(e.fait).toBe(false)
    expect(e.detail).toBe('Après-match : 7/8 cases remplies')
  })
  it('rédigé quand toutes sont remplies (schémas non exigés)', () => {
    const rapport = Object.fromEntries(CASES_APRES_MATCH.map(k => [k, 'ok']))
    expect(etapesFeuille({ ...base, rapport }).etapes.find(x => x.cle === 'rapport').fait).toBe(true)
  })
  it('une case avec seulement des balises vides ne compte pas', () => {
    const rapport = Object.fromEntries(CASES_APRES_MATCH.map(k => [k, 'ok']))
    rapport.problemes_def = '<p>&nbsp;</p>'
    expect(etapesFeuille({ ...base, rapport }).etapes.find(x => x.cle === 'rapport').fait).toBe(false)
  })
})
