import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { Card, PageHeader, Button, Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowLeft, CheckCircle2, MapPin, Bell, Send, Check, XCircle, Bandage, HelpCircle, AlertTriangle } from 'lucide-react'

const DISPO = {
  present: { label: 'Disponible', icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
  absent:  { label: 'Indisponible', icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
  blesse:  { label: 'Blessé', icon: Bandage, color: '#854F0B', bg: 'var(--warning-bg)' },
  inconnu: { label: 'Sans réponse', icon: HelpCircle, color: 'var(--text-muted)', bg: 'var(--bg-secondary)' },
}

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

export default function ConvocationsPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [joueurs, setJoueurs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [rdvHeure, setRdvHeure] = useState('14:00')
  const [rdvLieu, setRdvLieu] = useState('')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [existingConvocs, setExistingConvocs] = useState([])
  const [dispos, setDispos] = useState({})

  // Ignore une réponse devenue obsolète si le coach navigue vers un autre événement
  // avant qu'elle ne revienne.
  const eventIdRef = useRef(eventId)

  useEffect(() => { eventIdRef.current = eventId; loadData() }, [eventId])

  // Coupe = 16 convocables (règlement), championnat = 14, préparation = 22 (effectif large, pas de règlement de compétition)
  const cap = event?.match_type === 'coupe' ? 16 : event?.match_type === 'preparation' ? 22 : 14

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: jrs }, { data: convocs }, { data: pres }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('joueurs').select('*').order('nom'),
      supabase.from('convocations').select('*').eq('evenement_id', eventId),
      supabase.from('presences').select('joueur_id, statut').eq('evenement_id', eventId),
    ])
    if (eventIdRef.current !== eventId) return
    setEvent(ev)
    const dispoMap = {}
    for (const p of (pres || [])) dispoMap[p.joueur_id] = p.statut
    setDispos(dispoMap)
    // Les joueurs disponibles remontent en tête de liste pour faciliter la sélection
    const sorted = [...(jrs || [])].sort((a, b) => {
      const rank = s => s === 'present' ? 0 : s === 'blesse' ? 2 : s === 'absent' ? 3 : 1
      return rank(dispoMap[a.id]) - rank(dispoMap[b.id])
    })
    setJoueurs(sorted)
    const convocSet = new Set((convocs || []).filter(c => c.convoque).map(c => c.joueur_id))
    setSelected(convocSet)
    setExistingConvocs(convocs || [])
    setLoading(false)
  }

  function toggleJoueur(id) {
    if (selected.size >= cap && !selected.has(id)) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function saveConvocations() {
    setSaving(true)
    // Insère d'abord les nouvelles convocations, puis ne supprime les anciennes lignes
    // qu'une fois l'insertion réussie — si l'insertion échoue en cours de route, les
    // anciennes convocations restent intactes au lieu d'être perdues (l'ancien ordre
    // delete-puis-insert pouvait laisser la table vide, donc plus aucun joueur convoqué,
    // en cas d'échec de l'insertion après une suppression déjà effectuée).
    const { data: oldRows, error: fetchError } = await supabase.from('convocations').select('id').eq('evenement_id', eventId)
    if (fetchError) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement des convocations : ' + fetchError.message)
      return
    }
    const inserts = joueurs.map(j => ({
      evenement_id: eventId,
      joueur_id: j.id,
      convoque: selected.has(j.id)
    }))
    const { error: insError } = await supabase.from('convocations').insert(inserts)
    if (insError) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement des convocations : ' + insError.message)
      return
    }
    const oldIds = (oldRows || []).map(r => r.id)
    if (oldIds.length > 0) {
      const { error: cleanupError } = await supabase.from('convocations').delete().in('id', oldIds)
      if (cleanupError) {
        setSaving(false)
        alert('Les nouvelles convocations sont enregistrées, mais le nettoyage des anciennes lignes a échoué : ' + cleanupError.message)
        return
      }
    }

   // Met à jour le lieu et heure de RDV dans l'événement
    const { error: evError } = await supabase.from('evenements').update({
      rdv_heure: rdvHeure,
      rdv_lieu: rdvLieu || event?.lieu
    }).eq('id', eventId)
    if (evError) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement du RDV : ' + evError.message)
      return
    }

    // Envoie notification push aux joueurs convoqués
    const convoquesIds = joueurs.filter(j => selected.has(j.id)).map(j => j.id)
    if (convoquesIds.length > 0) {
      try {
        const dateStr = event?.date_heure
          ? new Date(event.date_heure).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
          : ''
        await fetch('/api/notif-convocation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            eventId,
            eventTitre: event?.titre,
            eventDate: dateStr,
            rdvHeure,
            rdvLieu,
            joueurIds: convoquesIds
          })
        })
      } catch (err) {
        console.error('Erreur notif convocation:', err)
      }
    }

    setSaving(false)
    setSent(true)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // L'événement a pu être supprimé entre l'ouverture du lien et le chargement.
  if (!event) return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <p style={{ fontSize: 16, fontWeight: 700 }}>Convocations</p>
      </div>
      <Card style={{ textAlign: 'center', padding: 24 }}>
        <AlertTriangle size={28} color={'var(--warning)'} style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Événement introuvable</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Il a peut-être été supprimé depuis. Retourne au calendrier.</p>
      </Card>
    </div>
  )

  const dateStr = event?.date_heure ? format(parseISO(event.date_heure), "EEE d MMM · HH'h'mm", { locale: fr }) : ''

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Convocations</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event?.titre} · {dateStr}</p>
        </div>
      </div>

      {sent ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <CheckCircle2 size={44} color={'var(--success)'} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>Convocations enregistrées !</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{selected.size} joueur(s) convoqué(s)</p>
            <Button variant="primary" style={{ marginTop: 16, width: '100%' }} onClick={() => navigate('/calendrier')}>
              Retour au calendrier
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Heure et lieu de RDV */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} color={'var(--primary)'} /> Informations de rendez-vous</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Heure de RDV</label>
                <input type="time" value={rdvHeure} onChange={e => setRdvHeure(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Lieu de RDV</label>
                <input type="text" value={rdvLieu} onChange={e => setRdvLieu(e.target.value)}
                  placeholder={event?.lieu || 'Vestiaires...'}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </Card>

          {/* Sélection joueurs */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Sélection des joueurs</p>
              <span style={{ fontSize: 12, color: selected.size >= cap ? 'var(--danger)' : 'var(--primary)', fontWeight: 600 }}>
                {selected.size}/{cap}
              </span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, marginTop: -6 }}>
              {event?.match_type === 'coupe' ? 'Match de coupe' : event?.match_type === 'preparation' ? 'Match de préparation' : 'Championnat'} · {cap} convocables — les joueurs disponibles sont affichés en premier.
            </p>

            {/* Aperçu SMS */}
            <div style={{ background: 'var(--primary-bg)', borderRadius: 10, padding: 10, marginBottom: 12, borderLeft: `3px solid ${'var(--primary)'}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}><Bell size={12} /> Notification push envoyée</p>
              <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <Send size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <span><strong>Convocation — {event?.titre}</strong>{'\n'}
                {dateStr} · RDV {rdvHeure} · {rdvLieu || event?.lieu || 'Vestiaires'}</span>
              </p>
            </div>

            {joueurs.map((j, i) => {
              const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
              const initials = `${j.nom?.[0] || ''}${j.prenom?.[0] || ''}`
              const isSelected = selected.has(j.id)
              const d = DISPO[dispos[j.id]] || DISPO.inconnu
              return (
                <div key={j.id} onClick={() => toggleJoueur(j.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '0.5px solid var(--bg-secondary)', cursor: 'pointer',
                  opacity: !isSelected && selected.size >= cap ? 0.4 : 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={initials} bg={col.bg} color={col.color} size={36} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{j.nom} {j.prenom}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {j.poste} {j.numero ? `· N°${j.numero}` : ''}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: d.color, background: d.bg, borderRadius: 6, padding: '1px 5px', fontWeight: 600, marginLeft: 2 }}>
                          <d.icon size={9} /> {d.label}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--success)' : 'var(--border)'}`,
                    background: isSelected ? 'var(--success)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: '#fff', flexShrink: 0, transition: 'all .15s'
                  }}>
                    {isSelected && <Check size={14} />}
                  </div>
                </div>
              )
            })}
          </Card>

          <Button variant="primary" style={{ width: '100%', padding: 14, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={saveConvocations} disabled={saving || selected.size === 0}>
            {saving ? 'Enregistrement...' : <><Send size={14} /> Convoquer {selected.size} joueur(s) et notifier</>}
          </Button>
        </>
      )}
    </div>
  )
}
