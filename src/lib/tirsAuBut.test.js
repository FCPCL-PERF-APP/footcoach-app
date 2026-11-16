import { describe, it, expect } from 'vitest'
import { tabPossible, tabReussis, resumeTab } from './tirsAuBut'

describe('tirs au but', () => {
  it('seulement en coupe et sur un nul saisi', () => {
    expect(tabPossible('coupe', '1', '1')).toBe(true)
    expect(tabPossible('coupe', 2, 1)).toBe(false)
    expect(tabPossible('championnat', 1, 1)).toBe(false)
    expect(tabPossible('coupe', '', '')).toBe(false)
  })
  it('compte les réussis', () => {
    expect(tabReussis([{ reussi: true }, { reussi: false }, { reussi: true }])).toBe(2)
    expect(tabReussis(null)).toBe(0)
  })
  it('résumé qualifié / éliminé', () => {
    expect(resumeTab({ buts_marques: 1, buts_encaisses: 1, tab_marques: 4, tab_encaisses: 3 })).toEqual({ marques: 4, encaisses: 3, qualifie: true, label: 'TAB 4-3' })
    expect(resumeTab({ buts_marques: 0, buts_encaisses: 0, tab_marques: 2, tab_encaisses: 4 }).qualifie).toBe(false)
  })
  it('ignore les données incohérentes', () => {
    expect(resumeTab({ buts_marques: 2, buts_encaisses: 1, tab_marques: 4, tab_encaisses: 3 })).toBeNull()
    expect(resumeTab({ buts_marques: 1, buts_encaisses: 1, tab_marques: 3, tab_encaisses: 3 })).toBeNull()
    expect(resumeTab({ buts_marques: 1, buts_encaisses: 1 })).toBeNull()
  })
})
