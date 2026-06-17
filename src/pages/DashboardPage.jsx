import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, BarChart, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'

function AlertCard({ type, title, message, joueurId, navigate }) {
  const colors = {
    red:    { border: '#A32D2D', bg: '#FDF1F1', icon: '🔴' },
    orange: { border: '#D85A30', bg: '#FDF5EE', icon: '🟠' },
    yellow: { border: '#BA7517', bg: '#FDFAEE', icon: '🟡' },
  }
  const c = colors[type] || colors.yellow
  return (
    <div onClick={() => joueurId && navigate(`/joueurs/${joueurId}`)}
      style={{ borderLeft: `3px solid ${c.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: c.bg, cursor: joueurId ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{c.icon} {title}</div>
      <div style={{ fontSize: 11, color: '#555' }}>{message}</div>
      {joueurId && <div style={{ fontSize: 10, color: THEME.primary, marginTop: 4 }}>Voir la fiche →</div>}
    </div>
  )
}

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

function LineChart({ data, color = THEME.primary }) {
  if (!data || data.length < 2) return <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: 12 }}>Pas assez de données</p>
  const W = 300, H = 80, PAD = 10
  const minV = Math.min(...data.map(d => d.value)) - 0.5
  const maxV = Math.max(...data.map(d => d.value)) + 0.5
  const xStep = (W - PAD * 2) / (data.length - 1)
  const yScale = (v) => H - PAD - ((v - minV) / (maxV - minV)) * (H - PAD * 2)
  const points = data.map((d, i) => `${PAD + i * xStep},${yScale(d.value)}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={PAD + i * xStep} cy={yScale(d.value)} r="4" fill={color} />
            <text x={PAD + i * xStep} y={yScale(d.value) - 8} textAnchor="middle" fontSize="9" fill="#6B7280">{d.value}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
        {data.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ rpeMoy: 0, presence: 0, distMoy: 0, butsMoy: 0 })
  const [rpeParItem, setRpeParItem] = useState([])
  const [rpeParJoueur, setRpeParJoueur] = useState([])
  const [alertes, setAlertes] = useState([])
  const [alertesCollectives, setAlertesCollectives] = useState([])
  const [statsMatchs, setStatsMatchs] = useState({ victoires: 0, nuls: 0, defaites: 0, serie: [] })
  const [rpeEvolution, setRpeEvolution] = useState([])
  const [presenceEvolution, setPresenceEvolution] = useState([])
  const [prochainEvent, setProchainEvent] = useState(null)
  const [nbAlertes, setNbAlertes] = useState(0)
  const [alertesTraitees, setAlertesTraitees] = useState(() => {
    try {
      // Reset automatique le lundi
      const lastReset = localStorage.getItem('fcpcl-alertes-last-reset')
      const now = new Date()
      const lastMonday = new Date(now)
      lastMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      lastMonday.setHours(0, 0, 0, 0)
      if (!lastReset || new Date(lastReset) < lastMonday) {
        localStorage.removeItem('fcpcl-alertes-traitees')
        localStorage.setItem('fcpcl-alertes-last-reset', now.toISOString())
        return []
      }
      return JSON.parse(localStorage.getItem('fcpcl-alertes-traitees') || '[]')
    } catch { return [] }
  })

  function marquerTraite(alerteKey) {
    const newList = [...alertesTraitees, alerteKey]
    setAlertesTraitees(newList)
    localStorage.setItem('fcpcl-alertes-traitees', JSON.stringify(newList))
  }

  function resetAlertes() {
    setAlertesTraitees([])
    localStorage.removeItem('fcpcl-alertes-traitees')
    localStorage.setItem('fcpcl-alertes-last-reset', new Date().toISOString())
  }

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const [{ data: rpeData }, { data: footData }, { data: statsData },
           { data: joueursData }, { data: presencesData }, { data: eventsData },
           { data: absencesData }] = await Promise.all([
      supabase.from('rpe').select('*, joueurs(id,nom,prenom), evenements(date_heure)').order('created_at', { ascending: false }).limit(300),
      supabase.from('footbar').select('distance_km, joueurs(nom,prenom)').order('created_at', { ascending: false }).limit(100),
      supabase.from('stats_collectives').select('*, evenements(date_heure,titre)').order('created_at', { ascending: false }).limit(20),
      supabase.from('joueurs').select('id,nom,prenom').order('nom'),
      supabase.from('presences').select('*, evenements(date_heure)').order('created_at', { ascending: false }).limit(500),
      supabase.from('evenements').select('*').gte('date_heure', new Date().toISOString()).order('date_heure', { ascending: true }).limit(1),
      supabase.from('presences').select('joueur_id, statut, evenement_id').in('statut', ['absent','blesse']),
    ])

    // Set des joueurs absents/blessés sur au moins un événement récent
    const joueursAbsentsBlessesSurEvenement = new Set((absencesData || []).map(p => p.joueur_id))

    // Prochain événement
    setProchainEvent(eventsData?.[0] || null)

    // Métriques
    const rpeVals = (rpeData || []).map(r => {
      const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      return items.length ? items.reduce((a, b) => a + b, 0) / items.length : null
    }).filter(v => v !== null)
    const rpeMoy = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : 0
    const distances = (footData || []).map(f => f.distance_km).filter(Boolean)
    const distMoy = distances.length ? distances.reduce((a, b) => a + b, 0) / distances.length : 0
    const buts = (statsData || []).map(s => s.buts_marques || 0)
    const butsMoy = buts.length ? buts.reduce((a, b) => a + b, 0) / buts.length : 0
    setMetrics({ rpeMoy: rpeMoy.toFixed(1), presence: 81, distMoy: distMoy.toFixed(1), butsMoy: butsMoy.toFixed(1) })

    // RPE par item
    const itemKeys = ['difficulte','fatigue','implication','motivation','perf_individuelle','perf_collective']
    const itemLabels = ['Difficulté','Fatigue','Implication','Motivation','Perf. indiv.','Perf. coll.']
    setRpeParItem(itemKeys.map((key, i) => {
      const vals = (rpeData || []).map(r => r[key]).filter(v => v !== null && v !== undefined)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { label: itemLabels[i], value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
    }))

    // Évolution RPE par semaine
    const rpeByWeek = {}
    for (const r of (rpeData || [])) {
      if (!r.evenements?.date_heure) continue
      const date = parseISO(r.evenements.date_heure)
      const weekLabel = format(date, "'S'w", { locale: fr })
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!rpeByWeek[weekLabel]) rpeByWeek[weekLabel] = []
      rpeByWeek[weekLabel].push(avg)
    }
    setRpeEvolution(Object.entries(rpeByWeek).slice(-8).map(([label, vals]) => ({
      label, value: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
    })))

    // Présences par événement
    const presByEvent = {}
    for (const p of (presencesData || [])) {
      const evId = p.evenement_id
      if (!presByEvent[evId]) presByEvent[evId] = { total: 0, present: 0, date: p.evenements?.date_heure }
      presByEvent[evId].total++
      if (p.statut === 'present') presByEvent[evId].present++
    }
    setPresenceEvolution(Object.values(presByEvent).filter(p => p.total > 0 && p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-8)
      .map(p => ({ label: format(parseISO(p.date), 'd/M', { locale: fr }), value: parseFloat((p.present / p.total * 100).toFixed(0)) })))

    // RPE par joueur
    const joueurMap = {}
    for (const r of (rpeData || [])) {
      if (!r.joueurs) continue
      const id = r.joueurs.id
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!joueurMap[id]) joueurMap[id] = { nom: `${r.joueurs.nom} ${r.joueurs.prenom?.[0] || ''}.`, id, sessions: [], motivation: [], fatigue: [], perf_ind: [] }
      joueurMap[id].sessions.push(avg)
      joueurMap[id].motivation.push(r.motivation)
      joueurMap[id].fatigue.push(r.fatigue)
      joueurMap[id].perf_ind.push(r.perf_individuelle)
    }
    setRpeParJoueur(Object.values(joueurMap).map(j => {
      const avg = j.sessions.reduce((a, b) => a + b, 0) / j.sessions.length
      return { label: j.nom, value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
    }).sort((a, b) => b.value - a.value).slice(0, 8))

    // Résultats
    const matchResults = (statsData || []).map(s => s.buts_marques > s.buts_encaisses ? 'V' : s.buts_marques === s.buts_encaisses ? 'N' : 'D')
    setStatsMatchs({ victoires: matchResults.filter(r => r === 'V').length, nuls: matchResults.filter(r => r === 'N').length, defaites: matchResults.filter(r => r === 'D').length, serie: matchResults.slice(0, 5) })

    // Alertes
    const alertList = []
    const collAlertes = []
    const totalJoueurs = (joueursData || []).length

    for (const [id, j] of Object.entries(joueurMap)) {
      // Ne pas alerter les joueurs absents ou blessés
      if (joueursAbsentsBlessesSurEvenement.has(id)) continue

      const last3 = j.sessions.slice(0, 3)
      const avgLast3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0
      const avgFatLast3 = j.fatigue.slice(0, 3).filter(v => v !== null)
      const avgMotivLast = j.motivation.slice(0, 3).filter(v => v !== null)
      const avgMotivAll = j.motivation.filter(v => v !== null)
      const avgPerfIndLast2 = j.perf_ind.slice(0, 2).filter(v => v !== null)
      if (avgLast3 >= 4.5) alertList.push({ type: 'red', title: `${j.nom} — Surcharge`, message: `RPE ${avgLast3.toFixed(1)}/5 sur 3 sessions.`, joueurId: id })
      if (avgFatLast3.length >= 3 && avgFatLast3.every(v => v >= 4)) alertList.push({ type: 'red', title: `${j.nom} — Fatigue chronique`, message: `Fatigue ≥ 4/5 sur 3 sessions.`, joueurId: id })
      if (avgMotivLast.length >= 2 && avgMotivAll.length >= 4) {
        const motLast = avgMotivLast.reduce((a, b) => a + b, 0) / avgMotivLast.length
        const motAll = avgMotivAll.reduce((a, b) => a + b, 0) / avgMotivAll.length
        if (motAll - motLast >= 1.5) alertList.push({ type: 'orange', title: `${j.nom} — Baisse motivation`, message: `${motLast.toFixed(1)}/5 vs ${motAll.toFixed(1)}/5 en moyenne.`, joueurId: id })
      }
      if (avgPerfIndLast2.length >= 2 && avgPerfIndLast2.every(v => v < 2.5)) alertList.push({ type: 'orange', title: `${j.nom} — Perf. faible`, message: `Perf. indiv. < 2.5/5 sur 2 sessions.`, joueurId: id })
    }
    const joueursAvecRpe = new Set(Object.keys(joueurMap))
    for (const j of (joueursData || [])) {
      // Ne pas alerter si le joueur est absent ou blessé
      if (!joueursAvecRpe.has(j.id) && !joueursAbsentsBlessesSurEvenement.has(j.id)) {
        alertList.push({ type: 'yellow', title: `${j.nom} ${j.prenom} — RPE manquant`, message: `Aucune donnée RPE.`, joueurId: j.id })
      }
    }
    if (parseFloat(rpeMoy) >= 4.2) collAlertes.push({ type: 'red', title: 'Surcharge collective', message: `RPE moyen : ${rpeMoy.toFixed(1)}/5.` })
    const allMotiv = (rpeData || []).map(r => r.motivation).filter(v => v !== null && v !== undefined)
    const avgMotivEquipe = allMotiv.length ? allMotiv.reduce((a, b) => a + b, 0) / allMotiv.length : 0
    if (avgMotivEquipe < 3.0 && allMotiv.length > 0) collAlertes.push({ type: 'orange', title: 'Motivation collective faible', message: `Motivation : ${avgMotivEquipe.toFixed(1)}/5.` })
    const nbRpeRecents = new Set((rpeData || []).slice(0, 50).map(r => r.joueur_id)).size
    if (totalJoueurs > 0 && nbRpeRecents / totalJoueurs < 0.7) collAlertes.push({ type: 'yellow', title: 'Complétion RPE insuffisante', message: `${nbRpeRecents}/${totalJoueurs} joueurs ont rempli.` })
    const derniers3 = matchResults.slice(0, 3)
    if (derniers3.length >= 3 && derniers3.every(r => r === 'D')) collAlertes.push({ type: 'yellow', title: '3 défaites consécutives', message: 'Analyser les rapports.' })

    setAlertes(alertList.slice(0, 6))
    setAlertesCollectives(collAlertes)
    setNbAlertes(alertList.length + collAlertes.length)
    setLoading(false)
  }

  const totalAlertes = alertes.length + alertesCollectives.length

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Dashboard" />

      {loading ? <Spinner /> : (
        <>
          {/* STAT RPE MANQUANTS */}
          {nbAlertes > 0 && (
            <div onClick={() => navigate('/rpe')} style={{
              background: '#FDF1F1', border: '0.5px solid #FCA5A5',
              borderRadius: 12, padding: '10px 14px', marginBottom: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D' }}>
                  ⚠️ {nbAlertes} point(s) à surveiller cette semaine
                </p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>Dont joueurs sans RPE et surcharges</p>
              </div>
              <span style={{ color: '#A32D2D', fontSize: 18 }}>→</span>
            </div>
          )}

          {/* RACCOURCIS RAPIDES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { icon: '📅', label: 'Agenda', action: () => navigate('/calendrier') },
              { icon: '👥', label: 'Joueurs', action: () => navigate('/joueurs') },
              { icon: '📊', label: 'Stats matchs', action: () => navigate('/stats-matchs') },
              { icon: '❤️', label: 'RPE équipe', action: () => navigate('/rpe') },
            ].map(({ icon, label, action }) => (
              <button key={label} onClick={action} style={{
                background: '#fff', border: '0.5px solid #E5E7EB',
                borderRadius: 12, padding: '10px 4px',
                cursor: 'pointer', textAlign: 'center'
              }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 9, color: '#6B7280', lineHeight: 1.2 }}>{label}</div>
              </button>
            ))}
          </div>

          {/* Prochain événement */}
          {prochainEvent && (
            <div style={{ background: THEME.gradient, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Prochain événement</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{prochainEvent.titre}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
                  {format(parseISO(prochainEvent.date_heure), "EEE d MMM · HH'h'mm", { locale: fr })}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {prochainEvent.type === 'match' && (
                  <button onClick={() => navigate(`/convocations/${prochainEvent.id}`)}
                    style={{ padding: '6px 10px', background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    📢 Convoquer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ALERTES */}
          {(() => {
            const alertesCollFiltrees = alertesCollectives.filter((a, i) => !alertesTraitees.includes(`col-${i}-${a.title}`))
            const alertesFiltrees = alertes.filter((a, i) => !alertesTraitees.includes(`ind-${i}-${a.title}`))
            const totalVisible = alertesCollFiltrees.length + alertesFiltrees.length

            return totalVisible > 0 ? (
              <div style={{ background: '#FDF1F1', border: '0.5px solid #FCA5A5', borderRadius: 14, padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D' }}>🚨 {totalVisible} point(s) à surveiller</p>
                  {alertesTraitees.length > 0 && (
                    <button onClick={resetAlertes}
                      style={{ fontSize: 10, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Tout réafficher
                    </button>
                  )}
                </div>
                {alertesCollFiltrees.length > 0 && <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Équipe</p>
                  {alertesCollectives.map((a, i) => {
                    const key = `col-${i}-${a.title}`
                    if (alertesTraitees.includes(key)) return null
                    return <AlertCard key={key} {...a} navigate={navigate} onTraite={() => marquerTraite(key)} />
                  })}
                </>}
                {alertesFiltrees.length > 0 && <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6, marginTop: alertesCollFiltrees.length > 0 ? 10 : 0 }}>Individuel</p>
                  {alertes.map((a, i) => {
                    const key = `ind-${i}-${a.title}`
                    if (alertesTraitees.includes(key)) return null
                    return <AlertCard key={key} {...a} navigate={navigate} onTraite={() => marquerTraite(key)} />
                  })}
                </>}
              </div>
            ) : (
              <div style={{ background: '#EAF3DE', border: '0.5px solid #3B6D11', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#3B6D11' }}>✅ Aucune alerte — tout va bien !</p>
                  {alertesTraitees.length > 0 && (
                    <button onClick={resetAlertes}
                      style={{ fontSize: 10, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Voir alertes traitées
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Métriques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'RPE moyen équipe', value: `${metrics.rpeMoy}/5`, sub: 'Toutes sessions', color: rpeColor(parseFloat(metrics.rpeMoy)) },
              { label: 'Présence moy.', value: `${metrics.presence}%`, sub: 'Ce mois', color: metrics.presence >= 80 ? '#3B6D11' : '#D85A30' },
              { label: 'Dist. moy. match', value: `${metrics.distMoy} km`, sub: 'Footbar', color: THEME.primary },
              { label: 'Buts / match', value: metrics.butsMoy, sub: 'Saison', color: THEME.primary },
            ].map(m => (
              <div key={m.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: m.color }}>{m.value}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Résultats */}
          {statsMatchs.serie.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Résultats récents</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {statsMatchs.serie.map((r, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: r === 'V' ? '#EAF3DE' : r === 'N' ? '#FAEEDA' : '#FCEBEB',
                    color: r === 'V' ? '#3B6D11' : r === 'N' ? '#854F0B' : '#A32D2D',
                    fontSize: 12, fontWeight: 700 }}>{r}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#3B6D11' }}>✅ {statsMatchs.victoires}V</span>
                <span style={{ color: '#854F0B' }}>〰️ {statsMatchs.nuls}N</span>
                <span style={{ color: '#A32D2D' }}>❌ {statsMatchs.defaites}D</span>
              </div>
            </Card>
          )}

          {/* Évolution RPE */}
          {rpeEvolution.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📈 Évolution RPE équipe</p>
              <LineChart data={rpeEvolution} color={rpeColor(parseFloat(metrics.rpeMoy))} />
            </Card>
          )}

          {/* Évolution présences */}
          {presenceEvolution.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📈 Évolution présences (%)</p>
              <LineChart data={presenceEvolution} color="#185FA5" />
            </Card>
          )}

          {/* RPE par item */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE équipe — par item</p>
            <BarChart data={rpeParItem} maxValue={5} />
          </Card>

          {/* RPE par joueur */}
          {rpeParJoueur.length > 0 && (
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>RPE par joueur</p>
                <button onClick={() => navigate('/joueurs')} style={{ fontSize: 11, color: THEME.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Voir tous →
                </button>
              </div>
              <BarChart data={rpeParJoueur} maxValue={5} />
            </Card>
          )}

          <button onClick={() => navigate('/joueurs')} style={{
            width: '100%', padding: 14, background: '#fff',
            border: '0.5px solid #E5E7EB', borderRadius: 12,
            fontSize: 13, color: THEME.primary, fontWeight: 600, cursor: 'pointer'
          }}>👥 Voir les fiches joueurs →</button>
        </>
      )}
    </div>
  )
}
