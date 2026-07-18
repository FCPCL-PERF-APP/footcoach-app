import { useState, useEffect } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Input, Select, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Plus, X, Target, Swords, Dumbbell, Brain, BarChart3,
  Calendar, CheckCircle2, XCircle, Hourglass
} from 'lucide-react'

const CATEGORIES = [
  { value: 'technique', icon: Swords, label: 'Technique' },
  { value: 'physique', icon: Dumbbell, label: 'Physique' },
  { value: 'tactique', icon: Brain, label: 'Tactique' },
  { value: 'mental', icon: Target, label: 'Mental' },
  { value: 'statistique', icon: BarChart3, label: 'Statistique' },
]

const STATUTS = [
  { value: 'en_cours', icon: Hourglass, label: 'En cours', bg: 'var(--primary-bg)', color: 'var(--primary)' },
  { value: 'atteint', icon: CheckCircle2, label: 'Atteint', bg: 'var(--success-bg)', color: 'var(--success)' },
  { value: 'abandonne', icon: XCircle, label: 'Abandonné', bg: 'var(--bg-secondary)', color: 'var(--text-muted)' },
]

export default function ObjectifsPage() {
  const { id: joueurId } = useParams()
  const navigate = useNavigate()
  const { isCoach, isJoueur } = useAuth()
  const [joueur, setJoueur] = useState(null)
  const [objectifs, setObjectifs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    categorie: 'physique', titre: '', description: '',
    valeur_cible: '', valeur_actuelle: '', unite: '',
    date_echeance: '', statut: 'en_cours'
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [joueurId])

  async function loadData() {
    setLoading(true)
    const [{ data: j }, { data: obj }] = await Promise.all([
      supabase.from('joueurs').select('nom,prenom,poste').eq('id', joueurId).single(),
      supabase.from('objectifs').select('*').eq('joueur_id', joueurId).order('created_at', { ascending: false })
    ])
    setJoueur(j)
    setObjectifs(obj || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.titre) return
    setSaving(true)
    await supabase.from('objectifs').insert({
      joueur_id: joueurId,
      ...form,
      valeur_cible: form.valeur_cible ? parseFloat(form.valeur_cible) : null,
      valeur_actuelle: form.valeur_actuelle ? parseFloat(form.valeur_actuelle) : null,
      date_echeance: form.date_echeance || null,
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ categorie: 'physique', titre: '', description: '', valeur_cible: '', valeur_actuelle: '', unite: '', date_echeance: '', statut: 'en_cours' })
    loadData()
  }

  async function updateStatut(id, statut) {
    await supabase.from('objectifs').update({ statut }).eq('id', id)
    loadData()
  }

  async function updateProgression(id, valeur_actuelle) {
    await supabase.from('objectifs').update({ valeur_actuelle: parseFloat(valeur_actuelle) }).eq('id', id)
    loadData()
  }

  const enCours = objectifs.filter(o => o.statut === 'en_cours')
  const termines = objectifs.filter(o => o.statut !== 'en_cours')

  function getCatStyle(cat) {
    const styles = {
      technique: { bg: 'var(--primary-bg)', color: 'var(--primary)' },
      physique: { bg: '#EAF3DE', color: '#3B6D11' },
      tactique: { bg: '#FAEEDA', color: 'var(--warning)' },
      mental: { bg: '#FCEBEB', color: '#A32D2D' },
      statistique: { bg: '#F0F4FF', color: '#4338CA' },
    }
    return styles[cat] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
  }

  // Vue coach des objectifs — un joueur doit passer par "Mes objectifs", pas voir/gérer
  // ceux des autres joueurs.
  if (isJoueur) return <Navigate to="/mes-objectifs" replace />

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate(`/joueurs/${joueurId}`)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Objectifs individuels</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{joueur?.nom} {joueur?.prenom}</p>
        </div>
        {isCoach && (
          <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {showAdd ? <X size={12} /> : <><Plus size={12} /> Objectif</>}
          </button>
        )}
      </div>

      {/* Formulaire ajout */}
      {showAdd && isCoach && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Nouvel objectif</p>
          <Select label="Catégorie" value={form.categorie} onChange={v => setForm(p => ({...p, categorie: v}))}
            options={CATEGORIES} />
          <Input label="Titre de l'objectif *" value={form.titre} onChange={v => setForm(p => ({...p, titre: v}))}
            placeholder="Ex : Atteindre 15 km/h en sprint max" />
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              placeholder="Détails, contexte, conseils..." rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 10 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Input label="Valeur actuelle" type="number" step="0.1" value={form.valeur_actuelle} onChange={v => setForm(p => ({...p, valeur_actuelle: v}))} placeholder="12.5" />
            <Input label="Valeur cible" type="number" step="0.1" value={form.valeur_cible} onChange={v => setForm(p => ({...p, valeur_cible: v}))} placeholder="15" />
            <Input label="Unité" value={form.unite} onChange={v => setForm(p => ({...p, unite: v}))} placeholder="km/h" />
          </div>
          <Input label="Échéance" type="date" value={form.date_echeance} onChange={v => setForm(p => ({...p, date_echeance: v}))} />
          <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : <><Target size={13} /> Créer l'objectif</>}
          </Button>
        </Card>
      )}

      {/* Résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          ['En cours', enCours.length, 'var(--primary)', 'var(--primary-bg)'],
          ['Atteints', objectifs.filter(o => o.statut === 'atteint').length, '#3B6D11', '#EAF3DE'],
          ['Total', objectifs.length, 'var(--text-secondary)', 'var(--bg-secondary)'],
        ].map(([lbl, val, color, bg]) => (
          <div key={lbl} style={{ background: bg, borderRadius: 12, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 10, color, marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Objectifs en cours */}
      {enCours.length === 0 && (
        <Card>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
            Aucun objectif en cours.{isCoach && ' Clique sur "+ Objectif" pour en ajouter un.'}
          </p>
        </Card>
      )}

      {enCours.map(obj => {
        const cat = CATEGORIES.find(c => c.value === obj.categorie)
        const catStyle = getCatStyle(obj.categorie)
        const progress = obj.valeur_cible && obj.valeur_actuelle
          ? Math.min(100, Math.round((obj.valeur_actuelle / obj.valeur_cible) * 100))
          : null

        return (
          <Card key={obj.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: catStyle.bg, color: catStyle.color, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {cat && <cat.icon size={10} />} {cat?.label || obj.categorie}
                  </span>
                  {obj.date_echeance && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Calendar size={10} /> {format(parseISO(obj.date_echeance), 'd MMM', { locale: fr })}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{obj.titre}</p>
                {obj.description && <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{obj.description}</p>}
              </div>
            </div>

            {/* Barre de progression */}
            {obj.valeur_cible && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {obj.valeur_actuelle ?? '—'} / {obj.valeur_cible} {obj.unite}
                  </span>
                  <span style={{ fontWeight: 600, color: progress >= 100 ? 'var(--success)' : 'var(--primary)' }}>
                    {progress !== null ? `${progress}%` : '—'}
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: progress >= 100 ? 'var(--success)' : 'var(--primary)', width: `${progress || 0}%`, transition: 'width .3s' }} />
                </div>
                {/* Mise à jour progression */}
                {isCoach && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <input type="number" step="0.1" placeholder={`Valeur actuelle (${obj.unite || ''})`}
                      defaultValue={obj.valeur_actuelle || ''}
                      onBlur={e => { if (e.target.value) updateProgression(obj.id, e.target.value) }}
                      style={{ flex: 1, padding: '5px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none' }} />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {isCoach && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--bg-secondary)' }}>
                <button onClick={() => updateStatut(obj.id, 'atteint')} style={{ flex: 1, padding: '5px', borderRadius: 8, border: 'none', background: 'var(--success-bg)', color: 'var(--success)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <CheckCircle2 size={11} /> Atteint
                </button>
                <button onClick={() => updateStatut(obj.id, 'abandonne')} style={{ flex: 1, padding: '5px', borderRadius: 8, border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <XCircle size={11} /> Abandonner
                </button>
              </div>
            )}
          </Card>
        )
      })}

      {/* Terminés */}
      {termines.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '14px 0 8px' }}>
            Terminés ({termines.length})
          </p>
          {termines.map(obj => {
            const catStyle = getCatStyle(obj.categorie)
            const st = STATUTS.find(s => s.value === obj.statut)
            return (
              <div key={obj.id} style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 8, opacity: 0.75 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{obj.titre}</p>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: st?.bg || 'var(--bg-secondary)', color: st?.color || 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {st && <st.icon size={10} />} {st?.label || obj.statut}
                  </span>
                </div>
                {obj.valeur_cible && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Cible : {obj.valeur_cible} {obj.unite} · Atteint : {obj.valeur_actuelle ?? '—'} {obj.unite}</p>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
