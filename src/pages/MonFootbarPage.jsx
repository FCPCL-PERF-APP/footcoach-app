import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const FOOTBAR_FIELDS = [
  { key: 'distance_km',     label: 'Distance',       unit: 'km',   placeholder: '8.4',  step: '0.1' },
  { key: 'sprint_max',      label: 'Sprint max',     unit: 'km/h', placeholder: '28.5', step: '0.1' },
  { key: 'sprints',         label: 'Nb sprints',     unit: '',     placeholder: '12',   step: '1' },
  { key: 'distance_hi',     label: 'Haute intensité',unit: 'm',    placeholder: '680',  step: '1' },
  { key: 'temps_jeu',       label: 'Temps de jeu',   unit: 'min',  placeholder: '90',   step: '1' },
  { key: 'ballons_touches', label: 'Ballons',        unit: '',     placeholder: '47',   step: '1' },
  { key: 'nb_passes',       label: 'Passes',         unit: '',     placeholder: '32',   step: '1' },
  { key: 'nb_tirs',         label: 'Tirs',           unit: '',     placeholder: '3',    step: '1' },
]

export default function MonFootbarPage() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('event')

  const [activeTab, setActiveTab] = useState('afaire')
  const [events, setEvents] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [selectedHistEvent, setSelectedHistEvent] = useState('')
  const [forms, setForms] = useState({})
  const [savingEventId, setSavingEventId] = useState(null)
  const [savedEventId, setSavedEventId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: evs }, { data: foot }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(30),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(30)
    ])

    setEvents(evs || [])
    setFootHistory(foot || [])

    const footIds = new Set((foot || []).map(f => f.evenement_id))
    const passesRecents = (evs || []).filter(e => new Date(e.date_heure) < new Date())
    const aFaire = passesRecents.filter(e => !footIds.has(e.id))
    setEventsAFaire(aFaire)

    if (foot?.length && !selectedHistEvent) setSelectedHistEvent(foot[0].evenement_id)

    setLoading(false)
  }

  async function handleSave(eventId) {
    const form = forms[eventId] || {}
    const vals = Object.values(form).filter(v => v !== undefined && v !== null && v !== '')
    if (vals.length === 0) return

    setSavingEventId(eventId)
    const payload = {
      joueur_id: profile.id,
      evenement_id: eventId,
      ...Object.fromEntries(FOOTBAR_FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null]))
    }

    const existing = footHistory.find(f => f.evenement_id === eventId)
    if (existing) await supabase.from('footbar').update(payload).eq('id', existing.id)
    else await supabase.from('footbar').insert(payload)

    setSavingEventId(null)
    setSavedEventId(eventId)
    setForms(p => ({ ...p, [eventId]: {} }))
    setTimeout(() => setSavedEventId(null), 3000)
    loadData()
  }

  function setField(eventId, key, value) {
    setForms(p => ({ ...p, [eventId]: { ...(p[eventId] || {}), [key]: value } }))
  }

  const selectedFoot = footHistory.find(f => f.evenement_id === selectedHistEvent)

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''
    return `${ev.type === 'match' ? '⚽' : '🏃'} ${ev.titre} — ${dateStr}`
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon Footbar" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['afaire', `📝 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
          ['historique', '📊 Historique'],
        ].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: `0.5px solid ${tab === 'afaire' && eventsAFaire.length > 0 ? '#185FA5' : '#D1D5DB'}`,
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* À FAIRE */}
          {activeTab === 'afaire' && (
            <>
              {eventsAFaire.length === 0 ? (
                <Card>
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>Tout est à jour !</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Footbar rempli pour tous les événements récents.</p>
                  </div>
                </Card>
              ) : (
                eventsAFaire.map(ev => {
                  const form = forms[ev.id] || {}
                  const hasValues = Object.values(form).some(v => v !== undefined && v !== null && v !== '')
                  return (
                    <Card key={ev.id} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700 }}>{ev.titre}</p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                          </p>
                        </div>
                        {ev.type === 'match' && (
                          <span style={{ fontSize: 10, color: '#185FA5', background: '#E6F1FB', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Recommandé</span>
                        )}
                        {ev.type === 'seance' && (
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Optionnel</span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                        {FOOTBAR_FIELDS.map(f => (
                          <div key={f.key}>
                            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
                              {f.label} {f.unit && <span style={{ color: '#9CA3AF' }}>({f.unit})</span>}
                            </label>
                            <input type="number" step={f.step} placeholder={f.placeholder}
                              value={form[f.key] || ''}
                              onChange={e => setField(ev.id, f.key, e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>

                      {savedEventId === ev.id && (
                        <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>
                          ✅ Footbar enregistré !
                        </div>
                      )}

                      <button onClick={() => handleSave(ev.id)}
                        disabled={savingEventId === ev.id || !hasValues}
                        style={{
                          width: '100%', padding: 13,
                          background: hasValues ? THEME.gradient : '#E5E7EB',
                          color: hasValues ? '#fff' : '#9CA3AF',
                          border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                          cursor: hasValues ? 'pointer' : 'not-allowed'
                        }}>
                        {savingEventId === ev.id ? 'Enregistrement...' : '💾 Enregistrer mon Footbar'}
                      </button>
                    </Card>
                  )
                })
              )}
            </>
          )}

          {/* HISTORIQUE — menu déroulant */}
          {activeTab === 'historique' && (
            <>
              {footHistory.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucune donnée Footbar pour l'instant.</p>
                </Card>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Choisir un événement</label>
                    <select value={selectedHistEvent} onChange={e => setSelectedHistEvent(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                      {footHistory.map(f => (
                        <option key={f.id} value={f.evenement_id}>
                          {formatEventLabel(f.evenements || events.find(e => e.id === f.evenement_id))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedFoot && (
                    <Card>
                      <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>{selectedFoot.evenements?.titre}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {selectedFoot.evenements?.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {selectedFoot.evenements?.date_heure ? format(parseISO(selectedFoot.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
                        {FOOTBAR_FIELDS.map(f => (
                          <div key={f.key} style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: selectedFoot[f.key] != null ? THEME.primary : '#D1D5DB' }}>
                              {selectedFoot[f.key] != null ? `${selectedFoot[f.key]}${f.unit}` : '—'}
                            </div>
                            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{f.label}</div>
                          </div>
                        ))}
                      </div>
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
