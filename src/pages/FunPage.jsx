import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const POSTES_11 = [
  { key: 'gb',  label: 'Gardien',        emoji: '🧤', zone: 'top' },
  { key: 'dd',  label: 'Défenseur D',    emoji: '🛡️', zone: 'def' },
  { key: 'dc1', label: 'Défenseur C',    emoji: '🛡️', zone: 'def' },
  { key: 'dc2', label: 'Défenseur C',    emoji: '🛡️', zone: 'def' },
  { key: 'dg',  label: 'Défenseur G',    emoji: '🛡️', zone: 'def' },
  { key: 'md',  label: 'Milieu D',       emoji: '⚙️', zone: 'mid' },
  { key: 'mc',  label: 'Milieu C',       emoji: '⚙️', zone: 'mid' },
  { key: 'mg',  label: 'Milieu G',       emoji: '⚙️', zone: 'mid' },
  { key: 'ad',  label: 'Attaquant D',    emoji: '⚡', zone: 'att' },
  { key: 'ac',  label: 'Attaquant C',    emoji: '⚡', zone: 'att' },
  { key: 'ag',  label: 'Attaquant G',    emoji: '⚡', zone: 'att' },
]

export default function FunPage() {
  const { profile, isCoach } = useAuth()
  const [activeTab, setActiveTab] = useState('onze')
  const [joueurs, setJoueurs] = useState([])
  const [loading, setLoading] = useState(true)

  // 11 idéal
  const [monOnze, setMonOnze] = useState({})
  const [onzeSaved, setOnzeSaved] = useState(false)
  const [selectingPoste, setSelectingPoste] = useState(null)
  const [statsOnze, setStatsOnze] = useState({})

  // Pronostics
  const [matchs, setMatchs] = useState([])
  const [pronostics, setPronostics] = useState({})
  const [mesPronostics, setMesPronostics] = useState({})
  const [classementPronos, setClassementPronos] = useState([])

  useEffect(() => { loadAll() }, [profile])

  async function loadAll() {
    if (!profile?.id) return
    setLoading(true)
    const [{ data: jrs }, { data: evs }, { data: mesOnzeData }, { data: tousOnze }, { data: mesPronos }, { data: tousStats }] = await Promise.all([
      supabase.from('joueurs').select('id, nom, prenom, poste, photo_url').order('nom'),
      supabase.from('evenements').select('*').eq('type', 'match').gte('date_heure', new Date().toISOString()).order('date_heure').limit(5),
      supabase.from('onze_ideal').select('*').eq('joueur_id', profile.id).maybeSingle(),
      supabase.from('onze_ideal').select('selections'),
      supabase.from('pronostics').select('*').eq('joueur_id', profile.id),
      supabase.from('pronostics').select('*, joueurs(nom,prenom)'),
    ])
    setJoueurs(jrs || [])
    setMatchs(evs || [])

    // Mon 11
    if (mesOnzeData?.selections) setMonOnze(mesOnzeData.selections)

    // Stats 11 agrégé
    const counts = {}
    for (const onze of (tousOnze || [])) {
      if (!onze.selections) continue
      for (const [poste, joueurId] of Object.entries(onze.selections)) {
        if (!counts[joueurId]) counts[joueurId] = { total: 0, postes: {} }
        counts[joueurId].total++
        counts[joueurId].postes[poste] = (counts[joueurId].postes[poste] || 0) + 1
      }
    }
    setStatsOnze(counts)

    // Mes pronostics
    const myProMap = {}
    for (const p of (mesPronos || [])) myProMap[p.evenement_id] = p
    setMesPronostics(myProMap)

    // Classement pronostics
    const scoreMap = {}
    for (const p of (tousStats || [])) {
      if (!p.score_points) continue
      const jId = p.joueur_id
      if (!scoreMap[jId]) scoreMap[jId] = { nom: p.joueurs?.nom, prenom: p.joueurs?.prenom, pts: 0, nb: 0 }
      scoreMap[jId].pts += p.score_points
      scoreMap[jId].nb++
    }
    const classement = Object.values(scoreMap).sort((a, b) => b.pts - a.pts)
    setClassementPronos(classement)

    setLoading(false)
  }

  async function saveOnze() {
    if (Object.keys(monOnze).length < 11) return
    const existing = await supabase.from('onze_ideal').select('id').eq('joueur_id', profile.id).maybeSingle()
    if (existing.data?.id) {
      await supabase.from('onze_ideal').update({ selections: monOnze }).eq('id', existing.data.id)
    } else {
      await supabase.from('onze_ideal').insert({ joueur_id: profile.id, selections: monOnze })
    }
    setOnzeSaved(true)
    setTimeout(() => setOnzeSaved(false), 2000)
    loadAll()
  }

  async function saveProno(eventId, domicile, exterieur) {
    const existing = mesPronostics[eventId]
    const payload = { joueur_id: profile.id, evenement_id: eventId, score_domicile: domicile, score_exterieur: exterieur }
    if (existing?.id) {
      await supabase.from('pronostics').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('pronostics').insert(payload)
    }
    setMesPronostics(p => ({ ...p, [eventId]: { ...payload } }))
  }

  const jTop = joueurs.filter(j => j.id !== profile?.id) // exclure soi-même optionnel
  const topChoisis = Object.values(statsOnze).length > 0
    ? joueurs.filter(j => statsOnze[j.id]).sort((a, b) => (statsOnze[b.id]?.total || 0) - (statsOnze[a.id]?.total || 0)).slice(0, 5)
    : []

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>🎮 Fun & Jeux</h1>

      {/* VUE COACH - résumé agrégé */}
      {isCoach && (
        <div style={{ background: '#E6F1FB', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: THEME.primary, marginBottom: 10 }}>👁️ Vue coach — résultats agrégés</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: THEME.primary }}>{Object.values(statsOnze).reduce((s, v) => s + v.total, 0)}</p>
              <p style={{ fontSize: 10, color: '#6B7280' }}>11 complétés</p>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: 10, textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#3B6D11' }}>{Object.keys(mesPronostics).length}</p>
              <p style={{ fontSize: 10, color: '#6B7280' }}>Mes pronostics</p>
            </div>
          </div>
          {topChoisis.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>🏅 Top 3 les plus choisis en 11 idéal :</p>
              {topChoisis.slice(0,3).map((j, i) => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{['🥇','🥈','🥉'][i]}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{j.nom} {j.prenom}</span>
                  <span style={{ fontSize: 11, color: THEME.primary, fontWeight: 700 }}>{statsOnze[j.id]?.total} sélections</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[['onze', '🏆 Mon 11 idéal'], ['pronos', '🎯 Pronostics']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: `1.5px solid ${activeTab === key ? THEME.primary : '#E5E7EB'}`,
            background: activeTab === key ? '#E6F1FB' : 'transparent',
            color: activeTab === key ? THEME.primary : '#6B7280',
          }}>{label}</button>
        ))}
      </div>

      {/* === MON 11 IDÉAL === */}
      {activeTab === 'onze' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>🏆 Mon 11 idéal FC PCL</p>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>Compose ton équipe de rêve parmi les joueurs du groupe. Clique sur un poste pour choisir.</p>

            {/* Terrain */}
            <div style={{ background: 'linear-gradient(180deg, #2d7a27 0%, #3a9e32 100%)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              {[
                { zone: 'att', postes: ['ag', 'ac', 'ad'] },
                { zone: 'mid', postes: ['mg', 'mc', 'md'] },
                { zone: 'def', postes: ['dg', 'dc1', 'dc2', 'dd'] },
                { zone: 'top', postes: ['gb'] },
              ].map(({ zone, postes }) => (
                <div key={zone} style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                  {postes.map(posteKey => {
                    const poste = POSTES_11.find(p => p.key === posteKey)
                    const joueurId = monOnze[posteKey]
                    const joueur = joueurs.find(j => j.id === joueurId)
                    return (
                      <div key={posteKey} onClick={() => setSelectingPoste(posteKey)}
                        style={{ width: 60, textAlign: 'center', cursor: 'pointer' }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', margin: '0 auto 4px',
                          background: joueur ? THEME.primary : 'rgba(255,255,255,.2)',
                          border: selectingPoste === posteKey ? '2px solid #FFD700' : '2px solid rgba(255,255,255,.4)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden'
                        }}>
                          {joueur?.photo_url
                            ? <img src={joueur.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ fontSize: joueur ? 10 : 16 }}>{joueur ? `${joueur.nom[0]}${joueur.prenom[0]}` : '+'}</span>
                          }
                        </div>
                        <p style={{ fontSize: 9, color: '#fff', fontWeight: joueur ? 600 : 400 }}>
                          {joueur ? joueur.nom.slice(0, 8) : poste?.label}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Sélecteur joueur */}
            {selectingPoste && (
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                  Choisir pour : {POSTES_11.find(p => p.key === selectingPoste)?.label}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {joueurs.map(j => (
                    <button key={j.id} onClick={() => {
                      setMonOnze(p => ({ ...p, [selectingPoste]: j.id }))
                      setSelectingPoste(null)
                    }} style={{
                      padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                      border: `1px solid ${monOnze[selectingPoste] === j.id ? THEME.primary : '#E5E7EB'}`,
                      background: monOnze[selectingPoste] === j.id ? '#E6F1FB' : '#fff',
                      color: monOnze[selectingPoste] === j.id ? THEME.primary : '#374151',
                    }}>
                      {j.nom} {j.prenom[0]}.
                    </button>
                  ))}
                  {monOnze[selectingPoste] && (
                    <button onClick={() => {
                      setMonOnze(p => { const n = {...p}; delete n[selectingPoste]; return n })
                      setSelectingPoste(null)
                    }} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', border: '1px solid #FCEBEB', background: '#FCEBEB', color: '#A32D2D' }}>
                      ✕ Effacer
                    </button>
                  )}
                </div>
              </div>
            )}

            <button onClick={saveOnze} disabled={Object.keys(monOnze).length < 11}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none',
                background: Object.keys(monOnze).length >= 11 ? THEME.gradient : '#E5E7EB',
                color: Object.keys(monOnze).length >= 11 ? '#fff' : '#9CA3AF',
                fontSize: 13, fontWeight: 700, cursor: Object.keys(monOnze).length >= 11 ? 'pointer' : 'not-allowed' }}>
              {onzeSaved ? '✅ Sauvegardé !' : `💾 Valider mon 11 (${Object.keys(monOnze).length}/11)`}
            </button>
          </Card>

          {/* Top joueurs les plus choisis */}
          {topChoisis.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🏅 Les plus choisis par le groupe</p>
              {topChoisis.map((j, i) => (
                <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  <span style={{ fontSize: 12, color: THEME.primary, fontWeight: 700 }}>{statsOnze[j.id]?.total} votes</span>
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
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                Aucun match à venir pour pronostiquer.
              </p>
            </Card>
          ) : (
            matchs.map(match => {
              const monProno = mesPronostics[match.id]
              const titre = match.titre || 'Match'
              const parts = titre.split(' - ')
              const domicile = parts[0] || 'FC PCL'
              const exterieur = parts[1] || 'Adversaire'
              const [scoreDom, setScoreDom] = useState(monProno?.score_domicile ?? '')
              const [scoreExt, setScoreExt] = useState(monProno?.score_exterieur ?? '')

              return (
                <Card key={match.id}>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
                    {format(parseISO(match.date_heure), 'EEEE d MMMM', { locale: fr })}
                  </p>
                  <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>{titre}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{domicile}</p>
                      <input type="number" min="0" max="20" value={scoreDom}
                        onChange={e => setScoreDom(e.target.value)}
                        style={{ width: 60, padding: '10px 8px', border: '2px solid #E5E7EB', borderRadius: 10, fontSize: 22, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                    </div>
                    <span style={{ fontSize: 20, color: '#9CA3AF', fontWeight: 700 }}>—</span>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>{exterieur}</p>
                      <input type="number" min="0" max="20" value={scoreExt}
                        onChange={e => setScoreExt(e.target.value)}
                        style={{ width: 60, padding: '10px 8px', border: '2px solid #E5E7EB', borderRadius: 10, fontSize: 22, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                    </div>
                  </div>
                  <button onClick={() => saveProno(match.id, parseInt(scoreDom), parseInt(scoreExt))}
                    disabled={scoreDom === '' || scoreExt === ''}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: 'none',
                      background: scoreDom !== '' && scoreExt !== '' ? THEME.gradient : '#E5E7EB',
                      color: scoreDom !== '' && scoreExt !== '' ? '#fff' : '#9CA3AF',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {monProno ? '✏️ Modifier mon pronostic' : '🎯 Valider mon pronostic'}
                  </button>
                  {monProno && (
                    <p style={{ fontSize: 11, color: '#3B6D11', textAlign: 'center', marginTop: 6 }}>
                      Mon prono : {monProno.score_domicile} — {monProno.score_exterieur}
                    </p>
                  )}
                </Card>
              )
            })
          )}

          {/* Classement pronostics */}
          {classementPronos.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>🏆 Classement pronostics</p>
              {classementPronos.map((j, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                  <span style={{ fontSize: 16, width: 24 }}>{i < 3 ? ['🥇','🥈','🥉'][i] : `${i+1}.`}</span>
                  <p style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  <span style={{ fontSize: 12, color: THEME.primary, fontWeight: 700 }}>{j.pts} pts</span>
                </div>
              ))}
              <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8 }}>
                Exact : 3pts · Bonne tendance : 1pt · Faux : 0pt
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
