import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { bornesSaison, labelSaison } from '../lib/saison'
import { Card, PageHeader, Button, Input, Spinner } from '../components/UI'
import { Trophy, Plus, X, Trash2, Pencil, ClipboardPaste } from 'lucide-react'

const FORME_COLORS = { V: '#16A34A', N: '#F59E0B', D: '#DC2626' }
const VIDE = { journee: '', date_match: '', equipe_dom: '', equipe_ext: '', score_dom: '', score_ext: '' }

function joue(m) { return m.score_dom !== null && m.score_dom !== undefined && m.score_ext !== null && m.score_ext !== undefined }

// Classement complet + forme à partir des seuls matchs joués. Départage : points, puis
// différence de buts, puis buts marqués, puis nom (ordre stable).
function calculer(matchs) {
  const equipes = {}
  const get = nom => equipes[nom] || (equipes[nom] = { nom, pts: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, resultats: [] })
  for (const m of matchs) { get(m.equipe_dom); get(m.equipe_ext) }
  const joues = matchs.filter(joue).sort((a, b) => a.journee - b.journee || String(a.date_match || '').localeCompare(String(b.date_match || '')))
  for (const m of joues) {
    for (const [nom, bp, bc] of [[m.equipe_dom, m.score_dom, m.score_ext], [m.equipe_ext, m.score_ext, m.score_dom]]) {
      const e = get(nom)
      e.j++; e.bp += bp; e.bc += bc
      const r = bp > bc ? 'V' : bp === bc ? 'N' : 'D'
      if (r === 'V') { e.g++; e.pts += 3 } else if (r === 'N') { e.n++; e.pts += 1 } else e.p++
      e.resultats.push(r)
    }
  }
  return Object.values(equipes)
    .map(e => ({ ...e, diff: e.bp - e.bc, forme: e.resultats.slice(-5) }))
    .sort((a, b) => b.pts - a.pts || b.diff - a.diff || b.bp - a.bp || a.nom.localeCompare(b.nom))
}

// Clé de comparaison de noms d'équipes (sans accents, casse ni ponctuation) : le site de
// la ligue et le calendrier PDF n'écrivent pas toujours un club exactement pareil.
function cle(nom) {
  return nom.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

// Lit un texte collé (une rencontre par ligne) :
//   "Equipe A 2 - 1 Equipe B"  → match joué
//   "Equipe A - Equipe B"      → match à venir
function analyserTexte(texte) {
  const lignes = texte.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const rows = [], ignorees = []
  for (const l of lignes) {
    let m = l.match(/^(.+?)\s+(\d{1,2})\s*[-–—:]\s*(\d{1,2})\s+(.+)$/)
    if (m) { rows.push({ dom: m[1].trim(), ext: m[4].trim(), sd: parseInt(m[2], 10), se: parseInt(m[3], 10) }); continue }
    m = l.match(/^(.+?)\s+(?:-|–|—|vs\.?|contre)\s+(.+)$/i)
    if (m) { rows.push({ dom: m[1].trim(), ext: m[2].trim(), sd: null, se: null }); continue }
    ignorees.push(l)
  }
  return { rows, ignorees }
}

function Forme({ forme }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {forme.map((r, i) => (
        <span key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: FORME_COLORS[r], color: '#fff', fontSize: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{r}</span>
      ))}
    </span>
  )
}

export default function ChampionnatPage() {
  const { isCoach, isAdjoint } = useAuth()
  const canEdit = isCoach || isAdjoint
  const saison = bornesSaison().year
  const [matchs, setMatchs] = useState([])
  const [notreEquipe, setNotreEquipe] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('classement')
  const [journee, setJournee] = useState(null)
  const [form, setForm] = useState(null) // null = fermé ; { id?, ...champs }
  const [saving, setSaving] = useState(false)
  const [erreur, setErreur] = useState('')
  const [imp, setImp] = useState(null) // { journee, date, texte }
  const [impBusy, setImpBusy] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: m, error }, { data: cfg }] = await Promise.all([
      supabase.from('championnat_matchs').select('*').eq('saison', saison).order('journee').order('date_match'),
      supabase.from('championnat_config').select('notre_equipe').eq('saison', saison).maybeSingle(),
    ])
    if (error) setErreur(error.message)
    setMatchs(m || [])
    setNotreEquipe(cfg?.notre_equipe || '')
    setLoading(false)
  }

  const classement = useMemo(() => calculer(matchs), [matchs])
  const equipes = useMemo(() => classement.map(e => e.nom).sort((a, b) => a.localeCompare(b)), [classement])
  const journees = useMemo(() => [...new Set(matchs.map(m => m.journee))].sort((a, b) => a - b), [matchs])

  // Journée affichée par défaut : la première qui a encore des matchs à jouer, sinon la dernière.
  useEffect(() => {
    if (journee !== null || !journees.length) return
    const prochaine = journees.find(j => matchs.some(m => m.journee === j && !joue(m)))
    setJournee(prochaine ?? journees[journees.length - 1])
  }, [journees, matchs, journee])

  async function changerNotreEquipe(nom) {
    setNotreEquipe(nom)
    await supabase.from('championnat_config').upsert({ saison, notre_equipe: nom || null }, { onConflict: 'saison' })
  }

  async function enregistrer() {
    const j = parseInt(form.journee, 10)
    if (!j || !form.equipe_dom.trim() || !form.equipe_ext.trim()) { setErreur('Journée et les deux équipes sont obligatoires.'); return }
    if (form.equipe_dom.trim() === form.equipe_ext.trim()) { setErreur('Les deux équipes doivent être différentes.'); return }
    const sd = form.score_dom === '' ? null : parseInt(form.score_dom, 10)
    const se = form.score_ext === '' ? null : parseInt(form.score_ext, 10)
    if ((sd === null) !== (se === null)) { setErreur('Renseigne les deux scores, ou aucun.'); return }
    setSaving(true); setErreur('')
    const row = { saison, journee: j, date_match: form.date_match || null, equipe_dom: form.equipe_dom.trim(), equipe_ext: form.equipe_ext.trim(), score_dom: sd, score_ext: se }
    const { error } = form.id
      ? await supabase.from('championnat_matchs').update(row).eq('id', form.id)
      : await supabase.from('championnat_matchs').insert(row)
    setSaving(false)
    if (error) { setErreur(error.message); return }
    setJournee(j)
    setForm(null)
    load()
  }

  async function supprimer(id) {
    if (!window.confirm('Supprimer ce match ?')) return
    const { error } = await supabase.from('championnat_matchs').delete().eq('id', id)
    if (error) { alert(error.message); return }
    setForm(null)
    load()
  }

  // Résout un nom collé vers le nom déjà utilisé pour cette équipe (même clé), sinon garde tel quel.
  const nomsConnus = useMemo(() => Object.fromEntries(equipes.map(n => [cle(n), n])), [equipes])
  const apercu = useMemo(() => {
    if (!imp || !imp.texte.trim()) return null
    const { rows, ignorees } = analyserTexte(imp.texte)
    const j = parseInt(imp.journee, 10)
    const detail = rows.map(r => {
      const dom = nomsConnus[cle(r.dom)] || r.dom
      const ext = nomsConnus[cle(r.ext)] || r.ext
      const existant = matchs.find(m => m.journee === j && m.equipe_dom === dom && m.equipe_ext === ext)
      return { ...r, dom, ext, existant, inconnues: [!nomsConnus[cle(r.dom)] && r.dom, !nomsConnus[cle(r.ext)] && r.ext].filter(Boolean) }
    })
    return { detail, ignorees }
  }, [imp, nomsConnus, matchs])

  async function importer() {
    const j = parseInt(imp.journee, 10)
    if (!j) { setErreur('Indique le numéro de journée.'); return }
    if (!apercu?.detail.length) { setErreur('Aucune rencontre reconnue dans le texte collé.'); return }
    setImpBusy(true); setErreur('')
    const date = imp.date || null
    const nouveaux = [], maj = []
    for (const r of apercu.detail) {
      const base = { saison, journee: j, equipe_dom: r.dom, equipe_ext: r.ext, score_dom: r.sd, score_ext: r.se }
      if (date) base.date_match = date
      if (r.existant) maj.push({ id: r.existant.id, ...base }); else nouveaux.push(base)
    }
    let err = null
    if (nouveaux.length) ({ error: err } = await supabase.from('championnat_matchs').insert(nouveaux))
    for (const u of maj) {
      if (err) break
      const { id, ...champs } = u
      ;({ error: err } = await supabase.from('championnat_matchs').update(champs).eq('id', id))
    }
    setImpBusy(false)
    if (err) { setErreur(err.message); return }
    setImp(null); setJournee(j); setTab('journees')
    load()
  }

  function ouvrirForm(m) {
    setErreur('')
    setForm(m
      ? { id: m.id, journee: String(m.journee), date_match: m.date_match || '', equipe_dom: m.equipe_dom, equipe_ext: m.equipe_ext, score_dom: joue(m) ? String(m.score_dom) : '', score_ext: joue(m) ? String(m.score_ext) : '' }
      : { ...VIDE, journee: journee ? String(journee) : '' })
  }

  const matchsJournee = matchs.filter(m => m.journee === journee)
  const dateFr = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Date à définir'
  const estNous = nom => notreEquipe && nom === notreEquipe

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const TH = { padding: '6px 4px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }
  const TD = { padding: '7px 4px', fontSize: 12, textAlign: 'center' }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} /> Championnat</span>}
        action={canEdit && !form && !imp ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => { setErreur(''); setImp({ journee: journee ? String(journee) : '', date: '', texte: '' }) }}><ClipboardPaste size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Importer</Button>
            <Button variant="primary" size="sm" onClick={() => ouvrirForm(null)}><Plus size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Match</Button>
          </div>
        ) : null}
      />
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8, marginBottom: 10 }}>Saison {labelSaison()}</p>

      {erreur && !form && !imp && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{erreur}</p>}

      {imp && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Importer une journée</p>
            <button onClick={() => setImp(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            Copie les rencontres depuis la page de la ligue et colle-les ici, une par ligne :
            « Équipe A 2 - 1 Équipe B » (joué) ou « Équipe A - Équipe B » (à venir). Les matchs déjà saisis de cette journée sont mis à jour.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Journée" type="number" value={imp.journee} onChange={v => setImp(p => ({ ...p, journee: v }))} />
            <Input label="Date (optionnel)" type="date" value={imp.date} onChange={v => setImp(p => ({ ...p, date: v }))} />
          </div>
          <textarea value={imp.texte} onChange={e => setImp(p => ({ ...p, texte: e.target.value }))} rows={7}
            placeholder={'Pont. Ent Trieux Fc 2 - 1 Cavan Js\nRospez Cs 0 - 0 Begard Cs'}
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-primary)', marginBottom: 8 }} />
          {apercu && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{apercu.detail.length} rencontre(s) reconnue(s)</p>
              {apercu.detail.map((r, i) => (
                <p key={i} style={{ fontSize: 12, padding: '3px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                  {r.dom} <b>{r.sd !== null ? `${r.sd} - ${r.se}` : '—'}</b> {r.ext}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{r.existant ? 'mise à jour' : 'nouveau'}</span>
                  {r.inconnues.length > 0 && matchs.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--warning)', marginLeft: 6 }}>équipe nouvelle : {r.inconnues.join(', ')}</span>
                  )}
                </p>
              ))}
              {apercu.ignorees.length > 0 && (
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{apercu.ignorees.length} ligne(s) ignorée(s) : {apercu.ignorees.slice(0, 3).join(' · ')}{apercu.ignorees.length > 3 ? '…' : ''}</p>
              )}
            </div>
          )}
          {erreur && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{erreur}</p>}
          <Button variant="primary" style={{ width: '100%' }} onClick={importer} disabled={impBusy || !apercu?.detail.length}>
            {impBusy ? 'Import...' : `Importer${apercu?.detail.length ? ` (${apercu.detail.length})` : ''}`}
          </Button>
        </Card>
      )}

      {form && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{form.id ? 'Modifier le match' : 'Nouveau match'}</p>
            <button onClick={() => setForm(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Journée" type="number" value={form.journee} onChange={v => setForm(p => ({ ...p, journee: v }))} />
            <Input label="Date (optionnel)" type="date" value={form.date_match} onChange={v => setForm(p => ({ ...p, date_match: v }))} />
          </div>
          <datalist id="equipes-championnat">{equipes.map(n => <option key={n} value={n} />)}</datalist>
          {[['equipe_dom', 'score_dom', 'Domicile'], ['equipe_ext', 'score_ext', 'Extérieur']].map(([eq, sc, lbl]) => (
            <div key={eq} style={{ display: 'grid', gridTemplateColumns: '1fr 64px', gap: 8, alignItems: 'end' }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3, fontWeight: 500 }}>{lbl}</label>
                <input list="equipes-championnat" value={form[eq]} onChange={e => setForm(p => ({ ...p, [eq]: e.target.value }))}
                  placeholder="Nom de l'équipe"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, boxSizing: 'border-box', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              </div>
              <Input label="Score" type="number" value={form[sc]} onChange={v => setForm(p => ({ ...p, [sc]: v }))} />
            </div>
          ))}
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Laisse les scores vides pour un match à venir.</p>
          {erreur && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{erreur}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1 }} onClick={enregistrer} disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
            {form.id && <Button variant="danger" onClick={() => supprimer(form.id)}><Trash2 size={13} /></Button>}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['classement', 'Classement'], ['journees', 'Journées']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: '0.5px solid var(--border)',
            background: tab === k ? 'var(--primary-bg)' : 'transparent',
            color: tab === k ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: tab === k ? 600 : 400
          }}>{l}</button>
        ))}
      </div>

      {matchs.length === 0 ? (
        <Card><p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
          Aucun match saisi pour l'instant.{canEdit ? ' Ajoute les matchs de la poule avec le bouton « Match ».' : ''}
        </p></Card>
      ) : tab === 'classement' ? (
        <>
          <Card style={{ padding: '6px 8px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <th style={TH}>#</th>
                    <th style={{ ...TH, textAlign: 'left' }}>Équipe</th>
                    <th style={{ ...TH, color: 'var(--text-primary)' }}>Pts</th>
                    <th style={TH}>J</th><th style={TH}>G</th><th style={TH}>N</th><th style={TH}>P</th>
                    <th style={TH}>BP</th><th style={TH}>BC</th><th style={TH}>Diff</th>
                    <th style={TH}>Forme</th>
                  </tr>
                </thead>
                <tbody>
                  {classement.map((e, i) => (
                    <tr key={e.nom} style={{ borderBottom: '0.5px solid var(--bg-secondary)', background: estNous(e.nom) ? 'var(--primary-bg)' : 'transparent' }}>
                      <td style={{ ...TD, fontWeight: 700, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ ...TD, textAlign: 'left', fontWeight: estNous(e.nom) ? 700 : 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nom}</td>
                      <td style={{ ...TD, fontWeight: 800 }}>{e.pts}</td>
                      <td style={TD}>{e.j}</td><td style={TD}>{e.g}</td><td style={TD}>{e.n}</td><td style={TD}>{e.p}</td>
                      <td style={TD}>{e.bp}</td><td style={TD}>{e.bc}</td>
                      <td style={{ ...TD, color: e.diff > 0 ? 'var(--success)' : e.diff < 0 ? 'var(--danger)' : 'inherit' }}>{e.diff > 0 ? `+${e.diff}` : e.diff}</td>
                      <td style={TD}><Forme forme={e.forme} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
            Calculé à partir des résultats saisis · 3 pts la victoire, 1 le nul · forme = 5 derniers matchs, du plus ancien au plus récent.
          </p>
          {canEdit && (
            <Card>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Notre équipe (mise en évidence)</label>
              <select value={notreEquipe} onChange={e => changerNotreEquipe(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                <option value="">— Choisir —</option>
                {equipes.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Card>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
            {journees.map(j => (
              <button key={j} onClick={() => setJournee(j)} style={{
                padding: '6px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                border: '0.5px solid var(--border)',
                background: journee === j ? 'var(--primary)' : 'transparent',
                color: journee === j ? '#fff' : 'var(--text-secondary)', fontWeight: journee === j ? 700 : 400
              }}>J{j}</button>
            ))}
          </div>
          {[['Joués', matchsJournee.filter(joue)], ['À venir', matchsJournee.filter(m => !joue(m))]]
            .filter(([, l]) => l.length > 0).map(([titre, liste]) => (
            <div key={titre}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '4px 0 6px' }}>{titre}</p>
              {liste.map(m => {
                const nousDom = estNous(m.equipe_dom), nousExt = estNous(m.equipe_ext)
                return (
                  <Card key={m.id} style={{ padding: '10px 12px', background: (nousDom || nousExt) ? 'var(--primary-bg)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>{dateFr(m.date_match)}</p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: nousDom ? 700 : 500 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.equipe_dom}</span>
                          <span style={{ fontWeight: 800, marginLeft: 8 }}>{joue(m) ? m.score_dom : ''}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: nousExt ? 700 : 500, marginTop: 2 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.equipe_ext}</span>
                          <span style={{ fontWeight: 800, marginLeft: 8 }}>{joue(m) ? m.score_ext : ''}</span>
                        </div>
                      </div>
                      {canEdit && (
                        <button onClick={() => ouvrirForm(m)} title="Modifier / saisir le score" style={{ border: 'none', background: 'var(--bg-secondary)', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'flex' }}>
                          <Pencil size={14} color="var(--primary)" />
                        </button>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          ))}
          {matchsJournee.length === 0 && <Card><p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>Aucun match pour cette journée.</p></Card>}
        </>
      )}
    </div>
  )
}
