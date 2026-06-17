import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'

const BADGE_DEFS = [
  // Présences
  { id: 'presence_5',   icon: '🔥', label: '5 séances de suite',    desc: 'Présent à 5 entraînements consécutifs', category: 'présence', condition: (s) => s.seriePresences >= 5 },
  { id: 'presence_10',  icon: '⚡', label: '10 séances de suite',   desc: 'Présent à 10 entraînements consécutifs', category: 'présence', condition: (s) => s.seriePresences >= 10 },
  { id: 'presence_100', icon: '💯', label: '100% présences',        desc: 'Taux de présence parfait sur la saison 2026/2027', category: 'présence', condition: (s) => s.tauxPresence >= 100 },
  { id: 'presence_80',  icon: '⭐', label: 'Assidu',                desc: '80% de présence aux entraînements', category: 'présence', condition: (s) => s.tauxPresence >= 80 },
  // Buts
  { id: 'buts_1',       icon: '⚽', label: 'Premier but',           desc: 'A marqué son premier but en match', category: 'perf', condition: (s) => s.totalButs >= 1 },
  { id: 'buts_5',       icon: '🎯', label: 'Sniper',                desc: '5 buts marqués saison 2026/2027', category: 'perf', condition: (s) => s.totalButs >= 5 },
  { id: 'buts_10',      icon: '💣', label: 'Artificier',            desc: '10 buts marqués saison 2026/2027', category: 'perf', condition: (s) => s.totalButs >= 10 },
  // Passes
  { id: 'pd_3',         icon: '🎪', label: 'Passeur',               desc: '3 passes décisives saison 2026/2027', category: 'perf', condition: (s) => s.totalPD >= 3 },
  // RPE
  { id: 'rpe_10',       icon: '📊', label: 'Analyste',              desc: '10 RPE remplis', category: 'rpe', condition: (s) => s.totalRpe >= 10 },
  { id: 'rpe_regulier', icon: '📈', label: 'Régulier',              desc: 'RPE rempli sur 5 séances consécutives', category: 'rpe', condition: (s) => s.serieRpe >= 5 },
  // Matchs
  { id: 'match_10',     icon: '🏆', label: 'Vétéran',               desc: '10 matchs joués saison 2026/2027', category: 'match', condition: (s) => s.totalMatchs >= 10 },
  { id: 'titu_5',       icon: '👑', label: 'Titulaire',             desc: '5 titularisations', category: 'match', condition: (s) => s.titularisations >= 5 },
]

export default function BadgesJoueurPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [badges, setBadges] = useState([])

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)
    const joueurId = profile.id

    const [
      { data: presences },
      { data: statsMatch },
      { data: rpe },
    ] = await Promise.all([
      supabase.from('presences').select('statut, evenements(type,date_heure)').eq('joueur_id', joueurId).order('created_at', { ascending: false }),
      supabase.from('stats_match').select('buts, passes_decisives, titulaire, evenements(match_type)').eq('joueur_id', joueurId),
      supabase.from('rpe').select('evenement_id, created_at').eq('joueur_id', joueurId).order('created_at', { ascending: false }),
    ])

    // Calcul série présences
    const presSeances = (presences || []).filter(p => p.evenements?.type === 'seance')
    let serie = 0, maxSerie = 0
    for (const p of presSeances) {
      if (p.statut === 'present' || p.statut === 'exterieur') { serie++; maxSerie = Math.max(maxSerie, serie) }
      else serie = 0
    }

    // Taux présence
    const presTotal = presSeances.length
    const presOk = presSeances.filter(p => p.statut === 'present' || p.statut === 'exterieur').length
    const tauxPresence = presTotal > 0 ? Math.round(presOk / presTotal * 100) : 0

    // Stats match (officiels seulement)
    const officiels = (statsMatch || []).filter(s => s.evenements?.match_type !== 'preparation')
    const totalButs = officiels.reduce((s, r) => s + (r.buts || 0), 0)
    const totalPD = officiels.reduce((s, r) => s + (r.passes_decisives || 0), 0)
    const totalMatchs = officiels.length
    const titularisations = officiels.filter(s => s.titulaire).length

    // Série RPE
    let serieRpe = 0
    for (const r of (rpe || [])) { serieRpe++ }
    const serieRpeConsec = Math.min(serieRpe, 10)

    const s = { seriePresences: maxSerie, tauxPresence, totalButs, totalPD, totalMatchs, titularisations, totalRpe: (rpe || []).length, serieRpe: serieRpeConsec }
    setStats(s)

    // Calcul badges débloqués
    const unlocked = BADGE_DEFS.filter(b => b.condition(s))
    setBadges(unlocked)
    setLoading(false)
  }

  const locked = BADGE_DEFS.filter(b => !badges.find(u => u.id === b.id))
  const categories = { présence: '📅 Présence', perf: '⚽ Performance', rpe: '📊 RPE', match: '🏆 Matchs' }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Mes badges</h1>
      </div>

      {/* Hero */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '16px', marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>
          {badges.length === 0 ? '🎯' : badges.length >= 8 ? '🏆' : badges.length >= 5 ? '⭐' : '🔥'}
        </div>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{badges.length} badge{badges.length > 1 ? 's' : ''} débloqué{badges.length > 1 ? 's' : ''}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>sur {BADGE_DEFS.length} disponibles</p>
        <div style={{ background: 'rgba(255,255,255,.2)', borderRadius: 8, height: 8, marginTop: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#FFD700', borderRadius: 8, width: `${badges.length / BADGE_DEFS.length * 100}%` }} />
        </div>
      </div>

      {/* Badges débloqués */}
      {badges.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>✅ Débloqués</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {badges.map(b => (
              <div key={b.id} style={{ textAlign: 'center', padding: 10, background: '#F9FAFB', borderRadius: 12, border: '1.5px solid #FFD700' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{b.icon}</div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{b.label}</p>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Badges verrouillés */}
      {locked.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#9CA3AF' }}>🔒 À débloquer</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {locked.map(b => (
              <div key={b.id} style={{ textAlign: 'center', padding: 10, background: '#F3F4F6', borderRadius: 12, border: '1px solid #E5E7EB', opacity: 0.6 }}>
                <div style={{ fontSize: 28, marginBottom: 4, filter: 'grayscale(1)' }}>{b.icon}</div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>{b.label}</p>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Stats rapides */}
      {stats && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📊 Tes stats saison 2026/2027</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              ['Série présences', `${stats.seriePresences} 🔥`],
              ['Taux présence', `${stats.tauxPresence}%`],
              ['Buts', stats.totalButs],
              ['Passes déc.', stats.totalPD],
              ['Matchs', stats.totalMatchs],
              ['RPE remplis', stats.totalRpe],
            ].map(([label, val]) => (
              <div key={label} style={{ background: '#F9FAFB', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: THEME.primary }}>{val}</div>
                <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
