import { describe, it, expect } from 'vitest'
import { calculer, cle, analyserTexte, joue } from './championnat'

const m = (journee, dom, ext, sd, se, date) => ({ journee, equipe_dom: dom, equipe_ext: ext, score_dom: sd, score_ext: se, date_match: date })

describe('calculer — classement', () => {
  it('3 points la victoire, 1 le nul, 0 la défaite, avec buts et différence', () => {
    const c = calculer([m(1, 'A', 'B', 2, 1), m(1, 'C', 'D', 0, 0)])
    const par = Object.fromEntries(c.map(e => [e.nom, e]))
    expect(par.A).toMatchObject({ pts: 3, j: 1, g: 1, n: 0, p: 0, bp: 2, bc: 1, diff: 1 })
    expect(par.B).toMatchObject({ pts: 0, j: 1, g: 0, p: 1, bp: 1, bc: 2, diff: -1 })
    expect(par.C).toMatchObject({ pts: 1, n: 1 })
    expect(par.D).toMatchObject({ pts: 1, n: 1 })
  })

  it('ignore les matchs sans score (à venir) mais liste quand même les équipes', () => {
    const c = calculer([m(1, 'A', 'B', null, null), m(2, 'A', 'C', 1, 0)])
    expect(c.map(e => e.nom).sort()).toEqual(['A', 'B', 'C'])
    expect(c.find(e => e.nom === 'B').j).toBe(0)
    expect(c.find(e => e.nom === 'A').j).toBe(1)
  })

  it('un 0-0 est bien un match joué (0 n\'est pas « pas de score »)', () => {
    expect(joue(m(1, 'A', 'B', 0, 0))).toBe(true)
    expect(joue(m(1, 'A', 'B', null, null))).toBe(false)
    expect(joue(m(1, 'A', 'B', 1, undefined))).toBe(false)
  })

  it('départage : points, puis différence de buts, puis buts marqués, puis nom', () => {
    const c = calculer([
      m(1, 'A', 'X', 3, 0), // A : 3 pts, diff +3
      m(1, 'B', 'Y', 1, 0), // B : 3 pts, diff +1
      m(1, 'C', 'Z', 4, 1), // C : 3 pts, diff +3, 4 buts marqués → devant A
    ])
    expect(c.slice(0, 3).map(e => e.nom)).toEqual(['C', 'A', 'B'])
  })

  it('départage final par ordre alphabétique (ordre stable)', () => {
    const c = calculer([m(1, 'B', 'A', 1, 1)])
    expect(c.map(e => e.nom)).toEqual(['A', 'B'])
  })

  it('forme : 5 derniers résultats, du plus ancien au plus récent', () => {
    const matchs = [
      m(1, 'A', 'B', 1, 0), m(2, 'A', 'C', 0, 0), m(3, 'D', 'A', 3, 0),
      m(4, 'A', 'E', 2, 0), m(5, 'F', 'A', 0, 1), m(6, 'A', 'G', 1, 2), m(7, 'A', 'H', 4, 0),
    ]
    const a = calculer(matchs).find(e => e.nom === 'A')
    expect(a.resultats).toEqual(['V', 'N', 'D', 'V', 'V', 'D', 'V'])
    expect(a.forme).toEqual(['D', 'V', 'V', 'D', 'V'])
  })

  it("la forme suit l'ordre des journées, pas l'ordre de saisie", () => {
    const a = calculer([m(2, 'A', 'B', 0, 1), m(1, 'A', 'C', 1, 0)]).find(e => e.nom === 'A')
    expect(a.forme).toEqual(['V', 'D'])
  })

  it("liste vide : pas d'erreur", () => {
    expect(calculer([])).toEqual([])
  })
})

describe('cle — rapprochement des noms d\'équipes', () => {
  it('ignore accents, casse et ponctuation', () => {
    expect(cle('Pont. Ent Trieux Fc')).toBe(cle('PONT ENT TRIEUX FC'))
    expect(cle('Plouagat-Châtelaudren')).toBe(cle('plouagat chatelaudren'))
  })
})

describe('analyserTexte — import copier-coller', () => {
  it('lit un match joué', () => {
    const { rows } = analyserTexte('Pont. Ent Trieux Fc 2 - 1 Cavan Js')
    expect(rows).toEqual([{ dom: 'Pont. Ent Trieux Fc', ext: 'Cavan Js', sd: 2, se: 1 }])
  })
  it('lit un 0-0 et différents tirets', () => {
    expect(analyserTexte('Rospez Cs 0 – 0 Begard Cs').rows[0]).toMatchObject({ sd: 0, se: 0 })
    expect(analyserTexte('Rospez Cs 3 : 2 Begard Cs').rows[0]).toMatchObject({ sd: 3, se: 2 })
  })
  it('lit un match à venir, sans score', () => {
    const { rows } = analyserTexte('Rospez Cs - Begard Cs')
    expect(rows).toEqual([{ dom: 'Rospez Cs', ext: 'Begard Cs', sd: null, se: null }])
  })
  it('accepte « vs » et ignore les lignes inutiles', () => {
    const { rows, ignorees } = analyserTexte('Journée 3\nRospez Cs vs Begard Cs\n\nSamedi 12 septembre')
    expect(rows).toHaveLength(1)
    expect(ignorees).toEqual(['Journée 3', 'Samedi 12 septembre'])
  })
  it('gère plusieurs lignes et espaces multiples', () => {
    const { rows } = analyserTexte('A   1 - 0   B\nC 2 - 2 D')
    expect(rows.map(r => [r.dom, r.ext, r.sd, r.se])).toEqual([['A', 'B', 1, 0], ['C', 'D', 2, 2]])
  })
})
