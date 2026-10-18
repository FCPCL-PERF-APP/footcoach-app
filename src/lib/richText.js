// Texte enrichi des rapports de match (gras, souligné, barré, couleur, surlignage...).
// Le contenu est stocké en HTML dans les mêmes colonnes texte qu'avant : les anciens
// rapports (texte brut avec retours à la ligne) restent lisibles tels quels.
// Tout HTML est passé par sanitizeHtml avant d'être stocké ou affiché : seules quelques
// balises et propriétés de style sont conservées (jamais de script, de lien ni d'attribut
// d'événement), même si le texte vient d'un copier-coller depuis Word ou un site web.

const TAGS_OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SPAN', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'FONT'])
const COULEUR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\)|[a-z]{3,20})$/i

function styleSur(el) {
  const out = []
  const get = p => (el.style.getPropertyValue(p) || '').trim()
  const color = get('color') || (el.tagName === 'FONT' ? (el.getAttribute('color') || '').trim() : '')
  const bg = get('background-color')
  if (color && COULEUR.test(color)) out.push(`color:${color}`)
  if (bg && COULEUR.test(bg) && !/^(transparent|inherit|initial|white|#fff(fff)?|rgb\(255,\s*255,\s*255\))$/i.test(bg)) {
    out.push(`background-color:${bg}`)
    // Texte sombre sur surlignage clair : lisible aussi en mode sombre de l'appli.
    if (!color) out.push('color:#111')
  }
  const fw = get('font-weight')
  if (fw === 'bold' || fw === '700' || fw === '600' || fw === '800') out.push('font-weight:700')
  if (get('font-style') === 'italic') out.push('font-style:italic')
  const td = get('text-decoration-line') || get('text-decoration')
  const decos = []
  if (/underline/.test(td)) decos.push('underline')
  if (/line-through/.test(td)) decos.push('line-through')
  if (decos.length) out.push(`text-decoration:${decos.join(' ')}`)
  return out.join(';')
}

function nettoyer(noeud, doc) {
  const sortie = doc.createDocumentFragment()
  for (const enfant of Array.from(noeud.childNodes)) {
    if (enfant.nodeType === 3) { sortie.appendChild(doc.createTextNode(enfant.nodeValue)); continue }
    if (enfant.nodeType !== 1) continue
    const tag = enfant.tagName
    if (tag === 'SCRIPT' || tag === 'STYLE') continue
    if (!TAGS_OK.has(tag)) { sortie.appendChild(nettoyer(enfant, doc)); continue }
    if (tag === 'BR') { sortie.appendChild(doc.createElement('br')); continue }
    const balise = tag === 'FONT' ? 'span' : tag === 'STRIKE' || tag === 'DEL' ? 's' : tag.toLowerCase()
    const el = doc.createElement(balise)
    if (balise === 'span') {
      const st = styleSur(enfant)
      if (!st) { sortie.appendChild(nettoyer(enfant, doc)); continue }
      el.setAttribute('style', st)
    }
    el.appendChild(nettoyer(enfant, doc))
    sortie.appendChild(el)
  }
  return sortie
}

export function sanitizeHtml(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const cible = document.createElement('div')
  cible.appendChild(nettoyer(doc.body, document))
  return cible.innerHTML
}

const RECONNU = /<(b|i|u|s|strong|em|span|div|br|p|ul|ol|li|strike|font)[\s>/]/i

function echapper(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Valeur stockée → HTML affichable/éditable. Un ancien texte brut est échappé et ses
// retours à la ligne conservés.
export function toEditorHtml(valeur) {
  if (!valeur) return ''
  if (RECONNU.test(valeur)) return sanitizeHtml(valeur)
  return echapper(valeur).replace(/\n/g, '<br>')
}

// Valeur stockée → texte brut (partage dans la messagerie, notifications...).
export function htmlToPlainText(valeur) {
  if (!valeur) return ''
  if (!RECONNU.test(valeur)) return valeur
  const el = document.createElement('div')
  el.innerHTML = sanitizeHtml(valeur).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li)>/gi, '\n')
  return (el.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}
