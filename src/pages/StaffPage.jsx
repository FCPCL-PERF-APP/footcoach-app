import { useState, useEffect } from 'react'
import { supabase, authHeaders } from '../lib/supabase'
import { validateFile } from '../lib/upload'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Input, Button, Spinner, Avatar } from '../components/UI'
import PhotoCropModal from '../components/PhotoCropModal'
import { THEME } from '../theme'

const ROLES = [
  { value: 'coach',    label: '👑 Coach principal', desc: 'Accès complet — modification, suppression, création', color: '#185FA5', canEdit: true },
  { value: 'adjoint',  label: '🤝 Coach adjoint',   desc: 'Lecture seule — consultation de toutes les données', color: '#3B6D11', canEdit: false },
  { value: 'admin',    label: '⚙️ Administrateur',  desc: 'Accès complet comme le coach principal', color: '#854F0B', canEdit: true },
  { value: 'preparateur', label: '💪 Préparateur physique', desc: 'Accès RPE, Footbar et données physiques', color: '#A32D2D', canEdit: false },
]

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
]

export default function StaffPage() {
  const { isCoach } = useAuth()
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ nom: '', prenom: '', email: '', role: 'adjoint', telephone: '', diplome: '' })
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [result, setResult] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [editingInfo, setEditingInfo] = useState(null)
  const [infoForm, setInfoForm] = useState({})
  const [savingInfo, setSavingInfo] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [photoUploadingId, setPhotoUploadingId] = useState(null)

  useEffect(() => { loadStaff() }, [])

  async function loadStaff() {
    setLoading(true)
    const { data } = await supabase.from('staff').select('*').order('nom')
    setStaff(data || [])
    setLoading(false)
  }

  async function handleAdd() {
    if (!form.nom || !form.prenom || !form.email) return
    setSaving(true)
    setResult(null)

    // 1. Crée la fiche staff
    const { data: newStaff, error } = await supabase.from('staff').insert({
      nom: form.nom.toUpperCase(),
      prenom: form.prenom,
      email: form.email,
      role: form.role,
      telephone: form.telephone || null,
      diplome: form.diplome || null,
    }).select().single()

    if (error) {
      setResult({ ok: false, message: 'Erreur création fiche : ' + error.message })
      setSaving(false)
      return
    }

    // 2. Envoie l'invitation email
    setInviting(true)
    try {
      const res = await fetch('/api/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          email: form.email,
          staffId: newStaff.id,
          nom: form.nom,
          prenom: form.prenom,
          role: form.role
        })
      })
      const data = await res.json()
      if (data.success) {
        setResult({ ok: true, message: data.mode === 'reset'
          ? `✅ ${form.prenom} ${form.nom} ajouté — ce membre avait déjà un compte, un email de réinitialisation de mot de passe a été envoyé à ${form.email}`
          : `✅ ${form.prenom} ${form.nom} ajouté et invitation envoyée à ${form.email}` })
      } else {
        setResult({ ok: false, message: `⚠️ Fiche créée mais erreur invitation : ${data.error}` })
      }
    } catch (err) {
      setResult({ ok: false, message: '⚠️ Fiche créée mais erreur réseau pour l\'invitation.' })
    }

    setInviting(false)
    setSaving(false)
    setForm({ nom: '', prenom: '', email: '', role: 'adjoint', telephone: '', diplome: '' })
    setShowAdd(false)
    loadStaff()
  }

  async function renvoyerInvitation(s) {
    try {
      const res = await fetch('/api/invite-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ email: s.email, staffId: s.id, nom: s.nom, prenom: s.prenom, role: s.role })
      })
      const data = await res.json()
      if (data.success) alert(data.mode === 'reset'
        ? `✅ Ce membre avait déjà un compte : un email de réinitialisation de mot de passe a été envoyé à ${s.email}`
        : `✅ Invitation renvoyée à ${s.email}`)
      else alert(`❌ Erreur : ${data.error}`)
    } catch (err) {
      alert('Erreur réseau.')
    }
  }

  function isCoachLike(role) { return role === 'coach' || role === 'admin' }

  async function updateRole(staffId, newRole) {
    const target = staff.find(s => s.id === staffId)
    if (isCoachLike(target?.role) && !isCoachLike(newRole)) {
      const nbCoachs = staff.filter(s => isCoachLike(s.role)).length
      if (nbCoachs <= 1) {
        alert('Impossible : il doit rester au moins un coach ou administrateur.')
        return
      }
    }
    const { error } = await supabase.from('staff').update({ role: newRole }).eq('id', staffId)
    if (error) {
      alert('Erreur lors de la mise à jour du rôle : ' + error.message)
      return
    }
    setEditingRole(null)
    loadStaff()
  }

  function startEditingInfo(s) {
    setInfoForm({
      nom: s.nom || '', prenom: s.prenom || '', telephone: s.telephone || '',
      email: s.email || '', diplome: s.diplome || '', specialite: s.specialite || ''
    })
    setEditingInfo(s.id)
  }

  async function saveInfo(staffId) {
    setSavingInfo(true)
    const { error } = await supabase.from('staff').update({
      nom: infoForm.nom, prenom: infoForm.prenom, telephone: infoForm.telephone,
      email: infoForm.email, diplome: infoForm.diplome, specialite: infoForm.specialite
    }).eq('id', staffId)
    setSavingInfo(false)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      return
    }
    setEditingInfo(null)
    loadStaff()
  }

  async function uploadStaffPhoto(staffId, file) {
    const err = validateFile(file, 'image')
    if (err) { alert(err); return }
    setPhotoUploadingId(staffId)
    const path = `staff/${staffId}_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('joueurs').upload(path, file, { upsert: true })
    if (error) {
      setPhotoUploadingId(null)
      alert('Erreur lors de l\'upload de la photo : ' + error.message)
      return
    }
    const { data: urlData } = supabase.storage.from('joueurs').getPublicUrl(path)
    const { error: updateError } = await supabase.from('staff').update({ photo_url: urlData.publicUrl }).eq('id', staffId)
    setPhotoUploadingId(null)
    if (updateError) {
      alert('Erreur lors de l\'enregistrement de la photo : ' + updateError.message)
      return
    }
    loadStaff()
  }

  async function deleteStaff(staffId) {
    if (!window.confirm('Supprimer ce membre du staff ?')) return
    const target = staff.find(s => s.id === staffId)
    if (isCoachLike(target?.role)) {
      const nbCoachs = staff.filter(s => isCoachLike(s.role)).length
      if (nbCoachs <= 1) {
        alert('Impossible de supprimer le dernier coach/administrateur.')
        return
      }
    }
    const { error } = await supabase.from('staff').delete().eq('id', staffId)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    loadStaff()
  }

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[1]

  return (
    <div style={{ padding: 12 }}>
      {pendingPhoto && (
        <PhotoCropModal file={pendingPhoto.file} onCancel={() => setPendingPhoto(null)}
          onCropped={f => { const id = pendingPhoto.staffId; setPendingPhoto(null); uploadStaffPhoto(id, f) }} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Staff technique</h1>
        {isCoach && (
          <button onClick={() => { setShowAdd(!showAdd); setResult(null) }}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            {showAdd ? '✕ Annuler' : '+ Ajouter'}
          </button>
        )}
      </div>

      {/* Légende des rôles */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Niveaux d'accès</p>
        {ROLES.map(r => (
          <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '0.5px solid #F3F4F6' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: r.color, width: 140 }}>{r.label}</span>
            <span style={{ fontSize: 11, color: '#6B7280' }}>{r.desc}</span>
          </div>
        ))}
      </Card>

      {/* Formulaire ajout */}
      {showAdd && isCoach && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nouveau membre du staff</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Nom *" value={form.nom} onChange={v => setForm(p => ({...p, nom: v}))} placeholder="DUPONT" />
            <Input label="Prénom *" value={form.prenom} onChange={v => setForm(p => ({...p, prenom: v}))} placeholder="Pierre" />
          </div>
          <Input label="Email *" type="email" value={form.email} onChange={v => setForm(p => ({...p, email: v}))} placeholder="pierre@email.com" />
          <Input label="Téléphone" value={form.telephone} onChange={v => setForm(p => ({...p, telephone: v}))} placeholder="06..." />
          <Input label="Diplôme / Qualification" value={form.diplome} onChange={v => setForm(p => ({...p, diplome: v}))} placeholder="UEFA B, BPJEPS..." />

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Rôle et niveau d'accès *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ROLES.map(r => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 10, border: `1.5px solid ${form.role === r.value ? r.color : '#E5E7EB'}`, background: form.role === r.value ? `${r.color}10` : 'transparent', cursor: 'pointer' }}>
                  <input type="radio" name="role" value={r.value} checked={form.role === r.value} onChange={() => setForm(p => ({...p, role: r.value}))} style={{ marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</p>
                    <p style={{ fontSize: 11, color: '#6B7280' }}>{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {result && (
            <div style={{ background: result.ok ? '#EAF3DE' : '#FCEBEB', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: result.ok ? '#3B6D11' : '#A32D2D' }}>
              {result.message}
            </div>
          )}

          <Button variant="primary" style={{ width: '100%' }} onClick={handleAdd} disabled={saving || inviting}>
            {inviting ? 'Envoi invitation...' : saving ? 'Création...' : '✅ Créer et envoyer l\'invitation'}
          </Button>
        </Card>
      )}

      {/* Liste staff */}
      {loading ? <Spinner /> : (
        <>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{staff.length} membre(s) du staff</p>
          {staff.map((s, i) => {
            const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const roleInfo = getRoleInfo(s.role)
            return (
              <Card key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ position: 'relative' }}>
                    {s.photo_url
                      ? <img src={s.photo_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                      : <Avatar initials={`${s.nom?.[0]}${s.prenom?.[0]}`} bg={col.bg} color={col.color} size={44} />
                    }
                    {isCoach && (
                      <>
                        <div onClick={() => document.getElementById(`staff-photo-${s.id}`).click()}
                          style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, background: THEME.primary, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 10 }}>
                          📷
                        </div>
                        <input id={`staff-photo-${s.id}`} type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => e.target.files[0] && setPendingPhoto({ staffId: s.id, file: e.target.files[0] })} />
                      </>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{s.nom} {s.prenom}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: roleInfo.color, background: `${roleInfo.color}15`, padding: '2px 8px', borderRadius: 20 }}>
                      {roleInfo.label}
                    </span>
                    {photoUploadingId === s.id && <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>📷 Upload en cours...</p>}
                  </div>
                  {isCoach && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => editingInfo === s.id ? setEditingInfo(null) : startEditingInfo(s)}
                        style={{ border: 'none', background: '#EAF3DE', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#3B6D11', fontWeight: 600 }}>
                        ✏️ Modifier
                      </button>
                      <button onClick={() => setEditingRole(editingRole === s.id ? null : s.id)}
                        style={{ border: 'none', background: '#E6F1FB', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: THEME.primary, fontWeight: 600 }}>
                        ✏️ Rôle
                      </button>
                      <button onClick={() => deleteStaff(s.id)}
                        style={{ border: 'none', background: '#FCEBEB', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                        🗑️
                      </button>
                    </div>
                  )}
                </div>

                {/* Formulaire de modification des coordonnées */}
                {editingInfo === s.id && isCoach && (
                  <div style={{ marginTop: 10, padding: 10, background: '#F9FAFB', borderRadius: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Input label="Nom" value={infoForm.nom} onChange={v => setInfoForm(p => ({...p, nom: v}))} />
                      <Input label="Prénom" value={infoForm.prenom} onChange={v => setInfoForm(p => ({...p, prenom: v}))} />
                      <Input label="Téléphone" value={infoForm.telephone} onChange={v => setInfoForm(p => ({...p, telephone: v}))} />
                      <Input label="Email" value={infoForm.email} onChange={v => setInfoForm(p => ({...p, email: v}))} />
                      <Input label="Diplôme" value={infoForm.diplome} onChange={v => setInfoForm(p => ({...p, diplome: v}))} />
                      <Input label="Spécialité" value={infoForm.specialite} onChange={v => setInfoForm(p => ({...p, specialite: v}))} />
                    </div>
                    <Button variant="primary" style={{ width: '100%', marginTop: 4 }} onClick={() => saveInfo(s.id)} disabled={savingInfo}>
                      {savingInfo ? 'Enregistrement...' : '💾 Enregistrer'}
                    </Button>
                  </div>
                )}

                {/* Infos contact */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F3F4F6' }}>
                  {s.email && <p style={{ fontSize: 11, color: '#6B7280' }}>📧 {s.email}</p>}
                  {s.telephone && <p style={{ fontSize: 11, color: '#6B7280' }}>📱 {s.telephone}</p>}
                  {s.diplome && <p style={{ fontSize: 11, color: '#6B7280' }}>🎓 {s.diplome}</p>}
                  {s.specialite && <p style={{ fontSize: 11, color: '#6B7280' }}>🧩 {s.specialite}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <p style={{ fontSize: 10, color: s.auth_id ? '#3B6D11' : '#9CA3AF' }}>
                      {s.auth_id ? '✅ Compte actif' : '⏳ Invitation en attente'}
                    </p>
                    {!s.auth_id && isCoach && (
                      <button onClick={() => renvoyerInvitation(s)}
                        style={{ fontSize: 10, color: '#185FA5', background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                        📧 Renvoyer l'invitation
                      </button>
                    )}
                  </div>
                </div>

                {/* Modifier le rôle */}
                {editingRole === s.id && isCoach && (
                  <div style={{ marginTop: 10, padding: 10, background: '#F9FAFB', borderRadius: 10 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Changer le rôle :</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ROLES.map(r => (
                        <button key={r.value} onClick={() => updateRole(s.id, r.value)}
                          style={{ padding: '8px 12px', borderRadius: 8, border: `1.5px solid ${s.role === r.value ? r.color : '#E5E7EB'}`, background: s.role === r.value ? `${r.color}15` : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: r.color }}>{r.label}</span>
                          <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 8 }}>{r.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {staff.length === 0 && (
            <Card>
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                Aucun membre du staff. Clique sur "+ Ajouter".
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
