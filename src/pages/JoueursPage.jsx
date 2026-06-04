import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner, Avatar } from '../components/UI'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

function rpeColor(v) {
  if (!v) return '#9CA3AF'
  if (v >= 4.5) return '#A32D2D'
  if (v >= 3.5) return '#D85A30'
  if (v >= 2.5) return '#BA7517'
  return '#3B6D11'
}

export default function JoueursPage() {
  const { isCoach, isAdjoint } = useAuth()
  const navigate = useNavigate()
  const [joueurs, setJoueurs] = useState([])
  const [rpeAvgs, setRpeAvgs] = useState({})
  const [search, setSearch] = useState('')
  const [filterPoste, setFilterPoste] = useState('tous')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadJoueurs() }, [])

  async function loadJoueurs() {
    const { data } = await supabase.from('joueurs').select('*').order('nom')
    setJoueurs(data || [])

    // RPE moyens récents par joueur
    const { data: rpe } = await supabase
      .from('rpe')
      .select('joueur_id, difficulte, fatigue, implication, motivation, perf_individuelle, perf_collective')
      .order('created_at', { ascending: false })

    const avgs = {}
    const counts = {}
    for (const r of (rpe || [])) {
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!avgs[r.joueur_id]) { avgs[r.joueur_id] = 0; counts[r.joueur_id] = 0 }
      avgs[r.joueur_id] += avg
      counts[r.joueur_id]++
    }
    const result = {}
    for (const id in avgs) result[id] = (avgs[id] / counts[id]).toFixed(1)
    setRpeAvgs(result)
    setLoading(false)
  }

  const postes = ['tous', ...new Set(joueurs.map(j => j.poste).filter(Boolean))]

  const filtered = joueurs.filter(j => {
    const matchSearch = !search || `${j.nom} ${j.prenom}`.toLowerCase().includes(search.toLowerCase())
    const matchPoste = filterPoste === 'tous' || j.poste === filterPoste
    return matchSearch && matchPoste
  })

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title="Joueurs"
        action={isCoach && (
          <Button variant="primary" size="sm" onClick={() => navigate('/joueurs/nouveau')}>
            + Ajouter
          </Button>
        )}
      />

      {/* Recherche */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher un joueur..."
        style={{
          width: '100%', padding: '9px 12px', marginBottom: 10,
          border: '0.5px solid #D1D5DB', borderRadius: 10,
          fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box'
        }}
      />

      {/* Filtre poste */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {postes.map(p => (
          <button key={p} onClick={() => setFilterPoste(p)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
            background: filterPoste === p ? '#E6F1FB' : 'transparent',
            color: filterPoste === p ? '#185FA5' : '#6B7280',
            fontWeight: filterPoste === p ? 600 : 400
          }}>{p === 'tous' ? 'Tous' : p}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>
            {filtered.length} joueur(s)
          </p>
          {filtered.map((j, i) => {
            const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const initials = `${j.nom?.[0] || ''}${j.prenom?.[0] || ''}`
            const rpe = rpeAvgs[j.id]
            return (
              <Card key={j.id} style={{ cursor: 'pointer', marginBottom: 8 }}
                onClick={() => navigate(`/joueurs/${j.id}`)}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={initials} bg={col.bg} color={col.color} size={40} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {j.poste || '—'} {j.numero ? `· N°${j.numero}` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {rpe && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: rpeColor(parseFloat(rpe)) }}>{rpe}</div>
                        <div style={{ fontSize: 9, color: '#9CA3AF' }}>RPE</div>
                      </div>
                    )}
                    <span style={{ color: '#D1D5DB', fontSize: 18 }}>›</span>
                  </div>
                </div>
              </Card>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>
              Aucun joueur trouvé.
            </div>
          )}
        </>
      )}
    </div>
  )
}
