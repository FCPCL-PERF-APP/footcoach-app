import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'

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
  const { isCoach } = useAuth()
  const navigate = useNavigate()
  const [joueurs, setJoueurs] = useState([])
  const [rpeAvgs, setRpeAvgs] = useState({})
  const [search, setSearch] = useState('')
  const [filterPoste, setFilterPoste] = useState('tous')
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => { loadJoueurs() }, [])

  async function loadJoueurs() {
    const { data } = await supabase.from('joueurs').select('*').order('nom')
    setJoueurs(data || [])
    const { data: rpe } = await supabase.from('rpe')
      .select('joueur_id, difficulte, fatigue, implication, motivation, perf_individuelle, perf_collective')
      .order('created_at', { ascending: false })
    const avgs = {}, counts = {}
    for (const r of (rpe || [])) {
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null)
      if (!vals.length) continue
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length
      if (!avgs[r.joueur_id]) { avgs[r.joueur_id] = 0; counts[r.joueur_id] = 0 }
      avgs[r.joueur_id] += avg; counts[r.joueur_id]++
    }
    const result = {}
    for (const id in avgs) result[id] = (avgs[id] / counts[id]).toFixed(1)
    setRpeAvgs(result)
    setLoading(false)
  }

  async function deleteJoueur(joueur) {
    await supabase.from('joueurs').delete().eq('id', joueur.id)
    setConfirmDelete(null)
    loadJoueurs()
  }

  const postes = ['tous', ...new Set(joueurs.map(j => j.poste).filter(Boolean))]
  const filtered = joueurs.filter(j => {
    const matchSearch = !search || `${j.nom} ${j.prenom}`.toLowerCase().includes(search.toLowerCase())
    const matchPoste = filterPoste === 'tous' || j.poste === filterPoste
    return matchSearch && matchPoste
  })

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Joueurs</h1>
        {isCoach && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => navigate('/joueurs/import')} style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>📥 Import</button>
            <button onClick={() => navigate('/joueurs/nouveau')} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>+ Ajouter</button>
          </div>
        )}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher un joueur..."
        style={{ width: '100%', padding: '9px 12px', marginBottom: 10, border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {postes.map(p => (
          <button key={p} onClick={() => setFilterPoste(p)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
            background: filterPoste === p ? '#E6F1FB' : 'transparent',
            color: filterPoste === p ? THEME.primary : '#6B7280',
            fontWeight: filterPoste === p ? 600 : 400
          }}>{p === 'tous' ? 'Tous' : p}</button>
        ))}
      </div>

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Supprimer ce joueur ?</p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>
              <strong>{confirmDelete.nom} {confirmDelete.prenom}</strong> sera définitivement supprimé avec toutes ses données.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: 10, border: '0.5px solid #D1D5DB', borderRadius: 10, cursor: 'pointer', background: 'transparent', fontSize: 13 }}>Annuler</button>
              <button onClick={() => deleteJoueur(confirmDelete)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#A32D2D', color: '#fff', fontSize: 13, fontWeight: 600 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{filtered.length} joueur(s)</p>
          {filtered.map((j, i) => {
            const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const initials = `${j.nom?.[0] || ''}${j.prenom?.[0] || ''}`
            const rpe = rpeAvgs[j.id]
            return (
              <div key={j.id} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 14, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/joueurs/${j.id}`)}>
                  {j.photo_url
                    ? <img src={j.photo_url} alt={j.nom} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <Avatar initials={initials} bg={col.bg} color={col.color} size={40} />
                  }
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                      {j.poste || '—'}{j.numero ? ` · N°${j.numero}` : ''}{j.groupe ? ` · Pôle ${j.groupe}` : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {rpe && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: rpeColor(parseFloat(rpe)) }}>{rpe}</div>
                      <div style={{ fontSize: 9, color: '#9CA3AF' }}>RPE</div>
                    </div>
                  )}
                  {isCoach && (
                    <button onClick={() => setConfirmDelete(j)}
                      style={{ border: 'none', background: 'rgba(163,45,45,.1)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', fontSize: 13 }}>
                      🗑️
                    </button>
                  )}
                  <span style={{ color: '#D1D5DB', fontSize: 20, cursor: 'pointer' }} onClick={() => navigate(`/joueurs/${j.id}`)}>›</span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>
              {joueurs.length === 0 ? 'Aucun joueur. Clique sur "+ Ajouter".' : 'Aucun joueur trouvé.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
