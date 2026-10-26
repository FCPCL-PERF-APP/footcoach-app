import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Spinner, Avatar } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { Download, Plus, AlertTriangle, ArrowRight, Search, Tag, Heart, Archive, ArchiveRestore, ChevronRight, Bandage } from 'lucide-react'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

function rpeColor(v) {
  if (!v) return 'var(--text-muted)'
  if (v >= 4.5) return 'var(--danger)'
  if (v >= 3.5) return '#D85A30'
  if (v >= 2.5) return 'var(--warning)'
  return 'var(--success)'
}

export default function JoueursPage() {
  const { isCoach, isStaff } = useAuth()
  const navigate = useNavigate()
  const [joueurs, setJoueurs] = useState([])
  const [rpeAvgs, setRpeAvgs] = useState({})
  const [blessuresActives, setBlessuresActives] = useState({})
  const [search, setSearch] = useState('')
  const [filterPoste, setFilterPoste] = useState('tous')
  const [sortBy, setSortBy] = useState('nom') // 'nom' | 'rpe'
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [confirmArchive, setConfirmArchive] = useState(null)
  const [showArchives, setShowArchives] = useState(false)

  useEffect(() => { loadJoueurs() }, [])

  async function loadJoueurs() {
    setLoadError(null)
    const { data, error } = await supabase.from('joueurs').select('*').order('nom')
    // Sans ce garde-fou, un échec réseau/RLS affichait "Aucun joueur" — indiscernable
    // d'un effectif réellement vide sur la page centrale de gestion des joueurs.
    if (error) { setLoadError(error.message); setLoading(false); return }
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
    for (const id in avgs) result[id] = (avgs[id] / counts[id])
    setRpeAvgs(result)
    setLoading(false)
  }

  // Archivage (et non suppression) : toutes les données du joueur sont conservées, il
  // disparaît des listes actives et n'a plus accès à l'appli. auth_id est retiré pour couper
  // l'accès (y compris aux données protégées par RLS) ; sa fiche garde son e-mail, il suffit
  // de le réactiver ou de lui renvoyer une invitation pour qu'il revienne.
  async function archiverJoueur(joueur) {
    const ancienAuthId = joueur.auth_id
    const { error } = await supabase.from('joueurs')
      .update({ archive: true, archive_le: new Date().toISOString(), auth_id: null }).eq('id', joueur.id)
    if (error) { alert('Erreur lors de l\'archivage : ' + error.message); return }
    // Plus de notifications push pour lui.
    if (ancienAuthId) await supabase.from('push_subscriptions').delete().eq('user_id', ancienAuthId)
    setConfirmArchive(null)
    loadJoueurs()
  }

  async function reactiverJoueur(joueur) {
    const { error } = await supabase.from('joueurs').update({ archive: false, archive_le: null }).eq('id', joueur.id)
    if (error) { alert('Erreur lors de la réactivation : ' + error.message); return }
    loadJoueurs()
    alert(`${joueur.prenom} ${joueur.nom} est de retour dans l'effectif.${joueur.email ? ' Pour qu\'il retrouve l\'accès, renvoie-lui une invitation depuis sa fiche (ou il se reconnecte avec ses identifiants).' : ''}`)
  }

  const nbArchives = joueurs.filter(j => j.archive).length

  const postes = ['tous', ...new Set(joueurs.map(j => j.poste).filter(Boolean))]
  const groupes = ['tous', ...new Set(joueurs.map(j => j.groupe).filter(Boolean)).values()].sort()
  const [filterGroupe, setFilterGroupe] = useState('tous')

  let filtered = joueurs.filter(j => {
    if (!!j.archive !== showArchives) return false
    const matchSearch = !search || `${j.nom} ${j.prenom}`.toLowerCase().includes(search.toLowerCase())
    const matchPoste = filterPoste === 'tous' || j.poste === filterPoste
    const matchGroupe = filterGroupe === 'tous' || j.groupe === filterGroupe
    return matchSearch && matchPoste && matchGroupe
  })

  // Tri
  if (sortBy === 'rpe') {
    filtered = [...filtered].sort((a, b) => {
      const ra = rpeAvgs[a.id] || 0
      const rb = rpeAvgs[b.id] || 0
      return rb - ra // Décroissant — surcharges en premier
    })
  }

  const nbSurcharge = Object.values(rpeAvgs).filter(v => v >= 4).length

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Joueurs</h1>
        {isCoach && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => navigate('/joueurs/import')} style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Download size={13} /> Import
            </button>
            <button onClick={() => navigate('/joueurs/nouveau')} style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              <Plus size={13} /> Ajouter
            </button>
          </div>
        )}
      </div>

      {/* Alerte surcharge */}
      {isStaff && nbSurcharge > 0 && (
        <div style={{ background: 'var(--danger-bg)', border: '0.5px solid #FCA5A5', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={13} /> {nbSurcharge} joueur(s) avec RPE ≥ 4
          </span>
          <button onClick={() => setSortBy('rpe')} style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            Voir en premier <ArrowRight size={11} />
          </button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur..."
          style={{ width: '100%', padding: '9px 12px 9px 34px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', background: 'var(--bg-card)', boxSizing: 'border-box' }} />
      </div>

      {/* Filtre groupe */}
      {groupes.length > 2 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, overflowX: 'auto' }}>
          {groupes.map(g => (
            <button key={g} onClick={() => setFilterGroupe(g)} style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
              border: '0.5px solid var(--border)', whiteSpace: 'nowrap',
              background: filterGroupe === g ? CAT_COLORS.amber.bg : 'transparent',
              color: filterGroupe === g ? CAT_COLORS.amber.color : 'var(--text-secondary)',
              fontWeight: filterGroupe === g ? 600 : 400,
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>{g === 'tous' ? <><Tag size={11} /> Tous les groupes</> : `Pôle ${g}`}</button>
          ))}
        </div>
      )}

      {/* Filtres + tri */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {postes.map(p => (
          <button key={p} onClick={() => setFilterPoste(p)} style={{
            padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid var(--border)', whiteSpace: 'nowrap',
            background: filterPoste === p ? 'var(--primary-bg)' : 'transparent',
            color: filterPoste === p ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: filterPoste === p ? 600 : 400
          }}>{p === 'tous' ? 'Tous' : p}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button onClick={() => setSortBy('nom')} style={{
            padding: '4px 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid var(--border)', whiteSpace: 'nowrap',
            background: sortBy === 'nom' ? 'var(--primary-bg)' : 'transparent',
            color: sortBy === 'nom' ? 'var(--primary)' : 'var(--text-secondary)',
          }}>A→Z</button>
          {isStaff && <button onClick={() => setSortBy('rpe')} style={{
            padding: '4px 8px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: `0.5px solid ${sortBy === 'rpe' ? 'var(--danger)' : 'var(--border)'}`,
            background: sortBy === 'rpe' ? 'var(--danger-bg)' : 'transparent',
            color: sortBy === 'rpe' ? 'var(--danger)' : 'var(--text-secondary)',
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}><Heart size={11} /> RPE</button>}
        </div>
      </div>

      {/* Modal confirmation archivage */}
      {confirmArchive && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Archiver ce joueur ?</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              <strong>{confirmArchive.nom} {confirmArchive.prenom}</strong> quitte l'effectif : il disparaît des listes et perd l'accès à l'appli. <strong>Toutes ses données sont conservées</strong> et tu pourras le réactiver à tout moment.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setConfirmArchive(null)} style={{ flex: 1, padding: 10, border: '0.5px solid var(--border)', borderRadius: 10, cursor: 'pointer', background: 'transparent', fontSize: 13 }}>Annuler</button>
              <button onClick={() => archiverJoueur(confirmArchive)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 10, cursor: 'pointer', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600 }}>Archiver</button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div style={{ background: 'var(--danger-bg)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--danger)' }}>Erreur de chargement : {loadError}</p>
        </div>
      )}

      {loading ? <Spinner /> : loadError ? null : (
        <>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            {filtered.length} joueur(s){showArchives ? ' archivé(s)' : ''}
            {sortBy === 'rpe' && <span style={{ color: 'var(--danger)' }}> · Trié par RPE décroissant</span>}
          </p>
          {filtered.map((j, i) => {
            const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const initials = `${j.nom?.[0] || ''}${j.prenom?.[0] || ''}`
            const rpeVal = rpeAvgs[j.id]
            const rpe = rpeVal ? rpeVal.toFixed(1) : null
            const enSurcharge = rpeVal >= 4
            return (
              <div key={j.id} style={{
                background: 'var(--bg-card)',
                border: `0.5px solid ${enSurcharge ? '#FCA5A5' : 'var(--border)'}`,
                borderLeft: enSurcharge ? `3px solid var(--danger)` : '3px solid transparent',
                borderRadius: 14, padding: '12px 14px', marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: isStaff ? 'pointer' : 'default' }} onClick={() => isStaff && navigate(`/joueurs/${j.id}`)}>
                  {j.photo_url
                    ? <img src={j.photo_url} alt={j.nom} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    : <Avatar initials={initials} bg={col.bg} color={col.color} size={40} />
                  }
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      {j.nom} {j.prenom}
                      {blessuresActives[j.id] && (
                        <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 10, padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Bandage size={10} /> Blessé
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {j.poste || '—'}{j.numero ? ` · N°${j.numero}` : ''}{j.groupe ? ` · Pôle ${j.groupe}` : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isStaff && rpe && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: rpeColor(parseFloat(rpe)) }}>{rpe}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>RPE</div>
                    </div>
                  )}
                  {isCoach && (j.archive ? (
                    <button onClick={() => reactiverJoueur(j)} title="Réactiver"
                      style={{ border: 'none', background: 'var(--success-bg)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                      <ArchiveRestore size={13} /> Réactiver
                    </button>
                  ) : (
                    <button onClick={() => setConfirmArchive(j)} title="Archiver"
                      style={{ border: 'none', background: 'var(--bg-secondary)', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', display: 'flex' }}>
                      <Archive size={13} color="var(--text-secondary)" />
                    </button>
                  ))}
                  {isStaff && <ChevronRight size={18} color="var(--border)" style={{ cursor: 'pointer' }} onClick={() => navigate(`/joueurs/${j.id}`)} />}
                </div>
              </div>
            )
          })}
          {isCoach && nbArchives > 0 && (
            <button onClick={() => setShowArchives(v => !v)} style={{ width: '100%', padding: '10px 12px', marginTop: 6, border: '0.5px solid var(--border)', borderRadius: 10, background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              {showArchives ? "← Retour à l'effectif" : `Joueurs archivés (${nbArchives})`}
            </button>
          )}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
              {joueurs.length === 0 ? 'Aucun joueur. Clique sur "+ Ajouter".' : 'Aucun joueur trouvé.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}
