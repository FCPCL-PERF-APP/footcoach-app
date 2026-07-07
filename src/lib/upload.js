// Garde-fous partagés pour les uploads utilisateur (photos, PDF) : taille max, type
// MIME attendu, et nom de fichier assaini (pas de "/" ou ".." pouvant sortir du dossier
// prévu dans le bucket Supabase Storage).
const MAX_SIZE_MB = { image: 5, pdf: 15 }

export function sanitizeFileName(name) {
  return (name || 'fichier')
    .replace(/[/\\]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/\s/g, '_')
}

// Retourne un message d'erreur si le fichier est invalide, ou null s'il est accepté.
export function validateFile(file, kind) {
  if (!file) return 'Aucun fichier sélectionné.'
  const maxMB = MAX_SIZE_MB[kind]
  if (file.size > maxMB * 1024 * 1024) {
    return `Le fichier dépasse la taille maximale autorisée (${maxMB} Mo).`
  }
  if (kind === 'image' && !file.type.startsWith('image/')) {
    return 'Le fichier doit être une image.'
  }
  if (kind === 'pdf' && file.type !== 'application/pdf') {
    return 'Le fichier doit être un PDF.'
  }
  return null
}
