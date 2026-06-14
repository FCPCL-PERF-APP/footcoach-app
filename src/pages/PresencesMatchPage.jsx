import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Button, Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

const STATUTS = {
  present:  { label: '✅ Présent',  bg: '#EAF3DE', color: '#3B6D11', border: '#3B6D11' },
  absent:   { label: '❌ Absent',   bg: '#FCEBEB', color: '#A32D2D', border: '#A32D2D' },
  blesse:   { label: '🤕 Blessé',   bg: '#FAEEDA', color: '#854F0B', border: '#854F0B' },
  inconnu:  { label: '❓ Inconnu',  bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
}

export default function PresencesMatchPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [convocations, setConvocations] = useState([])
  const [presences, setPresences] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [search, setSearch] = useState('')

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: convocs }, { data: pres }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('convocations').select('*, joueurs(*)').eq('evenement_id', eventId).eq('convoque', true),
      supabase.from('presences').select('*').eq('evenement_id', eventId)
    ])
    setEvent(ev)
    setConvocations(convocs || [])
    const presMap = {}
    for (const p of (pres || [])) presMap[p.joueur_id] = p.statut
    for (const c of (convocs || [])) {
      if (!presMap[c.joueur_id]) presMap[c.joueur_id] = 'inconnu'
    }
    setPresences(presMap)
    setLoading(false)
  }

  function setStatut(joueurId, statut) {
    setPresences(p => ({ ...p, [joueurId]: statut }))
  }

  async function handleSave() {
    setSaving(true)
    await supabase.from('presences').delete().eq('evenement_id', eventId)
    const inserts = Object.entries(presences).map(([joueur_id, statut]) => ({
      evenement_id: eventId, joueur_id, statut
    }))
    if (inserts.length > 0) await supabase.from('presences').insert(inserts)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const nbPresents = Object.values(presences).filter(s => s === 'present').length
  const nbAbsents  = Object.values(presences).filter(s => s === 'absent').length
  const nbBlesses  = Object.values(presences).filter(s => s === 'blesse').length
  const nbInconnus = Object.values(presences).filter(s => s === 'inconnu').length

  // Filtre les convocations affichées
  const convocsFiltrees = convocations.filter(c => {
    const j = c.joueurs
    if (!j) return false
    const matchSearch = !search || `${j.nom} ${j.prenom}`.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'tous' || presences[j.id] === filterStatut
    return matchSearch && matchStatut
  })

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Présences</p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{event?.titre}</p>
        </div>
      </div>

      {/* Résumé avec filtres cliquables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
        {[
          ['Tous', 'tous', convocations.length, '#185FA5', '#E6F1FB'],
          ['Présents', 'present', nbPresents, '#3B6D11', '#EAF3DE'],
          ['Absents', 'absent', nbAbsents, '#A32D2D', '#FCEBEB'],
          ['Blessés', 'blesse', nbBlesses, '#854F0B', '#FAEEDA'],
        ].map(([lbl, key, val, color, bg]) => (
          <button key={key} onClick={() => setFilterStatut(key)} style={{
            background: filterStatut === key ? bg : '#fff',
            border: `1.5px solid ${filterStatut === key ? color : '#E5E7EB'}`,
            borderRadius: 12, padding: 8, cursor: 'pointer', textAlign: 'center'
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 9, color, marginTop: 1 }}>{lbl}</div>
          </button>
        ))}
      </div>

      {/* Barre de recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher un joueur..."
        style={{ width: '100%', padding: '8px 12px', marginBottom: 10, border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />

      {saved && <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>✅ Présences enregistrées !</div>}

      {convocations.length === 0 ? (
        <Card>
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
            Aucun joueur convoqué.{' '}
            <span style={{ color: THEME.primary, cursor: 'pointer' }} onClick={() => navigate(`/convocations/${eventId}`)}>
              → Créer les convocations
            </span>
          </p>
        </Card>
      ) : (
        <>
          {/* Indicateur filtre actif */}
          {(filterStatut !== 'tous' || search) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: '#9CA3AF' }}>{convocsFiltrees.length} joueur(s) affiché(s)</p>
              <button onClick={() => { setFilterStatut('tous'); setSearch('') }}
                style={{ fontSize: 11, color: THEME.primary, background: 'none', border: 'none', cursor: 'pointer' }}>
                Réinitialiser les filtres
              </button>
            </div>
          )}

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              {convocations.length} joueur(s) convoqué(s)
            </p>
            {convocsFiltrees.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>
                Aucun joueur dans ce groupe.
              </p>
            ) : (
              convocsFiltrees.map((c, i) => {
                const j = c.joueurs
                if (!j) return null
                const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                const statut = presences[j.id] || 'inconnu'
                const st = STATUTS[statut]
                return (
                  <div key={j.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid #F3F4F6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      {j.photo_url
                        ? <img src={j.photo_url} alt={j.nom} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        : <Avatar initials={`${j.nom?.[0]}${j.prenom?.[0]}`} bg={col.bg} color={col.color} size={36} />
                      }
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>{j.poste} {j.numero ? `· N°${j.numero}` : ''}</p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 8 }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {Object.entries(STATUTS).map(([key, val]) => (
                        <button key={key} onClick={() => setStatut(j.id, key)} style={{
                          flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11,
                          border: `1.5px solid ${statut === key ? val.border : '#E5E7EB'}`,
                          background: statut === key ? val.bg : 'transparent',
                          color: statut === key ? val.color : '#9CA3AF',
                          fontWeight: statut === key ? 600 : 400, cursor: 'pointer'
                        }}>{val.label}</button>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </Card>
        </>
      )}

      <Button variant="primary" style={{ width: '100%', padding: 14 }}
        onClick={handleSave} disabled={saving}>
        {saving ? 'Enregistrement...' : '💾 Enregistrer les présences'}
      </Button>
    </div>
  )
}
