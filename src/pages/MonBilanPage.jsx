import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

function rpeColor(v) {
  if (!v) return '#9CA3AF'
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function MonBilanPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueur, setJoueur] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => { if (profile?.id) loadBilan() }, [profile])

  async function loadBilan() {
    setLoading(true)
    const [
      { data: j },
      { data: statsData },
      { data: rpeData },
      { data: presData },
      { data: footData },
      { data: objectifsData },
    ] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', profile.id).single(),
      supabase.from('stats_match').select('*, evenements(titre,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('rpe').select('*').eq('joueur_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('presences').select('statut').eq('joueur_id', profile.id),
      supabase.from('footbar').select('distance_km, sprint_max, sprints').eq('joueur_id', profile.id),
      supabase.from('objectifs').select('*').eq('joueur_id', profile.id),
    ])

    setJoueur(j)

    // Stats match
    const totalMatchs = statsData?.length || 0
    const totalButs = (statsData || []).reduce((s, r) => s + (r.buts || 0), 0)
    const totalPD = (statsData || []).reduce((s, r) => s + (r.passes_decisives || 0), 0)
    const totalMin = (statsData || []).reduce((s, r) => s + (r.temps_jeu || 0), 0)
    const noteMoy = statsData?.length ? (statsData.reduce((s, r) => s + (r.note || 0), 0) / statsData.length).toFixed(1) : '—'
    const titulaire = (statsData || []).filter(s => s.titulaire).length
    const cartons = (statsData || []).filter(s => s.carton_jaune).length

    // RPE
    const rpeVals = (rpeData || []).map(r => {
      const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
      return items.length ? items.reduce((a, b) => a + b, 0) / items.length : null
    }).filter(v => v !== null)
    const rpeMoy = rpeVals.length ? (rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1) : '—'
    const motivMoy = (() => {
      const vals = (rpeData || []).map(r => r.motivation).filter(v => v != null)
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—'
    })()

    // Présences
    const presents = (presData || []).filter(p => p.statut === 'present').length
    const tauxPresence = presData?.length ? Math.round(presents / presData.length * 100) : 0

    // Footbar
    const distances = (footData || []).map(f => f.distance_km).filter(Boolean)
    const distMoy = distances.length ? (distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1) : '—'
    const sprintMax = footData?.length ? Math.max(...(footData || []).map(f => f.sprint_max || 0)) : 0
    const totalDist = distances.length ? distances.reduce((a, b) => a + b, 0).toFixed(1) : '—'

    // Objectifs
    const objAtteints = (objectifsData || []).filter(o => o.statut === 'atteint').length
    const objTotal = (objectifsData || []).length

    setStats({
      totalMatchs, totalButs, totalPD, totalMin, noteMoy, titulaire, cartons,
      rpeMoy, motivMoy, nbRpe: rpeData?.length || 0,
      tauxPresence, presents, totalPresences: presData?.length || 0,
      distMoy, sprintMax, totalDist, nbFootbar: footData?.length || 0,
      objAtteints, objTotal
    })
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const annee = new Date().getFullYear()
  const saisonLabel = `${annee-1}/${annee}`

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>🏆 Mon bilan saison {saisonLabel}</h1>
      </div>

      {/* Hero */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '16px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          {joueur?.photo_url
            ? <img src={joueur.photo_url} alt={joueur.nom} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.4)' }} />
            : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                {joueur?.nom?.[0]}{joueur?.prenom?.[0]}
              </div>
          }
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{joueur?.nom} {joueur?.prenom}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>{joueur?.poste} {joueur?.numero ? `· N°${joueur.numero}` : ''}</p>
          </div>
        </div>
        {/* Stats clés en hero */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            { label: 'Matchs', value: stats?.totalMatchs, color: '#fff' },
            { label: 'Buts', value: stats?.totalButs, color: '#FFD700' },
            { label: 'Passes', value: stats?.totalPD, color: '#4ADE80' },
            { label: 'Présence', value: `${stats?.tauxPresence}%`, color: stats?.tauxPresence >= 80 ? '#4ADE80' : '#FCD34D' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* STATS MATCH */}
      <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>⚽ Statistiques match</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Matchs joués', value: stats?.totalMatchs, color: THEME.primary },
          { label: 'Buts', value: stats?.totalButs, color: '#3B6D11' },
          { label: 'Passes déc.', value: stats?.totalPD, color: '#3B6D11' },
          { label: 'Minutes jouées', value: stats?.totalMin, color: THEME.primary },
          { label: 'Note moyenne', value: stats?.noteMoy, color: THEME.primary },
          { label: 'Titularisations', value: stats?.titulaire, color: THEME.primary },
          { label: 'Cartons 🟡', value: stats?.cartons, color: '#BA7517' },
          { label: 'Dist. moy./match', value: stats?.distMoy ? `${stats.distMoy}km` : '—', color: THEME.primary },
          { label: 'Sprint max', value: stats?.sprintMax ? `${stats.sprintMax}km/h` : '—', color: THEME.primary },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* RPE */}
      <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>❤️ Charge & bien-être</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'RPE moyen', value: `${stats?.rpeMoy}/5`, color: rpeColor(parseFloat(stats?.rpeMoy)) },
          { label: 'Motivation moy.', value: `${stats?.motivMoy}/5`, color: rpeColor(parseFloat(stats?.motivMoy)) },
          { label: 'Sessions RPE', value: stats?.nbRpe, color: THEME.primary },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* PRÉSENCES */}
      <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>📅 Présences</p>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            border: `5px solid ${stats?.tauxPresence >= 80 ? '#3B6D11' : stats?.tauxPresence >= 60 ? '#BA7517' : '#A32D2D'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 800,
            color: stats?.tauxPresence >= 80 ? '#3B6D11' : stats?.tauxPresence >= 60 ? '#BA7517' : '#A32D2D'
          }}>
            {stats?.tauxPresence}%
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>
              {stats?.tauxPresence >= 80 ? '✅ Excellent engagement' :
               stats?.tauxPresence >= 60 ? '🟡 Présence correcte' : '🔴 Assiduité à améliorer'}
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
              {stats?.presents} présence(s) sur {stats?.totalPresences} événement(s)
            </p>
          </div>
        </div>
      </Card>

      {/* FOOTBAR */}
      {stats?.nbFootbar > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>📡 Footbar saison</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Distance totale', value: `${stats?.totalDist}km`, color: THEME.primary },
              { label: 'Dist. moy./match', value: `${stats?.distMoy}km`, color: THEME.primary },
              { label: 'Sprint max saison', value: `${stats?.sprintMax}km/h`, color: '#3B6D11' },
            ].map(s => (
              <div key={s.label} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* OBJECTIFS */}
      {stats?.objTotal > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>🎯 Objectifs</p>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700 }}>{stats?.objAtteints} / {stats?.objTotal} objectifs atteints</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                  {stats?.objAtteints === stats?.objTotal ? '🏆 Tous les objectifs accomplis !' :
                   stats?.objAtteints > 0 ? '✅ Bonne progression' : '⏳ Continue tes efforts'}
                </p>
              </div>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: `4px solid ${stats?.objAtteints === stats?.objTotal ? '#3B6D11' : THEME.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: stats?.objAtteints === stats?.objTotal ? '#3B6D11' : THEME.primary }}>
                {stats?.objTotal ? Math.round(stats.objAtteints / stats.objTotal * 100) : 0}%
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Message coach */}
      <div style={{ background: THEME.gradient, borderRadius: 12, padding: 14, textAlign: 'center' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>⚽ FC PCL — Saison {saisonLabel}</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
          Continue sur cette lancée pour la prochaine saison !
        </p>
      </div>
    </div>
  )
}
