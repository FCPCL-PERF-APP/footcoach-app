// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, toEditorHtml, htmlToPlainText } from './richText'

describe('sanitizeHtml — sécurité', () => {
  it('supprime scripts, images à évènement, liens javascript et iframes', () => {
    const out = sanitizeHtml('<b>ok</b><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">lien</a><iframe src="x"></iframe>')
    expect(out).not.toMatch(/script|onerror|javascript|iframe|<img|<a /i)
    expect(out).toContain('<b>ok</b>')
  })
  it('retire les attributs dangereux des balises autorisées', () => {
    const out = sanitizeHtml('<b onclick="alert(1)" class="x">gras</b>')
    expect(out).toBe('<b>gras</b>')
  })
  it('ne laisse passer ni position:fixed ni autres styles', () => {
    const out = sanitizeHtml('<span style="position:fixed;color:red;background-image:url(x)">t</span>')
    expect(out).not.toMatch(/position|background-image|url/)
    expect(out).toContain('color:red')
  })
  it('refuse une valeur de couleur piégée', () => {
    expect(sanitizeHtml('<span style="color:red;} body{display:none">t</span>')).not.toMatch(/display/)
  })
  it('valeur vide', () => {
    expect(sanitizeHtml('')).toBe('')
    expect(sanitizeHtml(null)).toBe('')
  })
})

describe('sanitizeHtml — mise en forme conservée', () => {
  it('gras, italique, souligné, barré', () => {
    expect(sanitizeHtml('<b>a</b><i>b</i><u>c</u><s>d</s>')).toBe('<b>a</b><i>b</i><u>c</u><s>d</s>')
  })
  it('strike/del deviennent s', () => {
    expect(sanitizeHtml('<strike>x</strike>')).toBe('<s>x</s>')
  })
  it('couleur du texte et surlignage', () => {
    const out = sanitizeHtml('<span style="color: rgb(220, 38, 38);">r</span><span style="background-color: rgb(254, 240, 138);">s</span>')
    expect(out).toContain('color:rgb(220, 38, 38)')
    expect(out).toContain('background-color:rgb(254, 240, 138)')
  })
  it('surlignage sans couleur de texte : texte forcé en sombre pour rester lisible', () => {
    expect(sanitizeHtml('<span style="background-color:#fef08a">s</span>')).toContain('color:#111')
  })
  it('<font color> converti en span', () => {
    const out = sanitizeHtml('<font color="#2563EB">bleu</font>')
    expect(out).toContain('color:#2563EB')
    expect(out).not.toMatch(/font/i)
  })
  it('un span sans style utile est aplati', () => {
    expect(sanitizeHtml('<span class="x">texte</span>')).toBe('texte')
  })
})

describe('toEditorHtml / htmlToPlainText', () => {
  it('ancien texte brut : échappé, retours à la ligne conservés', () => {
    expect(toEditorHtml('a < b\nligne 2')).toBe('a &lt; b<br>ligne 2')
  })
  it('un ancien texte contenant « < » n\'est pas pris pour du HTML', () => {
    expect(toEditorHtml('3 < 5 et 7 > 2')).toBe('3 &lt; 5 et 7 &gt; 2')
  })
  it('HTML enrichi : passé par le nettoyage', () => {
    expect(toEditorHtml('<b>x</b><script>1</script>')).toBe('<b>x</b>')
  })
  it('texte brut pour le partage en messagerie', () => {
    expect(htmlToPlainText('<b>Points</b> forts<br>ligne 2')).toBe('Points forts\nligne 2')
    expect(htmlToPlainText('simple texte')).toBe('simple texte')
    expect(htmlToPlainText('')).toBe('')
  })
})
