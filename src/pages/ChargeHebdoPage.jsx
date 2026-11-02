import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toutLire } from '../lib/toutLire'
import { bornesSaison } from '../lib/saison'
import { chargesDepuisRpe, indicateursJoueur, zoneAcwr } from '../lib/charge'
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
  const [loadError, setLoadError] = useState(null)
  const [semaines, setSemaines] = useState([])
  const [activeView, setActiveView] = useState('charge')
  const [joueursCharge, setJoueursCharge] = useState([])
  const [partEstimee, setPartEstimee] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    // Fenêtre glissante de 12 semaines, sans jamais remonter avant le début de la saison
    // en cours (sinon en début de saison, la fenêtre mélangerait avec la saison précédente).
    const { debut: debutSaison } = bornesSaison()
    const depuis12sem = subWeeks(new Date(), 12)
    const depuisDate = depuis12sem > new Date(debutSaison) ? depuis12sem : new Date(debutSaison)
    const depuis = depuisDate.toISOString()

    const [{ data: rpeData, error: e1 }, { data: eventsData, error: e2 }, { data: statsData, error: e3 }, { data: joueursData, error: e4 }] = await Promise.all([
      toutLire(() => supabase.from('rpe').select('*, evenements(date_heure, type)')
        .gte('created_at', depuis).order('created_at', { ascending: true })),
      supabase.from('evenements').select('*')
        .gte('date_heure', depuis).order('date_heure', { ascending: true }),
      toutLire(() => supabase.from('stats_match').select('evenement_id, joueur_id, temps_jeu')
        .gte('created_at', depuis)),
      supabase.from('joueurs').select('id, nom, prenom').eq('archive', false),
    ])
    // Sans ce garde-fou, une erreur réseau/RLS rendait la page comme si aucune donnée
    // n'existait (état vide), impossible à distinguer d'une saison qui vient de démarrer.
    if (e1 || e2 || e3 || e4) {
      setLoadError((e1 || e2 || e3 || e4).message)
      setLoading(false)
      return
    }

    // Charge sRPE de chaque séance déclarée (intensité × durée réelle ou temps de jeu)
    const charges = chargesDepuisRpe({ rpe: rpeData || [], evenements: eventsData || [], stats: statsData || [] })
    setPartEstimee(charges.length ? Math.round(charges.filter(c => c.estimee).length / charges.length * 100) : 0)
    const parJoueur = new Map()
    for (const c of charges) {
      if (!parJoueur.has(c.joueur_id)) parJoueur.set(c.joueur_id, [])
      parJoueur.get(c.joueur_id).push(c)
    }
    setJoueursCharge((joueursData || [])
      .map(j => ({ ...j, ...indicateursJoueur(parJoueur.get(j.id) || []) }))
      .filter(j => j.aigue > 0 || j.chronique > 0)
      .sort((a, b) => (b.acwr ?? -1) - (a.acwr ?? -1)))

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

      // Événements de cette semaine — exclut les événements pas encore joués, sinon la
      // semaine en cours comptait dès le lundi des séances/matchs prévus plus tard dans
      // la semaine, gonflant "charge" (rpeMoy × nb séances) au-delà de la charge
      // réellement subie jusqu'ici.
      const weekEvents = (eventsData || []).filter(e => {
        const d = parseISO(e.date_heure)
        return d >= weekStart && d <= weekEnd && d <= new Date()
      })

      // Calcul RPE moyen
      const calcRpe = (rpeList) => {
        const vals = rpeList.map(r => {
          const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
          return items.length ? items.reduce((a, b) => a + b, 0) / items.length : null
        }).filter(v => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      }

      // Charge de la semaine = moyenne, sur les joueurs ayant répondu, de leur total
      // sRPE de la semaine (UA). Un joueur sans réponse n'est pas compté comme 0.
      const rpeMoy = calcRpe(weekRpe)
      const nbSeances = weekEvents.filter(e => e.type === 'seance').length
      const nbMatchs = weekEvents.filter(e => e.type === 'match').length
      const totaux = {}
      for (const c of charges) {
        if (c.date >= weekStart && c.date <= weekEnd) totaux[c.joueur_id] = (totaux[c.joueur_id] || 0) + c.charge
      }
      const vals = Object.values(totaux)
      const charge = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null

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

  const maxCharge = Math.max(100, ...semaines.map(s => s.charge || 0))
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

      {loadError && (
        <Card style={{ marginBottom: 12, background: 'var(--danger-bg)' }}>
          <p style={{ fontSize: 13, color: 'var(--danger)' }}>Erreur de chargement : {loadError}</p>
        </Card>
      )}

      {loading ? <Spinner /> : loadError ? null : (
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
                  { label: 'Charge (UA)', value: derniereSemaine.charge ?? '—', color: 'var(--primary)' },
                  { label: 'Séances', value: derniereSemaine.nbSeances, color: '#3B6D11' },
                  { label: 'Matchs', value: derniereSemaine.nbMatchs, color: 'var(--primary)' },
                ].map(m => (
                  <div key={m.label} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.value}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
              {derniereSemaine.rpeMoy && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: `${rpeColor(derniereSemaine.rpeMoy)}20`, color: rpeColor(derniereSemaine.rpeMoy), fontWeight: 600 }}>
                    {rpeLabel(derniereSemaine.rpeMoy)}
                  </span>
                  {tendance !== null && (
                    <span style={{ fontSize: 12, color: tendance > 0.5 ? 'var(--danger)' : tendance < -0.5 ? 'var(--success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                border: '0.5px solid var(--border)', whiteSpace: 'nowrap',
                background: activeView === tab ? 'var(--primary-bg)' : 'transparent',
                color: activeView === tab ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: activeView === tab ? 600 : 400,
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}><Icon size={11} /> {lbl}</button>
            ))}
          </div>

          {/* Graphique charge */}
          {activeView === 'charge' && activeData.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Charge d'entraînement — 12 semaines</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
                Charge par joueur et par semaine (moyenne équipe) = intensité de l'effort (0-10) × durée en minutes, en UA.
                {partEstimee > 0 && ` ${partEstimee} % des valeurs sont estimées (RPE remplis avant la question d'intensité).`}
              </p>
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120 }}>
                {/* Courbe */}
                <polyline
                  points={activeData.filter(s => s.charge !== null).map((s, i) => `${xPos(i)},${yPosCharge(s.charge)}`).join(' ')}
                  fill="none" stroke={'var(--primary)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {activeData.map((s, i) => s.charge !== null && (
                  <g key={i}>
                    <circle cx={xPos(i)} cy={yPosCharge(s.charge)} r="4"
                      fill={'var(--primary)'} />
                    <text x={xPos(i)} y={yPosCharge(s.charge)-8} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{s.charge}</text>
                    <text x={xPos(i)} y={H-4} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{s.label}</text>
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
                    <text x={xPos(i)} y={H-4} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{s.label}</text>
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
                    <text x={xPos(i)} y={H-4} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{s.label}</text>
                  </g>
                ))}
              </svg>
            </Card>
          )}

          {/* Indicateurs par joueur */}
          {activeView === 'charge' && joueursCharge.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Joueurs — charge des 7 derniers jours</p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10 }}>
                Ratio = charge des 7 derniers jours ÷ moyenne hebdo des 4 dernières semaines.
                0,8 à 1,3 : zone optimale · au-delà de 1,5 : hausse brutale, risque de blessure accru.
                Monotonie &gt; 2 : semaine trop uniforme, pas assez de récupération.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px 72px', gap: 4, fontSize: 9, color: 'var(--text-muted)', paddingBottom: 4, borderBottom: '0.5px solid var(--border)' }}>
                <span>Joueur</span><span style={{ textAlign: 'right' }}>7 j (UA)</span><span style={{ textAlign: 'right' }}>Monot.</span><span style={{ textAlign: 'right' }}>Ratio</span>
              </div>
              {joueursCharge.map(j => {
                const z = zoneAcwr(j.acwr)
                return (
                  <div key={j.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px 72px', gap: 4, alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid var(--bg-secondary)', fontSize: 12 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.prenom} {j.nom}</span>
                    <span style={{ textAlign: 'right', fontWeight: 600 }}>{j.aigue}</span>
                    <span style={{ textAlign: 'right', color: j.monotonie > 2 ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: j.monotonie > 2 ? 700 : 400 }}>{j.monotonie ?? '—'}</span>
                    <span style={{ textAlign: 'right' }}>
                      {z ? <span style={{ fontSize: 11, fontWeight: 700, color: z.couleur }}>{j.acwr} · {z.label}</span>
                         : <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pas assez de données</span>}
                    </span>
                  </div>
                )
              })}
            </Card>
          )}

          {/* Tableau récap */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Récapitulatif par semaine</p>
            {semaines.slice(-8).reverse().map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{s.label} — {s.dateLabel}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.nbSeances} séance(s) · {s.nbMatchs} match(s) · {s.nbReponses} réponses</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {s.rpeMoy && <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: rpeColor(s.rpeMoy) }}>{s.rpeMoy}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>RPE</div>
                  </div>}
                  {s.charge && <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{s.charge}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Charge</div>
                  </div>}
                  {!s.rpeMoy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pas de données</span>}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
