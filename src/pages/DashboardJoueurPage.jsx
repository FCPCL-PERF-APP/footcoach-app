import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

function rpeColor(v) {
  if (!v) return '#9CA3AF'
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function DashboardJoueurPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueur, setJoueur] = useState(null)
  const [rpeHistory, setRpeHistory] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [presences, setPresences] = useState([])
  const [statsHistory, setStatsHistory] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [blessures, setBlessures] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])

  const joueurId = profile?.id

  useEffect(() => { if (joueurId) loadAll() }, [joueurId])

  async function loadAll() {
    setLoading(true)
    const since = subDays(new Date(), 60).toISOString()

    const [
      { data: j },
      { data: rpe },
      { data: foot },
      { data: pres },
      { data: stats },
      { data: obj },
      { data: bless },
      { data: evs },
      { data: rpesFaits },
      { data: footFaits },
    ] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', joueurId).single(),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(8),
      supabase.from('footbar').select('*, evenements(titre,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(5),
      supabase.from('presences').select('*, evenements(titre,date_heure,type)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(20),
      supabase.from('stats_match').select('*, evenements(titre,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(15),
      supabase.from('objectifs').select('*')
        .eq('joueur_id', joueurId).eq('statut', 'en_cours').order('date_echeance', { ascending: true }),
      supabase.from('blessures').select('*')
        .eq('joueur_id', joueurId).order('date_debut', { ascending: false }).limit(3),
      supabase.from('evenements').select('*')
        .lte('date_heure', new Date().toISOString())
        .gte('date_heure', since)
        .order('date_heure', { ascending: false }),
      supabase.from('rpe').select('evenement_id').eq('joueur_id', joueurId),
      supabase.from('footbar').select('evenement_id').eq('joueur_id', joueurId),
    ])

    setJoueur(j)
    setRpeHistory(rpe || [])
    setFootHistory(foot || [])
    setPresences(pres || [])
    setStatsHistory(stats || [])
    setObjectifs(obj || [])
    setBlessures(bless || [])

    // Calcule événements sans RPE ou Footbar
    const rpeIds = new Set((rpesFaits || []).map(r => r.evenement_id))
    const footIds = new Set((footFaits || []).map(f => f.evenement_id))
    const aFaire = (evs || []).filter(e => !rpeIds.has(e.id) || !footIds.has(e.id))
    setEventsAFaire(aFaire)

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // Calculs
  const rpeMoySaison = rpeHistory.length ? (() => {
    const vals = rpeHistory.map(r => {
      const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
      return items.length ? items.reduce((a,b) => a+b, 0) / items.length : null
    }).filter(v => v !== null)
    return vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : '—'
  })() : '—'

  const totalMatchs = statsHistory.length
  const totalButs = statsHistory.reduce((s, r) => s + (r.buts || 0), 0)
  const totalPD = statsHistory.reduce((s, r) => s + (r.passes_decisives || 0), 0)
  const presentsCount = presences.filter(p => p.statut === 'present').length
  const tauxPresence = presences.length ? Math.round(presentsCount / presences.length * 100) : 0

  const blessureActive = blessures.find(b => !b.date_retour_effective)
  const rpeParSession = rpeHistory.slice(0, 6).reverse().map(r => {
    const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    const avg = items.length ? items.reduce((a,b) => a+b, 0) / items.length : 0
    return { value: parseFloat(avg.toFixed(1)), label: r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd/M', { locale: fr }) : '' }
  })

  const W = 280, H = 80, PAD = 16
  function xPos(i, total) { return PAD + (i / Math.max(total - 1, 1)) * (W - PAD * 2) }
  function yPos(v) { return H - PAD - ((v / 5) * (H - PAD * 2)) }

  return (
    <div style={{ padding: 12 }}>

      {/* HERO */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '16px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {joueur?.photo_url
            ? <img src={joueur.photo_url} alt={joueur.nom} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.4)' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {joueur?.nom?.[0]}{joueur?.prenom?.[0]}
              </div>
          }
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{joueur?.nom} {joueur?.prenom}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
              {joueur?.poste || '—'} {joueur?.numero ? `· N°${joueur.numero}` : ''} {joueur?.groupe ? `· Pôle ${joueur.groupe}` : ''}
            </p>
            {blessureActive && (
              <div style={{ marginTop: 4, background: 'rgba(163,45,45,.3)', borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>
                <span style={{ fontSize: 11, color: '#FCA5A5' }}>🤕 Blessure en cours — {blessureActive.zone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ALERTES */}
      {(eventsAFaire.length > 0 || blessureActive || objectifs.some(o => o.date_echeance && new Date(o.date_echeance) < new Date(Date.now() + 7*24*60*60*1000))) && (
        <Card style={{ marginBottom: 14, background: '#FDF5EE', border: '0.5px solid #F5C4B3' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#854F0B', marginBottom: 8 }}>⚠️ À faire</p>
          {eventsAFaire.length > 0 && (
            <div onClick={() => navigate('/mon-rpe')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}>
              <span style={{ fontSize: 12 }}>📝 {eventsAFaire.length} RPE / Footbar à remplir</span>
              <span style={{ fontSize: 11, color: THEME.primary }}>→</span>
            </div>
          )}
          {blessureActive && (
            <div style={{ padding: '6px 0', borderBottom: '0.5px solid #F3F4F6' }}>
              <span style={{ fontSize: 12 }}>🤕 Blessure en cours — {blessureActive.zone} ({blessureActive.type_blessure})</span>
            </div>
          )}
          {objectifs.filter(o => o.date_echeance && new Date(o.date_echeance) < new Date(Date.now() + 7*24*60*60*1000)).map(o => (
            <div key={o.id} style={{ padding: '6px 0' }}>
              <span style={{ fontSize: 12 }}>🎯 Objectif proche : {o.titre}</span>
            </div>
          ))}
        </Card>
      )}

      {/* STATS RAPIDES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { label: 'Matchs', value: totalMatchs, color: THEME.primary },
          { label: 'Buts', value: totalButs, color: '#3B6D11' },
          { label: 'Présence', value: `${tauxPresence}%`, color: tauxPresence >= 80 ? '#3B6D11' : '#D85A30' },
          { label: 'RPE moy.', value: rpeMoySaison, color: rpeColor(parseFloat(rpeMoySaison)) },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* COURBE RPE */}
      {rpeParSession.length >= 2 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>❤️ Mon RPE — évolution</p>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
            <line x1={PAD} y1={yPos(2.5)} x2={W-PAD} y2={yPos(2.5)} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4,4" />
            <polyline
              points={rpeParSession.map((d,i) => `${xPos(i, rpeParSession.length)},${yPos(d.value)}`).join(' ')}
              fill="none" stroke={rpeColor(parseFloat(rpeMoySaison))} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {rpeParSession.map((d,i) => (
              <g key={i}>
                <circle cx={xPos(i, rpeParSession.length)} cy={yPos(d.value)} r="4" fill={rpeColor(d.value)} />
                <text x={xPos(i, rpeParSession.length)} y={yPos(d.value)-8} textAnchor="middle" fontSize="9" fill="#6B7280">{d.value}</text>
              </g>
            ))}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
            {rpeParSession.map((d,i) => <span key={i}>{d.label}</span>)}
          </div>
        </Card>
      )}

      {/* PRÉSENCES RÉCENTES */}
      {presences.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📅 Mes présences récentes</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {presences.slice(0,10).map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                  background: p.statut === 'present' ? '#EAF3DE' : p.statut === 'absent' ? '#FCEBEB' : '#FAEEDA'
                }}>
                  {p.statut === 'present' ? '✅' : p.statut === 'absent' ? '❌' : '🤕'}
                </div>
                <div style={{ fontSize: 8, color: '#9CA3AF', marginTop: 2 }}>
                  {p.evenements?.date_heure ? format(parseISO(p.evenements.date_heure), 'd/M', { locale: fr }) : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid #F3F4F6', display: 'flex', gap: 12, fontSize: 11 }}>
            <span style={{ color: '#3B6D11' }}>✅ {presences.filter(p => p.statut === 'present').length}</span>
            <span style={{ color: '#A32D2D' }}>❌ {presences.filter(p => p.statut === 'absent').length}</span>
            <span style={{ color: '#854F0B' }}>🤕 {presences.filter(p => p.statut === 'blesse').length}</span>
            <span style={{ color: '#9CA3AF' }}>· {tauxPresence}% de présence</span>
          </div>
        </Card>
      )}

      {/* FOOTBAR DERNIERS */}
      {footHistory.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📡 Mon Footbar — dernières données</p>
          {footHistory.slice(0,3).map(f => (
            <div key={f.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', marginBottom: 6 }}>
                {f.evenements?.titre} · {f.evenements?.date_heure ? format(parseISO(f.evenements.date_heure), 'd MMM', { locale: fr }) : ''}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {[
                  ['Distance', f.distance_km ? `${f.distance_km}km` : '—'],
                  ['V.max', f.sprint_max ? `${f.sprint_max}km/h` : '—'],
                  ['Sprints', f.sprints ?? '—'],
                  ['Ballons', f.ballons_touches ?? '—'],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ background: '#F9FAFB', borderRadius: 8, padding: '5px 4px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: THEME.primary }}>{val}</div>
                    <div style={{ fontSize: 9, color: '#9CA3AF' }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => navigate('/mon-footbar')} style={{ width: '100%', padding: 8, background: 'transparent', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 12, color: THEME.primary, cursor: 'pointer', fontWeight: 500 }}>
            Voir tout mon Footbar →
          </button>
        </Card>
      )}

      {/* OBJECTIFS EN COURS */}
      {objectifs.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🎯 Mes objectifs en cours</p>
          {objectifs.slice(0,3).map(o => {
            const progress = o.valeur_cible && o.valeur_actuelle
              ? Math.min(100, Math.round(o.valeur_actuelle / o.valeur_cible * 100))
              : null
            return (
              <div key={o.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{o.titre}</p>
                  {progress !== null && <span style={{ fontSize: 11, fontWeight: 700, color: progress >= 100 ? '#3B6D11' : THEME.primary }}>{progress}%</span>}
                </div>
                {progress !== null && (
                  <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: progress >= 100 ? '#3B6D11' : THEME.primary, width: `${progress}%` }} />
                  </div>
                )}
                {o.date_echeance && (
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>
                    Échéance : {format(parseISO(o.date_echeance), 'd MMM yyyy', { locale: fr })}
                  </p>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {/* STATS MATCH */}
      {statsHistory.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>⚽ Mes stats match</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
            {[
              ['Matchs joués', totalMatchs],
              ['Buts', totalButs],
              ['Passes déc.', totalPD],
              ['Note moy.', statsHistory.length ? (statsHistory.reduce((s,r) => s+(r.note||0),0)/statsHistory.length).toFixed(1) : '—'],
              ['Minutes', statsHistory.reduce((s,r) => s+(r.temps_jeu||0),0)],
              ['Cartons 🟡', statsHistory.filter(s=>s.carton_jaune).length],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ background: '#F9FAFB', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{val}</div>
                <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 1 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* BLESSURES */}
      {blessures.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🤕 Historique blessures</p>
          {blessures.slice(0,3).map(b => (
            <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #F3F4F6' }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500 }}>{b.zone} · {b.type_blessure}</p>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                  {format(parseISO(b.date_debut), 'd MMM yyyy', { locale: fr })}
                  {b.date_retour_effective ? ` → ${format(parseISO(b.date_retour_effective), 'd MMM', { locale: fr })}` : ' · En cours'}
                </p>
              </div>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 8, alignSelf: 'center',
                background: b.date_retour_effective ? '#EAF3DE' : '#FCEBEB',
                color: b.date_retour_effective ? '#3B6D11' : '#A32D2D'
              }}>
                {b.date_retour_effective ? 'Guéri' : 'En cours'}
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Navigation rapide */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
        {[
          { label: '❤️ Mon RPE', path: '/mon-rpe' },
          { label: '📡 Mon Footbar', path: '/mon-footbar' },
          { label: '📅 Agenda', path: '/calendrier' },
          { label: '👤 Ma fiche', path: '/ma-fiche' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            padding: 12, background: '#fff', border: '0.5px solid #E5E7EB',
            borderRadius: 12, fontSize: 13, color: THEME.primary,
            fontWeight: 500, cursor: 'pointer', textAlign: 'center'
          }}>{item.label}</button>
        ))}
      </div>
    </div>
  )
}
