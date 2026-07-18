import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { computePresenceBreakdown } from '../lib/presenceStats'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { Scale, Heart, Radio } from 'lucide-react'

function rpeColor(v) {
  if (!v) return '#9CA3AF'
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

const RPE_ITEMS = ['difficulte','fatigue','implication','motivation','perf_individuelle','perf_collective']
const RPE_LABELS = ['Difficulté','Fatigue','Implication','Motivation','Perf. indiv.','Perf. coll.']
const FOOT_ITEMS = [
  { key: 'distance_km', label: 'Distance', unit: 'km', max: 12 },
  { key: 'sprint_max', label: 'Sprint max', unit: 'km/h', max: 35 },
  { key: 'sprints', label: 'Sprints', unit: '', max: 30 },
  { key: 'temps_jeu', label: 'Tps jeu', unit: 'min', max: 90 },
]

export default function ComparatifJoueursPage() {
  const [joueurs, setJoueurs] = useState([])
  const [joueur1, setJoueur1] = useState('')
  const [joueur2, setJoueur2] = useState('')
  const [data1, setData1] = useState(null)
  const [data2, setData2] = useState(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('rpe')
  const [idsSaison, setIdsSaison] = useState(null)

  useEffect(() => { loadJoueurs() }, [])
  useEffect(() => {
    if (idsSaison && joueur1) loadJoueurData(joueur1, setData1)
    if (idsSaison && joueur2) loadJoueurData(joueur2, setData2)
  }, [joueur1, joueur2, idsSaison])

  async function loadJoueurs() {
    const { debut, fin } = bornesSaison()
    const [{ data }, { data: eventsSaisonIds }] = await Promise.all([
      supabase.from('joueurs').select('id,nom,prenom,poste,numero').order('nom'),
      supabase.from('evenements').select('id').gte('date_heure', debut).lte('date_heure', fin),
    ])
    setJoueurs(data || [])
    setIdsSaison((eventsSaisonIds || []).map(e => e.id))
    if (data?.length >= 2) { setJoueur1(data[0].id); setJoueur2(data[1].id) }
  }

  async function loadJoueurData(id, setter) {
    setLoading(true)
    const [{ data: j }, { data: rpe }, { data: foot }, { data: stats }, { data: pres }] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', id).single(),
      supabase.from('rpe').select('*').eq('joueur_id', id).in('evenement_id', idsSaison).order('created_at', { ascending: false }).limit(20),
      supabase.from('footbar').select('*').eq('joueur_id', id).in('evenement_id', idsSaison).order('created_at', { ascending: false }).limit(20),
      supabase.from('stats_match').select('*, evenements(match_type)').eq('joueur_id', id).in('evenement_id', idsSaison).order('created_at', { ascending: false }).limit(20),
      supabase.from('presences').select('statut').eq('joueur_id', id).in('evenement_id', idsSaison),
    ])

    // Moyennes RPE
    const rpeMoyennes = {}
    RPE_ITEMS.forEach(key => {
      const vals = (rpe || []).map(r => r[key]).filter(v => v != null)
      rpeMoyennes[key] = vals.length ? parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1)) : null
    })

    // Moyennes Footbar
    const footMoyennes = {}
    FOOT_ITEMS.forEach(({ key }) => {
      const vals = (foot || []).map(f => f[key]).filter(v => v != null)
      footMoyennes[key] = vals.length ? parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1)) : null
    })

    // Stats match (matchs officiels seulement, comme ClassementButeursPage/DashboardStatsPage)
    const officiels = (stats || []).filter(s => s.evenements?.match_type !== 'preparation')
    const totalButs = officiels.reduce((s,r) => s+(r.buts||0), 0)
    const totalPD = officiels.reduce((s,r) => s+(r.passes_decisives||0), 0)
    const noteMoy = officiels.length ? parseFloat((officiels.reduce((s,r) => s+(r.note||0),0)/officiels.length).toFixed(1)) : null
    const minMoy = officiels.length ? parseFloat((officiels.reduce((s,r) => s+(r.temps_jeu||0),0)/officiels.length).toFixed(0)) : null

    // Présence (taux d'engagement = présent + extérieur, blessures exclues du calcul)
    const { tauxEngagement } = computePresenceBreakdown(pres || [])

    setter({ joueur: j, rpeMoyennes, footMoyennes, totalButs, totalPD, noteMoy, minMoy, tauxPresence: tauxEngagement, nbMatchs: officiels.length })
    setLoading(false)
  }

  function CompareBar({ label, v1, v2, max = 5, unit = '' }) {
    const p1 = v1 ? Math.min(100, (v1/max)*100) : 0
    const p2 = v2 ? Math.min(100, (v2/max)*100) : 0
    const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: winner === 1 ? 700 : 400, color: winner === 1 ? 'var(--primary)' : '#374151' }}>
            {v1 ?? '—'}{unit}
          </span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: winner === 2 ? 700 : 400, color: winner === 2 ? '#A32D2D' : '#374151' }}>
            {v2 ?? '—'}{unit}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden', direction: 'rtl' }}>
            <div style={{ height: '100%', borderRadius: 4, background: 'var(--primary)', width: `${p1}%` }} />
          </div>
          <div style={{ width: 2, height: 12, background: '#E5E7EB' }} />
          <div style={{ flex: 1, height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: '#A32D2D', width: `${p2}%` }} />
          </div>
        </div>
      </div>
    )
  }

  const j1 = joueurs.find(j => j.id === joueur1)
  const j2 = joueurs.find(j => j.id === joueur2)

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Scale size={18} /> Comparatif joueurs</span>} />

      {/* Sélection joueurs */}
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center' }}>
          <select value={joueur1} onChange={e => setJoueur1(e.target.value)}
            style={{ padding: '8px 10px', border: `2px solid ${'var(--primary)'}`, borderRadius: 10, fontSize: 12, outline: 'none', color: 'var(--primary)', fontWeight: 600 }}>
            {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
          </select>
          <span style={{ textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#9CA3AF' }}>VS</span>
          <select value={joueur2} onChange={e => setJoueur2(e.target.value)}
            style={{ padding: '8px 10px', border: '2px solid #A32D2D', borderRadius: 10, fontSize: 12, outline: 'none', color: '#A32D2D', fontWeight: 600 }}>
            {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
          </select>
        </div>
        {j1 && j2 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>{j1.poste} {j1.numero ? `· N°${j1.numero}` : ''}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center' }}>{j2.poste} {j2.numero ? `· N°${j2.numero}` : ''}</p>
          </div>
        )}
      </Card>

      {loading ? <Spinner /> : data1 && data2 && (
        <>
          {/* Stats globales */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Matchs', v1: data1.nbMatchs, v2: data2.nbMatchs },
              { label: 'Buts', v1: data1.totalButs, v2: data2.totalButs },
              { label: 'Passes déc.', v1: data1.totalPD, v2: data2.totalPD },
              { label: 'Note moy.', v1: data1.noteMoy, v2: data2.noteMoy },
              { label: 'Tps jeu moy.', v1: data1.minMoy ? `${data1.minMoy}min` : '—', v2: data2.minMoy ? `${data2.minMoy}min` : '—', noCompare: true },
              { label: 'Engagement %', v1: data1.tauxPresence ? `${data1.tauxPresence}%` : '—', v2: data2.tauxPresence ? `${data2.tauxPresence}%` : '—', noCompare: true },
            ].map(({ label, v1, v2, noCompare }) => {
              const w = noCompare ? 0 : (v1 > v2 ? 1 : v2 > v1 ? 2 : 0)
              return (
                <div key={label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10 }}>
                  <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginBottom: 6 }}>{label}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: w === 1 ? 'var(--primary)' : '#374151' }}>{v1 ?? '—'}</span>
                    <span style={{ fontSize: 10, color: '#D1D5DB' }}>·</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: w === 2 ? '#A32D2D' : '#374151' }}>{v2 ?? '—'}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['rpe', Heart, 'RPE'],['footbar', Radio, 'Footbar']].map(([tab, Icon, lbl]) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: '0.5px solid #D1D5DB',
                background: activeTab === tab ? 'var(--primary-bg)' : 'transparent',
                color: activeTab === tab ? 'var(--primary)' : '#6B7280',
                fontWeight: activeTab === tab ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}><Icon size={11} /> {lbl}</button>
            ))}
          </div>

          {/* Légende */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 11 }}>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>◀ {j1?.nom}</span>
            <span style={{ color: '#A32D2D', fontWeight: 600 }}>{j2?.nom} ▶</span>
          </div>

          {/* RPE */}
          {activeTab === 'rpe' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Comparaison RPE moyen</p>
              {RPE_ITEMS.map((key, i) => (
                <CompareBar key={key} label={RPE_LABELS[i]}
                  v1={data1.rpeMoyennes[key]} v2={data2.rpeMoyennes[key]} max={5} />
              ))}
            </Card>
          )}

          {/* FOOTBAR */}
          {activeTab === 'footbar' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Comparaison Footbar moyen</p>
              {FOOT_ITEMS.map(({ key, label, unit, max }) => (
                <CompareBar key={key} label={label}
                  v1={data1.footMoyennes[key]} v2={data2.footMoyennes[key]}
                  max={max} unit={unit ? ` ${unit}` : ''} />
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
