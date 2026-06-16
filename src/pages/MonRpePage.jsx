import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const RPE_ITEMS = [
  { key: 'difficulte',        label: 'Difficulté ressentie' },
  { key: 'fatigue',           label: 'Fatigue ressentie' },
  { key: 'implication',       label: 'Implication' },
  { key: 'motivation',        label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. individuelle' },
  { key: 'perf_collective',   label: 'Perf. collective' },
]

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function MonRpePage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('event')

  const [activeTab, setActiveTab] = useState('afaire')
  const [events, setEvents] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [rpeHistory, setRpeHistory] = useState([])
  const [selectedHistEvent, setSelectedHistEvent] = useState('')
  const [form, setForm] = useState({})
  const [commentaire, setCommentaire] = useState('')
  const [savingEventId, setSavingEventId] = useState(null)
  const [savedEventId, setSavedEventId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: evs }, { data: rpe }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(30),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(30)
    ])

    setEvents(evs || [])
    setRpeHistory(rpe || [])

    const rpeIds = new Set((rpe || []).map(r => r.evenement_id))
    const passesRecents = (evs || []).filter(e => new Date(e.date_heure) < new Date())
    const aFaire = passesRecents.filter(e => !rpeIds.has(e.id))
    setEventsAFaire(aFaire)

    if (rpe?.length && !selectedHistEvent) {
      setSelectedHistEvent(rpe[0].evenement_id)
    }

    // Si on arrive depuis le calendrier avec un event précis
    if (eventIdParam) setActiveTab('afaire')

    setLoading(false)
  }

  async function handleSave(eventId) {
    const vals = Object.values(form[eventId] || {}).filter(v => v !== undefined && v !== null)
    if (vals.length === 0) return

    setSavingEventId(eventId)
    const payload = {
      joueur_id: profile.id,
      evenement_id: eventId,
      commentaire: commentaire[eventId] || '',
      ...Object.fromEntries(RPE_ITEMS.map(item => [item.key, form[eventId]?.[item.key] !== undefined ? parseFloat(form[eventId][item.key]) : null]))
    }

    const existing = rpeHistory.find(r => r.evenement_id === eventId)
    if (existing) await supabase.from('rpe').update(payload).eq('id', existing.id)
    else await supabase.from('rpe').insert(payload)

    setSavingEventId(null)
    setSavedEventId(eventId)
    setForm(p => ({ ...p, [eventId]: {} }))
    setTimeout(() => setSavedEventId(null), 3000)
    loadData()
  }

  function setItemValue(eventId, key, value) {
    setForm(p => ({ ...p, [eventId]: { ...(p[eventId] || {}), [key]: value } }))
  }

  function setComm(eventId, value) {
    setCommentaire(p => ({ ...p, [eventId]: value }))
  }

  const selectedRpe = rpeHistory.find(r => r.evenement_id === selectedHistEvent)
  const selectedEvent = events.find(e => e.id === selectedHistEvent)

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''
    return `${ev.type === 'match' ? '⚽' : '🏃'} ${ev.titre} — ${dateStr}`
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon RPE" />

      {/* Tabs — seulement 2 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['afaire', `📝 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
          ['historique', '📊 Historique'],
        ].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: `0.5px solid ${tab === 'afaire' && eventsAFaire.length > 0 ? '#A32D2D' : '#D1D5DB'}`,
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : tab === 'afaire' && eventsAFaire.length > 0 ? '#A32D2D' : '#6B7280',
            fontWeight: activeTab === tab || (tab === 'afaire' && eventsAFaire.length > 0) ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* À FAIRE — liste des événements sans RPE, formulaire intégré */}
          {activeTab === 'afaire' && (
            <>
              {eventsAFaire.length === 0 ? (
                <Card>
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>Tout est à jour !</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Tu as rempli ton RPE pour tous les événements récents.</p>
                  </div>
                </Card>
              ) : (
                eventsAFaire.map(ev => (
                  <Card key={ev.id} style={{ marginBottom: 12 }}>
                    {/* En-tête événement */}
                    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{ev.titre}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                      </p>
                    </div>

                    {/* Items RPE */}
                    {RPE_ITEMS.map(item => {
                      const val = form[ev.id]?.[item.key]
                      return (
                        <div key={item.key} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</label>
                            <span style={{ fontSize: 13, fontWeight: 700, color: val !== undefined ? rpeColor(val) : '#D1D5DB' }}>
                              {val !== undefined ? val : '—'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {[0,1,2,3,4,5].map(v => (
                              <button key={v} onClick={() => setItemValue(ev.id, item.key, v)} style={{
                                flex: 1, padding: '9px 4px', borderRadius: 8,
                                border: `1.5px solid ${val === v ? rpeColor(v) : '#E5E7EB'}`,
                                background: val === v ? `${rpeColor(v)}20` : '#fff',
                                color: val === v ? rpeColor(v) : '#6B7280',
                                fontSize: 13, fontWeight: val === v ? 700 : 400, cursor: 'pointer'
                              }}>{v}</button>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {/* Commentaire */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Commentaire (optionnel)</label>
                      <textarea value={commentaire[ev.id] || ''} onChange={e => setComm(ev.id, e.target.value)}
                        placeholder="Comment tu t'es senti ?"
                        rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    {savedEventId === ev.id && (
                      <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>
                        ✅ RPE enregistré avec succès !
                      </div>
                    )}

                    <button onClick={() => handleSave(ev.id)}
                      disabled={savingEventId === ev.id || !form[ev.id] || Object.keys(form[ev.id] || {}).length === 0}
                      style={{
                        width: '100%', padding: 13,
                        background: form[ev.id] && Object.keys(form[ev.id]).length > 0 ? THEME.gradient : '#E5E7EB',
                        color: form[ev.id] && Object.keys(form[ev.id]).length > 0 ? '#fff' : '#9CA3AF',
                        border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                        cursor: form[ev.id] && Object.keys(form[ev.id]).length > 0 ? 'pointer' : 'not-allowed'
                      }}>
                      {savingEventId === ev.id ? 'Enregistrement...' : '💾 Enregistrer mon RPE'}
                    </button>
                  </Card>
                ))
              )}
            </>
          )}

          {/* HISTORIQUE — menu déroulant + détail */}
          {activeTab === 'historique' && (
            <>
              {rpeHistory.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucun RPE enregistré pour l'instant.</p>
                </Card>
              ) : (
                <>
                  {/* Menu déroulant événement */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Choisir un événement</label>
                    <select value={selectedHistEvent} onChange={e => setSelectedHistEvent(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                      {rpeHistory.map(r => (
                        <option key={r.id} value={r.evenement_id}>
                          {formatEventLabel(r.evenements || events.find(e => e.id === r.evenement_id))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Détail du RPE sélectionné */}
                  {selectedRpe && (
                    <Card>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{selectedRpe.evenements?.titre}</p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {selectedRpe.evenements?.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {selectedRpe.evenements?.date_heure ? format(parseISO(selectedRpe.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                          </p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          {(() => {
                            const avg = (RPE_ITEMS.reduce((s,i) => s+(selectedRpe[i.key]||0),0)/RPE_ITEMS.length).toFixed(1)
                            return (
                              <>
                                <div style={{ fontSize: 20, fontWeight: 800, color: rpeColor(parseFloat(avg)) }}>{avg}</div>
                                <div style={{ fontSize: 9, color: '#9CA3AF' }}>Moy./5</div>
                              </>
                            )
                          })()}
                        </div>
                      </div>

                      {/* Barres par item */}
                      {RPE_ITEMS.map(item => {
                        const val = selectedRpe[item.key]
                        return (
                          <div key={item.key} style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                              <span style={{ color: '#374151' }}>{item.label}</span>
                              <span style={{ fontWeight: 700, color: val !== null ? rpeColor(val) : '#9CA3AF' }}>{val ?? '—'}/5</span>
                            </div>
                            <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 4, background: val !== null ? rpeColor(val) : '#E5E7EB', width: `${val !== null ? val/5*100 : 0}%`, transition: 'width .3s' }} />
                            </div>
                          </div>
                        )
                      })}

                      {selectedRpe.commentaire && (
                        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px', marginTop: 10 }}>
                          <p style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>💬 {selectedRpe.commentaire}</p>
                        </div>
                      )}
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
