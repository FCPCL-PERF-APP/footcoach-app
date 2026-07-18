import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { validateFile } from '../lib/upload'
import { useAuth } from '../hooks/useAuth'
import { Card, Button, Input, Select, Spinner, Avatar } from '../components/UI'
import PhotoCropModal from '../components/PhotoCropModal'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Camera, Pencil, Save, Mail, X, Hourglass, CheckCircle2,
  Bandage, Target, User, Heart, TrendingUp, Swords, MessageSquare,
  Dumbbell, Brain, Trophy, XCircle, RefreshCw, Calendar
} from 'lucide-react'
import { computePresenceBreakdown } from '../lib/presenceStats'

const RPE_ITEMS = [
  { key: 'difficulte', label: 'Difficulté' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'implication', label: 'Implication' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. indiv.' },
  { key: 'perf_collective', label: 'Perf. coll.' },
]

function rpeColor(v) {
  if (v >= 4.5) return 'var(--danger)'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return 'var(--warning)'
  return 'var(--success)'
}

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
]

export default function FicheJoueurPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isCoach, isJoueur, canComment } = useAuth()
  const [joueur, setJoueur] = useState(null)
  const [activeTab, setActiveTab] = useState('identite')
  const [rpeHistory, setRpeHistory] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [statsHistory, setStatsHistory] = useState([])
  const [footbarFiche, setFootbarFiche] = useState([])
  const [objJoueurData, setObjJoueurData] = useState(null)
  const [bilanForm, setBilanForm] = useState({})
  const [savingBilan, setSavingBilan] = useState(false)
  const [bilanSaved, setBilanSaved] = useState(false)
  const [tests, setTests] = useState([])
  const [poidsHistory, setPoidsHistory] = useState([])
  const [commentaires, setCommentaires] = useState([])
  const [blessures, setBlessures] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [presences, setPresences] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [photoUploading, setPhotoUploading] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newPoids, setNewPoids] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState(null)
  // Ignore une réponse devenue obsolète si le coach navigue vers une autre fiche joueur
  // avant qu'elle ne revienne.
  const idRef = useRef(id)

  useEffect(() => { idRef.current = id; loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const [{ data: j }, { data: rpe }, { data: foot }, { data: stats },
           { data: t }, { data: poids }, { data: comms }, { data: bless }, { data: obj }, { data: objJoueur }, { data: pres }] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', id).single(),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)').eq('joueur_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)').eq('joueur_id', id).order('created_at', { ascending: false }).limit(10),
      // Pas de limite : le filtre "matchs officiels" (hors préparation) s'applique après
      // coup sur ces données — une limite ici tronquait le total avant ce filtre et
      // sous-comptait buts/matchs/passes dès qu'un joueur avait des matchs de prépa
      // récents ou plus de 15 matchs dans la saison (cf. ExportFicheJoueurPage.jsx qui,
      // sans limite, calcule correctement les mêmes totaux).
      supabase.from('stats_match').select('*, evenements(titre,date_heure,match_type)').eq('joueur_id', id).order('created_at', { ascending: false }),
      supabase.from('tests_physiques').select('*').eq('joueur_id', id).order('date_test', { ascending: false }),
      supabase.from('suivi_poids').select('*').eq('joueur_id', id).order('date_mesure', { ascending: true }).limit(12),
      supabase.from('commentaires_joueurs').select('*').eq('joueur_id', id).order('created_at', { ascending: false }),
      supabase.from('blessures').select('*').eq('joueur_id', id).order('date_debut', { ascending: false }),
      supabase.from('objectifs').select('*').eq('joueur_id', id).order('created_at', { ascending: false }),
      supabase.from('objectifs_joueur').select('*').eq('joueur_id', id).maybeSingle(),
      supabase.from('presences').select('statut, evenements(type)').eq('joueur_id', id),
    ])
    if (idRef.current !== id) return
    setJoueur(j)
    setForm({ ...j })
    setRpeHistory(rpe || [])
    setFootHistory(foot || [])
    setStatsHistory(stats || [])
    setTests(t || [])
    setPoidsHistory(poids || [])
    setCommentaires(comms || [])
    setBlessures(bless || [])
    setObjectifs(obj || [])
    setPresences(pres || [])
    if (objJoueur) {
      setObjJoueurData(objJoueur)
      setBilanForm({
        bilan_obj_perso_atteints: objJoueur.bilan_obj_perso_atteints,
        bilan_obj_perso_comment: objJoueur.bilan_obj_perso_comment || '',
        bilan_obj_collectifs_atteints: objJoueur.bilan_obj_collectifs_atteints,
        bilan_axes_saison_prochaine: objJoueur.bilan_axes_saison_prochaine || '',
        bilan_projection: objJoueur.bilan_projection || '',
        bilan_commentaire: objJoueur.bilan_commentaire || '',
      })
    }
    setLoading(false)
  }

  async function renvoyerInvitation() {
    if (!joueur?.email) { alert('Aucun email pour ce joueur.'); return }
    if (inviting) return
    setInviting(true)
    try {
      const res = await fetch('/api/invite-joueur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ joueurId: joueur.id, email: joueur.email, nom: joueur.nom, prenom: joueur.prenom })
      })
      if (res.ok) {
        const data = await res.json()
        alert(data.mode === 'reset'
          ? `Ce joueur avait déjà un compte : un email de réinitialisation de mot de passe a été envoyé à ${joueur.email}`
          : `Invitation renvoyée à ${joueur.email}`)
      } else {
        const err = await res.json()
        alert('Erreur : ' + (err.error || "Impossible d'envoyer l'invitation"))
      }
    } catch(e) {
      alert('Erreur réseau : ' + e.message)
    }
    setInviting(false)
  }

  async function saveBilan() {
    if (!joueur?.id) return
    setSavingBilan(true)
    const payload = { ...bilanForm, joueur_id: joueur.id }
    const { data: existing } = await supabase.from('objectifs_joueur').select('id').eq('joueur_id', joueur.id).maybeSingle()
    const { error } = existing?.id
      ? await supabase.from('objectifs_joueur').update(payload).eq('id', existing.id)
      : await supabase.from('objectifs_joueur').insert(payload)
    setSavingBilan(false)
    if (error) {
      alert('Erreur lors de l\'enregistrement du bilan : ' + error.message)
      return
    }
    setBilanSaved(true)
    setTimeout(() => setBilanSaved(false), 2000)
    const { data: updated } = await supabase.from('objectifs_joueur').select('*').eq('joueur_id', joueur.id).maybeSingle()
    if (updated) setObjJoueurData(updated)

    // Notifier le joueur par message privé
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: staffData } = await supabase.from('staff').select('nom, prenom').eq('auth_id', user?.id).maybeSingle()
      const coachNom = staffData ? `${staffData.nom} ${staffData.prenom}` : 'Le coach'
      if (joueur.auth_id) {
        await supabase.from('messages').insert({
          expediteur_id: user?.id,
          expediteur_nom: coachNom,
          expediteur_role: 'coach',
          destinataire_id: joueur.auth_id,
          groupe: false,
          contenu: `Ton bilan de saison a été complété par le coach. Consulte-le dans Ma fiche → Objectifs → Bilan saison.`
        })
      }
    } catch(e) { console.error('Notif bilan:', e) }
  }

  async function saveIdentite() {
    setSaving(true)
    const payload = {
      nom: form.nom,
      prenom: form.prenom,
      poste: form.poste,
      numero: form.numero ? parseInt(form.numero) : null,
      groupe: form.groupe,
      date_naissance: form.date_naissance || null,
      licence: form.licence,
      pied: form.pied,
      telephone: form.telephone,
      email: form.email,
      adresse: form.adresse,
      contact_urgence_nom: form.contact_urgence_nom,
      contact_urgence_tel: form.contact_urgence_tel,
      taille: form.taille ? parseInt(form.taille) : null,
      poids: form.poids ? parseFloat(form.poids) : null,
      fc_max: form.fc_max ? parseInt(form.fc_max) : null,
      fc_repos: form.fc_repos ? parseInt(form.fc_repos) : null,
      points_forts: form.points_forts,
      points_faibles: form.points_faibles,
    }
    const { error } = await supabase.from('joueurs').update(payload).eq('id', id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setEditing(false)
      setJoueur({ ...joueur, ...payload })
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function uploadPhoto(file) {
    const fileErr = validateFile(file, 'image')
    if (fileErr) { alert(fileErr); return }
    setPhotoUploading(true)
    const path = `photos/${id}_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('joueurs').upload(path, file, { upsert: true })
    if (error) {
      setPhotoUploading(false)
      alert('Erreur lors de l\'upload de la photo : ' + error.message)
      return
    }
    const { data: urlData } = supabase.storage.from('joueurs').getPublicUrl(path)
    const { error: updateError } = await supabase.from('joueurs').update({ photo_url: urlData.publicUrl }).eq('id', id)
    setPhotoUploading(false)
    if (updateError) {
      alert('Erreur lors de l\'enregistrement de la photo : ' + updateError.message)
      return
    }
    setJoueur(p => ({ ...p, photo_url: urlData.publicUrl }))
    setForm(p => ({ ...p, photo_url: urlData.publicUrl }))
  }

  async function savePoids() {
    if (!newPoids) return
    const { error } = await supabase.from('suivi_poids').insert({ joueur_id: id, poids: parseFloat(newPoids), date_mesure: new Date().toISOString().split('T')[0] })
    if (error) {
      alert('Erreur lors de l\'ajout : ' + error.message)
      return
    }
    setNewPoids('')
    loadAll()
  }

  async function addComment() {
    if (!newComment.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase.from('staff').select('nom,prenom,role').eq('auth_id', user?.id).maybeSingle()
    const { error } = await supabase.from('commentaires_joueurs').insert({
      joueur_id: id,
      auteur_nom: staff ? `${staff.nom} ${staff.prenom}` : 'Staff',
      auteur_role: staff?.role || 'staff',
      contenu: newComment
    })
    if (error) {
      alert('Erreur lors de l\'ajout du commentaire : ' + error.message)
      return
    }
    setNewComment('')
    loadAll()
  }

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    setInviteResult(null)
    try {
      const res = await fetch('/api/invite-joueur', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ email: inviteEmail, joueurId: id, nom: joueur?.nom, prenom: joueur?.prenom })
      })
      const data = await res.json()
      if (data.success) {
        setInviteResult({ success: true, message: `Invitation envoyée à ${inviteEmail}` })
        setShowInvite(false)
        setInviteEmail('')
      } else {
        setInviteResult({ success: false, message: `Erreur : ${data.error}` })
      }
    } catch (err) {
      setInviteResult({ success: false, message: 'Erreur réseau. Réessaie.' })
    }
    setInviting(false)
  }

  // Un joueur ne doit accéder qu'à sa propre fiche — la vue détaillée coach expose
  // des données (commentaires staff, bilan, historique complet) qui ne doivent pas
  // être visibles pour les autres joueurs. "Ma fiche" est le point d'entrée prévu.
  if (isJoueur) return <Navigate to="/ma-fiche" replace />

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>
  if (!joueur) return <div style={{ padding: 12 }}>Joueur introuvable.</div>

  const initials = `${joueur.nom?.[0] || ''}${joueur.prenom?.[0] || ''}`
  const imc = joueur.taille && joueur.poids ? (joueur.poids / ((joueur.taille / 100) ** 2)).toFixed(1) : '—'
  const fcReserve = joueur.fc_max && joueur.fc_repos ? joueur.fc_max - joueur.fc_repos : null
  // Matchs officiels seulement (hors préparation), comme ClassementButeursPage/
  // DashboardStatsPage/BadgesJoueurPage/ComparatifJoueursPage
  const statsOfficielles = statsHistory.filter(s => s.evenements?.match_type !== 'preparation')
  const totalButs = statsOfficielles.reduce((s, r) => s + (r.buts || 0), 0)
  const totalPD = statsOfficielles.reduce((s, r) => s + (r.passes_decisives || 0), 0)
  const noteMoy = statsOfficielles.length ? (statsOfficielles.reduce((s, r) => s + (r.note || 0), 0) / statsOfficielles.length).toFixed(1) : '—'
  const blessureActive = blessures.find(b => !b.date_retour_effective)
  // Répartition des présences aux entraînements — présent/extérieur comptent comme
  // investissement, les blessures sont exclues du taux d'engagement (absence non choisie)
  const presenceSeances = presences.filter(p => p.evenements?.type === 'seance')
  const presenceBreakdown = computePresenceBreakdown(presenceSeances)

  const tabs = [
    { key: 'identite',  icon: User, label: 'Identité', cat: 'blue' },
    { key: 'physio',    icon: Heart, label: 'Physio', cat: 'rose' },
    { key: 'perf',      icon: TrendingUp, label: 'Perfs', cat: 'purple' },
    { key: 'stats',     icon: Swords, label: 'Stats', cat: 'orange' },
    { key: 'objectifs', icon: Target, label: 'Objectifs', cat: 'teal' },
    { key: 'notes',     icon: MessageSquare, label: 'Notes', cat: 'amber' },
  ]

  const inputStyle = (disabled) => ({
    width: '100%', padding: '8px 10px',
    border: `0.5px solid ${disabled ? 'var(--bg-secondary)' : 'var(--border)'}`,
    borderRadius: 10, fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
    background: disabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)'
  })

  function Field({ label, field, type = 'text', disabled = false, options = null, step }) {
    if (options) return (
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
        <select value={form[field] || ''} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
          disabled={disabled} style={inputStyle(disabled)}>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
    return (
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
        <input type={type} step={step} value={form[field] || ''} disabled={disabled}
          onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
          style={inputStyle(disabled)} />
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      {pendingPhoto && (
        <PhotoCropModal file={pendingPhoto} onCancel={() => setPendingPhoto(null)}
          onCropped={f => { setPendingPhoto(null); uploadPhoto(f) }} />
      )}
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/joueurs')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div style={{ position: 'relative' }}>
          {joueur.photo_url
            ? <img src={joueur.photo_url} alt={joueur.nom} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${'var(--primary)'}` }} />
            : <Avatar initials={initials} bg={AVATAR_COLORS[0].bg} color={AVATAR_COLORS[0].color} size={52} />
          }
          {isCoach && (
            <div onClick={() => document.getElementById(`photo-${id}`).click()}
              style={{ position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, background: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Camera size={11} color="#fff" />
            </div>
          )}
          <input id={`photo-${id}`} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && setPendingPhoto(e.target.files[0])} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>{joueur.nom} {joueur.prenom}</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {joueur.poste} {joueur.numero ? `· N°${joueur.numero}` : ''} {joueur.groupe ? `· Pôle ${joueur.groupe}` : ''}
          </p>
          {blessureActive && (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'var(--danger-bg)', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Bandage size={10} /> {blessureActive.zone}
            </span>
          )}
        </div>
        {isCoach && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { if (editing) saveIdentite(); else setEditing(true) }}
              style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: editing ? 'var(--success-bg)' : 'var(--primary-bg)', color: editing ? 'var(--success)' : 'var(--primary)', cursor: 'pointer', display: 'flex' }}>
              {saving ? '...' : editing ? <Save size={14} /> : <Pencil size={14} />}
            </button>
            <button onClick={renvoyerInvitation} disabled={inviting}
              title="Renvoyer l'invitation par email"
              style={{ padding: '6px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'var(--bg-card)', cursor: inviting ? 'not-allowed' : 'pointer', opacity: inviting ? 0.5 : 1, display: 'flex' }}>
              {inviting ? <Hourglass size={14} /> : <Mail size={14} color={'var(--primary)'} />}
            </button>
            {editing && <button onClick={() => { setEditing(false); setForm({...joueur}) }}
              style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><X size={14} /></button>}
          </div>
        )}
      </div>

      {photoUploading && <div style={{ background: 'var(--primary-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}><Camera size={13} /> Upload en cours...</div>}
      {saved && <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> Modifications enregistrées !</div>}

      {/* Invitation email */}
      {isCoach && !joueur.auth_id && (
        <Card style={{ marginBottom: 14, background: '#FDF5EE', border: '0.5px solid #F5C4B3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={12} /> Joueur sans accès à l'app</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Inviter par email pour créer son compte</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setShowInvite(!showInvite)}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--warning)', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                {showInvite ? <X size={12} /> : <><Mail size={12} /> Inviter</>}
              </button>
            </div>
          </div>
          {showInvite && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="email@joueur.com"
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button onClick={handleInvite} disabled={inviting || !inviteEmail}
                  style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  {inviting ? '...' : 'Envoyer'}
                </button>
              </div>
              {inviteResult && (
                <p style={{ fontSize: 12, marginTop: 6, color: inviteResult.success ? 'var(--success)' : 'var(--danger)' }}>
                  {inviteResult.message}
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {isCoach && joueur.auth_id && (
        <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 11, color: 'var(--success)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} /> Compte actif — joueur connecté à l'app</span>
        </div>
      )}

      {isCoach && !joueur.auth_id && joueur.email && !showInvite && inviteResult?.success && (
        <div style={{ background: 'var(--primary-bg)', borderRadius: 8, padding: '6px 10px', marginBottom: 10, fontSize: 11, color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Mail size={12} /> Invitation envoyée — lien valable 24h</span>
          <button onClick={() => { setShowInvite(true); setInviteResult(null) }}
            style={{ fontSize: 10, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>
            Renvoyer
          </button>
        </div>
      )}

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[['Matchs', statsOfficielles.length], ['Buts', totalButs], ['PD', totalPD], ['Note', noteMoy]].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{v}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Présence entraînements */}
      {presenceSeances.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}><Calendar size={13} color={'var(--primary)'} /> Présence entraînements</p>
            <span style={{ fontSize: 15, fontWeight: 800, color: presenceBreakdown.tauxEngagement >= 80 ? 'var(--success)' : 'var(--warning)' }}>
              {presenceBreakdown.tauxEngagement ?? '—'}%
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {[
              { key: 'present', label: 'Présent', icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
              { key: 'exterieur', label: 'Extérieur', icon: RefreshCw, color: 'var(--primary)', bg: 'var(--primary-bg)' },
              { key: 'blesse', label: 'Blessé', icon: Bandage, color: 'var(--warning)', bg: 'var(--warning-bg)' },
              { key: 'absent', label: 'Absent', icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
            ].map(s => (
              <div key={s.key} style={{ background: s.bg, borderRadius: 10, padding: '7px 4px', textAlign: 'center' }}>
                <s.icon size={12} color={s.color} style={{ marginBottom: 3 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{presenceBreakdown[s.key]}</div>
                <div style={{ fontSize: 8, color: s.color }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
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

      {/* Liens rapides blessures/objectifs */}
      {isCoach && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => navigate(`/joueurs/${id}/blessures`)}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: '0.5px solid var(--border)', background: blessureActive ? 'var(--danger-bg)' : 'transparent', color: blessureActive ? 'var(--danger)' : 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', fontWeight: blessureActive ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Bandage size={12} /> Blessures {blessureActive ? '· 1 active' : ''}
          </button>
          <button onClick={() => navigate(`/joueurs/${id}/objectifs`)}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Target size={12} /> Objectifs · {objectifs.filter(o => o.statut === 'en_cours').length} en cours
          </button>
        </div>
      )}

      {/* IDENTITÉ */}
      {activeTab === 'identite' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations personnelles</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Nom" field="nom" disabled={!editing} />
              <Field label="Prénom" field="prenom" disabled={!editing} />
              <Field label="Date de naissance" field="date_naissance" type="date" disabled={!editing} />
              <Field label="N° Licence" field="licence" disabled={!editing} />
              <Field label="Pied fort" field="pied" disabled={!editing} options={['Droit','Gauche','Les deux']} />
              <Field label="Poste" field="poste" disabled={!editing} />
              <Field label="Numéro" field="numero" type="number" disabled={!editing} />
              <Field label="Pôle / Groupe" field="groupe" disabled={!editing} options={['A','B','C','D','E']} />
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Coordonnées</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Téléphone" field="telephone" disabled={!editing} />
              <Field label="Email" field="email" disabled={!editing} />
            </div>
            <Field label="Adresse" field="adresse" disabled={!editing} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Contact urgence" field="contact_urgence_nom" disabled={!editing} />
              <Field label="Tél. urgence" field="contact_urgence_tel" disabled={!editing} />
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Morphologie</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Field label="Taille (cm)" field="taille" type="number" disabled={!editing} />
              <Field label="Poids (kg)" field="poids" type="number" step="0.1" disabled={!editing} />
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>IMC</label>
                <input value={imc} disabled style={inputStyle(true)} />
              </div>
            </div>
          </Card>
          {editing && (
            <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveIdentite} disabled={saving}>
              {saving ? 'Enregistrement...' : <><Save size={13} /> Enregistrer toutes les modifications</>}
            </Button>
          )}
        </>
      )}

      {/* PHYSIOLOGIE */}
      {activeTab === 'physio' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Fréquence cardiaque</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Field label="FC max" field="fc_max" type="number" disabled={!editing} />
              <Field label="FC repos" field="fc_repos" type="number" disabled={!editing} />
              <div style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>FC réserve</label>
                <input value={fcReserve || '—'} disabled style={inputStyle(true)} />
              </div>
            </div>
            {fcReserve && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Zones FC (Karvonen)</p>
                {[
                  ['Zone 1 — Récupération', 0.5, 0.6, 'var(--primary-bg)', 'var(--primary)'],
                  ['Zone 2 — Aérobie', 0.6, 0.7, '#EAF3DE', '#3B6D11'],
                  ['Zone 3 — Seuil', 0.7, 0.8, '#FAEEDA', 'var(--warning)'],
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
            {editing && <Button variant="primary" style={{ width: '100%', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveIdentite} disabled={saving}><Save size={13} /> Enregistrer FC</Button>}
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Suivi du poids</p>
            {poidsHistory.length > 1 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Dernier : <strong style={{ color: 'var(--primary)' }}>{poidsHistory[poidsHistory.length-1]?.poids} kg</strong></span>
                  {poidsHistory.length >= 2 && (() => {
                    const diff = (poidsHistory[poidsHistory.length-1].poids - poidsHistory[0].poids).toFixed(1)
                    return <span style={{ fontSize: 11, color: parseFloat(diff) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{parseFloat(diff) > 0 ? '+' : ''}{diff} kg</span>
                  })()}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 70, marginBottom: 4 }}>
                  {poidsHistory.map((p, i) => {
                    const min = Math.min(...poidsHistory.map(x => x.poids))
                    const max = Math.max(...poidsHistory.map(x => x.poids))
                    const h = max === min ? 50 : ((p.poids - min) / (max - min)) * 50 + 10
                    const isLast = i === poidsHistory.length - 1
                    return (
                      <div key={p.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {isLast && <span style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 700, marginBottom: 2 }}>{p.poids}</span>}
                        <div style={{ width: '100%', background: isLast ? 'var(--primary)' : '#B5D4F4', borderRadius: '3px 3px 0 0', height: `${h}px` }} />
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginBottom: 8 }}>
                  <span>{poidsHistory[0]?.poids} kg</span>
                  <span>{poidsHistory[poidsHistory.length-1]?.poids} kg</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" step="0.1" placeholder="Nouvelle pesée (kg)" value={newPoids} onChange={e => setNewPoids(e.target.value)}
                style={{ flex: 1, padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none' }} />
              <button onClick={savePoids} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Ajouter</button>
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Points forts / axes de travail</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['points_forts','points_faibles'].map((field, i) => (
                <div key={field}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {i === 0 ? <><CheckCircle2 size={11} color={'var(--success)'} /> Points forts</> : <><Target size={11} color={'var(--warning)'} /> Axes de travail</>}
                  </label>
                  <textarea value={form[field] || ''} onChange={e => setForm(p => ({...p, [field]: e.target.value}))}
                    disabled={!editing} rows={4}
                    style={{ width: '100%', padding: '8px 10px', border: `0.5px solid ${editing ? 'var(--border)' : 'var(--bg-secondary)'}`, borderRadius: 10, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', background: editing ? 'var(--bg-card)' : 'var(--bg-secondary)' }} />
                </div>
              ))}
            </div>
            {editing && <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveIdentite} disabled={saving}><Save size={13} /> Enregistrer</Button>}
          </Card>
        </>
      )}

      {/* PERFORMANCES */}
      {activeTab === 'perf' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE moyen — toutes sessions</p>
            {rpeHistory.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune donnée RPE.</p>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {RPE_ITEMS.map(item => {
                    const vals = rpeHistory.map(r => r[item.key]).filter(v => v != null)
                    const avg = vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : 0
                    return (
                      <div key={item.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                          <span>{item.label}</span><span style={{ color: rpeColor(avg), fontWeight: 600 }}>{avg.toFixed(1)}/5</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, background: rpeColor(avg), width: `${avg/5*100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Footbar — historique</p>
            {footHistory.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune donnée Footbar.</p>
              : footHistory.map(f => (
                  <div key={f.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{f.evenements?.titre} — {f.evenements?.date_heure ? format(parseISO(f.evenements.date_heure), 'd MMM', { locale: fr }) : ''}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                      {[['Distance',f.distance_km?`${f.distance_km}km`:'—'],['V.max',f.sprint_max?`${f.sprint_max}km/h`:'—'],['Sprints',f.sprints??'—'],['Ballons',f.ballons_touches??'—'],['Passes',f.nb_passes??'—'],['Tirs',f.nb_tirs??'—'],['HI',f.distance_hi?`${f.distance_hi}m`:'—'],['Tps jeu',f.temps_jeu?`${f.temps_jeu}min`:'—']].map(([l,v]) => (
                        <div key={l} style={{ background: 'var(--bg-secondary)', borderRadius: 6, padding: '4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{v}</div>
                          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l}</div>
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
          {/* Stats enrichies */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
            {[['Matchs',statsOfficielles.length],['Titu.',statsOfficielles.filter(s=>s.titulaire).length],['Rempl.',statsOfficielles.filter(s=>!s.titulaire).length],['Buts',totalButs],['PD',totalPD],['Note moy.',noteMoy],['Tps jeu moy.',statsOfficielles.filter(s=>s.temps_jeu>0).length ? Math.round(statsOfficielles.filter(s=>s.temps_jeu>0).reduce((a,b)=>a+b.temps_jeu,0)/statsOfficielles.filter(s=>s.temps_jeu>0).length)+"'" : '—'],['🟡',statsOfficielles.filter(s=>s.carton_jaune).length],['🔴',statsOfficielles.filter(s=>s.carton_rouge).length]].map(([l,v]) => (
              <div key={l} style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: 12, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{v}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          <Card>
            {statsHistory.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune statistique.</p>
              : statsHistory.map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{s.evenements?.titre}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.temps_jeu}min · {s.titulaire ? 'Titu.' : 'Rempl.'} {s.carton_jaune ? '🟡' : ''}{s.carton_rouge ? '🔴' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.note||'—'}</div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Note</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{s.buts||0}</div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Buts</div></div>
                    </div>
                  </div>
                ))
            }
          </Card>
        </>
      )}

      {/* NOTES */}
      {/* OBJECTIFS JOUEUR — lecture seule pour coach */}
      {activeTab === 'objectifs' && (
        <>
          {!objJoueurData ? (
            <Card>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                Ce joueur n'a pas encore rempli ses objectifs.
              </p>
            </Card>
          ) : (
            <>
              {/* Points forts */}
              {objJoueurData.points_forts && Object.values(objJoueurData.points_forts).some(v => v) && (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} /> Points forts</p>
                  {[
                    { key: 'athletique', icon: Dumbbell, label: 'Athlétique' },
                    { key: 'tactique',   icon: Brain, label: 'Tactique' },
                    { key: 'technique',  icon: Swords, label: 'Technique' },
                    { key: 'mental',     icon: Target, label: 'Mental' },
                  ].map(n => objJoueurData.points_forts[n.key] ? (
                    <div key={n.key} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 80, display: 'flex', alignItems: 'center', gap: 4 }}><n.icon size={11} /> {n.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{objJoueurData.points_forts[n.key]}</span>
                    </div>
                  ) : null)}
                </Card>
              )}

              {/* Axes amélioration */}
              {objJoueurData.axes_amelioration && Object.values(objJoueurData.axes_amelioration).some(v => v) && (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><Target size={13} /> Axes d'amélioration</p>
                  {[
                    { key: 'athletique', icon: Dumbbell, label: 'Athlétique' },
                    { key: 'tactique',   icon: Brain, label: 'Tactique' },
                    { key: 'technique',  icon: Swords, label: 'Technique' },
                    { key: 'mental',     icon: Target, label: 'Mental' },
                  ].map(n => objJoueurData.axes_amelioration[n.key] ? (
                    <div key={n.key} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 80, display: 'flex', alignItems: 'center', gap: 4 }}><n.icon size={11} /> {n.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{objJoueurData.axes_amelioration[n.key]}</span>
                    </div>
                  ) : null)}
                </Card>
              )}

              {/* Objectifs personnels */}
              {(objJoueurData.obj_perso_1 || objJoueurData.obj_perso_2 || objJoueurData.obj_perso_3) && (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><Trophy size={13} color={CAT_COLORS.gold.color} /> Objectifs personnels</p>
                  {[objJoueurData.obj_perso_1, objJoueurData.obj_perso_2, objJoueurData.obj_perso_3].filter(Boolean).map((obj, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i+1}.</span>
                      <span style={{ fontSize: 12 }}>{obj}</span>
                    </div>
                  ))}
                </Card>
              )}

              {/* Objectifs collectifs */}
              {(objJoueurData.obj_collectif_1 || objJoueurData.obj_collectif_2 || objJoueurData.obj_collectif_3) && (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}><Swords size={13} color={CAT_COLORS.blue.color} /> Objectifs collectifs</p>
                  {[objJoueurData.obj_collectif_1, objJoueurData.obj_collectif_2, objJoueurData.obj_collectif_3].filter(Boolean).map((obj, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i+1}.</span>
                      <span style={{ fontSize: 12 }}>{obj}</span>
                    </div>
                  ))}
                </Card>
              )}

              {/* Bilan — coach peut modifier */}
              <Card>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 5 }}><Target size={13} color={'var(--primary)'} /> Bilan saison — à remplir par le coach</p>

                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>1. Objectifs personnels atteints ?</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {['Oui', 'Non'].map(v => (
                    <button key={v} onClick={() => setBilanForm(p => ({...p, bilan_obj_perso_atteints: v === 'Oui'}))}
                      style={{ flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        border: `1.5px solid ${bilanForm.bilan_obj_perso_atteints === (v === 'Oui') ? (v === 'Oui' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
                        background: bilanForm.bilan_obj_perso_atteints === (v === 'Oui') ? (v === 'Oui' ? 'var(--success-bg)' : 'var(--danger-bg)') : 'transparent',
                        color: bilanForm.bilan_obj_perso_atteints === (v === 'Oui') ? (v === 'Oui' ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                      {v === 'Oui' ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {v}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Comment y remédier :</label>
                  <textarea value={bilanForm.bilan_obj_perso_comment || ''} onChange={e => setBilanForm(p => ({...p, bilan_obj_perso_comment: e.target.value}))}
                    placeholder="Commentaire..." rows={2}
                    style={{ width: '100%', padding: '7px 10px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
                </div>

                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>2. Objectifs collectifs atteints ?</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {['Oui', 'Non'].map(v => (
                    <button key={v} onClick={() => setBilanForm(p => ({...p, bilan_obj_collectifs_atteints: v === 'Oui'}))}
                      style={{ flex: 1, padding: 8, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        border: `1.5px solid ${bilanForm.bilan_obj_collectifs_atteints === (v === 'Oui') ? (v === 'Oui' ? 'var(--success)' : 'var(--danger)') : 'var(--border)'}`,
                        background: bilanForm.bilan_obj_collectifs_atteints === (v === 'Oui') ? (v === 'Oui' ? 'var(--success-bg)' : 'var(--danger-bg)') : 'transparent',
                        color: bilanForm.bilan_obj_collectifs_atteints === (v === 'Oui') ? (v === 'Oui' ? 'var(--success)' : 'var(--danger)') : 'var(--text-secondary)' }}>
                      {v === 'Oui' ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {v}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>3. Axes saison prochaine :</label>
                  <textarea value={bilanForm.bilan_axes_saison_prochaine || ''} onChange={e => setBilanForm(p => ({...p, bilan_axes_saison_prochaine: e.target.value}))}
                    placeholder="Ce qu'il doit améliorer..." rows={2}
                    style={{ width: '100%', padding: '7px 10px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>4. Commentaire général :</label>
                  <textarea value={bilanForm.bilan_commentaire || ''} onChange={e => setBilanForm(p => ({...p, bilan_commentaire: e.target.value}))}
                    placeholder="Bilan général du joueur..." rows={2}
                    style={{ width: '100%', padding: '7px 10px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
                </div>

                {bilanSaved && <p style={{ fontSize: 12, color: 'var(--success)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={13} /> Bilan sauvegardé !</p>}
                <button onClick={saveBilan} disabled={savingBilan}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'var(--gradient)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {savingBilan ? 'Enregistrement...' : <><Save size={14} /> Sauvegarder le bilan</>}
                </button>
              </Card>
            </>
          )}
        </>
      )}

      {activeTab === 'notes' && (
        <>
          {canComment && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Ajouter une note</p>
              <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="Observation technique, tactique, comportementale..." rows={3}
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 8 }} />
              <Button variant="primary" style={{ width: '100%' }} onClick={addComment}>Publier</Button>
            </Card>
          )}
          {commentaires.length === 0
            ? <Card><p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Aucune note pour l'instant.</p></Card>
            : commentaires.map(c => (
                <Card key={c.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar initials={(c.auteur_nom || 'S').slice(0,2).toUpperCase()} size={28} />
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{c.auteur_nom}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{c.auteur_role} · {c.created_at ? format(parseISO(c.created_at), 'd MMM HH:mm', { locale: fr }) : ''}</p>
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
