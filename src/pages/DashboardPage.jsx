import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, BarChart, AlertCard, Spinner } from '../components/UI'

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function DashboardPage() {
  const { isCoach, isAdjoint, isJoueur, profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ rpeMoy: 0, presence: 0, distMoy: 0, butsMoy: 0 })
  const [rpeParItem, setRpeParItem] = useState([])
  const [rpeParJoueur, setRpeParJoueur] = useState([])
  const [footParJoueur, setFootParJoueur] = useState([])
  const [alerts, setAlerts] = useState([])

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const [
      { data: rpeData },
      { data: footData },
      { data: statsData },
      { data: joueursData },
    ] = await Promise.all([
      supabase.from('rpe').select('*, joueurs(id,nom,prenom)').order('created_at', { ascending: false }).limit(200),
      supabase.from('footbar').select('*, joueurs(nom,prenom)').order('created_at', { ascending: false }).limit(100),
      supabase.from('stats_match').select('buts').order('created_at', { ascending: false }).limit(50),
      supabase.from('joueurs').select('id,nom,prenom').order('nom'),
    ])

    // RPE moyen global
    const rpeVals = (rpeData || []).map(r => {
      const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      return items.length ? items.reduce((a, b) => a + b, 0) / items.length : null
    }).filter(v => v !== null)
    const rpeMoy = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : 0

    // Distance moyenne Footbar
    const distances = (footData || []).map(f => f.distance_km).filter(Boolean)
    const distMoy = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0

    // Buts par match
    const buts = (statsData || []).map(s => s.buts || 0)
    const butsMoy = buts.length ? buts.reduce((a, b) => a + b, 0) / buts.length : 0

    setMetrics({ rpeMoy: rpeMoy.toFixed(1), presence: 81, distMoy: distMoy.toFixed(1), butsMoy: butsMoy.toFixed(1) })

    // RPE par item (moyenne équipe)
    const itemKeys = ['difficulte','fatigue','implication','motivation','perf_individuelle','perf_collective']
    const itemLabels = ['Difficulté','Fatigue','Implication','Motivation','Perf. indiv.','Perf. coll.']
    const rpeItems = itemKeys.map((key, i) => {
      const vals = (rpeData || []).map(r => r[key]).filter(v => v !== null && v !== undefined)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { label: itemLabels[i], value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
    })
    setRpeParItem(rpeItems)

    // RPE par joueur
    const joueurMap = {}
    for (const r of (rpeData || [])) {
      if (!r.joueurs) continue
      const id = r.joueurs.id
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!joueurMap[id]) joueurMap[id] = { nom: `${r.joueurs.nom} ${r.joueurs.prenom?.[0] || ''}.`, vals: [] }
      joueurMap[id].vals.push(avg)
    }
    const rpeJoueurs = Object.values(joueurMap).map(j => {
      const avg = j.vals.reduce((a, b) => a + b, 0) / j.vals.length
      return { label: j.nom, value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
    }).sort((a, b) => b.value - a.value).slice(0, 8)
    setRpeParJoueur(rpeJoueurs)

    // Footbar par joueur
    const footMap = {}
    for (const f of (footData || [])) {
      if (!f.joueurs || !f.distance_km) continue
      const nom = `${f.joueurs.nom} ${f.joueurs.prenom?.[0] || ''}.`
      if (!footMap[nom]) footMap[nom] = []
      footMap[nom].push(parseFloat(f.distance_km))
    }
    const footJoueurs = Object.entries(footMap).map(([nom, vals]) => ({
      label: nom,
      value: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
      color: '#185FA5'
    })).sort((a, b) => b.value - a.value).slice(0, 8)
    setFootParJoueur(footJoueurs)

    // Alertes automatiques
    const alertList = []
    for (const [id, j] of Object.entries(joueurMap)) {
      const avg = j.vals.reduce((a, b) => a + b, 0) / j.vals.length
      if (avg >= 4.5) alertList.push({ type: 'red', title: `⚠️ ${j.nom} — Surcharge détectée`, message: `RPE moyen ${avg.toFixed(1)}/5 sur les dernières sessions. Adapter la charge.` })
      else if (avg <= 2.0) alertList.push({ type: 'yellow', title: `📉 ${j.nom} — Charge très faible`, message: `RPE moyen ${avg.toFixed(1)}/5. Vérifier l'implication ou l'état de forme.` })
    }
    setAlerts(alertList.slice(0, 4))
    setLoading(false)
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Dashboard" />

      {loading ? <Spinner /> : (
        <>
          {/* Alertes */}
          {alerts.length > 0 && (
            <div style={{ background: '#FDF1F1', border: '0.5px solid #FCA5A5', borderRadius: 14, padding: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', marginBottom: 8 }}>🚨 Alertes coach</p>
              {alerts.map((a, i) => <AlertCard key={i} type={a.type} title={a.title} message={a.message} />)}
            </div>
          )}

          {/* Métriques clés */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'RPE moyen équipe', value: `${metrics.rpeMoy}/5`, sub: 'Dernière séance' },
              { label: 'Présence moy.', value: `${metrics.presence}%`, sub: 'Ce mois' },
              { label: 'Dist. moy. match', value: `${metrics.distMoy} km`, sub: 'Footbar' },
              { label: 'Buts / match', value: metrics.butsMoy, sub: 'Saison' },
            ].map(m => (
              <div key={m.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{m.value}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* RPE par item */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE équipe — moyenne par item</p>
            <BarChart data={rpeParItem} maxValue={5} />
            <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8 }}>🔴 Charge élevée · 🟠 Modérée · 🟢 Optimale</p>
          </Card>

          {/* RPE par joueur */}
          {rpeParJoueur.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE par joueur — moyenne saison</p>
              <BarChart data={rpeParJoueur} maxValue={5} />
            </Card>
          )}

          {/* Footbar par joueur */}
          {footParJoueur.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Footbar — distance moyenne / match (km)</p>
              <BarChart data={footParJoueur} maxValue={12} />
            </Card>
          )}

          {/* Lien vers joueurs */}
          <button onClick={() => navigate('/joueurs')} style={{
            width: '100%', padding: 14, background: '#fff',
            border: '0.5px solid #E5E7EB', borderRadius: 12,
            fontSize: 13, color: '#185FA5', fontWeight: 600, cursor: 'pointer'
          }}>
            👥 Voir les fiches joueurs →
          </button>
        </>
      )}
    </div>
  )
}
