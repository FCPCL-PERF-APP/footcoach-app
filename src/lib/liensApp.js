// Liens internes glissés dans un message (ex. partage d'un rapport de match) : le
// texte « /match/<id> » devient un bouton qui ouvre la page dans l'appli.
const MOTIF = /(?:^|\s)(\/match\/[0-9a-f-]{36})(?=\s|$)/i

export function lienInterne(contenu) {
  const m = MOTIF.exec(contenu || '')
  return m ? m[1] : null
}

// Texte du message sans la ligne technique contenant le lien.
export function texteSansLien(contenu) {
  return (contenu || '').split('\n').filter(l => !MOTIF.test(l)).join('\n').trim()
}
