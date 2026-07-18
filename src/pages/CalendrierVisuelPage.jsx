import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
         isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { List, ChevronLeft, ChevronRight, MapPin, Clock, Send, BarChart3, Heart, Swords, Footprints, Plus } from 'lucide-react'

const TYPE_COLORS = { match: 'var(--primary)', seance: 'var(--success)' }

export default function CalendrierVisuelPage() {
  const navigate = useNavigate()
  const { isCoach, isAdjoint, isJoueur } = useAuth()
  const isStaff = isCoach || isAdjoint
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
          style={{ border: 'none', background: 'var(--primary-bg)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <List size={12} /> Liste
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ChevronLeft size={20} /></button>
          <p style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>
            {format(currentMonth, 'MMMM yyyy', { locale: fr })}
          </p>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ChevronRight size={20} /></button>
        </div>
        <button onClick={() => setCurrentMonth(new Date())}
          style={{ border: 'none', background: 'rgba(24,95,165,.1)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
          Auj.
        </button>
      </div>

      {/* Jours de la semaine */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
        {['L','M','M','J','V','S','D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
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
                background: isSelected ? 'var(--primary)' : today ? 'var(--primary-bg)' : 'transparent',
                border: `1px solid ${isSelected ? 'var(--primary)' : today ? 'var(--primary)' : 'var(--bg-secondary)'}`,
                transition: 'all .15s'
              }}>
              <p style={{
                fontSize: 12, fontWeight: today || isSelected ? 700 : 400,
                textAlign: 'center', marginBottom: 3,
                color: isSelected ? '#fff' : today ? 'var(--primary)' : isSameMonth(day, currentMonth) ? 'var(--text-primary)' : 'var(--border)'
              }}>{format(day, 'd')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                {hasMatch && <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? '#fff' : TYPE_COLORS.match }} />}
                {hasSeance && <div style={{ width: 6, height: 6, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,.7)' : TYPE_COLORS.seance }} />}
                {dayEvs.length > 1 && !hasMatch && !hasSeance && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
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
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Match</span>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS.seance }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Séance</span>
        </div>
      </div>

      {/* Événements du jour sélectionné */}
      {selectedDay && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--primary)' }}>
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </p>
          {dayEvents.length === 0 ? (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun événement ce jour.</p>
              {isCoach && (
                <button onClick={() => navigate('/calendrier')}
                  style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Plus size={12} /> Ajouter un événement
                </button>
              )}
            </div>
          ) : (
            dayEvents.map(ev => (
              <div key={ev.id} style={{
                background: 'var(--bg-card)', border: `2px solid ${TYPE_COLORS[ev.type] || 'var(--border)'}`,
                borderRadius: 12, padding: '12px 14px', marginBottom: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: TYPE_COLORS[ev.type], marginRight: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {ev.type === 'match' ? <Swords size={11} /> : <Footprints size={11} />} {ev.type === 'match' ? 'Match' : 'Séance'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{ev.titre}</span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {format(parseISO(ev.date_heure), "HH'h'mm")}
                  </span>
                </div>
                {ev.lieu && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} /> {ev.lieu}</p>}
                {ev.type === 'match' && ev.rdv_heure && (
                  <p style={{ fontSize: 11, color: 'var(--primary)', marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} /> RDV {ev.rdv_heure}{ev.rdv_lieu ? ` · ${ev.rdv_lieu}` : ''}
                  </p>
                )}
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isCoach && ev.type === 'match' && (
                    <button onClick={() => navigate(`/convocations/${ev.id}`)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Send size={11} /> Convoquer</button>
                  )}
                  {isStaff && ev.type === 'match' && (
                    <button onClick={() => navigate(`/stats/${ev.id}`)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><BarChart3 size={11} /> Stats</button>
                  )}
                  {isStaff && (
                    <button onClick={() => navigate(`/rpe?event=${ev.id}`)}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={11} /> RPE</button>
                  )}
                  {isJoueur && (
                    <button onClick={() => navigate('/mon-suivi')}
                      style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Heart size={11} /> Mon suivi</button>
                  )}
                  {/* Vue liste */}
                  <button onClick={() => navigate('/calendrier')}
                    style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid var(--border)', background: 'transparent', fontSize: 11, cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <List size={11} /> Vue liste
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!selectedDay && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {events.filter(e => isSameMonth(parseISO(e.date_heure), currentMonth)).length} événement(s) ce mois
          </p>
          <p style={{ fontSize: 11, color: 'var(--border)', marginTop: 4 }}>Clique sur un jour pour voir le détail</p>
        </div>
      )}
    </div>
  )
}
