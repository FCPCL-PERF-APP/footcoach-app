import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { upsertOrQueue, flushQueue, getQueueCount } from '../lib/offlineQueue'
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

function FootbarBilan({ footList, title }) {
  if (!footList.length) return <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de données.</p>
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{title} — {footList.length} session(s)</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
        {FOOTBAR_FIELDS.map(f => {
          const vals = footList.map(d => d[f.key]).filter(v => v != null && v > 0)
          const avg = vals.length ? (vals.reduce((a,b) => a+b,0)/vals.length) : null
          const max = vals.length ? Math.max(...vals) : null
          return (
            <div key={f.key} style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: avg !== null ? THEME.primary : '#D1D5DB' }}>
                {avg !== null ? `${parseFloat(avg.toFixed(1))}${f.unit}` : '—'}
              </div>
              <div style={{ fontSize: 9, color: '#9CA3AF' }}>{f.label} (moy.)</div>
              {max !== null && <div style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>Max : {max}{f.unit}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
  const [savedWasQueued, setSavedWasQueued] = useState({})
  const [saveError, setSaveError] = useState({})
  const [queueCount, setQueueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    flushQueue('footbar').then(() => {
      setQueueCount(getQueueCount('footbar'))
      loadData()
    })
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    function onQueueChange() { setQueueCount(getQueueCount('footbar')); loadData() }
    window.addEventListener('fc-offline-queue-changed', onQueueChange)
    return () => window.removeEventListener('fc-offline-queue-changed', onQueueChange)
  }, [profile])

  async function loadData() {
    if (!profile?.id) return
    setLoading(true)
    const [{ data: evs }, { data: foot }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(30),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(50)
    ])
    setEvents(evs || [])
    setFootHistory(foot || [])
    const footIds = new Set((foot || []).map(f => f.evenement_id))
    const passes = (evs || []).filter(e => new Date(e.date_heure) < new Date())

    // Filtrer les événements où le joueur est absent ou blessé
    const eventIds = passes.map(e => e.id)
    const { data: presData } = await supabase.from('presences')
      .select('evenement_id, statut')
      .eq('joueur_id', profile.id)
      .in('evenement_id', eventIds)
    const presMap = {}
    for (const p of (presData || [])) presMap[p.evenement_id] = p.statut

    setEventsAFaire(passes.filter(e =>
      !footIds.has(e.id) &&
      presMap[e.id] !== 'absent' &&
      presMap[e.id] !== 'blesse'
    ))
    if (foot?.length && !selectedHistEvent) setSelectedHistEvent(foot[0].evenement_id)
    setLoading(false)
  }

  async function handleSave(eventId) {
    const form = forms[eventId] || {}
    const hasVals = Object.values(form).some(v => v !== undefined && v !== null && v !== '')
    if (!hasVals) return
    setSavingEventId(eventId)
    const payload = {
      joueur_id: profile.id, evenement_id: eventId,
      ...Object.fromEntries(FOOTBAR_FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null]))
    }
    try {
      const result = await upsertOrQueue('footbar', payload, 'evenement_id,joueur_id')
      setSavedEventId(eventId)
      setSavedWasQueued(p => ({ ...p, [eventId]: result.queued }))
      setSaveError(p => ({ ...p, [eventId]: null }))
      setForms(p => ({ ...p, [eventId]: {} }))
      setTimeout(() => setSavedEventId(null), 3000)
      setQueueCount(getQueueCount('footbar'))
      if (!result.queued) loadData()
    } catch (err) {
      setSaveError(p => ({ ...p, [eventId]: err.message || 'Erreur inconnue' }))
    } finally {
      setSavingEventId(null)
    }
  }

  const footEntrainement = footHistory.filter(f => f.evenements?.type === 'seance')
  const footMatch = footHistory.filter(f => f.evenements?.type === 'match')
  const selectedFoot = footHistory.find(f => f.evenement_id === selectedHistEvent)

  function formatEventLabel(ev) {
    if (!ev) return ''
    return `${ev.type === 'match' ? '⚽' : '🏃'} ${ev.titre} — ${ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}`
  }

  const tabs = [
    ['afaire', `📝 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
    ['historique', '📋 Historique'],
    ['bilan-entrainement', '🏃 Bilan entr.'],
    ['bilan-match', '⚽ Bilan match'],
  ]

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon Footbar" />

      {queueCount > 0 && (
        <div style={{ background: '#FAEEDA', color: '#854F0B', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 8, marginBottom: 10, textAlign: 'center' }}>
          📡 {queueCount} Footbar en attente de synchronisation
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: '0.5px solid #D1D5DB',
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
            eventsAFaire.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>Tout est à jour !</p>
                </div>
              </Card>
            ) : (
              eventsAFaire.map(ev => {
                const form = forms[ev.id] || {}
                const hasVals = Object.values(form).some(v => v !== undefined && v !== null && v !== '')
                return (
                  <Card key={ev.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700 }}>{ev.titre}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                        </p>
                      </div>
                      {ev.type === 'match'
                        ? <span style={{ fontSize: 10, color: '#185FA5', background: '#E6F1FB', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Recommandé</span>
                        : <span style={{ fontSize: 10, color: '#9CA3AF' }}>Optionnel</span>
                      }
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {FOOTBAR_FIELDS.map(f => (
                        <div key={f.key}>
                          <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
                            {f.label} {f.unit && <span style={{ color: '#9CA3AF' }}>({f.unit})</span>}
                          </label>
                          <input type="number" step={f.step} placeholder={f.placeholder}
                            value={form[f.key] || ''}
                            onChange={e => setForms(p => ({ ...p, [ev.id]: { ...(p[ev.id]||{}), [f.key]: e.target.value } }))}
                            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </div>
                    {savedEventId === ev.id && (
                      savedWasQueued[ev.id] ? (
                        <div style={{ background: '#FAEEDA', borderRadius: 8, padding: '10px', marginBottom: 10, fontSize: 13, color: '#854F0B', textAlign: 'center', fontWeight: 600 }}>📡 Pas de réseau — sera synchronisé automatiquement</div>
                      ) : (
                        <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px', marginBottom: 10, fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>✅ Footbar enregistré !</div>
                      )
                    )}
                    {saveError[ev.id] && (
                      <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '10px', marginBottom: 10, fontSize: 13, color: '#A32D2D', textAlign: 'center', fontWeight: 600 }}>⚠️ Échec de l'enregistrement : {saveError[ev.id]}</div>
                    )}
                    <button onClick={() => handleSave(ev.id)} disabled={savingEventId === ev.id || !hasVals}
                      style={{ width: '100%', padding: 13, background: hasVals ? THEME.gradient : '#E5E7EB', color: hasVals ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: hasVals ? 'pointer' : 'not-allowed' }}>
                      {savingEventId === ev.id ? 'Enregistrement...' : '💾 Enregistrer mon Footbar'}
                    </button>
                  </Card>
                )
              })
            )
          )}

          {/* HISTORIQUE */}
          {activeTab === 'historique' && (
            footHistory.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucune donnée Footbar.</p></Card>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Choisir un événement</label>
                  <select value={selectedHistEvent} onChange={e => setSelectedHistEvent(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    {footHistory.map(f => (
                      <option key={f.id} value={f.evenement_id}>{formatEventLabel(f.evenements)}</option>
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
            )
          )}

          {/* BILAN ENTRAÎNEMENT */}
          {activeTab === 'bilan-entrainement' && (
            <Card><FootbarBilan footList={footEntrainement} title="🏃 Entraînements" /></Card>
          )}

          {/* BILAN MATCH */}
          {activeTab === 'bilan-match' && (
            <Card><FootbarBilan footList={footMatch} title="⚽ Matchs" /></Card>
          )}
        </>
      )}
    </div>
  )
}
