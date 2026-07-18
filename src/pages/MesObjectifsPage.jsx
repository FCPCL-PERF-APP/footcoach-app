import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Target, ClipboardList, CheckCircle2, XCircle, MessageSquare,
  Dumbbell, Brain, Swords, Trophy, BarChart3, Save
} from 'lucide-react'

const NIVEAUX = [
  { key: 'athletique', icon: Dumbbell, text: 'athlétique' },
  { key: 'tactique',   icon: Brain, text: 'tactique' },
  { key: 'technique',  icon: Swords, text: 'technique' },
  { key: 'mental',     icon: Target, text: 'mental' },
]

export default function MesObjectifsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('objectifs')
  const [stats, setStats] = useState(null)
  const [data, setData] = useState({
    // Points forts (4 niveaux)
    points_forts: { athletique: '', tactique: '', technique: '', mental: '' },
    // Axes amélioration (4 niveaux)
    axes_amelioration: { athletique: '', tactique: '', technique: '', mental: '' },
    // Objectifs perso (3 items)
    obj_perso_1: '', obj_perso_2: '', obj_perso_3: '',
    // Objectifs collectifs (3 items)
    obj_collectif_1: '', obj_collectif_2: '', obj_collectif_3: '',
    // Bilan
    bilan_obj_perso_atteints: null,
    bilan_obj_perso_comment: '',
    bilan_obj_collectifs_atteints: null,
    bilan_axes_saison_prochaine: '',
    bilan_projection: '',
    bilan_commentaire: '',
  })

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)

    // Charge les données existantes
    const { data: existing } = await supabase
      .from('objectifs_joueur')
      .select('*')
      .eq('joueur_id', profile.id)
      .maybeSingle()

    if (existing) {
      setData(d => ({ ...d, ...existing }))
    }

    // Charge les stats match
    const { data: statsData } = await supabase
      .from('stats_match')
      .select('*')
      .eq('joueur_id', profile.id)

    if (statsData?.length) {
      const nbMatchs = statsData.length
      const titulaire = statsData.filter(s => s.titulaire).length
      const remplacant = statsData.filter(s => !s.titulaire).length
      const totalButs = statsData.reduce((s,r) => s+(r.buts||0), 0)
      const totalPD = statsData.reduce((s,r) => s+(r.passes_decisives||0), 0)
      const cartonsJ = statsData.filter(s => s.carton_jaune).length
      const cartonsR = statsData.filter(s => s.carton_rouge).length
      const tempsJeu = statsData.map(s => s.temps_jeu).filter(v => v > 0)
      const tempsMoy = tempsJeu.length ? Math.round(tempsJeu.reduce((a,b) => a+b,0)/tempsJeu.length) : 0
      const notes = statsData.map(s => s.note).filter(v => v > 0)
      const noteMoy = notes.length ? (notes.reduce((a,b) => a+b,0)/notes.length).toFixed(1) : '—'
      setStats({ nbMatchs, titulaire, remplacant, totalButs, totalPD, cartonsJ, cartonsR, tempsMoy, noteMoy })
    }

    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const payload = { ...data, joueur_id: profile.id }

    const { data: existing } = await supabase
      .from('objectifs_joueur')
      .select('id')
      .eq('joueur_id', profile.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('objectifs_joueur').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('objectifs_joueur').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function setField(key, value) {
    setData(p => ({ ...p, [key]: value }))
  }

  function setNested(parent, key, value) {
    setData(p => ({ ...p, [parent]: { ...(p[parent] || {}), [key]: value } }))
  }

  const tabs = [
    { key: 'objectifs', icon: Target, label: 'Mes objectifs' },
    { key: 'bilan',     icon: ClipboardList, label: 'Bilan saison' },
  ]

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/ma-fiche')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Mes objectifs</h1>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === t.key ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === t.key ? 'var(--primary)' : '#6B7280',
            fontWeight: activeTab === t.key ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><t.icon size={12} /> {t.label}</button>
        ))}
      </div>

      {saved && (
        <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={13} /> Sauvegardé !
        </div>
      )}

      {/* OBJECTIFS */}
      {activeTab === 'objectifs' && (
        <>
          {/* Points forts */}
          <Card>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} color={'var(--success)'} /> Mes points forts</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>Un point fort par domaine</p>
            {NIVEAUX.map(n => (
              <div key={n.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}><n.icon size={12} /> Niveau {n.text}</label>
                <input value={data.points_forts?.[n.key] || ''}
                  onChange={e => setNested('points_forts', n.key, e.target.value)}
                  placeholder={`Mon point fort ${n.text}...`}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </Card>

          {/* Axes d'amélioration */}
          <Card>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} color={'var(--warning)'} /> Mes axes d'amélioration</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>Un axe à travailler par domaine</p>
            {NIVEAUX.map(n => (
              <div key={n.key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}><n.icon size={12} /> Niveau {n.text}</label>
                <input value={data.axes_amelioration?.[n.key] || ''}
                  onChange={e => setNested('axes_amelioration', n.key, e.target.value)}
                  placeholder={`Axe à améliorer...`}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </Card>

          {/* Objectifs personnels */}
          <Card>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} color={'var(--warning)'} /> Mes objectifs personnels</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>3 objectifs pour la saison 2026/2027</p>
            {[1,2,3].map(i => (
              <div key={i} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Objectif {i}</label>
                <input value={data[`obj_perso_${i}`] || ''}
                  onChange={e => setField(`obj_perso_${i}`, e.target.value)}
                  placeholder={`Mon objectif personnel ${i}...`}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </Card>

          {/* Objectifs collectifs */}
          <Card>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Swords size={14} color={'var(--primary)'} /> Mes objectifs collectifs</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>3 objectifs d'équipe pour la saison 2026/2027</p>
            {[1,2,3].map(i => (
              <div key={i} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Objectif {i}</label>
                <input value={data[`obj_collectif_${i}`] || ''}
                  onChange={e => setField(`obj_collectif_${i}`, e.target.value)}
                  placeholder={`Objectif collectif ${i}...`}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </Card>
        </>
      )}

      {/* BILAN */}
      {activeTab === 'bilan' && (
        <>
          {/* Stats match */}
          {stats && (
            <Card>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={14} color={'var(--primary)'} /> Mes statistiques — Saison 2026/2027</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: 'var(--primary)' }}>
                      {['Matchs','Tps jeu moy.','Titulaire','Rempl.','Buts','PD','CJ','CR','Note'].map(h => (
                        <th key={h} style={{ padding: '6px 4px', color: '#fff', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ background: '#F9FAFB' }}>
                      {[stats.nbMatchs, `${stats.tempsMoy}'`, stats.titulaire, stats.remplacant, stats.totalButs, stats.totalPD, stats.cartonsJ, stats.cartonsR, stats.noteMoy].map((v, i) => (
                        <td key={i} style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 600, fontSize: 13 }}>{v}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* 1. Objectifs personnels atteints */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>1 — Objectifs personnels atteints ?</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {['Oui', 'Non'].map(v => (
                <button key={v} onClick={() => setField('bilan_obj_perso_atteints', v === 'Oui')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${data.bilan_obj_perso_atteints === (v === 'Oui') ? (v === 'Oui' ? '#3B6D11' : '#A32D2D') : '#E5E7EB'}`,
                    background: data.bilan_obj_perso_atteints === (v === 'Oui') ? (v === 'Oui' ? '#EAF3DE' : '#FCEBEB') : 'transparent',
                    color: data.bilan_obj_perso_atteints === (v === 'Oui') ? (v === 'Oui' ? '#3B6D11' : '#A32D2D') : '#6B7280',
                  }}>{v === 'Oui' ? <><CheckCircle2 size={13} style={{marginRight:4,verticalAlign:-2}} />Oui</> : <><XCircle size={13} style={{marginRight:4,verticalAlign:-2}} />Non</>}</button>
              ))}
            </div>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Comment y remédier :</label>
            <textarea value={data.bilan_obj_perso_comment || ''}
              onChange={e => setField('bilan_obj_perso_comment', e.target.value)}
              placeholder="Ce que je vais faire différemment..."
              rows={3} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Card>

          {/* 2. Objectifs collectifs atteints */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>2 — Objectifs collectifs atteints ?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Oui', 'Non'].map(v => (
                <button key={v} onClick={() => setField('bilan_obj_collectifs_atteints', v === 'Oui')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${data.bilan_obj_collectifs_atteints === (v === 'Oui') ? (v === 'Oui' ? '#3B6D11' : '#A32D2D') : '#E5E7EB'}`,
                    background: data.bilan_obj_collectifs_atteints === (v === 'Oui') ? (v === 'Oui' ? '#EAF3DE' : '#FCEBEB') : 'transparent',
                    color: data.bilan_obj_collectifs_atteints === (v === 'Oui') ? (v === 'Oui' ? '#3B6D11' : '#A32D2D') : '#6B7280',
                  }}>{v === 'Oui' ? <><CheckCircle2 size={13} style={{marginRight:4,verticalAlign:-2}} />Oui</> : <><XCircle size={13} style={{marginRight:4,verticalAlign:-2}} />Non</>}</button>
              ))}
            </div>
          </Card>

          {/* 3. Axes amélioration saison prochaine */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>3 — Axes d'amélioration saison prochaine</p>
            <textarea value={data.bilan_axes_saison_prochaine || ''}
              onChange={e => setField('bilan_axes_saison_prochaine', e.target.value)}
              placeholder="Ce que je veux améliorer la saison prochaine..."
              rows={4} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Card>

          {/* 4. Projection saison prochaine */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>4 — Projection saison prochaine</p>
            <textarea value={data.bilan_projection || ''}
              onChange={e => setField('bilan_projection', e.target.value)}
              placeholder="Mes ambitions pour la saison prochaine..."
              rows={4} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Card>

          {/* Commentaire général */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}><MessageSquare size={13} style={{marginRight:6,verticalAlign:-2}} />Commentaire général</p>
            <textarea value={data.bilan_commentaire || ''}
              onChange={e => setField('bilan_commentaire', e.target.value)}
              placeholder="Bilan général de ma saison 2026/2027..."
              rows={4} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Card>
        </>
      )}

      <Button variant="primary" style={{ width: '100%', marginTop: 4 }} onClick={handleSave} disabled={saving}>
        {saving ? 'Enregistrement...' : <><Save size={13} style={{marginRight:6,verticalAlign:-2}} />Sauvegarder</>}
      </Button>
    </div>
  )
}
