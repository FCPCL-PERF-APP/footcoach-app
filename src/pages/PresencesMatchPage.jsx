import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { Card, Button, Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, Footprints, Swords, CheckCircle2, RefreshCw, XCircle,
  Bandage, HelpCircle, Bell, Circle, Hourglass, Save, AlertTriangle
} from 'lucide-react'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9DE0C2', color: '#0B5C3A' },
  { bg: '#F4C5B5', color: '#7C2D0C' },
  { bg: '#C5B5F4', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

const STATUTS = {
  present:   { icon: CheckCircle2, label: 'Présent',   bg: 'var(--success-bg)', color: 'var(--success)', border: 'var(--success)' },
  exterieur: { icon: RefreshCw,    label: 'Extérieur', bg: 'var(--primary-bg)', color: 'var(--primary)', border: 'var(--primary)' },
  absent:    { icon: XCircle,      label: 'Absent',    bg: 'var(--danger-bg)',  color: 'var(--danger)',  border: 'var(--danger)' },
  blesse:    { icon: Bandage,      label: 'Blessé',    bg: 'var(--warning-bg)', color: '#854F0B',     border: '#854F0B' },
  inconnu:   { icon: HelpCircle,   label: 'Inconnu',   bg: 'var(--bg-secondary)',       color: 'var(--text-secondary)',     border: 'var(--border)' },
}

const FORMES = {
  bien:    { color: 'var(--success)', label: 'Bien' },
  moyen:   { color: 'var(--warning)', label: 'Moyen' },
  fatigue: { color: 'var(--danger)', label: 'Fatigué' },
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

  // Ignore une réponse devenue obsolète si le coach navigue vers un autre événement
  // avant qu'elle ne revienne.
  const eventIdRef = useRef(eventId)

  useEffect(() => { eventIdRef.current = eventId; loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: convocs }, { data: pres }, { data: tousJoueurs }, { data: forme }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('convocations').select('*, joueurs(*)').eq('evenement_id', eventId).eq('convoque', true),
      supabase.from('presences').select('*').eq('evenement_id', eventId),
      supabase.from('joueurs').select('id, nom, prenom, poste, numero, photo_url').order('nom'),
      supabase.from('forme_joueur').select('joueur_id, forme').eq('evenement_id', eventId),
    ])
    if (eventIdRef.current !== eventId) return

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
      // Tout l'effectif est affiché, pas seulement les convoqués : la disponibilité
      // (présent/absent/blessé) peut être déclarée avant que le coach ait fait sa
      // sélection, et un joueur absent/blessé n'est de toute façon jamais convoqué.
      const convoqueSet = new Set((convocs || []).map(c => c.joueur_id))
      const joueursAvecStatut = (tousJoueurs || []).map(j => ({
        id: j.id, convoque: convoqueSet.has(j.id), joueurs: j
      }))
      setConvocations(joueursAvecStatut)
      for (const j of (tousJoueurs || [])) {
        if (!presMap[j.id]) presMap[j.id] = 'inconnu'
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
    // Insère d'abord les nouvelles présences, puis ne supprime les anciennes lignes
    // qu'une fois l'insertion réussie — si l'insertion échoue (réseau coupé en cours de
    // route, etc.), les anciennes présences restent intactes au lieu d'être perdues
    // (l'ancien ordre delete-puis-insert pouvait laisser la table vide en cas d'échec
    // de l'insertion après une suppression déjà effectuée).
    const { data: oldRows, error: fetchError } = await supabase.from('presences').select('id').eq('evenement_id', eventId)
    if (fetchError) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement des présences : ' + fetchError.message)
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
    const oldIds = (oldRows || []).map(r => r.id)
    if (oldIds.length > 0) {
      const { error: cleanupError } = await supabase.from('presences').delete().in('id', oldIds)
      if (cleanupError) {
        setSaving(false)
        alert('Les nouvelles présences sont enregistrées, mais le nettoyage des anciennes lignes a échoué : ' + cleanupError.message)
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
      setRelanceState(data.success ? `${data.sent} notification(s) envoyée(s)` : `Erreur : ${data.error || 'inconnue'}`)
    } catch {
      setRelanceState('Erreur réseau')
    }
    setTimeout(() => setRelanceState(null), 4000)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // L'événement a pu être supprimé entre l'ouverture du lien et le chargement.
  if (!event) return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <p style={{ fontSize: 16, fontWeight: 700 }}>Présences</p>
      </div>
      <Card style={{ textAlign: 'center', padding: 24 }}>
        <AlertTriangle size={28} color={'var(--warning)'} style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Événement introuvable</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Il a peut-être été supprimé depuis. Retourne au calendrier.</p>
      </Card>
    </div>
  )

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            {event?.type === 'seance' ? <Footprints size={15} /> : <Swords size={15} />} {event?.type === 'seance' ? 'Présences séance' : 'Présences match'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event?.titre}</p>
          {event?.date_heure && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {format(parseISO(event.date_heure), 'EEEE d MMMM yyyy', { locale: fr })}
            </p>
          )}
        </div>
      </div>

      {/* Résumé avec filtres cliquables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 12 }}>
        {[
          ['Tous', 'tous', convocations.length, 'var(--primary)', 'var(--primary-bg)'],
          ['Présents', 'present', nbPresents, '#3B6D11', '#EAF3DE'],
          ['Extérieur', 'exterieur', nbExterieurs, 'var(--primary)', 'var(--primary-bg)'],
          ['Absents', 'absent', nbAbsents, '#A32D2D', '#FCEBEB'],
          ['Blessés', 'blesse', nbBlesses, '#854F0B', '#FAEEDA'],
          ['Inconnus', 'inconnu', nbInconnus, 'var(--text-secondary)', 'var(--bg-secondary)'],
        ].map(([lbl, key, val, color, bg]) => (
          <button key={key} onClick={() => setFilterStatut(key)} style={{
            padding: '8px 4px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            background: filterStatut === key ? bg : '#fff',
            border: `1.5px solid ${filterStatut === key ? color : 'var(--border)'}`,
            color: filterStatut === key ? color : 'var(--text-secondary)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{val}</div>
            <div style={{ fontSize: 9 }}>{lbl}</div>
          </button>
        ))}
      </div>

      {/* Relancer les indécis */}
      {filterStatut === 'inconnu' && nbInconnus > 0 && (
        <button onClick={relancerIndecis} disabled={relanceState === 'sending'}
          style={{ width: '100%', marginBottom: 12, padding: 10, background: 'var(--gradient)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {relanceState === 'sending' ? 'Envoi...' : relanceState || <><Bell size={12} /> Relancer les {nbInconnus} indécis</>}
        </button>
      )}

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un joueur..."
        style={{ width: '100%', padding: '8px 12px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

      {/* Réinitialiser filtre */}
      {(filterStatut !== 'tous' || search) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button onClick={() => { setFilterStatut('tous'); setSearch('') }}
            style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
            Tout afficher
          </button>
        </div>
      )}

      {/* Liste joueurs */}
      <Card>
        {filteredConvocations.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Aucun joueur trouvé.</p>
        ) : (
          filteredConvocations.map((c, i) => {
            const j = c.joueurs
            if (!j) return null
            const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
            const statut = presences[j.id] || 'inconnu'
            const st = STATUTS[statut]
            const forme = formes[j.id] ? FORMES[formes[j.id]] : null
            return (
              <div key={j.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {j.photo_url
                    ? <img src={j.photo_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: '50%', background: col.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: col.color }}>
                        {j.nom?.[0]}{j.prenom?.[0]}
                      </div>
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {j.nom} {j.prenom}
                      {event?.type === 'match' && c.convoque && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-bg)', padding: '1px 5px', borderRadius: 6 }}>Convoqué</span>
                      )}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.poste}{j.numero ? ` · N°${j.numero}` : ''}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, padding: '3px 8px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <st.icon size={11} /> {st.label}
                    </span>
                    {forme && (
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Circle size={7} fill={forme.color} color={forme.color} /> {forme.label}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {Object.entries(STATUTS).map(([key, val]) => (
                    <button key={key} onClick={() => setStatut(j.id, key)} style={{
                      flex: 1, padding: '6px 2px', borderRadius: 8, fontSize: 10,
                      border: `1.5px solid ${statut === key ? val.border : 'var(--border)'}`,
                      background: statut === key ? val.bg : 'transparent',
                      color: statut === key ? val.color : 'var(--text-muted)',
                      cursor: 'pointer', fontWeight: statut === key ? 700 : 400,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3
                    }}>
                      <val.icon size={10} /> {val.label}
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
          background: saved ? 'var(--success)' : 'var(--gradient)',
          color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
        }}>
          {saving ? <><Hourglass size={14} /> Enregistrement...</> : saved ? <><CheckCircle2 size={14} /> Enregistré !</> : <><Save size={14} /> Sauvegarder les présences</>}
        </button>
      </div>
    </div>
  )
}
