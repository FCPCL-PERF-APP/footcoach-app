import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, BarChart, Spinner, ListRow, IconTile, StatTile } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { computePresenceBreakdown } from '../lib/presenceStats'
import { labelSaison } from '../lib/saison'
import { format, parseISO, subWeeks } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ClipboardCheck, HelpCircle, FileText, Send, Calendar, Users, BarChart3, Heart,
  AlertTriangle, CheckCircle2, TrendingUp, Circle, ArrowRight
} from 'lucide-react'

function AlertCard({ type, title, message, joueurId, navigate, onTraite }) {
  const colors = {
    red:    { border: 'var(--danger)', bg: 'var(--danger-bg)' },
    orange: { border: '#D08A1E', bg: 'var(--warning-bg)' },
    yellow: { border: 'var(--warning)', bg: 'var(--warning-bg)' },
  }
  const c = colors[type] || colors.yellow
  return (
    <div style={{ borderLeft: `3px solid ${c.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: c.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flex: 1, cursor: joueurId ? 'pointer' : 'default' }} onClick={() => joueurId && navigate(`/joueurs/${joueurId}`)}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Circle size={8} fill={c.border} color={c.border} /> {title}
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>{message}</div>
        {joueurId && <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 2 }}>Voir la fiche <ArrowRight size={11} /></div>}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onTraite && onTraite() }}
        style={{ flexShrink: 0, border: 'none', background: 'rgba(0,0,0,.08)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 10, color: '#555', fontWeight: 600, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 3 }}>
        <CheckCircle2 size={12} /> Traité
      </button>
    </div>
  )
}

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

// Le bucket (valeur arrondie) fait partie de la clé : si une alerte déjà "traitée"
// s'aggrave (bucket différent), elle redevient visible sans attendre le reset hebdo.
function alertKey(a, joueurId) {
  const base = joueurId !== undefined ? `ind-${joueurId}-${a.title}` : `col-${a.title}`
  return a.bucket !== undefined ? `${base}-${a.bucket}` : base
}

function LineChart({ data, color = 'var(--primary)' }) {
  if (!data || data.length < 2) return <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>Pas assez de données</p>
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
            <text x={PAD + i * xStep} y={yScale(d.value) - 8} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">{d.value}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
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
  const [aujourdhui, setAujourdhui] = useState({ presencesAConfirmer: [], rpeManquants: 0, convocationsManquantes: [] })
  const [alertesTraitees, setAlertesTraitees] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('fcpcl-alertes-v2') || '{}')
      const now = new Date()
      const lundi = new Date(now)
      lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      lundi.setHours(0, 0, 0, 0)
      if (!stored.resetDate || new Date(stored.resetDate) < lundi) {
        localStorage.setItem('fcpcl-alertes-v2', JSON.stringify({ keys: [], resetDate: now.toISOString() }))
        return []
      }
      return stored.keys || []
    } catch { return [] }
  })

  function marquerTraite(alerteKey) {
    setAlertesTraitees(prev => {
      const next = [...prev, alerteKey]
      try {
        const stored = JSON.parse(localStorage.getItem('fcpcl-alertes-v2') || '{}')
        localStorage.setItem('fcpcl-alertes-v2', JSON.stringify({ ...stored, keys: next }))
      } catch { /* localStorage indisponible, on ignore */ }
      return next
    })
  }

  function marquerToutTraite(alertesC, alertesI) {
    const next = [
      ...alertesC.map(a => alertKey(a)),
      ...alertesI.map(a => alertKey(a, a.joueurId))
    ]
    setAlertesTraitees(next)
    try {
      const stored = JSON.parse(localStorage.getItem('fcpcl-alertes-v2') || '{}')
      localStorage.setItem('fcpcl-alertes-v2', JSON.stringify({ ...stored, keys: next }))
    } catch { /* localStorage indisponible, on ignore */ }
  }

  function resetAlertes() {
    setAlertesTraitees([])
    localStorage.removeItem('fcpcl-alertes-v2')
  }

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const [{ data: rpeData }, { data: footData }, { data: statsDataRaw },
           { data: joueursData }, { data: presencesData }, { data: eventsData },
           { data: absencesData }] = await Promise.all([
      supabase.from('rpe').select('*, joueurs(id,nom,prenom), evenements(date_heure)').order('created_at', { ascending: false }).limit(300),
      supabase.from('footbar').select('distance_km, joueurs(nom,prenom)').order('created_at', { ascending: false }).limit(100),
      supabase.from('stats_collectives').select('*, evenements(date_heure,titre,match_type)').order('created_at', { ascending: false }).limit(20),
      supabase.from('joueurs').select('id,nom,prenom').order('nom'),
      supabase.from('presences').select('*, evenements(date_heure)').order('created_at', { ascending: false }).limit(500),
      supabase.from('evenements').select('*').gte('date_heure', new Date().toISOString()).order('date_heure', { ascending: true }).limit(1),
      supabase.from('presences').select('joueur_id, statut, evenement_id').in('statut', ['absent','blesse']),
    ])

    // Matchs officiels (hors préparation), triés par date réelle du match plutôt que
    // par date de saisie — comme ClassementButeursPage/DashboardStatsPage/BadgesJoueurPage
    const statsData = (statsDataRaw || [])
      .filter(s => s.evenements?.match_type !== 'preparation')
      .sort((a, b) => new Date(b.evenements?.date_heure || 0) - new Date(a.evenements?.date_heure || 0))

    // Set des joueurs absents/blessés sur au moins un événement récent
    const joueursAbsentsBlessesSurEvenement = new Set((absencesData || []).map(p => p.joueur_id))

    // Prochain événement
    setProchainEvent(eventsData?.[0] || null)

    // Présences par événement (aussi utilisé pour la métrique "Présence moy." ci-dessous)
    // — taux d'engagement = (présent + extérieur) / (total - blessé), cf. src/lib/presenceStats.js
    const presRowsByEvent = {}
    for (const p of (presencesData || [])) {
      const evId = p.evenement_id
      if (!presRowsByEvent[evId]) presRowsByEvent[evId] = { rows: [], date: p.evenements?.date_heure }
      presRowsByEvent[evId].rows.push(p)
    }
    const presByEvent = {}
    for (const [evId, v] of Object.entries(presRowsByEvent)) {
      presByEvent[evId] = { ...computePresenceBreakdown(v.rows), date: v.date }
    }
    const unMoisAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const presEventsCeMois = Object.values(presByEvent).filter(p => p.total > 0 && p.date && new Date(p.date) >= unMoisAgo && p.tauxEngagement !== null)
    const presenceMoy = presEventsCeMois.length
      ? presEventsCeMois.reduce((s, p) => s + p.tauxEngagement, 0) / presEventsCeMois.length
      : 0

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
    setMetrics({ rpeMoy: rpeMoy.toFixed(1), presence: presenceMoy.toFixed(0), distMoy: distMoy.toFixed(1), butsMoy: butsMoy.toFixed(1) })

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

    setPresenceEvolution(Object.values(presByEvent).filter(p => p.total > 0 && p.date && p.tauxEngagement !== null)
      .sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-8)
      .map(p => ({ label: format(parseISO(p.date), 'd/M', { locale: fr }), value: p.tauxEngagement })))

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
      // bucket = valeur arrondie au 0.5 près, incluse dans la clé de "traité" plus bas :
      // si la situation s'aggrave (bucket différent), l'alerte redevient visible même
      // avant le reset hebdomadaire du lundi.
      if (avgLast3 >= 4.5) alertList.push({ type: 'red', title: `${j.nom} — Surcharge`, message: `RPE ${avgLast3.toFixed(1)}/5 sur 3 sessions.`, joueurId: id, bucket: Math.round(avgLast3 * 2) / 2 })
      if (avgFatLast3.length >= 3 && avgFatLast3.every(v => v >= 4)) {
        const fatMoy = avgFatLast3.reduce((a, b) => a + b, 0) / avgFatLast3.length
        alertList.push({ type: 'red', title: `${j.nom} — Fatigue chronique`, message: `Fatigue ≥ 4/5 sur 3 sessions.`, joueurId: id, bucket: Math.round(fatMoy * 2) / 2 })
      }
      if (avgMotivLast.length >= 2 && avgMotivAll.length >= 4) {
        const motLast = avgMotivLast.reduce((a, b) => a + b, 0) / avgMotivLast.length
        const motAll = avgMotivAll.reduce((a, b) => a + b, 0) / avgMotivAll.length
        if (motAll - motLast >= 1.5) alertList.push({ type: 'orange', title: `${j.nom} — Baisse motivation`, message: `${motLast.toFixed(1)}/5 vs ${motAll.toFixed(1)}/5 en moyenne.`, joueurId: id, bucket: Math.round(motLast * 2) / 2 })
      }
      if (avgPerfIndLast2.length >= 2 && avgPerfIndLast2.every(v => v < 2.5)) {
        const perfMoy = avgPerfIndLast2.reduce((a, b) => a + b, 0) / avgPerfIndLast2.length
        alertList.push({ type: 'orange', title: `${j.nom} — Perf. faible`, message: `Perf. indiv. < 2.5/5 sur 2 sessions.`, joueurId: id, bucket: Math.round(perfMoy * 2) / 2 })
      }
    }
    const joueursAvecRpe = new Set(Object.keys(joueurMap))
    for (const j of (joueursData || [])) {
      // Ne pas alerter si le joueur est absent ou blessé
      if (!joueursAvecRpe.has(j.id) && !joueursAbsentsBlessesSurEvenement.has(j.id)) {
        alertList.push({ type: 'yellow', title: `${j.nom} ${j.prenom} — RPE manquant`, message: `Aucune donnée RPE.`, joueurId: j.id })
      }
    }
    if (parseFloat(rpeMoy) >= 4.2) collAlertes.push({ type: 'red', title: 'Surcharge collective', message: `RPE moyen : ${rpeMoy.toFixed(1)}/5.`, bucket: Math.round(rpeMoy * 2) / 2 })
    const allMotiv = (rpeData || []).map(r => r.motivation).filter(v => v !== null && v !== undefined)
    const avgMotivEquipe = allMotiv.length ? allMotiv.reduce((a, b) => a + b, 0) / allMotiv.length : 0
    if (avgMotivEquipe < 3.0 && allMotiv.length > 0) collAlertes.push({ type: 'orange', title: 'Motivation collective faible', message: `Motivation : ${avgMotivEquipe.toFixed(1)}/5.`, bucket: Math.round(avgMotivEquipe * 2) / 2 })
    const nbRpeRecents = new Set((rpeData || []).slice(0, 50).map(r => r.joueur_id)).size
    if (totalJoueurs > 0 && nbRpeRecents / totalJoueurs < 0.7) collAlertes.push({ type: 'yellow', title: 'Complétion RPE insuffisante', message: `${nbRpeRecents}/${totalJoueurs} joueurs ont rempli.`, bucket: nbRpeRecents })
    const derniers3 = matchResults.slice(0, 3)
    if (derniers3.length >= 3 && derniers3.every(r => r === 'D')) collAlertes.push({ type: 'yellow', title: '3 défaites consécutives', message: 'Analyser les rapports.' })

    setAlertes(alertList.slice(0, 6))
    setAlertesCollectives(collAlertes)
    setNbAlertes(alertList.length + collAlertes.length)

    // ===== AUJOURD'HUI / À FAIRE =====
    const now = new Date()
    const dans2j = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const dans7j = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const il3j = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const [
      { data: eventsProches },
      { data: eventsMatchs7j },
      { data: eventsRecents },
    ] = await Promise.all([
      supabase.from('evenements').select('*')
        .gte('date_heure', now.toISOString()).lte('date_heure', dans2j)
        .order('date_heure', { ascending: true }),
      supabase.from('evenements').select('*')
        .eq('type', 'match')
        .gte('date_heure', now.toISOString()).lte('date_heure', dans7j)
        .order('date_heure', { ascending: true }),
      supabase.from('evenements').select('id,titre,date_heure')
        .lte('date_heure', now.toISOString()).gte('date_heure', il3j),
    ])

    // Présences non confirmées : séance → tous les joueurs, match → seulement les convoqués
    const presencesAConfirmer = (await Promise.all((eventsProches || []).map(async ev => {
      let candidats = joueursData || []
      if (ev.type === 'match') {
        const { data: convocs } = await supabase.from('convocations').select('joueur_id')
          .eq('evenement_id', ev.id).eq('convoque', true)
        const convoqueIds = new Set((convocs || []).map(c => c.joueur_id))
        candidats = candidats.filter(j => convoqueIds.has(j.id))
      }
      const { data: pres } = await supabase.from('presences').select('joueur_id').eq('evenement_id', ev.id)
      const reponduIds = new Set((pres || []).map(p => p.joueur_id))
      const sansReponse = candidats.filter(j => !reponduIds.has(j.id))
      return sansReponse.length > 0 ? { event: ev, nb: sansReponse.length } : null
    }))).filter(Boolean)

    // RPE manquants sur les événements récents, en excluant absents/blessés et, pour un
    // match, les joueurs non convoqués — le Footbar est facultatif (capteur pas toujours
    // dispo, club amateur) donc pas compté ici.
    let rpeManquants = 0
    const eventIdsRecents = (eventsRecents || []).map(e => e.id)
    if (eventIdsRecents.length > 0) {
      const [{ data: rpesFaits }, { data: recentsFull }, { data: convocsRecentes }] = await Promise.all([
        supabase.from('rpe').select('joueur_id, evenement_id').in('evenement_id', eventIdsRecents),
        supabase.from('evenements').select('id,type').in('id', eventIdsRecents),
        supabase.from('convocations').select('joueur_id, evenement_id').eq('convoque', true).in('evenement_id', eventIdsRecents),
      ])
      const rpeSet = new Set((rpesFaits || []).map(r => `${r.joueur_id}-${r.evenement_id}`))
      const matchIdsRecents = new Set((recentsFull || []).filter(e => e.type === 'match').map(e => e.id))
      const convoqueSet = new Set((convocsRecentes || []).map(c => `${c.joueur_id}-${c.evenement_id}`))
      for (const j of (joueursData || [])) {
        if (joueursAbsentsBlessesSurEvenement.has(j.id)) continue
        for (const evId of eventIdsRecents) {
          if (matchIdsRecents.has(evId) && !convoqueSet.has(`${j.id}-${evId}`)) continue
          if (!rpeSet.has(`${j.id}-${evId}`)) rpeManquants++
        }
      }
    }

    // Matchs à venir (7j) sans aucune convocation envoyée
    let convocationsManquantes = []
    if (eventsMatchs7j?.length) {
      const matchIds = eventsMatchs7j.map(e => e.id)
      const { data: convocsExistantes } = await supabase.from('convocations')
        .select('evenement_id').in('evenement_id', matchIds)
      const idsAvecConvoc = new Set((convocsExistantes || []).map(c => c.evenement_id))
      convocationsManquantes = eventsMatchs7j.filter(e => !idsAvecConvoc.has(e.id))
    }

    setAujourdhui({ presencesAConfirmer, rpeManquants, convocationsManquantes })
    setLoading(false)
  }

  const totalAlertes = alertes.length + alertesCollectives.length

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Dashboard" />

      {loading ? <Spinner /> : (
        <>
          {/* AUJOURD'HUI / À FAIRE */}
          {(() => {
            const items = []
            aujourdhui.presencesAConfirmer.forEach(p => items.push({
              icon: HelpCircle, label: `Présence à confirmer — ${p.event.titre}`,
              sub: `${p.nb} joueur(s) sans réponse`, action: () => navigate('/calendrier'), cat: 'amber'
            }))
            if (aujourdhui.rpeManquants > 0) items.push({
              icon: FileText, label: 'RPE à relancer',
              sub: `${aujourdhui.rpeManquants} formulaire(s) manquant(s)`, action: () => navigate('/rpe'), cat: 'rose'
            })
            aujourdhui.convocationsManquantes.forEach(ev => items.push({
              icon: Send, label: `Convocation à envoyer — ${ev.titre}`,
              sub: format(parseISO(ev.date_heure), 'EEE d MMM', { locale: fr }),
              action: () => navigate(`/convocations/${ev.id}`), cat: 'blue'
            }))

            return (
              <Card style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: items.length ? 8 : 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ClipboardCheck size={15} color={'var(--primary)'} /> Aujourd'hui
                </p>
                {items.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={14} /> Tout est à jour
                  </p>
                ) : items.map((it, i) => (
                  <ListRow key={i} icon={it.icon} label={it.label} sublabel={it.sub}
                    iconColor={CAT_COLORS[it.cat]?.color} iconBg={CAT_COLORS[it.cat]?.bg}
                    onClick={it.action} last={i === items.length - 1} />
                ))}
              </Card>
            )
          })()}

          {/* STAT RPE MANQUANTS */}
          {nbAlertes > 0 && (
            <div onClick={() => navigate('/rpe')} style={{
              background: 'var(--danger-bg)', border: `0.5px solid ${'var(--danger)'}55`,
              borderRadius: THEME.radiusMd, padding: '10px 14px', marginBottom: 12,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
            }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} /> {Math.max(0, (alertes.length + alertesCollectives.length) - alertesTraitees.length)} point(s) à surveiller
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dont joueurs sans RPE et surcharges</p>
              </div>
              <ArrowRight size={18} color={'var(--danger)'} />
            </div>
          )}

          {/* RACCOURCIS RAPIDES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { icon: Calendar, label: 'Agenda', action: () => navigate('/calendrier'), cat: 'blue' },
              { icon: Users, label: 'Joueurs', action: () => navigate('/joueurs'), cat: 'violet' },
              { icon: BarChart3, label: 'Stats matchs', action: () => navigate('/stats-matchs'), cat: 'purple' },
              { icon: Heart, label: 'RPE équipe', action: () => navigate('/rpe'), cat: 'rose' },
            ].map(({ icon, label, action, cat }) => (
              <button key={label} onClick={action} style={{
                background: 'var(--bg-card)', border: `0.5px solid ${'var(--border)'}`,
                borderRadius: THEME.radiusMd, padding: '12px 4px',
                cursor: 'pointer', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
              }}>
                <IconTile icon={icon} size={17} tileSize={32} color={CAT_COLORS[cat].color} bg={CAT_COLORS[cat].bg} />
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.2 }}>{label}</div>
              </button>
            ))}
          </div>

          {/* Prochain événement */}
          {prochainEvent && (
            <div style={{ background: 'var(--gradient)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                    style={{ padding: '6px 10px', background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Send size={12} /> Convoquer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ALERTES */}
          {(() => {
            const alertesCollFiltrees = alertesCollectives.filter(a => !alertesTraitees.includes(alertKey(a)))
            const alertesFiltrees = alertes.filter(a => !alertesTraitees.includes(alertKey(a, a.joueurId)))
            const totalVisible = alertesCollFiltrees.length + alertesFiltrees.length

            return totalVisible > 0 ? (
              <div style={{ background: 'var(--danger-bg)', border: `0.5px solid ${'var(--danger)'}55`, borderRadius: THEME.radiusLg, padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> {totalVisible} point(s) à surveiller
                  </p>
                  <button onClick={() => marquerToutTraite(alertesCollectives, alertes)}
                    style={{ fontSize: 10, color: 'var(--danger)', background: 'var(--danger-bg)', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}>
                    Tout traiter
                  </button>
                </div>
                {alertesCollFiltrees.length > 0 && <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Équipe</p>
                  {alertesCollectives.map((a, i) => {
                    const key = alertKey(a)
                    if (alertesTraitees.includes(key)) return null
                    return <AlertCard key={key} {...a} navigate={navigate} onTraite={() => marquerTraite(key)} />
                  })}
                </>}
                {alertesFiltrees.length > 0 && <>
                  <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, marginTop: alertesCollFiltrees.length > 0 ? 10 : 0 }}>Individuel</p>
                  {alertes.map((a, i) => {
                    const key = alertKey(a, a.joueurId)
                    if (alertesTraitees.includes(key)) return null
                    return <AlertCard key={key} {...a} navigate={navigate} onTraite={() => marquerTraite(key)} />
                  })}
                </>}
              </div>
            ) : (
              <div style={{ background: 'var(--success-bg)', border: `0.5px solid ${'var(--success)'}55`, borderRadius: THEME.radiusMd, padding: 12, marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={15} /> Aucune alerte — tout va bien !
                </p>
              </div>
            )
          })()}

          {/* Métriques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'RPE moyen équipe', value: `${metrics.rpeMoy}/5`, sub: 'Toutes sessions', color: rpeColor(parseFloat(metrics.rpeMoy)) },
              { label: 'Engagement moy.', value: `${metrics.presence}%`, sub: 'Ce mois · présent + extérieur', color: metrics.presence >= 80 ? 'var(--success)' : 'var(--warning)' },
              { label: 'Dist. moy. match', value: `${metrics.distMoy} km`, sub: 'Footbar', color: 'var(--primary)' },
              { label: 'Buts / match', value: metrics.butsMoy, sub: labelSaison(), color: 'var(--primary)' },
            ].map(m => <StatTile key={m.label} {...m} />)}
          </div>

          {/* Résultats */}
          {statsMatchs.serie.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Résultats récents</p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {statsMatchs.serie.map((r, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: r === 'V' ? 'var(--success-bg)' : r === 'N' ? 'var(--warning-bg)' : 'var(--danger-bg)',
                    color: r === 'V' ? 'var(--success)' : r === 'N' ? 'var(--warning)' : 'var(--danger)',
                    fontSize: 12, fontWeight: 700 }}>{r}</div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: 'var(--success)' }}>{statsMatchs.victoires}V</span>
                <span style={{ color: 'var(--warning)' }}>{statsMatchs.nuls}N</span>
                <span style={{ color: 'var(--danger)' }}>{statsMatchs.defaites}D</span>
              </div>
            </Card>
          )}

          {/* Évolution RPE */}
          {rpeEvolution.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color={'var(--primary)'} /> Évolution RPE équipe
              </p>
              <LineChart data={rpeEvolution} color={rpeColor(parseFloat(metrics.rpeMoy))} />
            </Card>
          )}

          {/* Évolution présences */}
          {presenceEvolution.length >= 2 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={14} color={'var(--primary)'} /> Évolution présences (%)
              </p>
              <LineChart data={presenceEvolution} color={'var(--primary)'} />
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
                <button onClick={() => navigate('/joueurs')} style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Voir tous →
                </button>
              </div>
              <BarChart data={rpeParJoueur} maxValue={5} />
            </Card>
          )}

          <button onClick={() => navigate('/joueurs')} style={{
            width: '100%', padding: 14, background: 'var(--bg-card)',
            border: `0.5px solid ${'var(--border)'}`, borderRadius: THEME.radiusMd,
            fontSize: 13, color: 'var(--primary)', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}><Users size={15} /> Voir les fiches joueurs <ArrowRight size={14} /></button>
        </>
      )}
    </div>
  )
}
