import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Input, Button, Spinner, Avatar } from '../components/UI'
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
        headers: { 'Content-Type': 'application/json' },
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
        setResult({ ok: true, message: `✅ ${form.prenom} ${form.nom} ajouté et invitation envoyée à ${form.email}` })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: s.email, staffId: s.id, nom: s.nom, prenom: s.prenom, role: s.role })
      })
      const data = await res.json()
      if (data.success) alert(`✅ Invitation renvoyée à ${s.email}`)
      else alert(`❌ Erreur : ${data.error}`)
    } catch (err) {
      alert('Erreur réseau.')
    }
  }

  async function updateRole(staffId, newRole) {
    await supabase.from('staff').update({ role: newRole }).eq('id', staffId)
    setEditingRole(null)
    loadStaff()
  }

  async function deleteStaff(staffId) {
    if (!window.confirm('Supprimer ce membre du staff ?')) return
    await supabase.from('staff').delete().eq('id', staffId)
    loadStaff()
  }

  const getRoleInfo = (role) => ROLES.find(r => r.value === role) || ROLES[1]

  return (
    <div style={{ padding: 12 }}>
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
                  {s.photo_url
                    ? <img src={s.photo_url} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                    : <Avatar initials={`${s.nom?.[0]}${s.prenom?.[0]}`} bg={col.bg} color={col.color} size={44} />
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{s.nom} {s.prenom}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, color: roleInfo.color, background: `${roleInfo.color}15`, padding: '2px 8px', borderRadius: 20 }}>
                      {roleInfo.label}
                    </span>
                  </div>
                  {isCoach && (
                    <div style={{ display: 'flex', gap: 6 }}>
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

                {/* Infos contact */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F3F4F6' }}>
                  {s.email && <p style={{ fontSize: 11, color: '#6B7280' }}>📧 {s.email}</p>}
                  {s.telephone && <p style={{ fontSize: 11, color: '#6B7280' }}>📱 {s.telephone}</p>}
                  {s.diplome && <p style={{ fontSize: 11, color: '#6B7280' }}>🎓 {s.diplome}</p>}
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
