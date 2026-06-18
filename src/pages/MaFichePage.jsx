import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

const RPE_ITEMS = [
  { key: 'difficulte', label: 'Difficulté' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'implication', label: 'Implication' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. indiv.' },
  { key: 'perf_collective', label: 'Perf. coll.' },
]

function Field({ label, value, onChange, type = 'text', step, disabled = false, note }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
        {label} {note && <span style={{ color: '#9CA3AF', fontSize: 10 }}>({note})</span>}
      </label>
      <input
        type={type} step={step} value={value || ''}
        onChange={e => onChange && onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: `0.5px solid ${disabled ? '#F3F4F6' : '#D1D5DB'}`,
          borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box',
          background: disabled ? '#FAFAFA' : '#fff',
          color: disabled ? '#9CA3AF' : '#111'
        }}
      />
    </div>
  )
}

function ZoneFC({ label, pct, fcRepos, fcReserve, color }) {
  if (!fcReserve) return null
  const val = Math.round(fcRepos + fcReserve * pct)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, marginBottom: 4, background: `${color}20` }}>
      <span style={{ fontSize: 12, color }}>{label}</span>
      <strong style={{ fontSize: 13, color }}>{val} bpm</strong>
    </div>
  )
}

export default function MaFichePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [joueur, setJoueur] = useState(null)
  const [form, setForm] = useState({})
  const [rpeHistory, setRpeHistory] = useState([])
  const [statsHistory, setStatsHistory] = useState([])
  const [poidsHistory, setPoidsHistory] = useState([])
  const [blessuresData, setBlessuresData] = useState([])
  const [newPoids, setNewPoids] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('infos')
  const [pwd, setPwd] = useState({ new: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)
  const [pwdSaving, setPwdSaving] = useState(false)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    const [{ data: j }, { data: rpe }, { data: stats }, { data: poids }] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', profile.id).single(),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('stats_match').select('*, evenements(titre,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('suivi_poids').select('*').eq('joueur_id', profile.id).order('date_mesure', { ascending: true }).limit(12),
    ])
    setJoueur(j)
    setForm(j || {})
    setRpeHistory(rpe || [])
    setStatsHistory(stats || [])
    setPoidsHistory(poids || [])
    setLoading(false)
  }

  const f = (key) => form[key] || ''

  async function changePassword() {
    if (!pwd.new || !pwd.confirm) { setPwdMsg({ ok: false, text: 'Remplis les deux champs.' }); return }
    if (pwd.new.length < 6) { setPwdMsg({ ok: false, text: 'Au moins 6 caractères.' }); return }
    if (pwd.new !== pwd.confirm) { setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' }); return }
    setPwdSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwd.new })
    setPwdSaving(false)
    if (error) setPwdMsg({ ok: false, text: 'Erreur : ' + error.message })
    else {
      setPwdMsg({ ok: true, text: '✅ Mot de passe modifié !' })
      setPwd({ new: '', confirm: '' })
      setTimeout(() => setPwdMsg(null), 3000)
    }
  }
  const s = (key) => (v) => setForm(p => ({ ...p, [key]: v }))

  async function saveForm() {
    setSaving(true)
    const { error } = await supabase.from('joueurs').update({
      // Infos personnelles
      nom: form.nom,
      prenom: form.prenom,
      date_naissance: form.date_naissance || null,
      telephone: form.telephone,
      email: form.email,
      adresse: form.adresse,
      contact_urgence_nom: form.contact_urgence_nom,
      contact_urgence_tel: form.contact_urgence_tel,
      pied: form.pied,
      // Morphologie
      taille: form.taille ? parseInt(form.taille) : null,
      poids: form.poids ? parseFloat(form.poids) : null,
      // Physiologie
      vma: form.vma ? parseFloat(form.vma) : null,
      fc_max: form.fc_max ? parseInt(form.fc_max) : null,
      fc_repos: form.fc_repos ? parseInt(form.fc_repos) : null,
    }).eq('id', profile.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setJoueur({ ...joueur, ...form })
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function savePoids() {
    if (!newPoids) return
    await supabase.from('suivi_poids').insert({
      joueur_id: profile.id,
      poids: parseFloat(newPoids),
      date_mesure: new Date().toISOString().split('T')[0]
    })
    setNewPoids('')
    loadData()
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // Calculs
  const imc = form.taille && form.poids
    ? (form.poids / ((form.taille / 100) ** 2)).toFixed(1)
    : '—'
  const fcMax = parseInt(form.fc_max) || 0
  const fcRepos = parseInt(form.fc_repos) || 0
  const fcReserve = fcMax && fcRepos ? fcMax - fcRepos : null

  const totalButs = statsHistory.reduce((s, r) => s + (r.buts || 0), 0)
  const totalPD = statsHistory.reduce((s, r) => s + (r.passes_decisives || 0), 0)
  const noteMoy = statsHistory.length
    ? (statsHistory.reduce((s, r) => s + (r.note || 0), 0) / statsHistory.length).toFixed(1)
    : '—'
  const rpeAvg = RPE_ITEMS.map(item => {
    const vals = rpeHistory.map(r => r[item.key]).filter(v => v !== null && v !== undefined)
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return { label: item.label, value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
  })

  const tabs = [
    { key: 'infos',    label: '👤 Mes infos' },
    { key: 'physio',   label: '❤️ Physio & FC' },
    { key: 'stats',    label: '⚽ Mes stats' },
    { key: 'poids',    label: '⚖️ Mon poids' },
    { key: 'objectifs',label: '🎯 Objectifs' },
    { key: 'blessures',label: '🤕 Blessures' },
    { key: 'compte',   label: '🔐 Compte' },
  ]

  return (
    <div style={{ padding: 12 }}>
      {/* Hero */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '16px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <label htmlFor="photo-upload-fiche" style={{ cursor: 'pointer', position: 'relative', display: 'block' }}>
          {joueur?.photo_url
            ? <img src={joueur.photo_url} alt={joueur.nom} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.4)' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {joueur?.nom?.[0]}{joueur?.prenom?.[0]}
              </div>
          }
          <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,.5)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>📷</div>
          <input id="photo-upload-fiche" type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => uploadPhoto(e.target.files[0])} />
        </label>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{joueur?.nom} {joueur?.prenom}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
            {joueur?.poste || '—'} {joueur?.numero ? `· N°${joueur.numero}` : ''} {joueur?.groupe ? `· Pôle ${joueur.groupe}` : ''}
          </p>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[['Matchs', statsHistory.length], ['Buts', totalButs], ['PD', totalPD], ['Note', noteMoy]].map(([l, v]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{v}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
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

      {saved && (
        <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>
          ✅ Modifications enregistrées !
        </div>
      )}

      {/* MES INFOS */}
      {activeTab === 'infos' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Informations personnelles</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Toutes ces informations sont modifiables par toi.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Nom" value={f('nom')} onChange={s('nom')} />
              <Field label="Prénom" value={f('prenom')} onChange={s('prenom')} />
              <Field label="Date de naissance" type="date" value={f('date_naissance')} onChange={s('date_naissance')} />
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Pied fort</label>
                <select value={f('pied')} onChange={e => setForm(p => ({...p, pied: e.target.value}))}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  {['Droit','Gauche','Les deux'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes coordonnées</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Téléphone" value={f('telephone')} onChange={s('telephone')} />
              <Field label="Email" value={f('email')} onChange={s('email')} />
            </div>
            <Field label="Adresse" value={f('adresse')} onChange={s('adresse')} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Contact urgence — Nom" value={f('contact_urgence_nom')} onChange={s('contact_urgence_nom')} />
              <Field label="Contact urgence — Tél." value={f('contact_urgence_tel')} onChange={s('contact_urgence_tel')} />
            </div>
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Morphologie</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Field label="Taille (cm)" type="number" value={f('taille')} onChange={s('taille')} />
              <Field label="Poids (kg)" type="number" step="0.1" value={f('poids')} onChange={s('poids')} />
              <Field label="IMC" value={imc} disabled />
            </div>
          </Card>

          <Button variant="primary" style={{ width: '100%' }} onClick={saveForm} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer mes infos'}
          </Button>
        </>
      )}

      {/* PHYSIO & FC */}
      {activeTab === 'physio' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>VMA</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Vitesse Maximale Aérobie — issue de ton dernier test</p>
            <Field label="VMA (km/h)" type="number" step="0.1" value={f('vma')} onChange={s('vma')} note="modifiable" />
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fréquence cardiaque</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>Renseigne ta FC max et ta FC de repos pour calculer tes zones d'entraînement.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <Field label="FC max (bpm)" type="number" value={f('fc_max')} onChange={s('fc_max')} note="modifiable" />
              <Field label="FC repos (bpm)" type="number" value={f('fc_repos')} onChange={s('fc_repos')} note="modifiable" />
            </div>

            {/* FC calculées */}
            {fcReserve && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Zones calculées (méthode Karvonen)</p>

                <ZoneFC label="FC à 70% — Endurance fondamentale" pct={0.70} fcRepos={fcRepos} fcReserve={fcReserve} color="#3B6D11" />
                <ZoneFC label="FC à 85% — Seuil anaérobie" pct={0.85} fcRepos={fcRepos} fcReserve={fcReserve} color="#BA7517" />
                <ZoneFC label="FC à 95% — Effort maximal" pct={0.95} fcRepos={fcRepos} fcReserve={fcReserve} color="#A32D2D" />

                <div style={{ marginTop: 10, background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Toutes les zones</p>
                  {[
                    ['Zone 1 — Récupération (50-60%)', 0.5, 0.6, '#185FA5'],
                    ['Zone 2 — Aérobie (60-70%)', 0.6, 0.7, '#3B6D11'],
                    ['Zone 3 — Seuil (70-80%)', 0.7, 0.8, '#BA7517'],
                    ['Zone 4 — Haute intensité (80-90%)', 0.8, 0.9, '#D85A30'],
                    ['Zone 5 — Maximale (90-100%)', 0.9, 1.0, '#A32D2D'],
                  ].map(([label, min, max, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 6, marginBottom: 3, background: `${color}15` }}>
                      <span style={{ fontSize: 11, color }}>{label}</span>
                      <strong style={{ fontSize: 11, color }}>
                        {Math.round(fcRepos + fcReserve * min)}–{Math.round(fcRepos + fcReserve * max)} bpm
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!fcReserve && (
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 12, fontSize: 12, color: THEME.primary }}>
                💡 Renseigne ta FC max et ta FC de repos pour voir tes zones d'entraînement personnalisées.
              </div>
            )}
          </Card>

          <Button variant="primary" style={{ width: '100%' }} onClick={saveForm} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer mes données physio'}
          </Button>
        </>
      )}

      {/* MON RPE */}
      {activeTab === 'rpe' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes moyennes RPE — saison</p>
            {rpeHistory.length === 0
              ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune donnée RPE pour l'instant.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rpeAvg.map(item => (
                    <div key={item.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6B7280', marginBottom: 2 }}>
                        <span>{item.label}</span>
                        <span style={{ color: item.color, fontWeight: 600 }}>{item.value}/5</span>
                      </div>
                      <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 4, background: item.color, width: `${item.value/5*100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
            }
          </Card>
          {rpeHistory.map(r => {
            const avg = (RPE_ITEMS.reduce((s, i) => s + (r[i.key] || 0), 0) / RPE_ITEMS.length).toFixed(1)
            return (
              <Card key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{r.evenements?.titre}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: rpeColor(parseFloat(avg)), padding: '3px 10px', borderRadius: 10, background: `${rpeColor(parseFloat(avg))}20` }}>{avg}/5</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {RPE_ITEMS.map(item => (
                    <div key={item.key} style={{ background: '#F9FAFB', borderRadius: 6, padding: '3px 7px', fontSize: 10 }}>
                      <span style={{ color: '#9CA3AF' }}>{item.label.split(' ')[0]} </span>
                      <span style={{ fontWeight: 600, color: rpeColor(r[item.key] || 0) }}>{r[item.key] ?? '—'}</span>
                    </div>
                  ))}
                </div>
                {r.commentaire && <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>💬 {r.commentaire}</p>}
              </Card>
            )
          })}
        </>
      )}

      {/* MES STATS */}
      {activeTab === 'stats' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes statistiques match</p>
          {statsHistory.length === 0
            ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune statistique enregistrée.</p>
            : statsHistory.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{s.evenements?.titre}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {s.temps_jeu}min · {s.titulaire ? 'Titulaire' : 'Remplaçant'} {s.carton_jaune ? '🟡' : ''}{s.carton_rouge ? '🔴' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.note || '—'}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Note</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11' }}>{s.buts || 0}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Buts</div></div>
                  </div>
                </div>
              ))
          }
        </Card>
      )}

      {/* OBJECTIFS */}
      {activeTab === 'objectifs' && (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Mes objectifs & bilan</p>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
            Points forts, axes d'amélioration, objectifs saison et bilan de fin de saison.
          </p>
          <button onClick={() => navigate('/mes-objectifs')} style={{
            width: '100%', padding: 14, background: THEME.gradient,
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            Accéder à mes objectifs →
          </button>
        </div>
      )}

      {/* BLESSURES */}
      {activeTab === 'blessures' && (
        <>
          {blessuresData.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>💪</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>Aucune blessure enregistrée</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Continue comme ça !</p>
              </div>
            </Card>
          ) : (
            blessuresData.map(b => (
              <Card key={b.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{b.zone || b.type}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{b.type}</p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    background: !b.date_retour_effective ? '#FCEBEB' : '#EAF3DE',
                    color: !b.date_retour_effective ? '#A32D2D' : '#3B6D11'
                  }}>
                    {!b.date_retour_effective ? '🤕 En cours' : '✅ Guéri'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: '#6B7280' }}>
                  <span>📅 Début : {b.date_debut ? new Date(b.date_debut).toLocaleDateString('fr-FR') : '—'}</span>
                  {b.date_retour_prevue && <span>🎯 Retour prévu : {new Date(b.date_retour_prevue).toLocaleDateString('fr-FR')}</span>}
                </div>
                {b.date_retour_effective && (
                  <p style={{ fontSize: 11, color: '#3B6D11', marginTop: 4 }}>
                    ✅ Retour effectif : {new Date(b.date_retour_effective).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {b.description && (
                  <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>{b.description}</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 10, background: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>
                    {b.gravite === 'legere' ? '🟡 Légère' : b.gravite === 'moderee' ? '🟠 Modérée' : b.gravite === 'grave' ? '🔴 Grave' : '—'}
                  </span>
                  {b.duree_estimee && <span style={{ fontSize: 10, color: '#9CA3AF' }}>~{b.duree_estimee} jours</span>}
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {/* COMPTE */}
      {activeTab === 'compte' && (
        <>
          <Card>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔐 Changer mon mot de passe</p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>
              Choisis un mot de passe sécurisé d'au moins 6 caractères.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Nouveau mot de passe</label>
              <input type="password" value={pwd.new} onChange={e => setPwd(p => ({...p, new: e.target.value}))}
                placeholder="Au moins 6 caractères"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Confirmer le mot de passe</label>
              <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({...p, confirm: e.target.value}))}
                placeholder="Répète le mot de passe"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {pwdMsg && (
              <div style={{ background: pwdMsg.ok ? '#EAF3DE' : '#FCEBEB', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: pwdMsg.ok ? '#3B6D11' : '#A32D2D' }}>
                {pwdMsg.text}
              </div>
            )}
            <Button variant="primary" style={{ width: '100%' }} onClick={changePassword} disabled={pwdSaving}>
              {pwdSaving ? 'Enregistrement...' : '💾 Modifier mon mot de passe'}
            </Button>
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations du compte</p>
            {[
              ['Nom', `${joueur?.nom} ${joueur?.prenom}`],
              ['Poste', joueur?.poste || '—'],
              ['Numéro', joueur?.numero ? `N°${joueur.numero}` : '—'],
              ['Groupe', joueur?.groupe ? `Pôle ${joueur.groupe}` : '—'],
              ['Email', joueur?.email || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* MON POIDS */}
      {activeTab === 'poids' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Suivi de mon poids</p>
          {poidsHistory.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70, marginBottom: 12 }}>
              {poidsHistory.map((p, i) => {
                const min = Math.min(...poidsHistory.map(x => x.poids))
                const max = Math.max(...poidsHistory.map(x => x.poids))
                const h = max === min ? 50 : ((p.poids - min) / (max - min)) * 50 + 10
                return (
                  <div key={p.id} title={`${p.poids} kg — ${p.date_mesure}`}
                    style={{ flex: 1, background: THEME.primary, borderRadius: '3px 3px 0 0', height: `${h}px`, opacity: 0.5 + (i / poidsHistory.length) * 0.5 }} />
                )
              })}
            </div>
          )}
          {poidsHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
              <span>Dernier : <strong style={{ color: '#111' }}>{poidsHistory[poidsHistory.length-1]?.poids} kg</strong></span>
              <span>Min : {Math.min(...poidsHistory.map(p => p.poids))} · Max : {Math.max(...poidsHistory.map(p => p.poids))} kg</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" step="0.1" placeholder="Nouvelle pesée (kg)" value={newPoids}
              onChange={e => setNewPoids(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            <button onClick={savePoids} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: THEME.primary, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              + Ajouter
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
