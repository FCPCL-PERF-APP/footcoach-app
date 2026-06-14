import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
         isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'

const TYPE_COLORS = { match: '#1A3A6B', seance: '#3B6D11' }

export default function CalendrierVisuelPage() {
  const navigate = useNavigate()
  const { isCoach, isJoueur, profile } = useAuth()
  const [events, setEvents] = useState([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayEvents, setDayEvents] = useState([])

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    const { data } = await supabase.from('evenements').select('*').order('date_heure')
    setEvents(data || [])
  }

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Padding début (lundi = 1)
  const startPad = (monthStart.getDay() + 6) % 7

  function getEventsForDay(day) {
    return events.filter(e => e.date_heure && isSameDay(parseISO(e.date_heure), day))
  }

  function handleDayClick(day) {
    const evs = getEventsForDay(day)
    setSelectedDay(day)
    setDayEvents(evs)
  }

  return (
    <div style={{ padding: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')}
          style={{ border: 'none', background: 'rgba(24,95,165,.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: THEME.primary, fontWeight: 600 }}>
          ← Liste
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>‹</button>
          <p style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </p>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#6B7280' }}>›</button>
        </div>
        <button onClick={() => setCurrentMonth(new Date())}
          style={{ border: 'none', background: 'rgba(24,95,165,.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: THEME.primary, fontWeight: 600 }}>
          Auj.
        </button>
      </div>

      {/* Jours de la semaine */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['L','M','M','J','V','S','D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#9CA3AF', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grille calendrier */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {/* Padding début */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {/* Jours */}
        {days.map(day => {
          const dayEvs = getEventsForDay(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)
          const today = isToday(day)
          const hasMatch = dayEvs.some(e => e.type === 'match')
          const hasSeance = dayEvs.some(e => e.type === 'seance')
          return (
            <div key={day.toISOString()} onClick={() => handleDayClick(day)}
              style={{
                minHeight: 44, borderRadius: 8, padding: '4px 2px',
                cursor: dayEvs.length > 0 ? 'pointer' : 'default',
                background: isSelected ? THEME.primary : today ? '#E6F1FB' : 'transparent',
                border: `1px solid ${isSelected ? THEME.primary : today ? THEME.primary : '#F3F4F6'}`,
                transition: 'all .15s'
              }}>
              <p style={{
                fontSize: 12, fontWeight: today || isSelected ? 700 : 400,
                textAlign: 'center', marginBottom: 3,
                color: isSelected ? '#fff' : today ? THEME.primary : isSameMonth(day, currentMonth) ? '#374151' : '#D1D5DB'
              }}>{format(day, 'd')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                {hasMatch && <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? '#fff' : TYPE_COLORS.match }} />}
                {hasSeance && <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,.7)' : TYPE_COLORS.seance }} />}
                {dayEvs.length > 1 && !hasMatch && !hasSeance && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#9CA3AF' }} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Légende */}
      <div style={{ display: 'flex', gap: 14, marginTop: 10, marginBottom: 14, justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS.match }} />
          <span style={{ fontSize: 11, color: '#6B7280' }}>Match</span>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS.seance }} />
          <span style={{ fontSize: 11, color: '#6B7280' }}>Séance</span>
        </div>
      </div>

      {/* Événements du jour sélectionné */}
      {selectedDay && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: THEME.primary }}>
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </p>
          {dayEvents.length === 0 ? (
            <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 14, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#9CA3AF' }}>Aucun événement ce jour.</p>
              {isCoach && (
                <button onClick={() => navigate('/calendrier')}
                  style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: 'none', background: THEME.primary, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                  + Ajouter un événement
                </button>
              )}
            </div>
          ) : (
            dayEvents.map(ev => (
              <div key={ev.id} style={{
                background: '#fff', border: `2px solid ${TYPE_COLORS[ev.type] || '#E5E7EB'}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLORS[ev.type], marginRight: 6 }}>
                      {ev.type === 'match' ? '⚽ Match' : '🏃 Séance'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{ev.titre}</span>
                  </div>
                  <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>
                    {format(parseISO(ev.date_heure), "HH'h'mm")}
                  </span>
                </div>
                {ev.lieu && <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>📍 {ev.lieu}</p>}
                {ev.type === 'match' && ev.rdv_heure && (
                  <p style={{ fontSize: 11, color: THEME.primary, marginBottom: 8, fontWeight: 500 }}>
                    🕐 RDV {ev.rdv_heure}{ev.rdv_lieu ? ` · ${ev.rdv_lieu}` : ''}
                  </p>
                )}
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isCoach && ev.type === 'match' && (
                    <>
                      <button onClick={() => navigate(`/convocations/${ev.id}`)}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>📢 Convoquer</button>
                      <button onClick={() => navigate(`/stats/${ev.id}`)}
                        style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>📊 Stats</button>
                    </>
                  )}
                  {isCoach && (
                    <button onClick={() => navigate(`/rpe?event=${ev.id}`)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>❤️ RPE</button>
                  )}
                  {isJoueur && (
                    <button onClick={() => navigate(`/mon-rpe?event=${ev.id}`)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer' }}>❤️ Mon RPE</button>
                  )}
                  {/* Vue liste */}
                  <button onClick={() => navigate('/calendrier')}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer', color: THEME.primary }}>
                    ≡ Vue liste
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!selectedDay && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            {events.filter(e => isSameMonth(parseISO(e.date_heure), currentMonth)).length} événement(s) ce mois
          </p>
          <p style={{ fontSize: 11, color: '#D1D5DB', marginTop: 4 }}>Clique sur un jour pour voir le détail</p>
        </div>
      )}
    </div>
  )
}
