import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateFile } from '../lib/upload'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import PushToggle from '../components/PushToggle'
import PhotoCropModal from '../components/PhotoCropModal'
import { THEME, CAT_COLORS } from '../theme'
import {
  User, Heart, Scale, Target, Bandage, Lock, Camera,
  CheckCircle2, Save, MessageSquare, Lightbulb, XCircle
} from 'lucide-react'

function Field({ label, value, onChange, type = 'text', step, disabled = false, note }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
        {label} {note && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>({note})</span>}
      </label>
      <input
        type={type} step={step} value={value || ''}
        onChange={e => onChange && onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%', padding: '8px 10px',
          border: `0.5px solid ${disabled ? 'var(--bg-secondary)' : 'var(--border)'}`,
          borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box',
          background: disabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
          color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
        }}
      />
    </div>
  )
}

function ZoneFC({ label, pct, fcRepos, fcReserve, color }) {
  if (!fcReserve) return null
  const val = Math.round(fcRepos + fcReserve * pct)
  // Affichage en battements/15s — la façon dont les joueurs comptent réellement à
  // l'entraînement — pour qu'ils sachent tout de suite quoi viser sans convertir.
  const val15 = Math.round(val / 4)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: 8, marginBottom: 4, background: `${color}20` }}>
      <span style={{ fontSize: 12, color }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <strong style={{ fontSize: 13, color }}>{val15} batt/15s</strong>
        <p style={{ fontSize: 9, color, opacity: .75 }}>{val} bpm</p>
      </div>
    </div>
  )
}

export default function MaFichePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [joueur, setJoueur] = useState(null)
  const [form, setForm] = useState({})
  const [poidsHistory, setPoidsHistory] = useState([])
  const [blessuresData, setBlessuresData] = useState([])
  const [newPoids, setNewPoids] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get('onglet') || 'infos')
  const [pwd, setPwd] = useState({ new: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    const [{ data: j }, { data: poids }, { data: blessures }] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', profile.id).single(),
      supabase.from('suivi_poids').select('*').eq('joueur_id', profile.id).order('date_mesure', { ascending: true }).limit(12),
      supabase.from('blessures').select('*').eq('joueur_id', profile.id).order('date_debut', { ascending: false }),
    ])
    setJoueur(j)
    setForm(j || {})
    setPoidsHistory(poids || [])
    setBlessuresData(blessures || [])
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
      setPwdMsg({ ok: true, text: 'Mot de passe modifié !' })
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
      points_forts: form.points_forts,
      points_faibles: form.points_faibles,
    }).eq('id', profile.id)
    setSaving(false)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      return
    }
    setSaved(true)
    setJoueur({ ...joueur, ...form })
    setTimeout(() => setSaved(false), 3000)
  }

  async function savePoids() {
    if (!newPoids) return
    const { error } = await supabase.from('suivi_poids').insert({
      joueur_id: profile.id,
      poids: parseFloat(newPoids),
      date_mesure: new Date().toISOString().split('T')[0]
    })
    if (error) {
      alert('Erreur lors de l\'ajout : ' + error.message)
      return
    }
    setNewPoids('')
    loadData()
  }

  async function uploadPhoto(file) {
    const fileErr = validateFile(file, 'image')
    if (fileErr) { alert(fileErr); return }
    setPhotoUploading(true)
    const path = `photos/${profile.id}_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('joueurs').upload(path, file, { upsert: true })
    if (error) {
      setPhotoUploading(false)
      alert('Erreur lors de l\'upload de la photo : ' + error.message)
      return
    }
    const { data: urlData } = supabase.storage.from('joueurs').getPublicUrl(path)
    const { error: updateError } = await supabase.from('joueurs').update({ photo_url: urlData.publicUrl }).eq('id', profile.id)
    setPhotoUploading(false)
    if (updateError) {
      alert('Erreur lors de l\'enregistrement de la photo : ' + updateError.message)
      return
    }
    setJoueur(p => ({ ...p, photo_url: urlData.publicUrl }))
    setForm(p => ({ ...p, photo_url: urlData.publicUrl }))
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // Calculs
  const imc = form.taille && form.poids
    ? (form.poids / ((form.taille / 100) ** 2)).toFixed(1)
    : '—'
  // fc_max/fc_repos sont saisis en comptage sur 15 secondes (méthode utilisée à
  // l'entraînement, plus rapide) — ×4 pour obtenir le vrai bpm/minute utilisé par les
  // zones Karvonen, sans que le joueur ait à faire cette conversion lui-même.
  const fcMax = (parseInt(form.fc_max) || 0) * 4
  const fcRepos = (parseInt(form.fc_repos) || 0) * 4
  const fcReserve = fcMax && fcRepos ? fcMax - fcRepos : null

  const tabs = [
    { key: 'infos',    icon: User, label: 'Mes infos', cat: 'blue' },
    { key: 'physio',   icon: Heart, label: 'Physio & FC', cat: 'rose' },
    { key: 'poids',    icon: Scale, label: 'Mon poids', cat: 'teal' },
    { key: 'blessures',icon: Bandage, label: 'Blessures', cat: 'pink' },
    { key: 'compte',   icon: Lock, label: 'Compte', cat: 'slate' },
  ]

  return (
    <div style={{ padding: 12 }}>
      {pendingPhoto && (
        <PhotoCropModal file={pendingPhoto} onCancel={() => setPendingPhoto(null)}
          onCropped={f => { setPendingPhoto(null); uploadPhoto(f) }} />
      )}
      {/* Hero */}
      <div style={{ background: 'var(--gradient)', borderRadius: 16, padding: '16px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <label htmlFor="photo-upload-fiche" style={{ cursor: 'pointer', position: 'relative', display: 'block' }}>
          {joueur?.photo_url
            ? <img src={joueur.photo_url} alt={joueur.nom} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.4)' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {joueur?.nom?.[0]}{joueur?.prenom?.[0]}
              </div>
          }
          <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'rgba(0,0,0,.5)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={10} color="#fff" /></div>
          <input id="photo-upload-fiche" type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && setPendingPhoto(e.target.files[0])} />
        </label>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{joueur?.nom} {joueur?.prenom}</p>
          {photoUploading && <p style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', display: 'flex', alignItems: 'center', gap: 4 }}><Camera size={11} /> Upload en cours...</p>}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
            {joueur?.poste || '—'} {joueur?.numero ? `· N°${joueur.numero}` : ''} {joueur?.groupe ? `· Pôle ${joueur.groupe}` : ''}
          </p>
        </div>
      </div>

      {/* Stats, RPE, présences et objectifs : regroupés dans « Ma saison » */}
      <button onClick={() => navigate('/mon-bilan')} style={{
        width: '100%', marginBottom: 14, padding: '10px 12px', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
        borderRadius: 10, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left'
      }}>Mes stats, RPE, présences et objectifs sont dans <strong style={{ color: 'var(--primary)' }}>Ma saison</strong> →</button>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {tabs.map(t => {
          const c = CAT_COLORS[t.cat]
          return (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
              border: activeTab === t.key ? `0.5px solid ${c.color}` : '0.5px solid var(--border)', whiteSpace: 'nowrap',
              background: activeTab === t.key ? c.bg : 'transparent',
              color: activeTab === t.key ? c.color : 'var(--text-secondary)',
              fontWeight: activeTab === t.key ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 5
            }}><t.icon size={12} /> {t.label}</button>
          )
        })}
      </div>

      {saved && (
        <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={13} /> Modifications enregistrées !
        </div>
      )}

      {/* MES INFOS */}
      {activeTab === 'infos' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Informations personnelles</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Toutes ces informations sont modifiables par toi.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Nom" value={f('nom')} onChange={s('nom')} />
              <Field label="Prénom" value={f('prenom')} onChange={s('prenom')} />
              <Field label="Date de naissance" type="date" value={f('date_naissance')} onChange={s('date_naissance')} />
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Pied fort</label>
                <select value={f('pied')} onChange={e => setForm(p => ({...p, pied: e.target.value}))}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
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

          <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveForm} disabled={saving}>
            {saving ? 'Enregistrement...' : <><Save size={13} /> Enregistrer mes infos</>}
          </Button>
        </>
      )}

      {/* PHYSIO & FC */}
      {activeTab === 'physio' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>VMA</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Vitesse Maximale Aérobie — issue de ton dernier test</p>
            <Field label="VMA (km/h)" type="number" step="0.1" value={f('vma')} onChange={s('vma')} note="modifiable" />
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fréquence cardiaque</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
              Compte les battements sur <strong>15 secondes</strong> (l'appli convertit automatiquement pour calculer tes zones). La FC de repos se prend le matin au réveil, avant de se lever.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <Field label="FC max (15s)" type="number" value={f('fc_max')} onChange={s('fc_max')} note="modifiable" />
              <Field label="FC repos (15s)" type="number" value={f('fc_repos')} onChange={s('fc_repos')} note="modifiable" />
            </div>

            {/* FC calculées */}
            {fcReserve && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Zones calculées (méthode Karvonen)</p>

                <ZoneFC label="FC à 70% — Endurance fondamentale" pct={0.70} fcRepos={fcRepos} fcReserve={fcReserve} color="#3B6D11" />
                <ZoneFC label="FC à 85% — Seuil anaérobie" pct={0.85} fcRepos={fcRepos} fcReserve={fcReserve} color="#BA7517" />
                <ZoneFC label="FC à 95% — Effort maximal" pct={0.95} fcRepos={fcRepos} fcReserve={fcReserve} color="#A32D2D" />

                <div style={{ marginTop: 10, background: 'var(--bg-secondary)', borderRadius: 10, padding: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Toutes les zones</p>
                  {[
                    ['Zone 1 — Récupération (50-60%)', 0.5, 0.6, 'var(--primary)'],
                    ['Zone 2 — Aérobie (60-70%)', 0.6, 0.7, '#3B6D11'],
                    ['Zone 3 — Seuil (70-80%)', 0.7, 0.8, '#BA7517'],
                    ['Zone 4 — Haute intensité (80-90%)', 0.8, 0.9, '#D85A30'],
                    ['Zone 5 — Maximale (90-100%)', 0.9, 1.0, '#A32D2D'],
                  ].map(([label, min, max, color]) => {
                    // Cible individualisée = point médian de la zone, comme pour le coach
                    // (FicheJoueurPage.jsx) — un chiffre unique à viser, pas qu'une fourchette.
                    // Affiché en battements/15s (méthode de comptage réelle à l'entraînement),
                    // le bpm reste en petit pour référence.
                    const cible = Math.round(fcRepos + fcReserve * ((min + max) / 2))
                    const bMin = Math.round(fcRepos + fcReserve * min), bMax = Math.round(fcRepos + fcReserve * max)
                    return (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', borderRadius: 6, marginBottom: 3, background: `${color}15` }}>
                        <span style={{ fontSize: 11, color }}>{label}</span>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: 12, color }}>{Math.round(cible / 4)} batt/15s</strong>
                          <p style={{ fontSize: 9, color, opacity: .75 }}>
                            {Math.round(bMin / 4)}–{Math.round(bMax / 4)} batt/15s · {bMin}–{bMax} bpm
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!fcReserve && (
              <div style={{ background: 'var(--primary-bg)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--primary)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <Lightbulb size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Renseigne ta FC max et ta FC de repos pour voir tes zones d'entraînement personnalisées.
              </div>
            )}
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Points forts / axes de travail</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Visible et modifiable par toi et ton coach.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['points_forts', 'points_faibles'].map((field, i) => (
                <div key={field}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {i === 0 ? <><CheckCircle2 size={11} color={'var(--success)'} /> Points forts</> : <><Target size={11} color={'var(--warning)'} /> Axes de travail</>}
                  </label>
                  <textarea value={form[field] || ''} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    rows={4}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>
              ))}
            </div>
          </Card>

          <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveForm} disabled={saving}>
            {saving ? 'Enregistrement...' : <><Save size={13} /> Enregistrer mes données physio</>}
          </Button>
        </>
      )}

      {/* BLESSURES */}
      {activeTab === 'blessures' && (
        <>
          {blessuresData.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <CheckCircle2 size={36} color={'var(--success)'} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>Aucune blessure enregistrée</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Continue comme ça !</p>
              </div>
            </Card>
          ) : (
            blessuresData.map(b => (
              <Card key={b.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{b.zone || b.type}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.type}</p>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    background: !b.date_retour_effective ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: !b.date_retour_effective ? 'var(--danger)' : 'var(--success)',
                    display: 'inline-flex', alignItems: 'center', gap: 3
                  }}>
                    {!b.date_retour_effective ? <><Bandage size={10} /> En cours</> : <><CheckCircle2 size={10} /> Guéri</>}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>Début : {b.date_debut ? new Date(b.date_debut).toLocaleDateString('fr-FR') : '—'}</span>
                  {b.date_retour_prevue && <span>Retour prévu : {new Date(b.date_retour_prevue).toLocaleDateString('fr-FR')}</span>}
                </div>
                {b.date_retour_effective && (
                  <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={11} /> Retour effectif : {new Date(b.date_retour_effective).toLocaleDateString('fr-FR')}
                  </p>
                )}
                {b.description && (
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, fontStyle: 'italic' }}>{b.description}</p>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 6,
                    background: b.gravite === 'legere' ? 'var(--warning-bg)' : b.gravite === 'moderee' ? '#FDF5EE' : b.gravite === 'grave' ? 'var(--danger-bg)' : 'var(--bg-secondary)',
                    color: b.gravite === 'legere' ? 'var(--warning)' : b.gravite === 'moderee' ? '#D85A30' : b.gravite === 'grave' ? 'var(--danger)' : 'var(--text-secondary)'
                  }}>
                    {b.gravite === 'legere' ? 'Légère' : b.gravite === 'moderee' ? 'Modérée' : b.gravite === 'grave' ? 'Grave' : '—'}
                  </span>
                  {b.duree_estimee && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>~{b.duree_estimee} jours</span>}
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
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={14} /> Changer mon mot de passe</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Choisis un mot de passe sécurisé d'au moins 6 caractères.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Nouveau mot de passe</label>
              <input type="password" value={pwd.new} onChange={e => setPwd(p => ({...p, new: e.target.value}))}
                placeholder="Au moins 6 caractères"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Confirmer le mot de passe</label>
              <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({...p, confirm: e.target.value}))}
                placeholder="Répète le mot de passe"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {pwdMsg && (
              <div style={{ background: pwdMsg.ok ? 'var(--success-bg)' : 'var(--danger-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: pwdMsg.ok ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {pwdMsg.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {pwdMsg.text}
              </div>
            )}
            <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={changePassword} disabled={pwdSaving}>
              {pwdSaving ? 'Enregistrement...' : <><Save size={13} /> Modifier mon mot de passe</>}
            </Button>
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Notifications</p>
            <PushToggle />
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
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
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
                    style={{ flex: 1, background: 'var(--primary)', borderRadius: '3px 3px 0 0', height: `${h}px`, opacity: 0.5 + (i / poidsHistory.length) * 0.5 }} />
                )
              })}
            </div>
          )}
          {poidsHistory.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
              <span>Dernier : <strong style={{ color: 'var(--text-primary)' }}>{poidsHistory[poidsHistory.length-1]?.poids} kg</strong></span>
              <span>Min : {Math.min(...poidsHistory.map(p => p.poids))} · Max : {Math.max(...poidsHistory.map(p => p.poids))} kg</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" step="0.1" placeholder="Nouvelle pesée (kg)" value={newPoids}
              onChange={e => setNewPoids(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none' }} />
            <button onClick={savePoids} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              + Ajouter
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
