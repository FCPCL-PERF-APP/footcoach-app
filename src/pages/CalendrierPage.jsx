import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Badge, Button, Input, Select, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, isAfter, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function CalendrierPage() {
  const { isCoach, isJoueur, profile } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [filter, setFilter] = useState('tous')
  const [form, setForm] = useState({
    type: 'match', titre: '', date: '', heure: '15:00',
    lieu: '', domicile: true, rdv_heure: '14:00', rdv_lieu: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase.from('evenements').select('*').order('date_heure', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  async function saveEvent() {
    if (!form.titre || !form.date) return
    setSaving(true)
    await supabase.from('evenements').insert({
      type: form.type,
      titre: form.titre,
      date_heure: `${form.date}T${form.heure}:00`,
      lieu: form.lieu,
      domicile: form.domicile,
      rdv_heure: form.type === 'match' ? form.rdv_heure : null,
      rdv_lieu: form.type === 'match' ? form.rdv_lieu : null,
    })
    setSaving(false)
    setShowAdd(false)
    setForm({ type: 'match', titre: '', date: '', heure: '15:00', lieu: '', domicile: true, rdv_heure: '14:00', rdv_lieu: '' })
    loadEvents()
  }

  const filtered = events.filter(e => filter === 'tous' || e.type === filter)
  const upcoming = filtered.filter(e => isAfter(parseISO(e.date_heure), new Date()))
  const past = filtered.filter(e => isBefore(parseISO(e.date_heure), new Date()))

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Calendrier</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate('/calendrier-visuel')} style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>📅 Vue mois</button>
          {isCoach && <button onClick={() => setShowRecurring(!showRecurring)} style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 12, cursor: 'pointer' }}>🔁</button>}
          {isCoach && <button onClick={() => setShowAdd(!showAdd)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#185FA5', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>+ Ajouter</button>}
        </div>
      </div>

      {/* ANCIEN PageHeader remplacé — garde le reste */}
      {false && <PageHeader
        title="Calendrier"
        action={isCoach && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="sm" onClick={() => setShowRecurring(!showRecurring)}>🔁</Button>
            <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>+ Ajouter</Button>
          </div>
        )}
      />}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['tous','match','seance'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: filter === f ? '#E6F1FB' : 'transparent',
            color: filter === f ? THEME.primary : '#6B7280',
            fontWeight: filter === f ? 600 : 400
          }}>
            {f === 'tous' ? 'Tous' : f === 'match' ? 'Matchs' : 'Séances'}
          </button>
        ))}
      </div>

      {showAdd && isCoach && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nouvel événement</p>
          <Select label="Type" value={form.type} onChange={v => setForm(p => ({...p, type: v}))}
            options={[{value:'match',label:'⚽ Match'},{value:'seance',label:'🏃 Séance'}]} />
          <Input label="Adversaire / Intitulé" value={form.titre} onChange={v => setForm(p => ({...p, titre: v}))} placeholder="vs FC Nancy R" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Date" type="date" value={form.date} onChange={v => setForm(p => ({...p, date: v}))} />
            <Input label="Heure du match" type="time" value={form.heure} onChange={v => setForm(p => ({...p, heure: v}))} />
          </div>
          <Input label="Lieu" value={form.lieu} onChange={v => setForm(p => ({...p, lieu: v}))} placeholder="Stade municipal..." />
          {form.type === 'match' && (
            <>
              <Select label="Domicile / Déplacement" value={form.domicile ? 'dom' : 'dep'}
                onChange={v => setForm(p => ({...p, domicile: v === 'dom'}))}
                options={[{value:'dom',label:'🏠 Domicile'},{value:'dep',label:'🚌 Déplacement'}]} />
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: THEME.primary, marginBottom: 8 }}>📍 Rendez-vous joueurs</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Input label="Heure de RDV" type="time" value={form.rdv_heure} onChange={v => setForm(p => ({...p, rdv_heure: v}))} />
                  <Input label="Lieu de RDV" value={form.rdv_lieu} onChange={v => setForm(p => ({...p, rdv_lieu: v}))} placeholder="Vestiaires..." />
                </div>
              </div>
            </>
          )}
          <Button variant="primary" style={{ width: '100%' }} onClick={saveEvent} disabled={saving}>
            {saving ? 'Création...' : 'Créer l\'événement'}
          </Button>
        </Card>
      )}

      {showRecurring && isCoach && <RecurringModal onClose={() => setShowRecurring(false)} onSave={loadEvents} />}

      {loading ? <Spinner /> : (
        <>
          {upcoming.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>À venir</p>
              {upcoming.map(ev => <EventCard key={ev.id} ev={ev} isCoach={isCoach} isJoueur={isJoueur} navigate={navigate} profile={profile} />)}
            </>
          )}
          {past.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', margin: '14px 0 8px' }}>Passés</p>
              {past.map(ev => <EventCard key={ev.id} ev={ev} isCoach={isCoach} isJoueur={isJoueur} navigate={navigate} profile={profile} past />)}
            </>
          )}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>
              Aucun événement.{isCoach && ' Clique sur "+ Ajouter".'}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EventCard({ ev, isCoach, isJoueur, navigate, past = false, profile }) {
  const date = parseISO(ev.date_heure)
  const dateStr = format(date, "EEE d MMM · HH'h'mm", { locale: fr })

  return (
    <Card style={{ opacity: past ? 0.75 : 1, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Badge type={ev.type}>{ev.type === 'match' ? '⚽ Match' : '🏃 Séance'}</Badge>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</span>
      </div>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>
        📅 {dateStr}{ev.type === 'match' ? (ev.domicile ? ' · Domicile' : ' · Déplacement') : ''}
      </p>
      {ev.lieu && <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2 }}>📍 {ev.lieu}</p>}
      {ev.type === 'match' && ev.rdv_heure && (
        <p style={{ fontSize: 11, color: THEME.primary, marginBottom: 8, fontWeight: 500 }}>
          🕐 RDV {ev.rdv_heure}{ev.rdv_lieu ? ` · ${ev.rdv_lieu}` : ''}
        </p>
      )}

      {/* Boutons COACH */}
      {isCoach && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {ev.type === 'match' && <Button size="sm" onClick={() => navigate(`/convocations/${ev.id}`)}>📢 Convocations</Button>}
          {ev.type === 'match' && <Button size="sm" onClick={() => navigate(`/presences/${ev.id}`)}>✅ Présences</Button>}
          {ev.type === 'match' && <Button size="sm" onClick={() => navigate(`/stats/${ev.id}`)}>📊 Stats</Button>}
          <Button size="sm" onClick={() => navigate(`/rpe?event=${ev.id}`)}>❤️ RPE</Button>
          <Button size="sm" onClick={() => navigate(`/footbar?event=${ev.id}`)}>📡 Footbar</Button>
        </div>
      )}

      {/* Boutons JOUEUR */}
      {isJoueur && <JoueurEventActions ev={ev} navigate={navigate} profile={profile} />}

      {isCoach && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid #F3F4F6' }}>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>
            📱 Notif J-2 {past ? '✅' : '⏳'} · Notif J-1 {past ? '✅' : '⏳'} · RPE {past ? '✅' : '⏳'}
          </span>
        </div>
      )}
    </Card>
  )
}


function JoueurEventActions({ ev, navigate, profile }) {
  const [statut, setStatut] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile?.id) loadStatut()
  }, [ev.id, profile?.id])

  async function loadStatut() {
    setLoading(true)
    const { data } = await supabase
      .from('presences')
      .select('statut')
      .eq('evenement_id', ev.id)
      .eq('joueur_id', profile?.id)
      .maybeSingle()
    setStatut(data?.statut || null)
    setLoading(false)
  }

  async function handleStatut(newStatut) {
    if (!profile?.id) return
    setSaving(true)
    // Supprime l'ancienne présence si elle existe
    await supabase.from('presences').delete()
      .eq('evenement_id', ev.id)
      .eq('joueur_id', profile?.id)
    // Insère la nouvelle
    await supabase.from('presences').insert({
      evenement_id: ev.id,
      joueur_id: profile?.id,
      statut: newStatut
    })
    setStatut(newStatut)
    setSaving(false)
  }

  const STATUTS = [
    { key: 'present', label: '✅ Présent',  bg: '#EAF3DE', color: '#3B6D11', border: '#3B6D11' },
    { key: 'absent',  label: '❌ Absent',   bg: '#FCEBEB', color: '#A32D2D', border: '#A32D2D' },
    { key: 'blesse',  label: '🤕 Blessé',   bg: '#FAEEDA', color: '#854F0B', border: '#854F0B' },
  ]

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #F3F4F6' }}>
      {/* Confirmation présence */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>
        Ma présence :
      </p>
      {loading ? (
        <p style={{ fontSize: 11, color: '#9CA3AF' }}>Chargement...</p>
      ) : (
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {STATUTS.map(s => (
            <button key={s.key} onClick={() => handleStatut(s.key)} disabled={saving}
              style={{
                flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11,
                border: `1.5px solid ${statut === s.key ? s.border : '#E5E7EB'}`,
                background: statut === s.key ? s.bg : 'transparent',
                color: statut === s.key ? s.color : '#9CA3AF',
                fontWeight: statut === s.key ? 600 : 400,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'all .15s'
              }}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      {/* Boutons RPE et Footbar */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => navigate(`/mon-rpe?event=${ev.id}`)}
          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, border: '0.5px solid #D1D5DB', background: 'transparent', cursor: 'pointer', color: '#374151' }}>
          ❤️ Mon RPE
        </button>
        <button onClick={() => navigate(`/mon-footbar?event=${ev.id}`)}
          style={{ flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, border: '0.5px solid #D1D5DB', background: 'transparent', cursor: 'pointer', color: '#374151' }}>
          📡 Footbar
        </button>
      </div>
    </div>
  )
}

function RecurringModal({ onClose, onSave }) {
  const [form, setForm] = useState({ titre: 'Entraînement', jour: '2', heure: '19:30', lieu: '', dateDebut: '', dateFin: '' })
  const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  const [saving, setSaving] = useState(false)
  const iStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    if (!form.titre || !form.dateDebut || !form.dateFin) return
    setSaving(true)
    const start = new Date(form.dateDebut)
    const end = new Date(form.dateFin)
    const jourNum = parseInt(form.jour)
    const seances = []
    const current = new Date(start)
    while (current.getDay() !== jourNum) current.setDate(current.getDate() + 1)
    while (current <= end) {
      seances.push({ type: 'seance', titre: form.titre, date_heure: `${current.toISOString().split('T')[0]}T${form.heure}:00`, lieu: form.lieu, domicile: true })
      current.setDate(current.getDate() + 7)
    }
    await supabase.from('evenements').insert(seances)
    setSaving(false)
    alert(`✅ ${seances.length} séances créées !`)
    onSave(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>🔁 Séances récurrentes</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Intitulé</label><input value={form.titre} onChange={e => setForm(p => ({...p, titre: e.target.value}))} style={iStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Jour</label><select value={form.jour} onChange={e => setForm(p => ({...p, jour: e.target.value}))} style={iStyle}>{JOURS.map((j,i) => <option key={i} value={i}>{j}</option>)}</select></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Heure</label><input type="time" value={form.heure} onChange={e => setForm(p => ({...p, heure: e.target.value}))} style={iStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date début</label><input type="date" value={form.dateDebut} onChange={e => setForm(p => ({...p, dateDebut: e.target.value}))} style={iStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date fin</label><input type="date" value={form.dateFin} onChange={e => setForm(p => ({...p, dateFin: e.target.value}))} style={iStyle} /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Lieu</label><input value={form.lieu} onChange={e => setForm(p => ({...p, lieu: e.target.value}))} placeholder="Terrain 1" style={iStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, background: THEME.gradient, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Création...' : 'Créer toutes les séances'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', background: '#F3F4F6', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}
