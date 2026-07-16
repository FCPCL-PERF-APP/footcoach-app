import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Input, Select, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, Plus, X, Save, Bandage, FileText, Pill, CheckCircle2 } from 'lucide-react'

const TYPES_BLESSURE = ['Musculaire','Articulaire','Tendineux','Osseux/Fracture','Contusion','Autre']
const ZONES = ['Cheville','Genou','Cuisse','Ischio-jambier','Mollet','Adducteur','Dos','Épaule','Tête','Autre']
const GRAVITES = [
  { value: 'legere', label: 'Légère (< 1 semaine)' },
  { value: 'moderee', label: 'Modérée (1-3 semaines)' },
  { value: 'grave', label: 'Grave (> 3 semaines)' },
]

export default function BlessuresPage() {
  const { id: joueurId } = useParams()
  const navigate = useNavigate()
  const { isCoach, isJoueur, canEdit } = useAuth()
  const [joueur, setJoueur] = useState(null)
  const [blessures, setBlessures] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    type_blessure: 'Musculaire', zone: 'Genou', gravite: 'moderee',
    date_debut: '', date_retour_prevue: '', date_retour_effective: '',
    description: '', traitement: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [joueurId])

  async function loadData() {
    setLoading(true)
    const [{ data: j }, { data: b }] = await Promise.all([
      supabase.from('joueurs').select('nom,prenom,poste').eq('id', joueurId).single(),
      supabase.from('blessures').select('*').eq('joueur_id', joueurId).order('date_debut', { ascending: false })
    ])
    setJoueur(j)
    setBlessures(b || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.date_debut || !form.zone) return
    setSaving(true)
    const { error } = await supabase.from('blessures').insert({
      joueur_id: joueurId,
      ...form,
      date_retour_prevue: form.date_retour_prevue || null,
      date_retour_effective: form.date_retour_effective || null,
    })
    setSaving(false)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      return
    }
    setShowAdd(false)
    setForm({ type_blessure: 'Musculaire', zone: 'Genou', gravite: 'moderee', date_debut: '', date_retour_prevue: '', date_retour_effective: '', description: '', traitement: '' })
    loadData()
  }

  async function marquerGueri(id, date) {
    const { error } = await supabase.from('blessures')
      .update({ date_retour_effective: date || new Date().toISOString().split('T')[0], statut: 'gueri' }).eq('id', id)
    if (error) {
      alert('Erreur lors de la mise à jour : ' + error.message)
      return
    }
    loadData()
  }

  const blessuresActives = blessures.filter(b => !b.date_retour_effective)
  const blessuresPassees = blessures.filter(b => b.date_retour_effective)

  function graviteStyle(g) {
    if (g === 'grave') return { bg: THEME.dangerBg, color: THEME.danger, label: 'Grave' }
    if (g === 'moderee') return { bg: THEME.warningBg, color: '#854F0B', label: 'Modérée' }
    return { bg: '#FDFAEE', color: THEME.warning, label: 'Légère' }
  }

  // Vue coach du détail des blessures — un joueur doit rester sur sa propre fiche
  // ("Ma fiche" → onglet Blessures), pas voir/gérer celle des autres.
  if (isJoueur) return <Navigate to="/ma-fiche" replace />

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate(`/joueurs/${joueurId}`)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={THEME.primary} /></button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Suivi des blessures</p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{joueur?.nom} {joueur?.prenom} · {joueur?.poste}</p>
        </div>
        {isCoach && (
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: THEME.primary, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {showAdd ? <X size={12} /> : <><Plus size={12} /> Blessure</>}
          </button>
        )}
      </div>

      {/* Formulaire ajout */}
      {showAdd && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Nouvelle blessure</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Select label="Type" value={form.type_blessure} onChange={v => setForm(p => ({...p, type_blessure: v}))}
              options={TYPES_BLESSURE} />
            <Select label="Zone" value={form.zone} onChange={v => setForm(p => ({...p, zone: v}))}
              options={ZONES} />
          </div>
          <Select label="Gravité" value={form.gravite} onChange={v => setForm(p => ({...p, gravite: v}))}
            options={GRAVITES} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Date de survenue" type="date" value={form.date_debut} onChange={v => setForm(p => ({...p, date_debut: v}))} />
            <Input label="Retour prévu" type="date" value={form.date_retour_prevue} onChange={v => setForm(p => ({...p, date_retour_prevue: v}))} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              placeholder="Circonstances, localisation précise..." rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Traitement / soins</label>
            <textarea value={form.traitement} onChange={e => setForm(p => ({...p, traitement: e.target.value}))}
              placeholder="Kinésithérapie, repos, glace..." rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <Button variant="primary" style={{ width: '100%', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : <><Save size={13} /> Enregistrer</>}
          </Button>
        </Card>
      )}

      {/* Blessures actives */}
      {blessuresActives.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: THEME.danger, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Bandage size={11} /> En cours ({blessuresActives.length})
          </p>
          {blessuresActives.map(b => {
            const g = graviteStyle(b.gravite)
            const jours = differenceInDays(new Date(), parseISO(b.date_debut))
            return (
              <Card key={b.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{b.zone}</span>
                      <span style={{ fontSize: 11 }}>·</span>
                      <span style={{ fontSize: 12 }}>{b.type_blessure}</span>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: g.bg, color: g.color }}>{g.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#A32D2D' }}>{jours}j</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>absent</div>
                  </div>
                </div>
                {b.description && <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}><FileText size={11} style={{ flexShrink: 0, marginTop: 2 }} /> {b.description}</p>}
                {b.traitement && <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, display: 'flex', alignItems: 'flex-start', gap: 5 }}><Pill size={11} style={{ flexShrink: 0, marginTop: 2 }} /> {b.traitement}</p>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F3F4F6' }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                    Depuis le {format(parseISO(b.date_debut), 'd MMM yyyy', { locale: fr })}
                    {b.date_retour_prevue && <span> · Retour prévu le {format(parseISO(b.date_retour_prevue), 'd MMM', { locale: fr })}</span>}
                  </div>
                  {isCoach && (
                    <button onClick={() => marquerGueri(b.id, new Date().toISOString().split('T')[0])}
                      style={{ padding: '4px 10px', borderRadius: 8, border: 'none', background: THEME.successBg, color: THEME.success, fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={11} /> Guéri
                    </button>
                  )}
                </div>
              </Card>
            )
          })}
        </>
      )}

      {blessuresActives.length === 0 && (
        <Card>
          <p style={{ fontSize: 13, color: THEME.success, textAlign: 'center', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <CheckCircle2 size={14} /> Aucune blessure en cours
          </p>
        </Card>
      )}

      {/* Historique */}
      {blessuresPassees.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', margin: '14px 0 8px' }}>
            Historique ({blessuresPassees.length})
          </p>
          {blessuresPassees.map(b => {
            const g = graviteStyle(b.gravite)
            const duree = b.date_retour_effective && b.date_debut
              ? differenceInDays(parseISO(b.date_retour_effective), parseISO(b.date_debut))
              : null
            return (
              <div key={b.id} style={{ background: '#F9FAFB', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 12, marginBottom: 8, opacity: 0.8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{b.zone} · {b.type_blessure}</span>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                      {format(parseISO(b.date_debut), 'd MMM yyyy', { locale: fr })} → {b.date_retour_effective ? format(parseISO(b.date_retour_effective), 'd MMM yyyy', { locale: fr }) : '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: g.bg, color: g.color }}>{g.label}</span>
                    {duree !== null && <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{duree}j</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
