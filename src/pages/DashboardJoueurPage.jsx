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
  const [nbRpeAFaire, setNbRpeAFaire] = useState(0)
  const [nbFootAFaire, setNbFootAFaire] = useState(0)

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
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(20),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(20),
      supabase.from('presences').select('*, evenements(titre,date_heure,type)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(50),
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

    const rpeIds = new Set((rpesFaits || []).map(r => r.evenement_id))
    const footIds = new Set((footFaits || []).map(f => f.evenement_id))
    const aFaire = (evs || []).filter(e => !rpeIds.has(e.id) || !footIds.has(e.id))
    setEventsAFaire(aFaire)
    setNbRpeAFaire((evs || []).filter(e => new Date(e.date_heure) < new Date() && !rpeIds.has(e.id)).length)
    setNbFootAFaire((evs || []).filter(e => new Date(e.date_heure) < new Date() && !footIds.has(e.id)).length)

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // ===== CALCULS =====

  // RPE moyen saison
  const rpeVals = rpeHistory.map(r => {
    const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    return items.length ? items.reduce((a,b) => a+b,0)/items.length : null
  }).filter(v => v !== null)
  const rpeMoySaison = rpeVals.length ? (rpeVals.reduce((a,b) => a+b,0)/rpeVals.length).toFixed(1) : '—'

  // Stats match
  const totalMatchs = statsHistory.length
  const totalButs = statsHistory.reduce((s,r) => s+(r.buts||0), 0)
  const totalPD = statsHistory.reduce((s,r) => s+(r.passes_decisives||0), 0)

  // Temps de jeu moyen (matchs uniquement)
  const tempsJeuVals = statsHistory.map(s => s.temps_jeu).filter(v => v != null && v > 0)
  const tempsJeuMoy = tempsJeuVals.length ? Math.round(tempsJeuVals.reduce((a,b) => a+b,0)/tempsJeuVals.length) : '—'

  // Présences sur ENTRAÎNEMENTS uniquement
  const presencesEntrainement = presences.filter(p => p.evenements?.type === 'seance')
  const presentsEntrainement = presencesEntrainement.filter(p => p.statut === 'present').length
  const tauxPresenceEntrainement = presencesEntrainement.length
    ? Math.round(presentsEntrainement / presencesEntrainement.length * 100)
    : '—'

  // Distance moyenne entraînement vs match
  const footEntrainement = footHistory.filter(f => f.evenements?.type === 'seance')
  const footMatch = footHistory.filter(f => f.evenements?.type === 'match')
  const distMoyEntrainement = footEntrainement.length
    ? (footEntrainement.reduce((s,f) => s+(f.distance_km||0), 0)/footEntrainement.length).toFixed(1)
    : '—'
  const distMoyMatch = footMatch.length
    ? (footMatch.reduce((s,f) => s+(f.distance_km||0), 0)/footMatch.length).toFixed(1)
    : '—'

  // Courbe RPE 6 dernières sessions
  const rpeParSession = rpeHistory.slice(0,6).reverse().map(r => {
    const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    const avg = items.length ? items.reduce((a,b) => a+b,0)/items.length : 0
    return {
      value: parseFloat(avg.toFixed(1)),
      label: r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd/M', { locale: fr }) : '',
      type: r.evenements?.type
    }
  })

  const W = 280, H = 80, PAD = 16
  function xPos(i, total) { return PAD + (i/Math.max(total-1,1))*(W-PAD*2) }
  function yPos(v) { return H - PAD - ((v/5)*(H-PAD*2)) }

  const blessureActive = blessures.find(b => !b.date_retour_effective)

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
                <span style={{ fontSize: 11, color: '#FCA5A5' }}>🤕 {blessureActive.zone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ALERTES */}
      {(eventsAFaire.length > 0 || blessureActive) && (
        <Card style={{ marginBottom: 14, background: '#FDF5EE', border: '0.5px solid #F5C4B3' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#854F0B', marginBottom: 8 }}>⚠️ À faire</p>
          {eventsAFaire.length > 0 && (
            <div onClick={() => navigate('/mon-rpe')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: blessureActive ? '0.5px solid #F3F4F6' : 'none', cursor: 'pointer' }}>
              <span style={{ fontSize: 12 }}>📝 {eventsAFaire.length} RPE / Footbar à remplir</span>
              <span style={{ fontSize: 11, color: THEME.primary }}>→</span>
            </div>
          )}
          {blessureActive && (
            <div style={{ padding: '6px 0' }}>
              <span style={{ fontSize: 12 }}>🤕 Blessure en cours — {blessureActive.zone}</span>
            </div>
          )}
        </Card>
      )}

      {/* STATS RAPIDES — sans RPE moyen, avec temps de jeu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { label: 'Matchs', value: totalMatchs, color: THEME.primary },
          { label: 'Buts', value: totalButs, color: '#3B6D11' },
          { label: 'Tps jeu moy.', value: tempsJeuMoy !== '—' ? `${tempsJeuMoy}\'` : '—', color: THEME.primary },
          { label: 'Présence entr.', value: tauxPresenceEntrainement !== '—' ? `${tauxPresenceEntrainement}%` : '—', color: tauxPresenceEntrainement >= 80 ? '#3B6D11' : '#D85A30' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* RACCOURCIS RPE + FOOTBAR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div onClick={() => navigate('/mon-rpe')} style={{
          background: THEME.gradient, borderRadius: 14, padding: '12px 14px',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>❤️ Mon RPE</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
              {nbRpeAFaire > 0 ? `${nbRpeAFaire} à compléter` : 'À jour ✅'}
            </p>
          </div>
          <span style={{ fontSize: 18, color: '#fff' }}>→</span>
        </div>
        <div onClick={() => navigate('/mon-footbar')} style={{
          background: '#1A3A6B', borderRadius: 14, padding: '12px 14px',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>📡 Footbar</p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>
              {nbFootAFaire > 0 ? `${nbFootAFaire} à compléter` : 'À jour ✅'}
            </p>
          </div>
          <span style={{ fontSize: 18, color: '#fff' }}>→</span>
        </div>
      </div>

      {/* COURBE RPE */}
      {rpeParSession.length >= 2 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>❤️ Mon RPE — évolution</p>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
            <line x1={PAD} y1={yPos(2.5)} x2={W-PAD} y2={yPos(2.5)} stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4,4" />
            <polyline
              points={rpeParSession.map((d,i) => `${xPos(i,rpeParSession.length)},${yPos(d.value)}`).join(' ')}
              fill="none" stroke={rpeColor(parseFloat(rpeMoySaison))} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {rpeParSession.map((d,i) => (
              <g key={i}>
                <circle cx={xPos(i,rpeParSession.length)} cy={yPos(d.value)} r="4"
                  fill={d.type === 'match' ? '#1A3A6B' : rpeColor(d.value)} />
                <text x={xPos(i,rpeParSession.length)} y={yPos(d.value)-8} textAnchor="middle" fontSize="9" fill="#6B7280">{d.value}</text>
              </g>
            ))}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>
            {rpeParSession.map((d,i) => <span key={i}>{d.label} {d.type === 'match' ? '⚽' : ''}</span>)}
          </div>
        </Card>
      )}

      {/* FOOTBAR — km moyen entraînement vs match */}
      {footHistory.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📡 Distance parcourue</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#EAF3DE', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#3B6D11' }}>{distMoyEntrainement} <span style={{ fontSize: 12 }}>km</span></div>
              <div style={{ fontSize: 10, color: '#3B6D11', marginTop: 2 }}>🏃 Moy. entraînement</div>
            </div>
            <div style={{ background: '#E6F1FB', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: THEME.primary }}>{distMoyMatch} <span style={{ fontSize: 12 }}>km</span></div>
              <div style={{ fontSize: 10, color: THEME.primary, marginTop: 2 }}>⚽ Moy. match</div>
            </div>
          </div>
        </Card>
      )}

      {/* PRÉSENCES ENTRAÎNEMENTS */}
      {presencesEntrainement.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📅 Présences entraînements</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {presencesEntrainement.slice(0,10).map((p,i) => (
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
          <div style={{ display: 'flex', gap: 12, fontSize: 11, borderTop: '0.5px solid #F3F4F6', paddingTop: 8 }}>
            <span style={{ color: '#3B6D11' }}>✅ {presentsEntrainement}</span>
            <span style={{ color: '#A32D2D' }}>❌ {presencesEntrainement.filter(p => p.statut === 'absent').length}</span>
            <span style={{ color: '#9CA3AF' }}>· {tauxPresenceEntrainement}% de présence</span>
          </div>
        </Card>
      )}

      {/* OBJECTIFS */}
      {objectifs.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>🎯 Mes objectifs</p>
          {objectifs.slice(0,3).map(o => {
            const progress = o.valeur_cible && o.valeur_actuelle
              ? Math.min(100, Math.round(o.valeur_actuelle/o.valeur_cible*100))
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
              </div>
            )
          })}
        </Card>
      )}

      {/* Navigation rapide */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
        {[
          { label: '📅 Agenda', path: '/calendrier' },
          { label: '👤 Ma fiche', path: '/ma-fiche' },
          { label: '💬 Messages', path: '/messages' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            padding: 10, background: '#fff', border: '0.5px solid #E5E7EB',
            borderRadius: 12, fontSize: 12, color: THEME.primary,
            fontWeight: 500, cursor: 'pointer', textAlign: 'center'
          }}>{item.label}</button>
        ))}
      </div>
    </div>
  )
}
