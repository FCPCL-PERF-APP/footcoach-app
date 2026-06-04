import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Input, Select, Avatar, Badge, Spinner } from '../components/UI'

const ROLE_COLORS = {
  coach:   { bg: '#E6F1FB', color: '#185FA5', avBg: '#185FA5', avColor: '#fff' },
  adjoint: { bg: '#EAF3DE', color: '#3B6D11', avBg: '#EAF3DE', avColor: '#3B6D11' },
  gardien: { bg: '#FAEEDA', color: '#854F0B', avBg: '#FAEEDA', avColor: '#854F0B' },
}
const ROLE_LABELS = { coach: 'Coach principal', adjoint: 'Entraîneur adjoint', gardien: 'Responsable gardiens' }

const ACCESS_TABLE = [
  ['📅 Calendrier',            'Complet', 'Lecture', 'Lecture'],
  ['❤️ RPE & Footbar',         'Complet', 'Lecture', 'Lecture'],
  ['⚽ Stats de match',        'Complet', 'Lecture', 'Lecture'],
  ['📊 Dashboard',             'Complet', 'Lecture', 'Lecture'],
  ['👤 Fiches joueurs',        'Complet', 'Lecture + 💬', 'Lecture + 💬'],
  ['📁 Ressources',            'Complet', 'Lecture', 'Lecture'],
  ['💬 Messagerie',            'Complet', 'Lecture', 'Lecture'],
  ['📢 Convocations & SMS',    'Complet', '—', '—'],
  ['⚙️ Gestion effectif',      'Complet', '—', '—'],
]

export default function StaffPage() {
  const { isCoach, profile } = useAuth()
  const [staff, setStaff] = useState([])
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newForm, setNewForm] = useState({ nom: '', prenom: '', role: 'adjoint', telephone: '', email: '', adresse: '', diplome: '', specialite: '' })
  const [loading, setLoading] = useState(true)
  const [showAccess, setShowAccess] = useState(false)

  useEffect(() => { loadStaff() }, [])

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*').order('role')
    setStaff(data || [])
    setLoading(false)
  }

  async function saveEdit() {
    await supabase.from('staff').update(form).eq('id', selected.id)
    setEditing(false)
    setSelected(form)
    loadStaff()
  }

  async function addStaff() {
    if (!newForm.nom || !newForm.email) return
    await supabase.from('staff').insert(newForm)
    // Inviter via Supabase Auth
    await supabase.auth.admin?.inviteUserByEmail?.(newForm.email)
    setShowAdd(false)
    setNewForm({ nom: '', prenom: '', role: 'adjoint', telephone: '', email: '', adresse: '', diplome: '', specialite: '' })
    loadStaff()
  }

  function openDetail(s) {
    setSelected(s)
    setForm(s)
    setEditing(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title="Staff technique"
        action={isCoach && <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>+ Ajouter</Button>}
      />

      {/* Ajout staff */}
      {showAdd && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Nouveau membre du staff</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Nom" value={newForm.nom} onChange={v => setNewForm(p => ({ ...p, nom: v }))} />
            <Input label="Prénom" value={newForm.prenom} onChange={v => setNewForm(p => ({ ...p, prenom: v }))} />
          </div>
          <Select label="Rôle" value={newForm.role} onChange={v => setNewForm(p => ({ ...p, role: v }))}
            options={[{ value: 'adjoint', label: 'Entraîneur adjoint' }, { value: 'gardien', label: 'Responsable gardiens' }]} />
          <Input label="Email (pour l'invitation)" value={newForm.email} onChange={v => setNewForm(p => ({ ...p, email: v }))} />
          <Input label="Téléphone" value={newForm.telephone} onChange={v => setNewForm(p => ({ ...p, telephone: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Diplôme" value={newForm.diplome} onChange={v => setNewForm(p => ({ ...p, diplome: v }))} />
            <Input label="Spécialité" value={newForm.specialite} onChange={v => setNewForm(p => ({ ...p, specialite: v }))} />
          </div>
          <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 11, color: '#185FA5' }}>
            📧 Un email d'invitation sera envoyé automatiquement pour créer un mot de passe.
          </div>
          <Button variant="primary" style={{ width: '100%' }} onClick={addStaff}>Créer le compte</Button>
        </Card>
      )}

      {/* Fiche détail */}
      {selected ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '0.5px solid #F3F4F6' }}>
            <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
            <Avatar initials={`${selected.nom?.[0] || ''}${selected.prenom?.[0] || ''}`}
              bg={ROLE_COLORS[selected.role]?.avBg} color={ROLE_COLORS[selected.role]?.avColor} size={44} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700 }}>{selected.nom} {selected.prenom}</p>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: ROLE_COLORS[selected.role]?.bg, color: ROLE_COLORS[selected.role]?.color }}>
                {ROLE_LABELS[selected.role]}
              </span>
            </div>
            {isCoach && (
              <Button size="sm" onClick={() => editing ? saveEdit() : setEditing(true)} variant={editing ? 'success' : 'default'}>
                {editing ? '💾 Sauver' : '✏️ Modifier'}
              </Button>
            )}
          </div>

          <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>Coordonnées</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Téléphone" value={form.telephone || ''} onChange={v => setForm(p => ({ ...p, telephone: v }))} disabled={!editing} />
            <Input label="Email" value={form.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))} disabled={!editing} />
          </div>
          <Input label="Adresse" value={form.adresse || ''} onChange={v => setForm(p => ({ ...p, adresse: v }))} disabled={!editing} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Diplôme" value={form.diplome || ''} onChange={v => setForm(p => ({ ...p, diplome: v }))} disabled={!editing} />
            <Input label="Spécialité" value={form.specialite || ''} onChange={v => setForm(p => ({ ...p, specialite: v }))} disabled={!editing} />
          </div>

          {/* Niveau d'accès */}
          {selected.role !== 'coach' && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', margin: '14px 0 8px' }}>Niveau d'accès</p>
              {[
                ['📅 Calendrier', 'Lecture'],
                ['❤️ RPE & Footbar', 'Lecture'],
                ['📊 Dashboard', 'Lecture'],
                ['👤 Fiches joueurs', 'Lecture + commentaires'],
                ['📁 Ressources', 'Lecture'],
                ['💬 Messagerie', 'Lecture'],
                ['📢 Convocations', 'Non disponible'],
              ].map(([feat, level]) => (
                <div key={feat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid #F9FAFB' }}>
                  <span style={{ fontSize: 12 }}>{feat}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8,
                    background: level === 'Non disponible' ? '#F3F4F6' : level.includes('commentaires') ? '#FAEEDA' : '#E6F1FB',
                    color: level === 'Non disponible' ? '#9CA3AF' : level.includes('commentaires') ? '#854F0B' : '#185FA5'
                  }}>{level}</span>
                </div>
              ))}
            </>
          )}
        </Card>
      ) : (
        <>
          {/* Liste staff */}
          {staff.map(s => (
            <div key={s.id} onClick={() => openDetail(s)} style={{
              background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12,
              padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={`${s.nom?.[0] || ''}${s.prenom?.[0] || ''}`}
                  bg={ROLE_COLORS[s.role]?.avBg} color={ROLE_COLORS[s.role]?.avColor} size={42} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{s.nom} {s.prenom}</p>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: ROLE_COLORS[s.role]?.bg, color: ROLE_COLORS[s.role]?.color }}>
                    {ROLE_LABELS[s.role] || s.role}
                  </span>
                </div>
              </div>
              <span style={{ color: '#D1D5DB', fontSize: 18 }}>›</span>
            </div>
          ))}

          {/* Tableau récap */}
          <button onClick={() => setShowAccess(!showAccess)} style={{ width: '100%', padding: 12, background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, fontSize: 12, color: '#185FA5', cursor: 'pointer', marginTop: 4 }}>
            {showAccess ? '▲' : '▼'} Tableau récapitulatif des accès
          </button>
          {showAccess && (
            <Card style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #E5E7EB' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', color: '#9CA3AF' }}>Fonctionnalité</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', color: '#185FA5' }}>Coach</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', color: '#3B6D11' }}>Adjoint</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', color: '#854F0B' }}>Gardien</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCESS_TABLE.map(([feat, coach, adj, gard]) => (
                    <tr key={feat} style={{ borderBottom: '0.5px solid #F3F4F6' }}>
                      <td style={{ padding: '6px 4px' }}>{feat}</td>
                      {[coach, adj, gard].map((v, i) => (
                        <td key={i} style={{ textAlign: 'center', padding: '6px 4px' }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6,
                            background: v === '—' ? '#F3F4F6' : v === 'Complet' ? '#EAF3DE' : v.includes('💬') ? '#FAEEDA' : '#E6F1FB',
                            color: v === '—' ? '#9CA3AF' : v === 'Complet' ? '#3B6D11' : v.includes('💬') ? '#854F0B' : '#185FA5'
                          }}>{v}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
