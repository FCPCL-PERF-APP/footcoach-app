import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, endOfWeek, subWeeks, eachWeekOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TrendingUp, BarChart3, Heart, Frown, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react'

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

function rpeLabel(v) {
  if (v >= 4.5) return 'Surcharge'
  if (v >= 4) return 'Élevée'
  if (v >= 3) return 'Modérée'
  if (v >= 2) return 'Légère'
  return 'Faible'
}

export default function ChargeHebdoPage() {
  const [loading, setLoading] = useState(true)
  const [semaines, setSemaines] = useState([])
  const [activeView, setActiveView] = useState('charge')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    // Fenêtre glissante de 12 semaines, sans jamais remonter avant le début de la saison
    // en cours (sinon en début de saison, la fenêtre mélangerait avec la saison précédente).
    const { debut: debutSaison } = bornesSaison()
    const depuis12sem = subWeeks(new Date(), 12)
    const depuisDate = depuis12sem > new Date(debutSaison) ? depuis12sem : new Date(debutSaison)
    const depuis = depuisDate.toISOString()

    const [{ data: rpeData }, { data: eventsData }] = await Promise.all([
      supabase.from('rpe').select('*, evenements(date_heure, type)')
        .gte('created_at', depuis).order('created_at', { ascending: true }),
      supabase.from('evenements').select('*')
        .gte('date_heure', depuis).order('date_heure', { ascending: true }),
    ])

    // Groupe par semaine
    const weeks = eachWeekOfInterval(
      { start: depuisDate, end: new Date() },
      { weekStartsOn: 1 }
    )

    const semainesData = weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      const label = `S${format(weekStart, 'w', { locale: fr })}`
      const dateLabel = format(weekStart, 'd MMM', { locale: fr })

      // RPE de cette semaine
      const weekRpe = (rpeData || []).filter(r => {
        if (!r.evenements?.date_heure) return false
        const d = parseISO(r.evenements.date_heure)
        return d >= weekStart && d <= weekEnd
      })

      // Événements de cette semaine
      const weekEvents = (eventsData || []).filter(e => {
        const d = parseISO(e.date_heure)
        return d >= weekStart && d <= weekEnd
      })

      // Calcul RPE moyen
      const calcRpe = (rpeList) => {
        const vals = rpeList.map(r => {
          const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
          return items.length ? items.reduce((a, b) => a + b, 0) / items.length : null
        }).filter(v => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }

      // Charge = RPE moyen × nb séances (monotonie simplifiée)
      const rpeMoy = calcRpe(weekRpe)
      const nbSeances = weekEvents.filter(e => e.type === 'seance').length
      const nbMatchs = weekEvents.filter(e => e.type === 'match').length
      const charge = rpeMoy ? parseFloat((rpeMoy * (nbSeances + nbMatchs * 1.5)).toFixed(1)) : null

      return {
        label, dateLabel, weekStart, weekEnd,
        rpeMoy: rpeMoy ? parseFloat(rpeMoy.toFixed(1)) : null,
        charge,
        nbSeances, nbMatchs,
        nbReponses: weekRpe.length,
        fatigueMoy: (() => {
          const vals = weekRpe.map(r => r.fatigue).filter(v => v != null)
          return vals.length ? parseFloat((vals.reduce((a,b) => a+b,0)/vals.length).toFixed(1)) : null
        })(),
        motivationMoy: (() => {
          const vals = weekRpe.map(r => r.motivation).filter(v => v != null)
          return vals.length ? parseFloat((vals.reduce((a,b) => a+b,0)/vals.length).toFixed(1)) : null
        })(),
      }
    })

    setSemaines(semainesData)
    setLoading(false)
  }

  const maxCharge = Math.max(10, ...semaines.map(s => s.charge || 0))
  const maxRpe = 5
  const W = 320, H = 120, PAD = 20
  const activeData = semaines.filter(s => s.charge !== null || s.rpeMoy !== null)

  function xPos(i) { return PAD + (i / Math.max(activeData.length - 1, 1)) * (W - PAD * 2) }
  function yPosCharge(v) { return H - PAD - (v / maxCharge) * (H - PAD * 2) }
  function yPosRpe(v) { return H - PAD - (v / maxRpe) * (H - PAD * 2) }

  const derniereSemaine = semaines[semaines.length - 1]
  const avantDerniere = semaines[semaines.length - 2]
  const tendance = derniereSemaine?.rpeMoy && avantDerniere?.rpeMoy
    ? derniereSemaine.rpeMoy - avantDerniere.rpeMoy
    : null

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp size={18} /> Charge hebdomadaire</span>} />

      {loading ? <Spinner /> : (
        <>
          {/* Résumé semaine en cours */}
          {derniereSemaine && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Semaine en cours — {derniereSemaine.dateLabel}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 10 }}>
                {[
                  { label: 'RPE moy.', value: derniereSemaine.rpeMoy ?? '—', color: rpeColor(derniereSemaine.rpeMoy) },
                  { label: 'Charge', value: derniereSemaine.charge ?? '—', color: 'var(--primary)' },
                  { label: 'Séances', value: derniereSemaine.nbSeances, color: '#3B6D11' },
                  { label: 'Matchs', value: derniereSemaine.nbMatchs, color: '#185FA5' },
                ].map(m => (
                  <div key={m.label} style={{ background: '#F9FAFB', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {derniereSemaine.rpeMoy && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: `${rpeColor(derniereSemaine.rpeMoy)}20`, color: rpeColor(derniereSemaine.rpeMoy), fontWeight: 600 }}>
                    {rpeLabel(derniereSemaine.rpeMoy)}
                  </span>
                  {tendance !== null && (
                    <span style={{ fontSize: 12, color: tendance > 0.5 ? 'var(--danger)' : tendance < -0.5 ? 'var(--success)' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tendance > 0 ? <ArrowUpRight size={12} /> : tendance < 0 ? <ArrowDownRight size={12} /> : <ArrowRight size={12} />} {tendance > 0 ? '+' : ''}{tendance.toFixed(1)} vs sem. précédente
                    </span>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['charge', BarChart3, 'Charge'],['rpe', Heart, 'RPE'],['fatigue', Frown, 'Fatigue / Motivation']].map(([tab, Icon, lbl]) => (
              <button key={tab} onClick={() => setActiveView(tab)} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
                background: activeView === tab ? 'var(--primary-bg)' : 'transparent',
                color: activeView === tab ? 'var(--primary)' : '#6B7280',
                fontWeight: activeView === tab ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}><Icon size={11} /> {lbl}</button>
            ))}
          </div>

          {/* Graphique charge */}
          {activeView === 'charge' && activeData.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Charge d'entraînement — 12 semaines</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 10 }}>Charge = RPE moyen × nombre de séances</p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
                {/* Zones de danger */}
                <rect x={PAD} y={PAD} width={W-PAD*2} height={(H-PAD*2)*0.15} fill="#FCEBEB" opacity="0.5" />
                <text x={W-PAD-2} y={PAD+10} textAnchor="end" fontSize="8" fill="#A32D2D">Surcharge</text>
                {/* Courbe */}
                <polyline
                  points={activeData.filter(s => s.charge !== null).map((s, i) => `${xPos(i)},${yPosCharge(s.charge)}`).join(' ')}
                  fill="none" stroke={'var(--primary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {activeData.map((s, i) => s.charge !== null && (
                  <g key={i}>
                    <circle cx={xPos(i)} cy={yPosCharge(s.charge)} r="4"
                      fill={s.charge > maxCharge * 0.85 ? '#A32D2D' : 'var(--primary)'} />
                    <text x={xPos(i)} y={H-4} textAnchor="middle" fontSize="8" fill="#9CA3AF">{s.label}</text>
                  </g>
                ))}
              </svg>
            </Card>
          )}

          {/* Graphique RPE */}
          {activeView === 'rpe' && activeData.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>RPE moyen équipe — 12 semaines</p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
                <line x1={PAD} y1={yPosRpe(4)} x2={W-PAD} y2={yPosRpe(4)} stroke="#FCEBEB" strokeWidth="1" strokeDasharray="4,4" />
                <text x={W-PAD} y={yPosRpe(4)-3} textAnchor="end" fontSize="8" fill="#A32D2D">Seuil 4.0</text>
                <polyline
                  points={activeData.filter(s => s.rpeMoy !== null).map((s, i) => `${xPos(i)},${yPosRpe(s.rpeMoy)}`).join(' ')}
                  fill="none" stroke={rpeColor(derniereSemaine?.rpeMoy || 3)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {activeData.map((s, i) => s.rpeMoy !== null && (
                  <g key={i}>
                    <circle cx={xPos(i)} cy={yPosRpe(s.rpeMoy)} r="4" fill={rpeColor(s.rpeMoy)} />
                    <text x={xPos(i)} y={yPosRpe(s.rpeMoy)-8} textAnchor="middle" fontSize="9" fill={rpeColor(s.rpeMoy)}>{s.rpeMoy}</text>
                    <text x={xPos(i)} y={H-4} textAnchor="middle" fontSize="8" fill="#9CA3AF">{s.label}</text>
                  </g>
                ))}
              </svg>
            </Card>
          )}

          {/* Fatigue / Motivation */}
          {activeView === 'fatigue' && activeData.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Fatigue vs Motivation — 12 semaines</p>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, marginBottom: 8 }}>
                <span style={{ color: '#A32D2D' }}>— Fatigue</span>
                <span style={{ color: '#3B6D11' }}>— Motivation</span>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
                <polyline
                  points={activeData.filter(s => s.fatigueMoy !== null).map((s,i) => `${xPos(i)},${yPosRpe(s.fatigueMoy)}`).join(' ')}
                  fill="none" stroke="#A32D2D" strokeWidth="2" strokeLinecap="round" />
                <polyline
                  points={activeData.filter(s => s.motivationMoy !== null).map((s,i) => `${xPos(i)},${yPosRpe(s.motivationMoy)}`).join(' ')}
                  fill="none" stroke="#3B6D11" strokeWidth="2" strokeLinecap="round" />
                {activeData.map((s, i) => (
                  <g key={i}>
                    {s.fatigueMoy !== null && <circle cx={xPos(i)} cy={yPosRpe(s.fatigueMoy)} r="3" fill="#A32D2D" />}
                    {s.motivationMoy !== null && <circle cx={xPos(i)} cy={yPosRpe(s.motivationMoy)} r="3" fill="#3B6D11" />}
                    <text x={xPos(i)} y={H-4} textAnchor="middle" fontSize="8" fill="#9CA3AF">{s.label}</text>
                  </g>
                ))}
              </svg>
            </Card>
          )}

          {/* Tableau récap */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Récapitulatif par semaine</p>
            {semaines.slice(-8).reverse().map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{s.label} — {s.dateLabel}</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF' }}>{s.nbSeances} séance(s) · {s.nbMatchs} match(s) · {s.nbReponses} réponses</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {s.rpeMoy && <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: rpeColor(s.rpeMoy) }}>{s.rpeMoy}</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>RPE</div>
                  </div>}
                  {s.charge && <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{s.charge}</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>Charge</div>
                  </div>}
                  {!s.rpeMoy && <span style={{ fontSize: 11, color: '#9CA3AF' }}>Pas de données</span>}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
