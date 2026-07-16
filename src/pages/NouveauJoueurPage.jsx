import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { Card, PageHeader, Input, Select, Button } from '../components/UI'
import { THEME } from '../theme'
import { ArrowLeft, CheckCircle2, Mail, AlertTriangle, Lightbulb, Plus, Check } from 'lucide-react'

export default function NouveauJoueurPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    nom: '', prenom: '', poste: '', numero: '', groupe: 'A',
    date_naissance: '', licence: '', pied: 'Droit',
    telephone: '', email: '',
    adresse: '', contact_urgence_nom: '', contact_urgence_tel: '',
    taille: '', poids: '',
  })
  const [saving, setSaving] = useState(false)
  const [inviteEmail, setInviteEmail] = useState(true)
  const [inviteError, setInviteError] = useState(null)
  const [inviteMode, setInviteMode] = useState(null)
  const [step, setStep] = useState(1) // 1 = infos, 2 = confirmation

  const f = (key) => form[key]
  const s = (key) => (v) => setForm(p => ({ ...p, [key]: v }))

  async function handleSave() {
    if (!form.nom || !form.prenom) {
      alert('Nom et prénom sont obligatoires.')
      return
    }
    setSaving(true)

    // 1. Crée le joueur dans la table joueurs
    const { data: joueur, error } = await supabase.from('joueurs').insert({
      nom: form.nom.toUpperCase(),
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
    }).select().single()

    if (error) {
      console.error('Erreur création joueur:', error)
      alert('Erreur lors de la création du joueur.')
      setSaving(false)
      return
    }

    // 2. Envoie l'invitation si email fourni
    setInviteError(null)
    setInviteMode(null)
    if (inviteEmail && form.email) {
      try {
        const res = await fetch('/api/invite-joueur', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            email: form.email,
            joueurId: joueur.id,
            nom: form.nom,
            prenom: form.prenom
          })
        })
        const data = await res.json()
        if (!data.success) setInviteError(data.error || "Impossible d'envoyer l'invitation")
        else setInviteMode(data.mode)
      } catch (err) {
        console.error('Erreur invitation:', err)
        setInviteError('Erreur réseau')
      }
    }

    setSaving(false)
    setStep(2)
  }

  if (step === 2) {
    return (
      <div style={{ padding: 12 }}>
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircle2 size={44} color={THEME.success} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: THEME.success }}>
              {form.prenom} {form.nom.toUpperCase()} ajouté !
            </p>
            {form.email && inviteEmail && !inviteError && inviteMode === 'reset' && (
              <div style={{ background: THEME.successBg, borderRadius: 10, padding: 12, margin: '12px 0', fontSize: 12, color: THEME.success, display: 'flex', gap: 6 }}>
                <Mail size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Ce joueur avait déjà un compte : un email de réinitialisation de mot de passe a été envoyé à<br />
                <strong>{form.email}</strong></span>
              </div>
            )}
            {form.email && inviteEmail && !inviteError && inviteMode === 'invite' && (
              <div style={{ background: THEME.successBg, borderRadius: 10, padding: 12, margin: '12px 0', fontSize: 12, color: THEME.success, display: 'flex', gap: 6 }}>
                <Mail size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Un email d'invitation a été envoyé à<br />
                <strong>{form.email}</strong><br />
                Le joueur devra créer son mot de passe.</span>
              </div>
            )}
            {form.email && inviteEmail && inviteError && (
              <div style={{ background: THEME.dangerBg, borderRadius: 10, padding: 12, margin: '12px 0', fontSize: 12, color: THEME.danger, display: 'flex', gap: 6 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Le joueur a été créé, mais l'envoi de l'invitation a échoué : {inviteError}.<br />
                Tu peux la renvoyer depuis la fiche du joueur.</span>
              </div>
            )}
            {form.email && !inviteEmail && (
              <div style={{ background: THEME.primaryBg, borderRadius: 10, padding: 12, margin: '12px 0', fontSize: 12, color: THEME.primary, display: 'flex', gap: 6 }}>
                <Lightbulb size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Pour créer le compte du joueur manuellement :<br />
                Supabase → Authentication → Users → Add user</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => { setStep(1); setForm({ nom:'',prenom:'',poste:'',numero:'',groupe:'A',date_naissance:'',licence:'',pied:'Droit',telephone:'',email:'',adresse:'',contact_urgence_nom:'',contact_urgence_tel:'',taille:'',poids:'' }) }}>
                <Plus size={13} /> Ajouter un autre joueur
              </Button>
              <Button style={{ flex: 1 }} onClick={() => navigate('/joueurs')}>
                Voir l'effectif
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/joueurs')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={THEME.primary} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Nouveau joueur</h1>
      </div>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations obligatoires</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label="Nom *" value={f('nom')} onChange={s('nom')} placeholder="MARTIN" />
          <Input label="Prénom *" value={f('prenom')} onChange={s('prenom')} placeholder="Antoine" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label="Numéro" type="number" value={f('numero')} onChange={s('numero')} placeholder="10" />
          <Select label="Pôle / Groupe" value={f('groupe')} onChange={s('groupe')}
            options={['A','B','C','D','E']} />
        </div>
        <Input label="Poste" value={f('poste')} onChange={s('poste')} placeholder="Milieu défensif" />
      </Card>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations personnelles</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label="Date de naissance" type="date" value={f('date_naissance')} onChange={s('date_naissance')} />
          <Input label="N° Licence" value={f('licence')} onChange={s('licence')} placeholder="2234891" />
          <Select label="Pied fort" value={f('pied')} onChange={s('pied')}
            options={['Droit','Gauche','Les deux']} />
          <Input label="Taille (cm)" type="number" value={f('taille')} onChange={s('taille')} placeholder="178" />
        </div>
      </Card>

      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Coordonnées</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label="Téléphone" value={f('telephone')} onChange={s('telephone')} placeholder="06 12 34 56 78" />
          <Input label="Email" value={f('email')} onChange={s('email')} placeholder="joueur@email.com" />
        </div>
        <Input label="Adresse" value={f('adresse')} onChange={s('adresse')} placeholder="12 rue..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input label="Contact urgence — Nom" value={f('contact_urgence_nom')} onChange={s('contact_urgence_nom')} />
          <Input label="Contact urgence — Tél." value={f('contact_urgence_tel')} onChange={s('contact_urgence_tel')} />
        </div>
      </Card>

      {/* Invitation */}
      {form.email && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Accès à l'application</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={inviteEmail} onChange={e => setInviteEmail(e.target.checked)}
              style={{ width: 18, height: 18 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 500 }}>Envoyer une invitation par email</p>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                Le joueur recevra un email pour créer son mot de passe et accéder à l'app.
              </p>
            </div>
          </label>
        </Card>
      )}

      <Button variant="primary" style={{ width: '100%', padding: 14, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={handleSave} disabled={saving}>
        {saving ? 'Création en cours...' : <><Check size={14} /> Créer le joueur</>}
      </Button>
    </div>
  )
}
