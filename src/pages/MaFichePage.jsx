import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Input, Button, BarChart, Spinner } from '../components/UI'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

const RPE_ITEMS = [
  { key: 'difficulte', label: 'Difficulté' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'implication', label: 'Implication' },
  { key: 'motivation', label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. indiv.' },
  { key: 'perf_collective', label: 'Perf. coll.' },
]

export default function MaFichePage() {
  const { profile } = useAuth()
  const [joueur, setJoueur] = useState(null)
  const [rpeHistory, setRpeHistory] = useState([])
  const [statsHistory, setStatsHistory] = useState([])
  const [poidsHistory, setPoidsHistory] = useState([])
  const [form, setForm] = useState({})
  const [newPoids, setNewPoids] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState('infos')

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    const [{ data: j }, { data: rpe }, { data: stats }, { data: poids }] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', profile.id).single(),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('stats_match').select('*, evenements(titre,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('suivi_poids').select('*').eq('joueur_id', profile.id).order('date_mesure', { ascending: true }).limit(12),
    ])
    setJoueur(j); setForm(j || {})
    setRpeHistory(rpe || [])
    setStatsHistory(stats || [])
    setPoidsHistory(poids || [])
    setLoading(false)
  }

  async function saveForm() {
    setSaving(true)
    await supabase.from('joueurs').update({
      telephone: form.telephone, email: form.email,
      adresse: form.adresse, poids: form.poids,
      contact_urgence_nom: form.contact_urgence_nom,
      contact_urgence_tel: form.contact_urgence_tel,
    }).eq('id', profile.id)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function savePoids() {
    if (!newPoids) return
    await supabase.from('suivi_poids').insert({ joueur_id: profile.id, poids: parseFloat(newPoids), date_mesure: new Date().toISOString().split('T')[0] })
    setNewPoids(''); loadData()
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const rpeAvg = RPE_ITEMS.map(item => {
    const vals = rpeHistory.map(r => r[item.key]).filter(v => v !== null && v !== undefined)
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    return { label: item.label, value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
  })

  const totalButs = statsHistory.reduce((s, r) => s + (r.buts || 0), 0)
  const totalPD = statsHistory.reduce((s, r) => s + (r.passes_decisives || 0), 0)
  const noteMoy = statsHistory.length ? (statsHistory.reduce((s, r) => s + (r.note || 0), 0) / statsHistory.length).toFixed(1) : '—'

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Ma fiche" />

      {/* Hero */}
      <div style={{ background: '#185FA5', borderRadius: 14, padding: '16px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {joueur?.nom?.[0]}{joueur?.prenom?.[0]}
        </div>
        <div>
          <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{joueur?.nom} {joueur?.prenom}</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{joueur?.poste} {joueur?.numero ? `· N°${joueur.numero}` : ''}</p>
        </div>
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[['Matchs', statsHistory.length], ['Buts', totalButs], ['PD', totalPD], ['Note', noteMoy]].map(([l, v]) => (
          <div key={l} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{v}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
        {[['infos','👤 Mes infos'],['rpe','❤️ Mon RPE'],['stats','⚽ Mes stats'],['poids','⚖️ Mon poids']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? '#185FA5' : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {/* INFOS */}
      {activeTab === 'infos' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>Mes coordonnées</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>Modifiables par toi</p>
          </div>
          {saved && <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '7px 10px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>✅ Enregistré !</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Téléphone" value={form.telephone || ''} onChange={v => setForm(p => ({ ...p, telephone: v }))} />
            <Input label="Email" value={form.email || ''} onChange={v => setForm(p => ({ ...p, email: v }))} />
          </div>
          <Input label="Adresse" value={form.adresse || ''} onChange={v => setForm(p => ({ ...p, adresse: v }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Contact urgence — Nom" value={form.contact_urgence_nom || ''} onChange={v => setForm(p => ({ ...p, contact_urgence_nom: v }))} />
            <Input label="Contact urgence — Tél." value={form.contact_urgence_tel || ''} onChange={v => setForm(p => ({ ...p, contact_urgence_tel: v }))} />
          </div>
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>Informations physiques (uniquement ton poids)</p>
            <Input label="Poids actuel (kg)" type="number" step="0.1" value={form.poids || ''} onChange={v => setForm(p => ({ ...p, poids: v }))} />
          </div>
          <Button variant="primary" style={{ width: '100%' }} onClick={saveForm} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer mes infos'}
          </Button>
        </Card>
      )}

      {/* MON RPE */}
      {activeTab === 'rpe' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes moyennes RPE — saison</p>
            {rpeHistory.length === 0
              ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune donnée RPE pour l'instant.</p>
              : <BarChart data={rpeAvg} maxValue={5} />
            }
          </Card>
          {rpeHistory.map(r => {
            const avg = (RPE_ITEMS.reduce((s, i) => s + (r[i.key] || 0), 0) / RPE_ITEMS.length).toFixed(1)
            return (
              <Card key={r.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{r.evenements?.titre}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: rpeColor(parseFloat(avg)) }}>{avg}/5</span>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {RPE_ITEMS.map(item => (
                    <div key={item.key} style={{ background: '#F9FAFB', borderRadius: 6, padding: '3px 7px', fontSize: 10 }}>
                      <span style={{ color: '#9CA3AF' }}>{item.label.split(' ')[0]} </span>
                      <span style={{ fontWeight: 600, color: rpeColor(r[item.key] || 0) }}>{r[item.key] ?? '—'}</span>
                    </div>
                  ))}
                </div>
                {r.commentaire && <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>💬 {r.commentaire}</p>}
              </Card>
            )
          })}
        </>
      )}

      {/* MES STATS */}
      {activeTab === 'stats' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes statistiques match</p>
          {statsHistory.length === 0
            ? <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucune statistique enregistrée.</p>
            : statsHistory.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{s.evenements?.titre}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                      {s.temps_jeu}min · {s.titulaire ? 'Titulaire' : 'Remplaçant'} {s.carton_jaune ? '🟡' : ''}{s.carton_rouge ? '🔴' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.note || '—'}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Note</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11' }}>{s.buts || 0}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Buts</div></div>
                  </div>
                </div>
              ))
          }
        </Card>
      )}

      {/* MON POIDS */}
      {activeTab === 'poids' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Suivi de mon poids</p>
          {poidsHistory.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70, marginBottom: 8 }}>
              {poidsHistory.map((p, i) => {
                const min = Math.min(...poidsHistory.map(x => x.poids))
                const max = Math.max(...poidsHistory.map(x => x.poids))
                const h = max === min ? 50 : ((p.poids - min) / (max - min)) * 50 + 10
                return (
                  <div key={p.id} title={`${p.poids} kg`}
                    style={{ flex: 1, background: '#185FA5', borderRadius: '3px 3px 0 0', height: `${h}px`, opacity: 0.5 + (i / poidsHistory.length) * 0.5 }} />
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Input label="Nouvelle pesée (kg)" type="number" step="0.1" value={newPoids} onChange={setNewPoids} style={{ marginBottom: 0 }} />
            <Button variant="primary" onClick={savePoids} style={{ marginTop: 16, flexShrink: 0 }}>+ Ajouter</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
