import { describe, it, expect } from 'vitest'
import { lienInterne, texteSansLien } from './liensApp'

const id = '3f2b8c1e-1234-4abc-9def-0123456789ab'
describe('liens internes', () => {
  it('trouve le lien de feuille de match', () => {
    expect(lienInterne(`Rapport\nOuvrir : /match/${id}`)).toBe(`/match/${id}`)
    expect(lienInterne('Bonjour')).toBeNull()
  })
  it('retire la ligne du lien du texte affiché', () => {
    expect(texteSansLien(`Rapport vs X\nÀ compléter\nOuvrir : /match/${id}`)).toBe('Rapport vs X\nÀ compléter')
  })
})
