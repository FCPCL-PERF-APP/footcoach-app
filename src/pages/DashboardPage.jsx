import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, BarChart, Spinner } from '../components/UI'
import { THEME } from '../theme'

function AlertCard({ type, title, message, joueurId, navigate }) {
  const colors = {
    red:    { border: '#A32D2D', bg: '#FDF1F1', icon: '🔴' },
    orange: { border: '#D85A30', bg: '#FDF5EE', icon: '🟠' },
    yellow: { border: '#BA7517', bg: '#FDFAEE', icon: '🟡' },
  }
  const c = colors[type] || colors.yellow
  return (
    <div onClick={() => joueurId && navigate(`/joueurs/${joueurId}`)}
      style={{
        borderLeft: `3px solid ${c.border}`, borderRadius: 8,
        padding: '10px 12px', marginBottom: 8, background: c.bg,
        cursor: joueurId ? 'pointer' : 'default'
      }}>
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

export default function DashboardPage() {
  const { isCoach, isAdjoint } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({ rpeMoy: 0, presence: 0, distMoy: 0, butsMoy: 0 })
  const [rpeParItem, setRpeParItem] = useState([])
  const [rpeParJoueur, setRpeParJoueur] = useState([])
  const [footParJoueur, setFootParJoueur] = useState([])
  const [alertes, setAlertes] = useState([])
  const [alertesCollectives, setAlertesCollectives] = useState([])
  const [statsMatchs, setStatsMatchs] = useState({ victoires: 0, nuls: 0, defaites: 0, serie: [] })

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const [
      { data: rpeData },
      { data: footData },
      { data: statsData },
      { data: joueursData },
      { data: eventsData },
      { data: presencesData },
    ] = await Promise.all([
      supabase.from('rpe').select('*, joueurs(id,nom,prenom)').order('created_at', { ascending: false }).limit(300),
      supabase.from('footbar').select('*, joueurs(nom,prenom)').order('created_at', { ascending: false }).limit(100),
      supabase.from('stats_collectives').select('*, evenements(date_heure)').order('created_at', { ascending: false }).limit(20),
      supabase.from('joueurs').select('id,nom,prenom').order('nom'),
      supabase.from('evenements').select('id,titre,type,date_heure').order('date_heure', { ascending: false }).limit(10),
      supabase.from('presences').select('*').order('created_at', { ascending: false }).limit(500),
    ])

    // ============ MÉTRIQUES CLÉS ============
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

    // ============ RPE PAR ITEM ============
    const itemKeys = ['difficulte','fatigue','implication','motivation','perf_individuelle','perf_collective']
    const itemLabels = ['Difficulté','Fatigue','Implication','Motivation','Perf. indiv.','Perf. coll.']
    const rpeItems = itemKeys.map((key, i) => {
      const vals = (rpeData || []).map(r => r[key]).filter(v => v !== null && v !== undefined)
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
      return { label: itemLabels[i], value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
    })
    setRpeParItem(rpeItems)

    // ============ RPE PAR JOUEUR ============
    const joueurMap = {}
    for (const r of (rpeData || [])) {
      if (!r.joueurs) continue
      const id = r.joueurs.id
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!joueurMap[id]) joueurMap[id] = { nom: `${r.joueurs.nom} ${r.joueurs.prenom?.[0] || ''}.`, id, sessions: [], motivation: [], fatigue: [], perf_ind: [], perf_col: [] }
      joueurMap[id].sessions.push(avg)
      joueurMap[id].motivation.push(r.motivation)
      joueurMap[id].fatigue.push(r.fatigue)
      joueurMap[id].perf_ind.push(r.perf_individuelle)
      joueurMap[id].perf_col.push(r.perf_collective)
    }

    const rpeJoueurs = Object.values(joueurMap).map(j => {
      const avg = j.sessions.reduce((a, b) => a + b, 0) / j.sessions.length
      return { label: j.nom, value: parseFloat(avg.toFixed(1)), color: rpeColor(avg) }
    }).sort((a, b) => b.value - a.value).slice(0, 8)
    setRpeParJoueur(rpeJoueurs)

    // ============ FOOTBAR PAR JOUEUR ============
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
      color: THEME.primary
    })).sort((a, b) => b.value - a.value).slice(0, 8)
    setFootParJoueur(footJoueurs)

    // ============ RÉSULTATS MATCHS ============
    const matchResults = (statsData || []).map(s => {
      if (s.buts_marques > s.buts_encaisses) return 'V'
      if (s.buts_marques === s.buts_encaisses) return 'N'
      return 'D'
    })
    const serie = matchResults.slice(0, 5)
    const victoires = matchResults.filter(r => r === 'V').length
    const nuls = matchResults.filter(r => r === 'N').length
    const defaites = matchResults.filter(r => r === 'D').length
    setStatsMatchs({ victoires, nuls, defaites, serie })

    // ============ ALERTES INDIVIDUELLES ============
    const alertList = []
    const totalJoueurs = (joueursData || []).length
    const recentEvents = (eventsData || []).slice(0, 3).map(e => e.id)

    for (const [id, j] of Object.entries(joueurMap)) {
      const last3 = j.sessions.slice(0, 3)
      const avgLast3 = last3.length ? last3.reduce((a, b) => a + b, 0) / last3.length : 0
      const avgAll = j.sessions.reduce((a, b) => a + b, 0) / j.sessions.length
      const avgMotivLast = j.motivation.slice(0, 3).filter(v => v !== null)
      const avgMotivAll = j.motivation.filter(v => v !== null)
      const avgFatLast3 = j.fatigue.slice(0, 3).filter(v => v !== null)
      const avgPerfIndLast2 = j.perf_ind.slice(0, 2).filter(v => v !== null)

      // 🔴 Surcharge RPE
      if (avgLast3 >= 4.5) {
        alertList.push({ type: 'red', title: `${j.nom} — Surcharge détectée`, message: `RPE moyen ${avgLast3.toFixed(1)}/5 sur les 3 dernières sessions. Réduire la charge d'entraînement.`, joueurId: id })
      }

      // 🔴 Fatigue chronique
      if (avgFatLast3.length >= 3 && avgFatLast3.every(v => v >= 4)) {
        alertList.push({ type: 'red', title: `${j.nom} — Fatigue chronique`, message: `Fatigue ≥ 4/5 sur 3 sessions consécutives. Risque de blessure élevé.`, joueurId: id })
      }

      // 🟠 Baisse de motivation
      if (avgMotivLast.length >= 2 && avgMotivAll.length >= 4) {
        const motLast = avgMotivLast.reduce((a, b) => a + b, 0) / avgMotivLast.length
        const motAll = avgMotivAll.reduce((a, b) => a + b, 0) / avgMotivAll.length
        if (motAll - motLast >= 1.5) {
          alertList.push({ type: 'orange', title: `${j.nom} — Baisse de motivation`, message: `Motivation : ${motLast.toFixed(1)}/5 cette semaine vs ${motAll.toFixed(1)}/5 en moyenne. Échange recommandé.`, joueurId: id })
        }
      }

      // 🟠 Baisse de performance individuelle
      if (avgPerfIndLast2.length >= 2 && avgPerfIndLast2.every(v => v < 2.5)) {
        alertList.push({ type: 'orange', title: `${j.nom} — Perf. individuelle faible`, message: `Performance individuelle < 2.5/5 sur 2 sessions consécutives.`, joueurId: id })
      }
    }

    // 🟡 RPE non rempli (joueurs sans données récentes)
    const joueursAvecRpe = new Set(Object.keys(joueurMap))
    for (const j of (joueursData || [])) {
      if (!joueursAvecRpe.has(j.id)) {
        alertList.push({ type: 'yellow', title: `${j.nom} ${j.prenom} — RPE manquant`, message: `Aucune donnée RPE enregistrée. Relancer le joueur.`, joueurId: j.id })
      }
    }

    // 🟡 Absentéisme (basé sur les présences)
    const presencesByJoueur = {}
    for (const p of (presencesData || [])) {
      if (!presencesByJoueur[p.joueur_id]) presencesByJoueur[p.joueur_id] = { total: 0, present: 0 }
      presencesByJoueur[p.joueur_id].total++
      if (p.statut === 'present') presencesByJoueur[p.joueur_id].present++
    }
    for (const [joueurId, stats] of Object.entries(presencesByJoueur)) {
      if (stats.total >= 5) {
        const taux = stats.present / stats.total
        if (taux < 0.6) {
          const j = (joueursData || []).find(x => x.id === joueurId)
          if (j) alertList.push({ type: 'yellow', title: `${j.nom} ${j.prenom} — Absentéisme`, message: `Taux de présence : ${Math.round(taux * 100)}% (${stats.present}/${stats.total}). En dessous du seuil de 60%.`, joueurId: joueurId })
        }
      }
    }

    setAlertes(alertList.slice(0, 8))

    // ============ ALERTES COLLECTIVES ============
    const collAlertes = []

    // 🔴 Surcharge équipe
    if (parseFloat(rpeMoy) >= 4.2) {
      collAlertes.push({ type: 'red', title: 'Surcharge collective', message: `RPE moyen équipe : ${rpeMoy.toFixed(1)}/5. Alléger la charge des prochaines séances.` })
    }

    // 🟠 Motivation collective faible
    const allMotiv = (rpeData || []).map(r => r.motivation).filter(v => v !== null && v !== undefined)
    const avgMotivEquipe = allMotiv.length ? allMotiv.reduce((a, b) => a + b, 0) / allMotiv.length : 0
    if (avgMotivEquipe < 3.0 && allMotiv.length > 0) {
      collAlertes.push({ type: 'orange', title: 'Motivation collective faible', message: `Motivation moyenne : ${avgMotivEquipe.toFixed(1)}/5. Revoir la dynamique de groupe.` })
    }

    // 🟠 Perf collective faible
    const lastPerfCol = (rpeData || []).slice(0, 20).map(r => r.perf_collective).filter(v => v !== null)
    const avgPerfCol = lastPerfCol.length ? lastPerfCol.reduce((a, b) => a + b, 0) / lastPerfCol.length : 0
    if (avgPerfCol < 2.5 && lastPerfCol.length > 0) {
      collAlertes.push({ type: 'orange', title: 'Performance collective faible', message: `Perf. collective moyenne : ${avgPerfCol.toFixed(1)}/5 sur les derniers matchs.` })
    }

    // 🟡 Taux de complétion RPE
    const nbRpeRecents = new Set((rpeData || []).slice(0, 50).map(r => r.joueur_id)).size
    if (totalJoueurs > 0 && nbRpeRecents / totalJoueurs < 0.7) {
      collAlertes.push({ type: 'yellow', title: 'Complétion RPE insuffisante', message: `Seulement ${nbRpeRecents}/${totalJoueurs} joueurs ont rempli leur RPE récemment (< 70%).` })
    }

    // 🟡 Série de défaites
    const derniers3 = matchResults.slice(0, 3)
    if (derniers3.length >= 3 && derniers3.every(r => r === 'D')) {
      collAlertes.push({ type: 'yellow', title: '3 défaites consécutives', message: 'L\'équipe n\'a pas gagné ses 3 derniers matchs. Analyser les rapports de match.' })
    }

    setAlertesCollectives(collAlertes)
    setLoading(false)
  }

  const totalAlertes = alertes.length + alertesCollectives.length

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Dashboard" />

      {loading ? <Spinner /> : (
        <>
          {/* BLOC ALERTES */}
          {totalAlertes > 0 && (
            <div style={{ background: '#FDF1F1', border: '0.5px solid #FCA5A5', borderRadius: 14, padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D' }}>🚨 Alertes — {totalAlertes} point(s) à surveiller</p>
              </div>

              {alertesCollectives.length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>Équipe</p>
                  {alertesCollectives.map((a, i) => <AlertCard key={`col-${i}`} {...a} navigate={navigate} />)}
                </>
              )}

              {alertes.length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6, marginTop: alertesCollectives.length > 0 ? 10 : 0 }}>Individuel</p>
                  {alertes.map((a, i) => <AlertCard key={`ind-${i}`} {...a} navigate={navigate} />)}
                </>
              )}
            </div>
          )}

          {totalAlertes === 0 && (
            <div style={{ background: '#EAF3DE', border: '0.5px solid #3B6D11', borderRadius: 12, padding: 12, marginBottom: 14, textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#3B6D11' }}>✅ Aucune alerte — tout va bien !</p>
              <p style={{ fontSize: 11, color: '#3B6D11', marginTop: 2 }}>Charge, motivation et présences dans les normes.</p>
            </div>
          )}

          {/* MÉTRIQUES CLÉS */}
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

          {/* RÉSULTATS RÉCENTS */}
          {statsMatchs.serie.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Résultats récents</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {statsMatchs.serie.map((r, i) => (
                  <div key={i} style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: r === 'V' ? '#EAF3DE' : r === 'N' ? '#FAEEDA' : '#FCEBEB',
                    color: r === 'V' ? '#3B6D11' : r === 'N' ? '#854F0B' : '#A32D2D',
                    fontSize: 12, fontWeight: 700
                  }}>{r}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#3B6D11' }}>✅ {statsMatchs.victoires}V</span>
                <span style={{ color: '#854F0B' }}>〰️ {statsMatchs.nuls}N</span>
                <span style={{ color: '#A32D2D' }}>❌ {statsMatchs.defaites}D</span>
              </div>
            </Card>
          )}

          {/* RPE PAR ITEM */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE équipe — moyenne par item</p>
            <BarChart data={rpeParItem} maxValue={5} />
            <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8 }}>🔴 Charge élevée · 🟠 Modérée · 🟢 Optimale</p>
          </Card>

          {/* RPE PAR JOUEUR */}
          {rpeParJoueur.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE par joueur — moyenne saison</p>
              <BarChart data={rpeParJoueur} maxValue={5} />
            </Card>
          )}

          {/* FOOTBAR PAR JOUEUR */}
          {footParJoueur.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Footbar — distance moyenne / match (km)</p>
              <BarChart data={footParJoueur} maxValue={12} />
            </Card>
          )}

          {/* LIEN JOUEURS */}
          <button onClick={() => navigate('/joueurs')} style={{
            width: '100%', padding: 14, background: '#fff',
            border: '0.5px solid #E5E7EB', borderRadius: 12,
            fontSize: 13, color: THEME.primary, fontWeight: 600, cursor: 'pointer'
          }}>
            👥 Voir les fiches joueurs →
          </button>
        </>
      )}
    </div>
  )
}
