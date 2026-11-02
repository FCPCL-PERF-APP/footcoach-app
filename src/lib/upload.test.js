import { describe, it, expect } from 'vitest'
import { sanitizeFileName, validateFile } from './upload'

describe('sanitizeFileName', () => {
  it('retire les accents (Supabase Storage refuse « Invalid key »)', () => {
    expect(sanitizeFileName('Séance du 11.09.2026.pdf')).toBe('Seance_du_11.09.2026.pdf')
  })
  it('neutralise séparateurs de dossier et ..', () => {
    expect(sanitizeFileName('../../etc/passwd')).not.toMatch(/[/\\]|\.\./)
    expect(sanitizeFileName('a\\b/c.pdf')).toBe('a_b_c.pdf')
  })
  it('ne garde que lettres, chiffres, point, tiret et underscore', () => {
    expect(sanitizeFileName("photo #1 (copie) é'à.jpg")).toMatch(/^[a-zA-Z0-9._-]+$/)
  })
  it('valeur par défaut', () => {
    expect(sanitizeFileName(undefined)).toBe('fichier')
  })
})

describe('validateFile', () => {
  const f = (type, mo) => ({ type, size: mo * 1024 * 1024 })
  it('refuse un fichier trop gros', () => {
    expect(validateFile(f('image/png', 6), 'image')).toMatch(/5 Mo/)
    expect(validateFile(f('application/pdf', 16), 'pdf')).toMatch(/15 Mo/)
  })
  it('refuse un mauvais type', () => {
    expect(validateFile(f('application/pdf', 1), 'image')).toMatch(/image/)
    expect(validateFile(f('image/png', 1), 'pdf')).toMatch(/PDF/)
  })
  it('accepte un fichier valide et refuse l\'absence de fichier', () => {
    expect(validateFile(f('image/jpeg', 1), 'image')).toBeNull()
    expect(validateFile(f('application/pdf', 1), 'pdf')).toBeNull()
    expect(validateFile(null, 'pdf')).toMatch(/Aucun/)
  })
})
