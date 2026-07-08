import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { Card, Button, Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9DE0C2', color: '#0B5C3A' },
  { bg: '#F4C5B5', color: '#7C2D0C' },
  { bg: '#C5B5F4', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

const STATUTS = {
  present:   { label: '✅ Présent',   bg: '#EAF3DE', color: '#3B6D11', border: '#3B6D11' },
  exterieur: { label: '🔄 Extérieur', bg: '#E6F1FB', color: '#185FA5', border: '#185FA5' },
  absent:    { label: '❌ Absent',    bg: '#FCEBEB', color: '#A32D2D', border: '#A32D2D' },
  blesse:    { label: '🤕 Blessé',    bg: '#FAEEDA', color: '#854F0B', border: '#854F0B' },
  inconnu:   { label: '❓ Inconnu',   bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
}

const FORMES = {
  bien:    { emoji: '🟢', label: 'Bien' },
  moyen:   { emoji: '🟡', label: 'Moyen' },
  fatigue: { emoji: '🔴', label: 'Fatigué' },
}

export default function PresencesMatchPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [convocations, setConvocations] = useState([])
  const [presences, setPresences] = useState({})
  const [formes, setFormes] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [filterStatut, setFilterStatut] = useState('tous')
  const [search, setSearch] = useState('')
  const [relanceState, setRelanceState] = useState(null)

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: convocs }, { data: pres }, { data: tousJoueurs }, { data: forme }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('convocations').select('*, joueurs(*)').eq('evenement_id', eventId).eq('convoque', true),
      supabase.from('presences').select('*').eq('evenement_id', eventId),
      supabase.from('joueurs').select('id, nom, prenom, poste, numero, photo_url').order('nom'),
      supabase.from('forme_joueur').select('joueur_id, forme').eq('evenement_id', eventId),
    ])

    setEvent(ev)
    const presMap = {}
    for (const p of (pres || [])) presMap[p.joueur_id] = p.statut
    const formeMap = {}
    for (const f of (forme || [])) formeMap[f.joueur_id] = f.forme
    setFormes(formeMap)

    if (ev?.type === 'seance') {
      const joueursAvecStatut = (tousJoueurs || []).map(j => ({
        id: j.id, convoque: true, joueurs: j
      }))
      setConvocations(joueursAvecStatut)
      for (const j of (tousJoueurs || [])) {
        if (!presMap[j.id]) presMap[j.id] = 'inconnu'
      }
    } else {
      setConvocations(convocs || [])
      for (const c of (convocs || [])) {
        if (!presMap[c.joueur_id]) presMap[c.joueur_id] = 'inconnu'
      }
    }
    setPresences(presMap)
    setLoading(false)
  }

  function setStatut(joueurId, statut) {
    setPresences(p => ({ ...p, [joueurId]: statut }))
  }

  async function handleSave() {
    setSaving(true)
    const { error: delError } = await supabase.from('presences').delete().eq('evenement_id', eventId)
    if (delError) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement des présences : ' + delError.message)
      return
    }
    const inserts = Object.entries(presences).map(([joueur_id, statut]) => ({
      evenement_id: eventId, joueur_id, statut
    }))
    if (inserts.length > 0) {
      const { error: insError } = await supabase.from('presences').insert(inserts)
      if (insError) {
        setSaving(false)
        alert('Erreur lors de l\'enregistrement des présences : ' + insError.message)
        return
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const nbPresents    = Object.values(presences).filter(s => s === 'present').length
  const nbExterieurs  = Object.values(presences).filter(s => s === 'exterieur').length
  const nbAbsents     = Object.values(presences).filter(s => s === 'absent').length
  const nbBlesses     = Object.values(presences).filter(s => s === 'blesse').length
  const nbInconnus    = Object.values(presences).filter(s => s === 'inconnu').length

  const filteredConvocations = convocations.filter(c => {
    const j = c.joueurs
    if (!j) return false
    const matchSearch = !search || `${j.nom} ${j.prenom}`.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'tous' || presences[j.id] === filterStatut
    return matchSearch && matchStatut
  })

  async function relancerIndecis() {
    const indecis = convocations.filter(c => c.joueurs && presences[c.joueurs.id] === 'inconnu')
    setRelanceState('sending')
    try {
      const res = await fetch('/api/notif-manquants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          type: 'presence',
          eventTitre: event?.titre,
          joueurIds: indecis.map(c => c.joueurs.id)
        })
      })
      const data = await res.json()
      setRelanceState(data.success ? `✅ ${data.sent} notification(s) envoyée(s)` : `❌ ${data.error || 'Erreur'}`)
    } catch {
      setRelanceState('❌ Erreur réseau')
    }
    setTimeout(() => setRelanceState(null), 4000)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            {event?.type === 'seance' ? '🏃 Présences séance' : '⚽ Présences match'}
          </p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{event?.titre}</p>
          {event?.date_heure && (
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>
              {format(parseISO(event.date_heure), 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
      </div>

      {/* Résumé avec filtres cliquables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 12 }}>
        {[
          ['Tous', 'tous', convocations.length, '#185FA5', '#E6F1FB'],
          ['Présents', 'present', nbPresents, '#3B6D11', '#EAF3DE'],
          ['Extérieur', 'exterieur', nbExterieurs, '#185FA5', '#E6F1FB'],
          ['Absents', 'absent', nbAbsents, '#A32D2D', '#FCEBEB'],
          ['Blessés', 'blesse', nbBlesses, '#854F0B', '#FAEEDA'],
          ['Inconnus', 'inconnu', nbInconnus, '#6B7280', '#F3F4F6'],
        ].map(([lbl, key, val, color, bg]) => (
          <button key={key} onClick={() => setFilterStatut(key)} style={{
            padding: '8px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            background: filterStatut === key ? bg : '#fff',
            border: `1.5px solid ${filterStatut === key ? color : '#E5E7EB'}`,
            color: filterStatut === key ? color : '#6B7280',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{val}</div>
            <div style={{ fontSize: 9 }}>{lbl}</div>
          </button>
        ))}
      </div>

      {/* Relancer les indécis */}
      {filterStatut === 'inconnu' && nbInconnus > 0 && (
        <button onClick={relancerIndecis} disabled={relanceState === 'sending'}
          style={{ width: '100%', marginBottom: 12, padding: 10, background: THEME.gradient, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {relanceState === 'sending' ? 'Envoi...' : relanceState || `📱 Relancer les ${nbInconnus} indécis`}
        </button>
      )}

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un joueur..."
        style={{ width: '100%', padding: '8px 12px', border: '0.5px solid #E5E7EB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

      {/* Réinitialiser filtre */}
      {(filterStatut !== 'tous' || search) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={() => { setFilterStatut('tous'); setSearch('') }}
            style={{ fontSize: 11, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer' }}>
            Tout afficher
          </button>
        </div>
      )}

      {/* Liste joueurs */}
      <Card>
        {filteredConvocations.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucun joueur trouvé.</p>
        ) : (
          filteredConvocations.map((c, i) => {
            const j = c.joueurs
            if (!j) return null
            const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const statut = presences[j.id] || 'inconnu'
            const st = STATUTS[statut]
            const forme = formes[j.id] ? FORMES[formes[j.id]] : null
            return (
              <div key={j.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid #F3F4F6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {j.photo_url
                    ? <img src={j.photo_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: col.color }}>
                        {j.nom?.[0]}{j.prenom?.[0]}
                      </div>
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF' }}>{j.poste}{j.numero ? ` · N°${j.numero}` : ''}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 8 }}>
                      {st.label}
                    </span>
                    {forme && (
                      <span style={{ fontSize: 10, color: '#6B7280' }}>{forme.emoji} {forme.label}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(STATUTS).map(([key, val]) => (
                    <button key={key} onClick={() => setStatut(j.id, key)} style={{
                      flex: 1, padding: '6px 2px', borderRadius: 8, fontSize: 10,
                      border: `1.5px solid ${statut === key ? val.border : '#E5E7EB'}`,
                      background: statut === key ? val.bg : 'transparent',
                      color: statut === key ? val.color : '#9CA3AF',
                      cursor: 'pointer', fontWeight: statut === key ? 700 : 400
                    }}>
                      {val.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </Card>

      {/* Bouton sauvegarder */}
      <div style={{ position: 'sticky', bottom: 16, marginTop: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: saved ? '#3B6D11' : THEME.gradient,
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer'
        }}>
          {saving ? '⏳ Enregistrement...' : saved ? '✅ Enregistré !' : '💾 Sauvegarder les présences'}
        </button>
      </div>
    </div>
  )
}
