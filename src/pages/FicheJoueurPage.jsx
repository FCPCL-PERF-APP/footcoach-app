import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Button, Input, Select, Textarea, BarChart, Spinner, Avatar, Badge } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const RPE_ITEMS = [
  { key: 'difficulte', label: 'Difficulté' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'implication', label: 'Implication' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. indiv.' },
  { key: 'perf_collective', label: 'Perf. coll.' },
]

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function FicheJoueurPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isCoach, canComment, canEdit } = useAuth()
  const [joueur, setJoueur] = useState(null)
  const [activeTab, setActiveTab] = useState('identite')
  const [rpeHistory, setRpeHistory] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [statsHistory, setStatsHistory] = useState([])
  const [tests, setTests] = useState([])
  const [poidsHistory, setPoidsHistory] = useState([])
  const [commentaires, setCommentaires] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [showAddTest, setShowAddTest] = useState(false)
  const [testForm, setTestForm] = useState({ date_test: '', protocole: 'Vameval', vma: '', fc_max_atteinte: '', conditions: '' })
  const [newPoids, setNewPoids] = useState('')

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const [{ data: j }, { data: rpe }, { data: foot }, { data: stats }, { data: t }, { data: poids }, { data: comms }] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', id).single(),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)').eq('joueur_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)').eq('joueur_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('stats_match').select('*, evenements(titre,date_heure)').eq('joueur_id', id).order('created_at', { ascending: false }).limit(15),
      supabase.from('tests_physiques').select('*').eq('joueur_id', id).order('date_test', { ascending: false }),
      supabase.from('suivi_poids').select('*').eq('joueur_id', id).order('date_mesure', { ascending: true }).limit(12),
      supabase.from('commentaires_joueurs').select('*').eq('joueur_id', id).order('created_at', { ascending: false })
    ])
    setJoueur(j); setForm(j || {})
    setRpeHistory(rpe || [])
    setFootHistory(foot || [])
    setStatsHistory(stats || [])
    setTests(t || [])
    setPoidsHistory(poids || [])
    setCommentaires(comms || [])
    setLoading(false)
  }

  async function saveIdentite() {
    await supabase.from('joueurs').update(form).eq('id', id)
    setJoueur(form)
    setEditing(false)
  }

  async function uploadPhoto(file) {
    setPhotoUploading(true)
    const path = `photos/${id}_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('joueurs').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('joueurs').getPublicUrl(path)
      await supabase.from('joueurs').update({ photo_url: urlData.publicUrl }).eq('id', id)
      setJoueur(p => ({ ...p, photo_url: urlData.publicUrl }))
      setForm(p => ({ ...p, photo_url: urlData.publicUrl }))
    }
    setPhotoUploading(false)
  }

  async function savePoids() {
    if (!newPoids) return
    await supabase.from('suivi_poids').insert({ joueur_id: id, poids: parseFloat(newPoids), date_mesure: new Date().toISOString().split('T')[0] })
    setNewPoids(''); loadAll()
  }

  async function saveTest() {
    await supabase.from('tests_physiques').insert({ joueur_id: id, ...testForm, vma: parseFloat(testForm.vma), fc_max_atteinte: parseInt(testForm.fc_max_atteinte) })
    if (testForm.vma) await supabase.from('joueurs').update({ vma: parseFloat(testForm.vma) }).eq('id', id)
    setTestForm({ date_test: '', protocole: 'Vameval', vma: '', fc_max_atteinte: '', conditions: '' })
    setShowAddTest(false); loadAll()
  }

  async function addComment() {
    if (!newComment.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase.from('staff').select('nom,prenom,role').eq('auth_id', user?.id).maybeSingle()
    await supabase.from('commentaires_joueurs').insert({
      joueur_id: id,
      auteur_nom: staff ? `${staff.nom} ${staff.prenom}` : 'Staff',
      auteur_role: staff?.role || 'staff',
      contenu: newComment
    })
    setNewComment(''); loadAll()
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>
  if (!joueur) return <div style={{ padding: 12 }}>Joueur introuvable.</div>

  const initials = `${joueur.nom?.[0] || ''}${joueur.prenom?.[0] || ''}`
  const col = AVATAR_COLORS[0]
  const imc = joueur.taille && joueur.poids ? (joueur.poids / ((joueur.taille / 100) ** 2)).toFixed(1) : '—'
  const fcReserve = joueur.fc_max && joueur.fc_repos ? joueur.fc_max - joueur.fc_repos : null
  const totalButs = statsHistory.reduce((s, r) => s + (r.buts || 0), 0)
  const totalPD = statsHistory.reduce((s, r) => s + (r.passes_decisives || 0), 0)
  const totalMin = statsHistory.reduce((s, r) => s + (r.temps_jeu || 0), 0)
  const noteMoy = statsHistory.length ? (statsHistory.reduce((s, r) => s + (r.note || 0), 0) / statsHistory.length).toFixed(1) : '—'
  const rpeAvg = RPE_ITEMS.map(item => {
    const vals = rpeHistory.map(r => r[item.key]).filter(v => v !== null && v !== undefined)
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return { label: item.label, value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
  })

  const tabs = [
    { key: 'identite', label: '👤 Identité' },
    { key: 'physio', label: '❤️ Physio' },
    { key: 'perf', label: '📈 Perfs' },
    { key: 'stats', label: '⚽ Stats' },
    { key: 'notes', label: '💬 Notes' },
  ]

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/joueurs')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        {/* Photo ou avatar */}
        <div style={{ position: 'relative' }}>
          {joueur.photo_url ? (
            <img src={joueur.photo_url} alt={joueur.nom}
              style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${THEME.primary}` }} />
          ) : (
            <Avatar initials={initials} bg={col.bg} color={col.color} size={52} />
          )}
          {isCoach && (
            <div onClick={() => document.getElementById(`photo-${id}`).click()}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, background: THEME.primary, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }}>
              📷
            </div>
          )}
          <input id={`photo-${id}`} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{joueur.nom} {joueur.prenom}</p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            {joueur.poste} {joueur.numero ? `· N°${joueur.numero}` : ''} {joueur.groupe ? `· Groupe ${joueur.groupe}` : ''}
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant={editing ? 'success' : 'default'} onClick={() => editing ? saveIdentite() : setEditing(true)}>
            {editing ? '💾' : '✏️'}
          </Button>
        )}
      </div>

      {photoUploading && <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: THEME.primary }}>📷 Upload en cours...</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
            background: activeTab === t.key ? '#E6F1FB' : 'transparent',
            color: activeTab === t.key ? THEME.primary : '#6B7280',
            fontWeight: activeTab === t.key ? 600 : 400
          }}>{t.label}</button>
        ))}
      </div>

      {/* IDENTITÉ */}
      {activeTab === 'identite' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations personnelles</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Nom" value={form.nom || ''} onChange={v => setForm(p => ({ ...p, nom: v }))} disabled={!editing} />
              <Input label="Prénom" value={form.prenom || ''} onChange={v => setForm(p => ({ ...p, prenom: v }))} disabled={!editing} />
              <Input label="Date de naissance" type="date" value={form.date_naissance || ''} onChange={v => setForm(p => ({ ...p, date_naissance: v }))} disabled={!editing} />
              <Input label="N° Licence" value={form.licence || ''} onChange={v => setForm(p => ({ ...p, licence: v }))} disabled={!editing} />
              <Select label="Pied fort" value={form.pied || 'Droit'} onChange={v => setForm(p => ({ ...p, pied: v }))}
                options={['Droit','Gauche','Les deux']} disabled={!editing} />
              <Input label="Poste" value={form.poste || ''} onChange={v => setForm(p => ({ ...p, poste: v }))} disabled={!editing} />
              <Input label="Numéro" type="number" value={form.numero || ''} onChange={v => setForm(p => ({ ...p, numero: v }))} disabled={!editing} />
              <Select label="Pôle / Groupe" value={form.groupe || 'A'} onChange={v => setForm(p => ({ ...p, groupe: v }))}
                options={['A','B','C','D','E']} disabled={!editing} />
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Coordonnées</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Téléphone" value={form.telephone || ''} onChange={v => setForm(p => ({ ...p, telephone: v }))} disabled={!editing} />
              <Input label="Email" value={form.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))} disabled={!editing} />
            </div>
            <Input label="Adresse" value={form.adresse || ''} onChange={v => setForm(p => ({ ...p, adresse: v }))} disabled={!editing} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Contact urgence" value={form.contact_urgence_nom || ''} onChange={v => setForm(p => ({ ...p, contact_urgence_nom: v }))} disabled={!editing} />
              <Input label="Tél. urgence" value={form.contact_urgence_tel || ''} onChange={v => setForm(p => ({ ...p, contact_urgence_tel: v }))} disabled={!editing} />
            </div>
            {editing && <Button variant="primary" style={{ width: '100%', marginTop: 8 }} onClick={saveIdentite}>💾 Enregistrer</Button>}
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Morphologie</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Input label="Taille (cm)" type="number" value={form.taille || ''} onChange={v => setForm(p => ({ ...p, taille: v }))} disabled={!editing} />
              <Input label="Poids (kg)" type="number" value={form.poids || ''} onChange={v => setForm(p => ({ ...p, poids: v }))} disabled={!editing} />
              <Input label="IMC" value={imc} disabled />
            </div>
            {editing && <Button variant="primary" style={{ width: '100%', marginTop: 8 }} onClick={saveIdentite}>💾 Enregistrer</Button>}
          </Card>
        </>
      )}

      {/* PHYSIOLOGIE */}
      {activeTab === 'physio' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Fréquence cardiaque</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Input label="FC max" type="number" value={form.fc_max || ''} onChange={v => setForm(p => ({ ...p, fc_max: v }))} disabled={!canEdit} />
              <Input label="FC repos" type="number" value={form.fc_repos || ''} onChange={v => setForm(p => ({ ...p, fc_repos: v }))} disabled={!canEdit} />
              <Input label="FC réserve" value={fcReserve || '—'} disabled />
            </div>
            {fcReserve && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Zones FC (Karvonen)</p>
                {[['Zone 1 — Récupération', 0.5, 0.6, '#E6F1FB', '#185FA5'],
                  ['Zone 2 — Aérobie', 0.6, 0.7, '#EAF3DE', '#3B6D11'],
                  ['Zone 3 — Seuil', 0.7, 0.8, '#FAEEDA', '#854F0B'],
                  ['Zone 4 — Haute intensité', 0.8, 0.9, '#FCEBEB', '#A32D2D'],
                  ['Zone 5 — Maximale', 0.9, 1.0, '#F5C4B3', '#712B13'],
                ].map(([label, min, max, bg, color]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 8, marginBottom: 4, background: bg }}>
                    <span style={{ fontSize: 11, color }}>{label}</span>
                    <strong style={{ fontSize: 11, color }}>
                      {Math.round(joueur.fc_repos + fcReserve * min)}–{Math.round(joueur.fc_repos + fcReserve * max)} bpm
                    </strong>
                  </div>
                ))}
              </>
            )}
            {canEdit && <Button variant="primary" style={{ width: '100%', marginTop: 10 }} onClick={saveIdentite}>💾 Enregistrer FC</Button>}
          </Card>

          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Tests VMA</p>
              {canEdit && <Button size="sm" onClick={() => setShowAddTest(!showAddTest)}>+ Ajouter</Button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: THEME.primary }}>{joueur.vma || '—'}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>VMA actuelle (km/h)</div>
              </div>
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#3B6D11' }}>
                  {tests.length >= 2 ? `+${(parseFloat(tests[0]?.vma) - parseFloat(tests[tests.length-1]?.vma)).toFixed(1)}` : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>Progression</div>
              </div>
            </div>
            {showAddTest && canEdit && (
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Input label="Date" type="date" value={testForm.date_test} onChange={v => setTestForm(p => ({ ...p, date_test: v }))} />
                  <Select label="Protocole" value={testForm.protocole} onChange={v => setTestForm(p => ({ ...p, protocole: v }))}
                    options={['Vameval','Cooper','Yo-Yo','Navette 20m','Terrain perso']} />
                  <Input label="VMA (km/h)" type="number" step="0.1" value={testForm.vma} onChange={v => setTestForm(p => ({ ...p, vma: v }))} />
                  <Input label="FC max atteinte" type="number" value={testForm.fc_max_atteinte} onChange={v => setTestForm(p => ({ ...p, fc_max_atteinte: v }))} />
                </div>
                <Input label="Conditions" value={testForm.conditions} onChange={v => setTestForm(p => ({ ...p, conditions: v }))} placeholder="Terrain sec, bonne météo..." />
                <Button variant="primary" style={{ width: '100%' }} onClick={saveTest}>Enregistrer le test</Button>
              </div>
            )}
            {tests.map(t => (
              <div key={t.id} style={{ padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{t.protocole} — {t.date_test}</p>
                    {t.conditions && <p style={{ fontSize: 11, color: '#9CA3AF' }}>{t.conditions}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: THEME.primary }}>{t.vma} km/h</p>
                    {t.fc_max_atteinte && <p style={{ fontSize: 10, color: '#9CA3AF' }}>FC max: {t.fc_max_atteinte}</p>}
                  </div>
                </div>
              </div>
            ))}
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Suivi du poids</p>
            {poidsHistory.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60, marginBottom: 8 }}>
                {poidsHistory.map((p, i) => {
                  const min = Math.min(...poidsHistory.map(x => x.poids))
                  const max = Math.max(...poidsHistory.map(x => x.poids))
                  const h = max === min ? 50 : ((p.poids - min) / (max - min)) * 50 + 10
                  return <div key={p.id} title={`${p.poids} kg`}
                    style={{ flex: 1, background: THEME.primary, borderRadius: '3px 3px 0 0', height: `${h}px`, opacity: 0.5 + (i / poidsHistory.length) * 0.5 }} />
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Input label="Nouvelle pesée (kg)" type="number" step="0.1" value={newPoids} onChange={setNewPoids} style={{ marginBottom: 0 }} />
              <Button variant="primary" onClick={savePoids} style={{ marginTop: 16, flexShrink: 0 }}>+ Ajouter</Button>
            </div>
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Points forts / axes de travail</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Textarea label="✅ Points forts" value={form.points_forts || ''} onChange={v => setForm(p => ({ ...p, points_forts: v }))} rows={4} />
              <Textarea label="⚠️ Axes de travail" value={form.points_faibles || ''} onChange={v => setForm(p => ({ ...p, points_faibles: v }))} rows={4} />
            </div>
            {canEdit && <Button variant="primary" style={{ width: '100%' }} onClick={saveIdentite}>💾 Enregistrer</Button>}
          </Card>
        </>
      )}

      {/* PERFORMANCES */}
      {activeTab === 'perf' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE moyen — toutes sessions</p>
            {rpeHistory.length === 0
              ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune donnée RPE.</p>
              : <BarChart data={rpeAvg} maxValue={5} />}
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Footbar — historique</p>
            {footHistory.length === 0
              ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune donnée Footbar.</p>
              : footHistory.map(f => (
                  <div key={f.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '0.5px solid #F3F4F6' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{f.evenements?.titre}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
                      {[['Dist.',`${f.distance_km}km`],['Sprints',f.sprints],['Ballons',f.ballons_touches],['V.max',`${f.vitesse_max}km/h`],['Accél.',f.accelerations]].map(([l,v]) => (
                        <div key={l} style={{ background: '#F9FAFB', borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{v ?? '—'}</div>
                          <div style={{ fontSize: 9, color: '#9CA3AF' }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
            }
          </Card>
        </>
      )}

      {/* STATS */}
      {activeTab === 'stats' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[['Matchs',statsHistory.length],['Buts',totalButs],['PD',totalPD],['Min.',totalMin],['Note',noteMoy],['Cartons 🟡',statsHistory.filter(s=>s.carton_jaune).length]].map(([l,v]) => (
              <div key={l} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Historique matchs</p>
            {statsHistory.length === 0
              ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune statistique.</p>
              : statsHistory.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{s.evenements?.titre}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>{s.temps_jeu}min · {s.titulaire ? 'Titu.' : 'Rempl.'} {s.carton_jaune ? '🟡' : ''}{s.carton_rouge ? '🔴' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.note || '—'}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Note</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11' }}>{s.buts || 0}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Buts</div></div>
                    </div>
                  </div>
                ))
            }
          </Card>
        </>
      )}

      {/* NOTES STAFF */}
      {activeTab === 'notes' && (
        <>
          {canComment && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ajouter une note</p>
              <Textarea value={newComment} onChange={setNewComment} placeholder="Observation technique, tactique, comportementale..." rows={3} />
              <Button variant="primary" style={{ width: '100%' }} onClick={addComment}>Publier</Button>
            </Card>
          )}
          {commentaires.length === 0
            ? <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucune note pour l'instant.</p></Card>
            : commentaires.map(c => (
                <Card key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar initials={(c.auteur_nom || 'S').slice(0, 2).toUpperCase()} size={28} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{c.auteur_nom}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>{c.auteur_role} · {c.created_at ? format(parseISO(c.created_at), 'd MMM HH:mm', { locale: fr }) : ''}</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.5 }}>{c.contenu}</p>
                </Card>
              ))
          }
        </>
      )}
    </div>
  )
}
