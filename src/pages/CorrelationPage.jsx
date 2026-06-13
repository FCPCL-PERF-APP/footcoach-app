import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function CorrelationPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [correlation, setCorrelation] = useState(null)
  const [activeView, setActiveView] = useState('graphique')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    // Récupère les RPE et les stats collectives liés aux mêmes événements
    const [{ data: rpeData }, { data: statsData }] = await Promise.all([
      supabase.from('rpe').select('evenement_id, difficulte, fatigue, implication, motivation, perf_individuelle, perf_collective')
        .order('created_at', { ascending: false }),
      supabase.from('stats_collectives').select('*, evenements(titre, date_heure)')
        .order('created_at', { ascending: false })
    ])

    // Calcule RPE moyen par événement
    const rpeByEvent = {}
    for (const r of (rpeData || [])) {
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!rpeByEvent[r.evenement_id]) rpeByEvent[r.evenement_id] = []
      rpeByEvent[r.evenement_id].push(avg)
    }

    // Croise avec les résultats de match
    const points = []
    for (const s of (statsData || [])) {
      const rpeVals = rpeByEvent[s.evenement_id]
      if (!rpeVals?.length) continue
      const rpeMoy = rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length
      const diff = (s.buts_marques || 0) - (s.buts_encaisses || 0)
      const resultat = s.buts_marques > s.buts_encaisses ? 'V' : s.buts_marques === s.buts_encaisses ? 'N' : 'D'
      points.push({
        titre: s.evenements?.titre || 'Match',
        date: s.evenements?.date_heure,
        rpeMoy: parseFloat(rpeMoy.toFixed(1)),
        diff,
        resultat,
        buts_marques: s.buts_marques || 0,
        buts_encaisses: s.buts_encaisses || 0,
        nb_reponses: rpeVals.length
      })
    }

    setData(points)

    // Calcule la corrélation de Pearson entre RPE moyen et différence de buts
    if (points.length >= 3) {
      const n = points.length
      const x = points.map(p => p.rpeMoy)
      const y = points.map(p => p.diff)
      const sumX = x.reduce((a, b) => a + b, 0)
      const sumY = y.reduce((a, b) => a + b, 0)
      const sumXY = x.reduce((s, xi, i) => s + xi * y[i], 0)
      const sumX2 = x.reduce((s, xi) => s + xi * xi, 0)
      const sumY2 = y.reduce((s, yi) => s + yi * yi, 0)
      const num = n * sumXY - sumX * sumY
      const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
      const r = den !== 0 ? parseFloat((num / den).toFixed(2)) : 0
      setCorrelation(r)
    }

    setLoading(false)
  }

  function getCorrelationLabel(r) {
    if (r === null) return { label: 'Pas assez de données', color: '#9CA3AF' }
    const abs = Math.abs(r)
    if (abs >= 0.7) return { label: r > 0 ? 'Forte corrélation positive' : 'Forte corrélation négative', color: r > 0 ? '#3B6D11' : '#A32D2D' }
    if (abs >= 0.4) return { label: r > 0 ? 'Corrélation modérée positive' : 'Corrélation modérée négative', color: r > 0 ? '#BA7517' : '#D85A30' }
    return { label: 'Faible corrélation', color: '#9CA3AF' }
  }

  const corrLabel = getCorrelationLabel(correlation)

  // Prépare le graphique scatter
  const maxRpe = 5
  const maxDiff = data.length ? Math.max(3, ...data.map(p => Math.abs(p.diff))) : 3
  const W = 280, H = 160, PAD = 24

  function xPos(rpe) { return PAD + ((rpe - 1) / (maxRpe - 1)) * (W - PAD * 2) }
  function yPos(diff) { return H - PAD - ((diff + maxDiff) / (maxDiff * 2)) * (H - PAD * 2) }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="📊 Corrélation RPE / Perf." />

      {loading ? <Spinner /> : (
        <>
          {/* Coefficient de corrélation */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Corrélation RPE ↔ Résultats</p>
            <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
              Relation entre la charge ressentie par l'équipe et la différence de buts en match.
            </p>
            {correlation !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', border: `5px solid ${corrLabel.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: corrLabel.color }}>
                  {correlation}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: corrLabel.color }}>{corrLabel.label}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                    {correlation > 0.4 ? 'Plus l\'équipe est chargée, meilleurs sont les résultats.' :
                     correlation < -0.4 ? 'La surcharge nuit aux performances.' :
                     'Pas de lien clair entre charge et résultats sur les données actuelles.'}
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>Il faut au moins 3 matchs avec RPE rempli pour calculer la corrélation.</p>
            )}
          </Card>

          {/* Graphique scatter */}
          {data.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>RPE moyen vs Différence de buts</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 10 }}>Chaque point = un match · 🟢 Victoire · 🟡 Nul · 🔴 Défaite</p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
                {/* Axes */}
                <line x1={PAD} y1={PAD} x2={PAD} y2={H-PAD} stroke="#E5E7EB" strokeWidth="1" />
                <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} stroke="#E5E7EB" strokeWidth="1" />
                {/* Ligne zéro */}
                <line x1={PAD} y1={yPos(0)} x2={W-PAD} y2={yPos(0)} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4,4" />
                {/* Labels axes */}
                <text x={W/2} y={H-4} textAnchor="middle" fontSize="9" fill="#9CA3AF">RPE moyen équipe</text>
                <text x={6} y={H/2} textAnchor="middle" fontSize="9" fill="#9CA3AF" transform={`rotate(-90, 6, ${H/2})`}>Diff. buts</text>
                {/* Points */}
                {data.map((p, i) => {
                  const cx = xPos(p.rpeMoy)
                  const cy = yPos(p.diff)
                  const color = p.resultat === 'V' ? '#3B6D11' : p.resultat === 'N' ? '#BA7517' : '#A32D2D'
                  return (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="6" fill={color} opacity="0.85" />
                      <text x={cx} y={cy-9} textAnchor="middle" fontSize="8" fill="#6B7280">
                        {p.rpeMoy}
                      </text>
                    </g>
                  )
                })}
              </svg>
            </Card>
          )}

          {/* Tableau détaillé */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Détail par match</p>
            {data.length === 0
              ? <p style={{ fontSize: 12, color: '#9CA3AF' }}>Aucune donnée disponible. Assure-toi que les joueurs remplissent leur RPE après chaque match.</p>
              : data.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{p.titre}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                        {p.date ? format(parseISO(p.date), 'd MMM', { locale: fr }) : ''} · {p.nb_reponses} réponses
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: rpeColor(p.rpeMoy) }}>{p.rpeMoy}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF' }}>RPE</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.buts_marques}-{p.buts_encaisses}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF' }}>Score</div>
                      </div>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: p.resultat === 'V' ? '#EAF3DE' : p.resultat === 'N' ? '#FAEEDA' : '#FCEBEB',
                        color: p.resultat === 'V' ? '#3B6D11' : p.resultat === 'N' ? '#854F0B' : '#A32D2D',
                        fontSize: 11, fontWeight: 700
                      }}>{p.resultat}</div>
                    </div>
                  </div>
                ))
            }
          </Card>
        </>
      )}
    </div>
  )
}
