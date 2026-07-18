import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TrendingDown, Dumbbell, Star, Circle } from 'lucide-react'

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

// Deux dimensions de polarité opposée : la charge (difficulté/fatigue — plus c'est haut,
// plus la séance a été dure) ne peut pas être moyennée avec le ressenti de performance
// (implication/motivation/perf — plus c'est haut, mieux les joueurs se sont sentis) sans
// que les deux signaux ne se neutralisent. On calcule donc une corrélation séparée pour
// chacune plutôt qu'une seule moyenne composite.
const CHARGE_ITEMS = ['difficulte', 'fatigue']
const PERF_ITEMS = ['implication', 'motivation', 'perf_individuelle', 'perf_collective']

function avgOf(r, items) {
  const vals = items.map(k => r[k]).filter(v => v !== null && v !== undefined)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function pearson(xs, ys) {
  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((s, xi, i) => s + xi * ys[i], 0)
  const sumX2 = xs.reduce((s, xi) => s + xi * xi, 0)
  const sumY2 = ys.reduce((s, yi) => s + yi * yi, 0)
  const num = n * sumXY - sumX * sumY
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  return den !== 0 ? parseFloat((num / den).toFixed(2)) : null
}

export default function CorrelationPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState([])
  const [correlationCharge, setCorrelationCharge] = useState(null)
  const [correlationPerf, setCorrelationPerf] = useState(null)
  const [dimension, setDimension] = useState('charge') // 'charge' | 'perf' — pilote le graphique/tableau

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { debut, fin } = bornesSaison()
    const { data: eventsSaisonIds } = await supabase.from('evenements').select('id')
      .gte('date_heure', debut).lte('date_heure', fin)
    const idsSaison = (eventsSaisonIds || []).map(e => e.id)

    // Récupère les RPE et les stats collectives liés aux mêmes événements, de la saison en cours
    const [{ data: rpeData }, { data: statsData }] = await Promise.all([
      supabase.from('rpe').select('evenement_id, difficulte, fatigue, implication, motivation, perf_individuelle, perf_collective')
        .in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('stats_collectives').select('*, evenements(titre, date_heure)')
        .in('evenement_id', idsSaison).order('created_at', { ascending: false })
    ])

    // Moyennes charge / perf ressentie par événement
    const chargeByEvent = {}
    const perfByEvent = {}
    for (const r of (rpeData || [])) {
      const charge = avgOf(r, CHARGE_ITEMS)
      const perf = avgOf(r, PERF_ITEMS)
      if (charge !== null) {
        if (!chargeByEvent[r.evenement_id]) chargeByEvent[r.evenement_id] = []
        chargeByEvent[r.evenement_id].push(charge)
      }
      if (perf !== null) {
        if (!perfByEvent[r.evenement_id]) perfByEvent[r.evenement_id] = []
        perfByEvent[r.evenement_id].push(perf)
      }
    }

    // Croise avec les résultats de match
    const points = []
    for (const s of (statsData || [])) {
      const chargeVals = chargeByEvent[s.evenement_id]
      const perfVals = perfByEvent[s.evenement_id]
      if (!chargeVals?.length && !perfVals?.length) continue
      const chargeMoy = chargeVals?.length ? chargeVals.reduce((a, b) => a + b, 0) / chargeVals.length : null
      const perfMoy = perfVals?.length ? perfVals.reduce((a, b) => a + b, 0) / perfVals.length : null
      const diff = (s.buts_marques || 0) - (s.buts_encaisses || 0)
      const resultat = s.buts_marques > s.buts_encaisses ? 'V' : s.buts_marques === s.buts_encaisses ? 'N' : 'D'
      points.push({
        titre: s.evenements?.titre || 'Match',
        date: s.evenements?.date_heure,
        chargeMoy: chargeMoy !== null ? parseFloat(chargeMoy.toFixed(1)) : null,
        perfMoy: perfMoy !== null ? parseFloat(perfMoy.toFixed(1)) : null,
        diff,
        resultat,
        buts_marques: s.buts_marques || 0,
        buts_encaisses: s.buts_encaisses || 0,
        nb_reponses: Math.max(chargeVals?.length || 0, perfVals?.length || 0)
      })
    }

    setData(points)

    const chargePoints = points.filter(p => p.chargeMoy !== null)
    const perfPoints = points.filter(p => p.perfMoy !== null)
    setCorrelationCharge(chargePoints.length >= 3 ? pearson(chargePoints.map(p => p.chargeMoy), chargePoints.map(p => p.diff)) : null)
    setCorrelationPerf(perfPoints.length >= 3 ? pearson(perfPoints.map(p => p.perfMoy), perfPoints.map(p => p.diff)) : null)

    setLoading(false)
  }

  function getCorrelationLabel(r) {
    if (r === null) return { label: 'Pas assez de données', color: 'var(--text-muted)' }
    const abs = Math.abs(r)
    if (abs >= 0.7) return { label: r > 0 ? 'Forte corrélation positive' : 'Forte corrélation négative', color: r > 0 ? '#3B6D11' : '#A32D2D' }
    if (abs >= 0.4) return { label: r > 0 ? 'Corrélation modérée positive' : 'Corrélation modérée négative', color: r > 0 ? '#BA7517' : '#D85A30' }
    return { label: 'Faible corrélation', color: 'var(--text-muted)' }
  }

  const corrLabelCharge = getCorrelationLabel(correlationCharge)
  const corrLabelPerf = getCorrelationLabel(correlationPerf)

  // Prépare le graphique scatter selon la dimension choisie
  const dimKey = dimension === 'charge' ? 'chargeMoy' : 'perfMoy'
  const dimLabel = dimension === 'charge' ? 'Charge perçue (difficulté/fatigue)' : 'Ressenti de performance'
  const dimData = data.filter(p => p[dimKey] !== null)
  const maxVal = 5
  const maxDiff = dimData.length ? Math.max(3, ...dimData.map(p => Math.abs(p.diff))) : 3
  const W = 280, H = 160, PAD = 24

  function xPos(v) { return PAD + ((v - 1) / (maxVal - 1)) * (W - PAD * 2) }
  function yPos(diff) { return H - PAD - ((diff + maxDiff) / (maxDiff * 2)) * (H - PAD * 2) }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingDown size={18} /> Corrélation RPE / Perf.</span>} />

      {loading ? <Spinner /> : (
        <>
          {/* Coefficients de corrélation — deux dimensions distinctes */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Charge perçue ↔ Résultats</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Relation entre la difficulté/fatigue ressentie et la différence de buts en match.
            </p>
            {correlationCharge !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', border: `5px solid ${corrLabelCharge.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: corrLabelCharge.color }}>
                  {correlationCharge}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: corrLabelCharge.color }}>{corrLabelCharge.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {correlationCharge > 0.4 ? 'Plus la charge perçue est élevée, meilleurs sont les résultats.' :
                     correlationCharge < -0.4 ? 'Une charge perçue élevée est associée à de moins bons résultats.' :
                     'Pas de lien clair entre charge perçue et résultats sur les données actuelles.'}
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Il faut au moins 3 matchs avec RPE rempli pour calculer la corrélation.</p>
            )}
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Ressenti de performance ↔ Résultats</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Relation entre l'implication/motivation/perf. ressentie et la différence de buts.
            </p>
            {correlationPerf !== null ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', border: `5px solid ${corrLabelPerf.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: corrLabelPerf.color }}>
                  {correlationPerf}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: corrLabelPerf.color }}>{corrLabelPerf.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {correlationPerf > 0.4 ? 'Le ressenti des joueurs est cohérent avec le résultat réel.' :
                     correlationPerf < -0.4 ? 'Le ressenti des joueurs diverge du résultat réel.' :
                     'Pas de lien clair entre ressenti de performance et résultats sur les données actuelles.'}
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Il faut au moins 3 matchs avec RPE rempli pour calculer la corrélation.</p>
            )}
          </Card>

          {/* Sélecteur de dimension pour le graphique et le tableau */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['charge', Dumbbell, 'Charge perçue'], ['perf', Star, 'Ressenti perf.']].map(([key, Icon, lbl]) => (
              <button key={key} onClick={() => setDimension(key)} style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: '0.5px solid var(--border)',
                background: dimension === key ? 'var(--primary-bg)' : 'transparent',
                color: dimension === key ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: dimension === key ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}><Icon size={11} /> {lbl}</button>
            ))}
          </div>

          {/* Graphique scatter */}
          {dimData.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{dimLabel} vs Différence de buts</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Chaque point = un match</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Circle size={7} fill={'var(--success)'} color={'var(--success)'} /> Victoire</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Circle size={7} fill={'var(--warning)'} color={'var(--warning)'} /> Nul</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Circle size={7} fill={'var(--danger)'} color={'var(--danger)'} /> Défaite</span>
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }}>
                {/* Axes */}
                <line x1={PAD} y1={PAD} x2={PAD} y2={H-PAD} stroke="var(--border)" strokeWidth="1" />
                <line x1={PAD} y1={H-PAD} x2={W-PAD} y2={H-PAD} stroke="var(--border)" strokeWidth="1" />
                {/* Ligne zéro */}
                <line x1={PAD} y1={yPos(0)} x2={W-PAD} y2={yPos(0)} stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4" />
                {/* Labels axes */}
                <text x={W/2} y={H-4} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{dimLabel}</text>
                <text x={6} y={H/2} textAnchor="middle" fontSize="9" fill="var(--text-muted)" transform={`rotate(-90, 6, ${H/2})`}>Diff. buts</text>
                {/* Points */}
                {dimData.map((p, i) => {
                  const cx = xPos(p[dimKey])
                  const cy = yPos(p.diff)
                  const color = p.resultat === 'V' ? 'var(--success)' : p.resultat === 'N' ? 'var(--warning)' : 'var(--danger)'
                  return (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="6" fill={color} opacity="0.85" />
                      <text x={cx} y={cy-9} textAnchor="middle" fontSize="8" fill="var(--text-secondary)">
                        {p[dimKey]}
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
            {dimData.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucune donnée disponible. Assure-toi que les joueurs remplissent leur RPE après chaque match.</p>
              : dimData.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{p.titre}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {p.date ? format(parseISO(p.date), 'd MMM', { locale: fr }) : ''} · {p.nb_reponses} réponses
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: rpeColor(p[dimKey]) }}>{p[dimKey]}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{dimension === 'charge' ? 'Charge' : 'Perf.'}</div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{p.buts_marques}-{p.buts_encaisses}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Score</div>
                      </div>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: p.resultat === 'V' ? 'var(--success-bg)' : p.resultat === 'N' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                        color: p.resultat === 'V' ? 'var(--success)' : p.resultat === 'N' ? 'var(--warning)' : 'var(--danger)',
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
