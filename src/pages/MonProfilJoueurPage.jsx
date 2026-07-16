import { useState } from 'react'
import { supabase } from '../lib/supabase'
import PushToggle from '../components/PushToggle'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button } from '../components/UI'
import { THEME } from '../theme'
import { Lock, X, Save, LogOut } from 'lucide-react'

export default function MonProfilJoueurPage() {
  const { profile, signOut } = useAuth()
  const [pwd, setPwd] = useState({ new: '', confirm: '' })
  const [pwdMsg, setPwdMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  async function changePassword() {
    if (!pwd.new || !pwd.confirm) { setPwdMsg({ ok: false, text: 'Remplis les deux champs.' }); return }
    if (pwd.new.length < 6) { setPwdMsg({ ok: false, text: 'Le mot de passe doit faire au moins 6 caractères.' }); return }
    if (pwd.new !== pwd.confirm) { setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas.' }); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pwd.new })
    setSaving(false)
    if (error) {
      setPwdMsg({ ok: false, text: `Erreur : ${error.message}` })
    } else {
      setPwdMsg({ ok: true, text: 'Mot de passe modifié avec succès !' })
      setPwd({ new: '', confirm: '' })
      setTimeout(() => { setShowForm(false); setPwdMsg(null) }, 3000)
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon profil" />

      {/* Hero */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '20px 16px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(255,255,255,.2)', border: '2px solid rgba(255,255,255,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff', margin: '0 auto 10px'
        }}>
          {profile?.nom?.[0]}{profile?.prenom?.[0]}
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{profile?.nom} {profile?.prenom}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{profile?.poste} · FC PCL</p>
      </div>

      {/* Changer mot de passe */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showForm ? 14 : 0 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={13} /> Mot de passe</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Modifie ton mot de passe de connexion</p>
          </div>
          <button onClick={() => { setShowForm(!showForm); setPwdMsg(null); setPwd({ new: '', confirm: '' }) }}
            style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {showForm ? <><X size={11} /> Annuler</> : 'Modifier'}
          </button>
        </div>

        {showForm && (
          <>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Nouveau mot de passe</label>
              <input type="password" value={pwd.new} onChange={e => setPwd(p => ({...p, new: e.target.value}))}
                placeholder="Au moins 6 caractères"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Confirmer le mot de passe</label>
              <input type="password" value={pwd.confirm} onChange={e => setPwd(p => ({...p, confirm: e.target.value}))}
                placeholder="Répète le mot de passe"
                style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {pwdMsg && (
              <p style={{ fontSize: 12, color: pwdMsg.ok ? THEME.success : THEME.danger, marginBottom: 10 }}>
                {pwdMsg.text}
              </p>
            )}
            <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={changePassword} disabled={saving}>
              {saving ? 'Enregistrement...' : <><Save size={13} /> Enregistrer le mot de passe</>}
            </Button>
          </>
        )}
      </Card>

      {/* Infos compte */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations du compte</p>
        {[
          ['Nom', `${profile?.nom} ${profile?.prenom}`],
          ['Poste', profile?.poste || '—'],
          ['Numéro', profile?.numero ? `N°${profile.numero}` : '—'],
          ['Groupe', profile?.groupe ? `Pôle ${profile.groupe}` : '—'],
        ].map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{value}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
          Pour modifier ces informations, va dans <strong>Ma fiche</strong>.
        </p>
      </Card>

      {/* Notifications */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Notifications</p>
        <PushToggle />
      </Card>

      {/* Déconnexion */}
      <button onClick={signOut} style={{
        width: '100%', padding: 14, borderRadius: 12,
        border: '0.5px solid #FCEBEB', background: '#FDF1F1',
        color: THEME.danger, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
      }}>
        <LogOut size={14} /> Se déconnecter
      </button>
    </div>
  )
}
