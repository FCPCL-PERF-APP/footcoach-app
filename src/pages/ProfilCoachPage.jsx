import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Input, Button, Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'

export default function ProfilCoachPage() {
  const { profile, signOut } = useAuth()
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwd, setPwd] = useState({ current: '', new: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  useEffect(() => { loadProfil() }, [])

  async function loadProfil() {
    const { data } = await supabase.from('staff').select('*').eq('auth_id', profile?.auth_id || profile?.id).maybeSingle()
    if (data) { setForm(data) }
    setLoading(false)
  }

  async function saveProfil() {
    setSaving(true)
    await supabase.from('staff').update({
      nom: form.nom,
      prenom: form.prenom,
      telephone: form.telephone,
      email: form.email,
      adresse: form.adresse,
      diplome: form.diplome,
      specialite: form.specialite,
    }).eq('id', form.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function changePassword() {
    if (pwd.new !== pwd.confirm) { setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' }); return }
    if (pwd.new.length < 6) { setPwdMsg({ ok: false, text: 'Le mot de passe doit faire au moins 6 caractères.' }); return }
    const { error } = await supabase.auth.updateUser({ password: pwd.new })
    if (error) setPwdMsg({ ok: false, text: `Erreur : ${error.message}` })
    else {
      setPwdMsg({ ok: true, text: '✅ Mot de passe modifié avec succès !' })
      setPwd({ current: '', new: '', confirm: '' })
      setTimeout(() => { setChangingPwd(false); setPwdMsg(null) }, 3000)
    }
  }

  async function uploadPhoto(file) {
    setPhotoUploading(true)
    const path = `staff/${form.id}_${Date.now()}.jpg`
    const { error } = await supabase.storage.from('joueurs').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('joueurs').getPublicUrl(path)
      await supabase.from('staff').update({ photo_url: urlData.publicUrl }).eq('id', form.id)
      setForm(p => ({ ...p, photo_url: urlData.publicUrl }))
    }
    setPhotoUploading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const initials = `${form.nom?.[0] || ''}${form.prenom?.[0] || ''}`

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon profil" />

      {/* Hero */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '20px 16px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 10 }}>
          {form.photo_url
            ? <img src={form.photo_url} alt="Photo" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,.4)' }} />
            : <Avatar initials={initials} size={72} bg="rgba(255,255,255,.2)" color="#fff" />
          }
          <div onClick={() => document.getElementById('coach-photo').click()}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>
            📷
          </div>
          <input id="coach-photo" type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => e.target.files[0] && uploadPhoto(e.target.files[0])} />
        </div>
        {photoUploading && <p style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Upload en cours...</p>}
        <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{form.nom} {form.prenom}</p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
          {form.role === 'coach' ? 'Coach principal' : form.role} · FC PCL
        </p>
      </div>

      {saved && <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>✅ Profil mis à jour !</div>}

      {/* Infos */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes informations</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label="Nom" value={form.nom || ''} onChange={v => setForm(p => ({...p, nom: v}))} />
          <Input label="Prénom" value={form.prenom || ''} onChange={v => setForm(p => ({...p, prenom: v}))} />
          <Input label="Téléphone" value={form.telephone || ''} onChange={v => setForm(p => ({...p, telephone: v}))} />
          <Input label="Email" value={form.email || ''} onChange={v => setForm(p => ({...p, email: v}))} />
          <Input label="Diplôme" value={form.diplome || ''} onChange={v => setForm(p => ({...p, diplome: v}))} />
          <Input label="Spécialité" value={form.specialite || ''} onChange={v => setForm(p => ({...p, specialite: v}))} />
        </div>
        <Button variant="primary" style={{ width: '100%', marginTop: 4 }} onClick={saveProfil} disabled={saving}>
          {saving ? 'Enregistrement...' : '💾 Enregistrer'}
        </Button>
      </Card>

      {/* Changement mot de passe */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: changingPwd ? 12 : 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>🔐 Mot de passe</p>
          <button onClick={() => { setChangingPwd(!changingPwd); setPwdMsg(null) }}
            style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>
            {changingPwd ? '✕ Annuler' : 'Modifier'}
          </button>
        </div>
        {changingPwd && (
          <>
            <Input label="Nouveau mot de passe" type="password" value={pwd.new} onChange={v => setPwd(p => ({...p, new: v}))} />
            <Input label="Confirmer le mot de passe" type="password" value={pwd.confirm} onChange={v => setPwd(p => ({...p, confirm: v}))} />
            {pwdMsg && <p style={{ fontSize: 12, color: pwdMsg.ok ? '#3B6D11' : '#A32D2D', marginBottom: 8 }}>{pwdMsg.text}</p>}
            <Button variant="primary" style={{ width: '100%' }} onClick={changePassword}>
              Changer le mot de passe
            </Button>
          </>
        )}
      </Card>

      {/* Déconnexion */}
      <button onClick={signOut} style={{
        width: '100%', padding: 14, borderRadius: 12,
        border: '0.5px solid #FCEBEB', background: '#FDF1F1',
        color: '#A32D2D', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4
      }}>
        🚪 Se déconnecter
      </button>
    </div>
  )
}
