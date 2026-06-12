import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO, addMonths, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function CalendrierVisuelPage() {
  const { isCoach } = useAuth()
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => { loadEvents() }, [currentMonth])

  async function loadEvents() {
    setLoading(true)
    const start = startOfMonth(currentMonth).toISOString()
    const end = endOfMonth(currentMonth).toISOString()
    const { data } = await supabase.from('evenements').select('*')
      .gte('date_heure', start).lte('date_heure', end)
      .order('date_heure', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = (startOfMonth(currentMonth).getDay() + 6) % 7 // Lundi = 0

  const eventsForDay = (day) => events.filter(e => isSameDay(parseISO(e.date_heure), day))

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : []

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Calendrier" />

      {/* Navigation mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 8px' }}>‹</button>
        <p style={{ fontSize: 16, fontWeight: 700, textTransform: 'capitalize' }}>
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </p>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, padding: '4px 8px' }}>›</button>
      </div>

      {/* En-têtes jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['L','M','M','J','V','S','D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#9CA3AF', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 14 }}>
        {/* Cases vides avant le 1er */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {/* Jours du mois */}
        {days.map(day => {
          const dayEvents = eventsForDay(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          const hasMatch = dayEvents.some(e => e.type === 'match')
          const hasSeance = dayEvents.some(e => e.type === 'seance')
          return (
            <div key={day.toISOString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              style={{
                aspectRatio: '1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                background: isSelected ? THEME.primary : isToday(day) ? '#E6F1FB' : 'transparent',
                border: isToday(day) && !isSelected ? `1.5px solid ${THEME.primary}` : '1.5px solid transparent',
                position: 'relative'
              }}>
              <span style={{
                fontSize: 13, fontWeight: isToday(day) ? 700 : 400,
                color: isSelected ? '#fff' : isToday(day) ? THEME.primary : '#374151'
              }}>
                {format(day, 'd')}
              </span>
              {/* Indicateurs événements */}
              {dayEvents.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  {hasMatch && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#185FA5' }} />}
                  {hasSeance && <div style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#3B6D11' }} />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 11, color: '#6B7280' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#185FA5', marginRight: 4 }} />Match</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#3B6D11', marginRight: 4 }} />Séance</span>
      </div>

      {/* Événements du jour sélectionné */}
      {selectedDay && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'capitalize' }}>
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </p>
          {selectedDayEvents.length === 0 ? (
            <Card>
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 12 }}>Aucun événement ce jour.</p>
            </Card>
          ) : (
            selectedDayEvents.map(ev => (
              <Card key={ev.id} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 8,
                    background: ev.type === 'match' ? '#E6F1FB' : '#EAF3DE',
                    color: ev.type === 'match' ? '#185FA5' : '#3B6D11'
                  }}>{ev.type === 'match' ? '⚽ Match' : '🏃 Séance'}</span>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</p>
                </div>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>
                  🕐 {format(parseISO(ev.date_heure), 'HH:mm')} {ev.lieu ? `· 📍 ${ev.lieu}` : ''}
                </p>
                {ev.rdv_heure && <p style={{ fontSize: 11, color: THEME.primary, marginBottom: 8 }}>🕐 RDV {ev.rdv_heure}{ev.rdv_lieu ? ` · ${ev.rdv_lieu}` : ''}</p>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isCoach && ev.type === 'match' && (
                    <button onClick={() => navigate(`/convocations/${ev.id}`)} style={{ padding: '4px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>📢 Convocations</button>
                  )}
                  {isCoach && ev.type === 'match' && (
                    <button onClick={() => navigate(`/presences/${ev.id}`)} style={{ padding: '4px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>✅ Présences</button>
                  )}
                  {isCoach && ev.type === 'match' && (
                    <button onClick={() => navigate(`/stats/${ev.id}`)} style={{ padding: '4px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>📊 Stats</button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {loading && <Spinner />}
    </div>
  )
}
