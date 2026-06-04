import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Badge, Button, Input, Select, Spinner } from '../components/UI'
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns'
import { fr } from 'date-fns/locale'

const NOTIFICATION_TYPES = [
  { value: 'rappel_j2', label: 'Rappel J-2' },
  { value: 'rappel_j1', label: 'Rappel J-1' },
  { value: 'invitation_rpe', label: 'Invitation RPE après événement' },
]

export default function CalendrierPage() {
  const { isCoach, isAdjoint } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('tous')
  const [form, setForm] = useState({
    type: 'match', titre: '', date: '', heure: '15:00',
    lieu: '', domicile: true,
    notif_j2: true, notif_j1: true, notif_rpe: true
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase
      .from('evenements')
      .select('*')
      .order('date_heure', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  async function saveEvent() {
    if (!form.titre || !form.date) return
    setSaving(true)
    const date_heure = `${form.date}T${form.heure}:00`
    await supabase.from('evenements').insert({
      type: form.type,
      titre: form.titre,
      date_heure,
      lieu: form.lieu,
      domicile: form.domicile
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ type: 'match', titre: '', date: '', heure: '15:00', lieu: '', domicile: true, notif_j2: true, notif_j1: true, notif_rpe: true })
    loadEvents()
  }

  const filtered = events.filter(e => filter === 'tous' || e.type === filter)

  const upcoming = filtered.filter(e => isAfter(parseISO(e.date_heure), new Date()))
  const past = filtered.filter(e => isBefore(parseISO(e.date_heure), new Date()))

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title="Calendrier"
        action={isCoach && (
          <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '✕ Annuler' : '+ Ajouter'}
          </Button>
        )}
      />

      {/* Filtre */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['tous','match','seance'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: filter === f ? '#E6F1FB' : 'transparent',
            color: filter === f ? '#185FA5' : '#6B7280',
            fontWeight: filter === f ? 600 : 400
          }}>
            {f === 'tous' ? 'Tous' : f === 'match' ? 'Matchs' : 'Séances'}
          </button>
        ))}
      </div>

      {/* Formulaire ajout */}
      {showAdd && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nouvel événement</p>
          <Select label="Type" value={form.type} onChange={v => setForm(p => ({...p, type: v}))}
            options={[{value:'match',label:'Match'},{value:'seance',label:'Séance'}]} />
          <Input label="Adversaire / Intitulé" value={form.titre}
            onChange={v => setForm(p => ({...p, titre: v}))} placeholder="vs FC Nancy R" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Date" type="date" value={form.date} onChange={v => setForm(p => ({...p, date: v}))} />
            <Input label="Heure" type="time" value={form.heure} onChange={v => setForm(p => ({...p, heure: v}))} />
          </div>
          <Input label="Lieu" value={form.lieu} onChange={v => setForm(p => ({...p, lieu: v}))} placeholder="Terrain 1, Stade..." />
          {form.type === 'match' && (
            <Select label="Domicile / Déplacement" value={form.domicile ? 'dom' : 'dep'}
              onChange={v => setForm(p => ({...p, domicile: v === 'dom'}))}
              options={[{value:'dom',label:'Domicile'},{value:'dep',label:'Déplacement'}]} />
          )}
          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>📱 Notifications push automatiques</p>
            {[['notif_j2','Rappel J-2 aux joueurs'],['notif_j1','Rappel J-1'],['notif_rpe','Invitation RPE après événement']].map(([key, lbl]) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={form[key]} onChange={e => setForm(p => ({...p, [key]: e.target.checked}))} />
                {lbl}
              </label>
            ))}
          </div>
          <Button variant="primary" style={{ width: '100%' }} onClick={saveEvent} disabled={saving}>
            {saving ? 'Création...' : 'Créer l\'événement'}
          </Button>
        </Card>
      )}

      {loading ? <Spinner /> : (
        <>
          {upcoming.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>À venir</p>
              {upcoming.map(ev => <EventCard key={ev.id} ev={ev} isCoach={isCoach} navigate={navigate} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', margin: '14px 0 8px' }}>Passés</p>
              {past.map(ev => <EventCard key={ev.id} ev={ev} isCoach={isCoach} navigate={navigate} past />)}
            </>
          )}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>
              Aucun événement pour l'instant.{isCoach && ' Clique sur "+ Ajouter" pour commencer.'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EventCard({ ev, isCoach, navigate, past = false }) {
  const date = parseISO(ev.date_heure)
  const dateStr = format(date, "EEE d MMM · HH'h'mm", { locale: fr })

  return (
    <Card style={{ opacity: past ? 0.75 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Badge type={ev.type}>{ev.type === 'match' ? 'Match' : 'Séance'}</Badge>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</span>
      </div>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: ev.lieu ? 4 : 10 }}>
        📅 {dateStr}{ev.domicile !== undefined && ev.type === 'match' ? (ev.domicile ? ' · Domicile' : ' · Déplacement') : ''}
      </p>
      {ev.lieu && <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>📍 {ev.lieu}</p>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {isCoach && ev.type === 'match' && (
          <Button size="sm" onClick={() => navigate(`/stats/${ev.id}`)}>📊 Stats</Button>
        )}
        {isCoach && ev.type === 'match' && (
          <Button size="sm" onClick={() => navigate(`/convocations/${ev.id}`)}>📢 Convocations</Button>
        )}
        <Button size="sm" onClick={() => navigate(`/rpe?event=${ev.id}`)}>❤️ RPE</Button>
      </div>

      {/* Statut notifications */}
      {isCoach && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F3F4F6' }}>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
            📱 Notif J-2 ✅ · Notif J-1 {past ? '✅' : '⏳'} · RPE {past ? '✅' : '⏳'}
          </span>
        </div>
      )}
    </Card>
  )
}
