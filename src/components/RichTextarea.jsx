import { useEffect, useRef, useState } from 'react'
import { Bold, Italic, Underline, Strikethrough, Highlighter, Palette, Eraser, Maximize2, Minimize2 } from 'lucide-react'
import { sanitizeHtml, toEditorHtml } from '../lib/richText'

const COULEURS_TEXTE = ['#DC2626', '#EA580C', '#16A34A', '#2563EB', '#7C3AED', '#6B7280']
const COULEURS_SURLIGNAGE = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA']

// Zone de texte enrichie (façon traitement de texte) pour les rapports de match : gras,
// italique, souligné, barré, couleur du texte, surlignage. Composant au niveau module
// (pas imbriqué dans une page) pour que la zone ne soit pas remontée à chaque frappe.
// `value` est du HTML stocké (ou un ancien texte brut) ; onChange reçoit du HTML assaini.
export default function RichTextarea({ label, value, onChange, placeholder, rows = 2, style = {} }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(false)
  const [menu, setMenu] = useState(null) // 'texte' | 'surlignage' | null

  // Réinjecte la valeur seulement si elle diffère de ce que contient déjà la zone :
  // sinon chaque frappe remettrait le curseur au début.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const attendu = toEditorHtml(value)
    if (sanitizeHtml(el.innerHTML) !== attendu) el.innerHTML = attendu
  }, [value])

  function emettre() {
    const html = sanitizeHtml(ref.current.innerHTML)
    const vide = !html || html === '<br>' || !ref.current.textContent.trim() && !/<br/.test(html)
    onChange(vide ? '' : html)
  }

  function cmd(nom, arg, css = false) {
    ref.current?.focus()
    try { document.execCommand('styleWithCSS', false, css) } catch { /* non supporté */ }
    if (nom === 'hiliteColor' && !document.execCommand('hiliteColor', false, arg)) document.execCommand('backColor', false, arg)
    else if (nom !== 'hiliteColor') document.execCommand(nom, false, arg)
    setMenu(null)
    emettre()
  }

  function coller(e) {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const texte = e.clipboardData.getData('text/plain')
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html))
    else document.execCommand('insertText', false, texte)
    emettre()
  }

  // onPointerDown + preventDefault : le bouton n'enlève pas la sélection du texte.
  const btn = (title, onClick, children, actif) => (
    <button type="button" title={title} onPointerDown={e => { e.preventDefault(); onClick() }}
      style={{ border: 'none', background: actif ? 'var(--primary-bg)' : 'transparent', borderRadius: 6, padding: 5, cursor: 'pointer', display: 'flex', color: 'var(--text-secondary)' }}>
      {children}
    </button>
  )
  const pastille = (couleur, onClick) => (
    <button key={couleur} type="button" onPointerDown={e => { e.preventDefault(); onClick() }}
      style={{ width: 22, height: 22, borderRadius: '50%', background: couleur, border: '1px solid var(--border)', cursor: 'pointer', padding: 0 }} />
  )

  return (
    <div style={{ marginBottom: 10, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        {label && <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</label>}
        <button type="button" onClick={() => setExpanded(p => !p)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)', padding: 2, marginLeft: 'auto' }}>
          {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>
      <div style={{ border: '0.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '3px 4px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)', flexWrap: 'wrap' }}>
          {btn('Gras', () => cmd('bold'), <Bold size={14} />)}
          {btn('Italique', () => cmd('italic'), <Italic size={14} />)}
          {btn('Souligné', () => cmd('underline'), <Underline size={14} />)}
          {btn('Barré', () => cmd('strikeThrough'), <Strikethrough size={14} />)}
          {btn('Couleur du texte', () => setMenu(m => m === 'texte' ? null : 'texte'), <Palette size={14} />, menu === 'texte')}
          {btn('Surligner', () => setMenu(m => m === 'surlignage' ? null : 'surlignage'), <Highlighter size={14} />, menu === 'surlignage')}
          {btn('Effacer la mise en forme', () => cmd('removeFormat'), <Eraser size={14} />)}
        </div>
        {menu && (
          <div style={{ display: 'flex', gap: 8, padding: '6px 8px', borderBottom: '0.5px solid var(--border)', alignItems: 'center', flexWrap: 'wrap' }}>
            {menu === 'texte'
              ? COULEURS_TEXTE.map(c => pastille(c, () => cmd('foreColor', c, true)))
              : COULEURS_SURLIGNAGE.map(c => pastille(c, () => cmd('hiliteColor', c, true)))}
            <button type="button" onPointerDown={e => { e.preventDefault(); cmd('removeFormat') }}
              style={{ border: 'none', background: 'none', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Retirer</button>
          </div>
        )}
        <div ref={ref} className="rt-editor" contentEditable suppressContentEditableWarning
          data-placeholder={placeholder || ''}
          onInput={emettre} onPaste={coller} onBlur={emettre}
          style={{
            minHeight: (expanded ? 10 : rows) * 20 + 16, maxHeight: expanded ? 'none' : 320, overflowY: 'auto',
            padding: '8px 10px', fontSize: 13, lineHeight: '20px', outline: 'none', boxSizing: 'border-box',
            color: 'var(--text-primary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap'
          }} />
      </div>
    </div>
  )
}
