import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Button, Spinner, Avatar } from '../components/UI'
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

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: jrs }, { data: convocs }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('joueurs').select('*').order('nom'),
      supabase.from('convocations').select('*').eq('evenement_id', eventId)
    ])
    setEvent(ev)
    setJoueurs(jrs || [])
    const convocSet = new Set((convocs || []).filter(c => c.convoque).map(c => c.joueur_id))
    setSelected(convocSet)
    setExistingConvocs(convocs || [])
    setLoading(false)
  }

  function toggleJoueur(id) {
    if (selected.size >= 16 && !selected.has(id)) return
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function saveConvocations() {
    setSaving(true)
    // Supprime les anciennes convocations
    await supabase.from('convocations').delete().eq('evenement_id', eventId)
    // Insère les nouvelles
    const inserts = joueurs.map(j => ({
      evenement_id: eventId,
      joueur_id: j.id,
      convoque: selected.has(j.id)
    }))
    await supabase.from('convocations').insert(inserts)

    // Met à jour le lieu et heure de RDV dans l'événement
    await supabase.from('evenements').update({
      rdv_heure: rdvHeure,
      rdv_lieu: rdvLieu || event?.lieu
    }).eq('id', eventId)

    setSaving(false)
    setSent(true)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const dateStr = event?.date_heure ? format(parseISO(event.date_heure), "EEE d MMM · HH'h'mm", { locale: fr }) : ''

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Convocations</p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{event?.titre} · {dateStr}</p>
        </div>
      </div>

      {sent ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: THEME.success }}>Convocations enregistrées !</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>{selected.size} joueur(s) convoqué(s)</p>
            <Button variant="primary" style={{ marginTop: 16, width: '100%' }} onClick={() => navigate('/calendrier')}>
              Retour au calendrier
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Heure et lieu de RDV */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📍 Informations de rendez-vous</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Heure de RDV</label>
                <input type="time" value={rdvHeure} onChange={e => setRdvHeure(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Lieu de RDV</label>
                <input type="text" value={rdvLieu} onChange={e => setRdvLieu(e.target.value)}
                  placeholder={event?.lieu || 'Vestiaires...'}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          </Card>

          {/* Sélection joueurs */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Sélection des joueurs</p>
              <span style={{ fontSize: 12, color: selected.size >= 16 ? THEME.danger : THEME.primary, fontWeight: 600 }}>
                {selected.size}/16
              </span>
            </div>

            {/* Aperçu SMS */}
            <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 10, marginBottom: 12, borderLeft: `3px solid ${THEME.primary}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: THEME.primary, marginBottom: 4 }}>📱 Notification push envoyée</p>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                📢 <strong>Convocation — {event?.titre}</strong>{'\n'}
                {dateStr} · RDV {rdvHeure} · {rdvLieu || event?.lieu || 'Vestiaires'}
              </p>
            </div>

            {joueurs.map((j, i) => {
              const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
              const initials = `${j.nom?.[0] || ''}${j.prenom?.[0] || ''}`
              const isSelected = selected.has(j.id)
              return (
                <div key={j.id} onClick={() => toggleJoueur(j.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer',
                  opacity: !isSelected && selected.size >= 16 ? 0.4 : 1
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={initials} bg={col.bg} color={col.color} size={36} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{j.nom} {j.prenom}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>{j.poste} {j.numero ? `· N°${j.numero}` : ''}</p>
                    </div>
                  </div>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    border: `2px solid ${isSelected ? THEME.success : '#D1D5DB'}`,
                    background: isSelected ? THEME.success : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: '#fff', flexShrink: 0, transition: 'all .15s'
                  }}>
                    {isSelected ? '✓' : ''}
                  </div>
                </div>
              )
            })}
          </Card>

          <Button variant="primary" style={{ width: '100%', padding: 14, fontSize: 14 }}
            onClick={saveConvocations} disabled={saving || selected.size === 0}>
            {saving ? 'Enregistrement...' : `📢 Convoquer ${selected.size} joueur(s) et notifier`}
          </Button>
        </>
      )}
    </div>
  )
}
