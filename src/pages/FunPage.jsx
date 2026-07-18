import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Gamepad2, Trophy, Target, X, CheckCircle2, Save, Hourglass, Pencil, Award } from 'lucide-react'

const FORMATIONS = {
  '4-4-2': {
    label: '4-4-2',
    postes: [
      { key: 'gb',  label: 'GB',  zone: 1, col: 3 },
      { key: 'dd',  label: 'DD',  zone: 2, col: 5 },
      { key: 'dc1', label: 'DC',  zone: 2, col: 4 },
      { key: 'dc2', label: 'DC',  zone: 2, col: 2 },
      { key: 'dg',  label: 'DG',  zone: 2, col: 1 },
      { key: 'md',  label: 'MD',  zone: 3, col: 5 },
      { key: 'mc1', label: 'MC',  zone: 3, col: 4 },
      { key: 'mc2', label: 'MC',  zone: 3, col: 2 },
      { key: 'mg',  label: 'MG',  zone: 3, col: 1 },
      { key: 'ad',  label: 'ATT', zone: 4, col: 4 },
      { key: 'ag',  label: 'ATT', zone: 4, col: 2 },
    ]
  },
  '4-3-3': {
    label: '4-3-3',
    postes: [
      { key: 'gb',  label: 'GB',  zone: 1, col: 3 },
      { key: 'dd',  label: 'DD',  zone: 2, col: 5 },
      { key: 'dc1', label: 'DC',  zone: 2, col: 4 },
      { key: 'dc2', label: 'DC',  zone: 2, col: 2 },
      { key: 'dg',  label: 'DG',  zone: 2, col: 1 },
      { key: 'md',  label: 'MID', zone: 3, col: 5 },
      { key: 'mc',  label: 'MID', zone: 3, col: 3 },
      { key: 'mg',  label: 'MID', zone: 3, col: 1 },
      { key: 'ad',  label: 'AD',  zone: 4, col: 5 },
      { key: 'ac',  label: 'AC',  zone: 4, col: 3 },
      { key: 'ag',  label: 'AG',  zone: 4, col: 1 },
    ]
  },
  '4-2-3-1': {
    label: '4-2-3-1',
    postes: [
      { key: 'gb',  label: 'GB',  zone: 1, col: 3 },
      { key: 'dd',  label: 'DD',  zone: 2, col: 5 },
      { key: 'dc1', label: 'DC',  zone: 2, col: 4 },
      { key: 'dc2', label: 'DC',  zone: 2, col: 2 },
      { key: 'dg',  label: 'DG',  zone: 2, col: 1 },
      { key: 'mdp1',label: 'MDP', zone: 3, col: 4 },
      { key: 'mdp2',label: 'MDP', zone: 3, col: 2 },
      { key: 'mod', label: 'MOD', zone: 4, col: 5 },
      { key: 'moc', label: 'MOC', zone: 4, col: 3 },
      { key: 'mog', label: 'MOG', zone: 4, col: 1 },
      { key: 'buts',label: 'BT',  zone: 5, col: 3 },
    ]
  },
  '3-5-2': {
    label: '3-5-2',
    postes: [
      { key: 'gb',  label: 'GB',  zone: 1, col: 3 },
      { key: 'dc1', label: 'DC',  zone: 2, col: 5 },
      { key: 'dc2', label: 'DC',  zone: 2, col: 3 },
      { key: 'dc3', label: 'DC',  zone: 2, col: 1 },
      { key: 'pdd', label: 'PD',  zone: 3, col: 6 },
      { key: 'mc1', label: 'MC',  zone: 3, col: 4 },
      { key: 'mc2', label: 'MC',  zone: 3, col: 3 },
      { key: 'mc3', label: 'MC',  zone: 3, col: 2 },
      { key: 'pdg', label: 'PG',  zone: 3, col: 0 },
      { key: 'att1',label: 'ATT', zone: 4, col: 4 },
      { key: 'att2',label: 'ATT', zone: 4, col: 2 },
    ]
  },
}

function CoachOnzeView({ joueurs, tousLesOnze, statsOnze }) {
  const [activeFormation, setActiveFormation] = useState('4-4-2')
  const [showPosteStats, setShowPosteStats] = useState(null)
  const nbReponses = tousLesOnze.length

  if (nbReponses === 0) return (
    <Card style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
        Aucun joueur n'a encore composé son 11 idéal.
      </p>
    </Card>
  )

  // Calculer le 11 populaire + % par poste
  const formConfig = FORMATIONS[activeFormation]
  const onzeAvecFormation = tousLesOnze.filter(o => o.formation === activeFormation)
  const nbFormation = onzeAvecFormation.length || nbReponses

  // Pour chaque poste, compter les votes par joueur
  const statsByPoste = {}
  for (const poste of formConfig.postes) {
    const counts = {}
    const source = onzeAvecFormation.length > 0 ? onzeAvecFormation : tousLesOnze
    for (const onze of source) {
      const jId = onze.selections?.[poste.key]
      if (jId) counts[jId] = (counts[jId] || 0) + 1
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    statsByPoste[poste.key] = sorted.map(([jId, nb]) => ({
      joueur: joueurs.find(j => j.id === jId),
      nb, pct: Math.round(nb / nbFormation * 100)
    }))
  }

  // 11 populaire = joueur le plus voté à chaque poste
  const onzePopulaire = {}
  for (const poste of formConfig.postes) {
    if (statsByPoste[poste.key]?.length > 0) {
      onzePopulaire[poste.key] = statsByPoste[poste.key][0].joueur?.id
    }
  }

  const zones = [...new Set(formConfig.postes.map(p => p.zone))].sort((a, b) => b - a)

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trophy size={14} /> 11 du groupe ({nbReponses} réponse{nbReponses > 1 ? 's' : ''})
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {Object.keys(FORMATIONS).map(f => (
            <button key={f} onClick={() => setActiveFormation(f)} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontWeight: 600,
              border: `1px solid ${activeFormation === f ? 'var(--primary)' : 'var(--border)'}`,
              background: activeFormation === f ? 'var(--primary-bg)' : 'transparent',
              color: activeFormation === f ? 'var(--primary)' : 'var(--text-muted)',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Terrain avec 11 populaire */}
      <div style={{ background: 'linear-gradient(180deg, #2d7a27 0%, #3a9e32 100%)', borderRadius: 10, padding: '10px 6px', marginBottom: 12 }}>
        {zones.map(zone => {
          const postesZone = formConfig.postes.filter(p => p.zone === zone)
          return (
            <div key={zone} style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
              {postesZone.map(poste => {
                const joueurId = onzePopulaire[poste.key]
                const joueur = joueurs.find(j => j.id === joueurId)
                const stats = statsByPoste[poste.key] || []
                const pct = stats[0]?.pct || 0
                const isSelected = showPosteStats === poste.key
                return (
                  <div key={poste.key} onClick={() => setShowPosteStats(isSelected ? null : poste.key)}
                    style={{ width: 58, textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', margin: '0 auto 3px',
                      background: joueur ? 'var(--primary)' : 'rgba(255,255,255,.15)',
                      border: isSelected ? '2.5px solid #FFD700' : '2px solid rgba(255,255,255,.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', position: 'relative'
                    }}>
                      {joueur?.photo_url
                        ? <img src={joueur.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: joueur ? 9 : 16, color: '#fff', fontWeight: 700 }}>
                            {joueur ? `${joueur.nom[0]}${joueur.prenom[0]}` : '?'}
                          </span>
                      }
                    </div>
                    <p style={{ fontSize: 8, color: '#fff', fontWeight: 600, lineHeight: 1.2 }}>
                      {joueur ? joueur.nom.slice(0, 7) : poste.label}
                    </p>
                    {pct > 0 && (
                      <p style={{ fontSize: 8, color: '#FFD700', fontWeight: 700 }}>{pct}%</p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Détail poste sélectionné */}
      {showPosteStats && statsByPoste[showPosteStats]?.length > 0 && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            {formConfig.postes.find(p => p.key === showPosteStats)?.label} — détail des votes
          </p>
          {statsByPoste[showPosteStats].map(({ joueur, nb, pct }, i) => joueur ? (
            <div key={joueur.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, width: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: i === 0 ? 700 : 400 }}>{joueur.nom} {joueur.prenom}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 60, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', minWidth: 32 }}>{pct}%</span>
              </div>
            </div>
          ) : null)}
        </div>
      )}

      <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
        Clique sur un poste pour voir le détail des votes
      </p>
    </Card>
  )
}

const COULEURS = ['#FFDD57','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD','#F0B27A','#BB8FCE','#85C1E9','#F8C471','#82E0AA']

export default function FunPage() {
  const { profile, isCoach, isAdjoint } = useAuth()
  const [activeTab, setActiveTab] = useState('onze')
  const [joueurs, setJoueurs] = useState([])
  const [loading, setLoading] = useState(true)

  // 11 idéal
  const [formation, setFormation] = useState('4-4-2')
  const [monOnze, setMonOnze] = useState({})
  const [onzeSaved, setOnzeSaved] = useState(false)
  const [selectingPoste, setSelectingPoste] = useState(null)
  const [statsOnze, setStatsOnze] = useState({})
  const [tousLesOnze, setTousLesOnze] = useState([])

  // Pronostics
  const [matchs, setMatchs] = useState([])
  const [mesPronostics, setMesPronostics] = useState({})
  const [scoreInputs, setScoreInputs] = useState({})
  const [savingProno, setSavingProno] = useState(null)
  const [classementPronos, setClassementPronos] = useState([])

  useEffect(() => { loadAll() }, [profile?.id])

  async function loadAll() {
    if (!profile?.id) return
    setLoading(true)
    const [{ data: jrs }, { data: evs }, { data: mesOnzeData }, { data: tousOnze }, { data: mesPronos }, { data: tousStats }] = await Promise.all([
      supabase.from('joueurs').select('id, nom, prenom, poste, photo_url').order('nom'),
      supabase.from('evenements').select('*').eq('type', 'match').gte('date_heure', new Date().toISOString()).order('date_heure').limit(5),
      supabase.from('onze_ideal').select('*').eq('joueur_id', profile.id).maybeSingle(),
      supabase.from('onze_ideal').select('selections, formation, joueur_id'),
      supabase.from('pronostics').select('*').eq('joueur_id', profile.id),
      supabase.from('pronostics').select('*, joueurs(nom,prenom)'),
    ])
    setJoueurs(jrs || [])
    setMatchs(evs || [])
    setTousLesOnze(tousOnze || [])

    if (mesOnzeData?.selections) {
      setMonOnze(mesOnzeData.selections)
      if (mesOnzeData.formation) setFormation(mesOnzeData.formation)
    }

    // Stats 11 agrégé
    const counts = {}
    for (const onze of (tousOnze || [])) {
      if (!onze.selections) continue
      for (const [poste, joueurId] of Object.entries(onze.selections)) {
        if (!counts[joueurId]) counts[joueurId] = { total: 0 }
        counts[joueurId].total++
      }
    }
    setStatsOnze(counts)

    // Mes pronostics
    const myProMap = {}
    const inputMap = {}
    for (const p of (mesPronos || [])) {
      myProMap[p.evenement_id] = p
      inputMap[p.evenement_id] = { dom: p.score_domicile?.toString() || '', ext: p.score_exterieur?.toString() || '' }
    }
    setMesPronostics(myProMap)
    setScoreInputs(inputMap)

    // Classement pronostics
    const scoreMap = {}
    for (const p of (tousStats || [])) {
      if (!p.score_points) continue
      const jId = p.joueur_id
      if (!scoreMap[jId]) scoreMap[jId] = { nom: p.joueurs?.nom, prenom: p.joueurs?.prenom, pts: 0, nb: 0 }
      scoreMap[jId].pts += p.score_points
      scoreMap[jId].nb++
    }
    setClassementPronos(Object.values(scoreMap).sort((a, b) => b.pts - a.pts))
    setLoading(false)
  }

  async function saveOnze() {
    const postes = FORMATIONS[formation].postes
    if (Object.keys(monOnze).length < postes.length) return
    const { data: existing } = await supabase.from('onze_ideal').select('id').eq('joueur_id', profile.id).maybeSingle()
    const payload = { joueur_id: profile.id, selections: monOnze, formation }
    if (existing?.id) {
      await supabase.from('onze_ideal').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('onze_ideal').insert(payload)
    }
    setOnzeSaved(true)
    setTimeout(() => setOnzeSaved(false), 2000)
    loadAll()
  }

  async function saveProno(eventId) {
    const input = scoreInputs[eventId] || {}
    if (input.dom === '' || input.ext === '') return
    setSavingProno(eventId)
    const payload = {
      joueur_id: profile.id,
      evenement_id: eventId,
      score_domicile: parseInt(input.dom),
      score_exterieur: parseInt(input.ext)
    }
    const existing = mesPronostics[eventId]
    if (existing?.id) {
      await supabase.from('pronostics').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('pronostics').insert(payload)
    }
    setMesPronostics(p => ({ ...p, [eventId]: payload }))
    setSavingProno(null)
  }

  const formationConfig = FORMATIONS[formation]
  const zones = [...new Set(formationConfig.postes.map(p => p.zone))].sort((a, b) => b - a)
  const nbPostes = formationConfig.postes.length
  const topChoisis = joueurs.filter(j => statsOnze[j.id]).sort((a, b) => (statsOnze[b.id]?.total || 0) - (statsOnze[a.id]?.total || 0)).slice(0, 5)

  // 11 le plus populaire pour le coach
  const onzePopulaire = (() => {
    if (tousLesOnze.length === 0) return null
    const scoreMap = {}
    for (const onze of tousLesOnze) {
      if (!onze.selections) continue
      for (const [poste, joueurId] of Object.entries(onze.selections)) {
        const key = `${poste}-${joueurId}`
        scoreMap[key] = (scoreMap[key] || 0) + 1
      }
    }
    // Pour chaque poste, prendre le joueur le plus voté
    const best = {}
    const formRef = tousLesOnze.find(o => o.formation)?.formation || '4-4-2'
    const postes = FORMATIONS[formRef]?.postes || FORMATIONS['4-4-2'].postes
    for (const p of postes) {
      let max = 0; let bestJ = null
      for (const onze of tousLesOnze) {
        const jId = onze.selections?.[p.key]
        if (!jId) continue
        const count = scoreMap[`${p.key}-${jId}`] || 0
        if (count > max) { max = count; bestJ = jId }
      }
      if (bestJ) best[p.key] = bestJ
    }
    return { selections: best, formation: formRef }
  })()

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Gamepad2 size={18} color={'var(--primary)'} /> Fun & Jeux
      </h1>

      {/* VUE COACH DÉDIÉE */}
      {(isCoach || isAdjoint) && (
        <CoachOnzeView joueurs={joueurs} tousLesOnze={tousLesOnze} statsOnze={statsOnze} />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['onze', Trophy, 'Mon 11 idéal'], ['pronos', Target, 'Pronostics']].map(([key, Icon, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${activeTab === key ? 'var(--primary)' : 'var(--border)'}`,
            background: activeTab === key ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === key ? 'var(--primary)' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}><Icon size={13} /> {label}</button>
        ))}
      </div>

      {/* === MON 11 IDÉAL === */}
      {activeTab === 'onze' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} /> Mon 11 idéal FC PCL</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>Choisis ta formation et compose ton 11 de rêve.</p>

            {/* Choix formation */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {Object.keys(FORMATIONS).map(f => (
                <button key={f} onClick={() => { setFormation(f); setMonOnze({}) }} style={{
                  padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                  border: `1.5px solid ${formation === f ? 'var(--primary)' : 'var(--border)'}`,
                  background: formation === f ? 'var(--primary-bg)' : 'transparent',
                  color: formation === f ? 'var(--primary)' : 'var(--text-secondary)',
                }}>{f}</button>
              ))}
            </div>

            {/* Terrain */}
            <div style={{ background: 'linear-gradient(180deg, #2d7a27 0%, #3a9e32 100%)', borderRadius: 12, padding: '12px 8px', marginBottom: 12, minHeight: 280 }}>
              {zones.map(zone => {
                const postesZone = formationConfig.postes.filter(p => p.zone === zone)
                return (
                  <div key={zone} style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 10 }}>
                    {postesZone.map(poste => {
                      const joueurId = monOnze[poste.key]
                      const joueur = joueurs.find(j => j.id === joueurId)
                      const isSelecting = selectingPoste === poste.key
                      return (
                        <div key={poste.key} onClick={() => setSelectingPoste(isSelecting ? null : poste.key)}
                          style={{ width: 58, textAlign: 'center', cursor: 'pointer' }}>
                          <div style={{
                            width: 42, height: 42, borderRadius: '50%', margin: '0 auto 3px',
                            background: joueur ? 'var(--primary)' : 'rgba(255,255,255,.2)',
                            border: isSelecting ? '2.5px solid #FFD700' : '2px solid rgba(255,255,255,.4)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', boxShadow: isSelecting ? '0 0 8px #FFD700' : 'none'
                          }}>
                            {joueur?.photo_url
                              ? <img src={joueur.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: joueur ? 9 : 18, color: '#fff', fontWeight: 700 }}>
                                  {joueur ? `${joueur.nom[0]}${joueur.prenom[0]}` : '+'}
                                </span>
                            }
                          </div>
                          <p style={{ fontSize: 8, color: '#fff', fontWeight: joueur ? 600 : 400, lineHeight: 1.2 }}>
                            {joueur ? joueur.nom.slice(0, 7) : poste.label}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Sélecteur joueur */}
            {selectingPoste && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Choisir : {formationConfig.postes.find(p => p.key === selectingPoste)?.label}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
                  {joueurs.map(j => (
                    <button key={j.id} onClick={() => {
                      setMonOnze(p => ({ ...p, [selectingPoste]: j.id }))
                      setSelectingPoste(null)
                    }} style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                      border: `1px solid ${monOnze[selectingPoste] === j.id ? 'var(--primary)' : 'var(--border)'}`,
                      background: monOnze[selectingPoste] === j.id ? 'var(--primary-bg)' : '#fff',
                      color: monOnze[selectingPoste] === j.id ? 'var(--primary)' : 'var(--text-primary)',
                    }}>
                      {j.nom} {j.prenom[0]}.
                    </button>
                  ))}
                  {monOnze[selectingPoste] && (
                    <button onClick={() => {
                      setMonOnze(p => { const n = {...p}; delete n[selectingPoste]; return n })
                      setSelectingPoste(null)
                    }} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: `1px solid ${'var(--danger-bg)'}`, background: 'var(--danger-bg)', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <X size={11} /> Retirer
                    </button>
                  )}
                </div>
              </div>
            )}

            <button onClick={saveOnze} disabled={Object.keys(monOnze).length < nbPostes}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none',
                background: Object.keys(monOnze).length >= nbPostes ? 'var(--gradient)' : 'var(--border)',
                color: Object.keys(monOnze).length >= nbPostes ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {onzeSaved ? <><CheckCircle2 size={14} /> Sauvegardé !</> : <><Save size={14} /> Valider mon 11 ({Object.keys(monOnze).length}/{nbPostes})</>}
            </button>
          </Card>

          {/* Top joueurs */}
          {topChoisis.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Award size={14} /> Les plus choisis dans le groupe</p>
              {topChoisis.map((j, i) => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{statsOnze[j.id]?.total} votes</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {/* === PRONOSTICS === */}
      {activeTab === 'pronos' && (
        <>
          {matchs.length === 0 ? (
            <Card>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                Aucun match à venir pour l'instant.
              </p>
            </Card>
          ) : matchs.map(match => {
            const monProno = mesPronostics[match.id]
            const input = scoreInputs[match.id] || { dom: '', ext: '' }
            const titre = match.titre || 'Match'
            const adversaire = titre.replace(/^vs\.?\s*/i, '').trim() || 'Adversaire'
            const domicile = match.domicile !== false ? 'FC PCL' : adversaire
            const exterieur = match.domicile !== false ? adversaire : 'FC PCL'
            return (
              <Card key={match.id}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {format(parseISO(match.date_heure), 'EEEE d MMMM', { locale: fr })}
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>{titre}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{domicile}</p>
                    <input type="number" min="0" max="20" value={input.dom}
                      onChange={e => setScoreInputs(p => ({ ...p, [match.id]: { ...p[match.id], dom: e.target.value } }))}
                      style={{ width: 64, padding: '10px 8px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 24, fontWeight: 700, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <span style={{ fontSize: 20, color: 'var(--text-muted)', fontWeight: 700 }}>—</span>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>{exterieur}</p>
                    <input type="number" min="0" max="20" value={input.ext}
                      onChange={e => setScoreInputs(p => ({ ...p, [match.id]: { ...p[match.id], ext: e.target.value } }))}
                      style={{ width: 64, padding: '10px 8px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 24, fontWeight: 700, textAlign: 'center', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button onClick={() => saveProno(match.id)} disabled={input.dom === '' || input.ext === '' || savingProno === match.id}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none',
                    background: input.dom !== '' && input.ext !== '' ? 'var(--gradient)' : 'var(--border)',
                    color: input.dom !== '' && input.ext !== '' ? '#fff' : 'var(--text-muted)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {savingProno === match.id ? <Hourglass size={13} /> : monProno ? <><Pencil size={13} /> Modifier mon pronostic</> : <><Target size={13} /> Valider mon pronostic</>}
                </button>
                {monProno && (
                  <p style={{ fontSize: 11, color: '#3B6D11', textAlign: 'center', marginTop: 6, fontWeight: 600 }}>
                    Mon prono actuel : {monProno.score_domicile} — {monProno.score_exterieur}
                  </p>
                )}
              </Card>
            )
          })}

          {classementPronos.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={14} /> Classement pronostics</p>
              {classementPronos.map((j, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                  <span style={{ fontSize: 16, width: 24 }}>{i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}</span>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{j.pts} pts</span>
                </div>
              ))}
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                Score exact = 3pts · Bonne tendance = 1pt · Mauvais = 0pt
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
