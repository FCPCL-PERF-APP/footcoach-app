import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { upsertOrQueue, flushQueue, getQueueCount } from '../lib/offlineQueue'
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

function RpeBarChart({ rpeList, title }) {
  if (!rpeList.length) return <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de données.</p>
  const avgGlobal = (() => {
    const vals = rpeList.map(r => {
      const items = RPE_ITEMS.map(i => r[i.key]).filter(v => v != null)
      return items.length ? items.reduce((a,b) => a+b,0)/items.length : null
    }).filter(v => v !== null)
    return vals.length ? (vals.reduce((a,b) => a+b,0)/vals.length).toFixed(1) : '—'
  })()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 600 }}>{title}</p>
        <span style={{ fontSize: 13, fontWeight: 700, color: rpeColor(parseFloat(avgGlobal)) }}>{avgGlobal}/5</span>
      </div>
      {RPE_ITEMS.map(item => {
        const vals = rpeList.map(r => r[item.key]).filter(v => v != null)
        const avg = vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : null
        return avg !== null ? (
          <div key={item.key} style={{ marginBottom: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3 }}>
              <span style={{ color: '#6B7280' }}>{item.label}</span>
              <span style={{ color: rpeColor(avg), fontWeight: 600 }}>{avg.toFixed(1)}/5</span>
            </div>
            <div style={{ height: 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: rpeColor(avg), width: `${avg/5*100}%` }} />
            </div>
          </div>
        ) : null
      })}
    </div>
  )
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
  const [forms, setForms] = useState({})
  const [commentaires, setCommentaires] = useState({})
  const [savingEventId, setSavingEventId] = useState(null)
  const [savedEventId, setSavedEventId] = useState(null)
  const [savedWasQueued, setSavedWasQueued] = useState({})
  const [saveError, setSaveError] = useState({})
  const [queueCount, setQueueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    flushQueue('rpe').then(() => {
      setQueueCount(getQueueCount('rpe'))
      loadData()
    })
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    function onQueueChange() { setQueueCount(getQueueCount('rpe')); loadData() }
    window.addEventListener('fc-offline-queue-changed', onQueueChange)
    return () => window.removeEventListener('fc-offline-queue-changed', onQueueChange)
  }, [profile])

  async function loadData() {
    if (!profile?.id) return
    setLoading(true)
    const [{ data: evs }, { data: rpe }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(30),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(50)
    ])
    setEvents(evs || [])
    setRpeHistory(rpe || [])
    const rpeIds = new Set((rpe || []).map(r => r.evenement_id))
    const passes = (evs || []).filter(e => new Date(e.date_heure) < new Date())

    // Filtrer les événements où le joueur est absent ou blessé
    const eventIds = passes.map(e => e.id)
    const { data: presData } = await supabase.from('presences')
      .select('evenement_id, statut')
      .eq('joueur_id', profile.id)
      .in('evenement_id', eventIds)
    const presMap = {}
    for (const p of (presData || [])) presMap[p.evenement_id] = p.statut

    // Exclure les événements où absent ou blessé, garder ceux sans statut (inconnu/présent/extérieur)
    setEventsAFaire(passes.filter(e =>
      !rpeIds.has(e.id) &&
      presMap[e.id] !== 'absent' &&
      presMap[e.id] !== 'blesse'
    ))
    if (rpe?.length && !selectedHistEvent) setSelectedHistEvent(rpe[0].evenement_id)
    setLoading(false)
  }

  async function handleSave(eventId) {
    const form = forms[eventId] || {}
    if (!Object.keys(form).length) return
    setSavingEventId(eventId)
    const payload = {
      joueur_id: profile.id, evenement_id: eventId,
      commentaire: commentaires[eventId] || '',
      ...Object.fromEntries(RPE_ITEMS.map(i => [i.key, form[i.key] !== undefined ? parseFloat(form[i.key]) : null]))
    }
    try {
      const result = await upsertOrQueue('rpe', payload, 'evenement_id,joueur_id')
      setSavedEventId(eventId)
      setSavedWasQueued(p => ({ ...p, [eventId]: result.queued }))
      setSaveError(p => ({ ...p, [eventId]: null }))
      setForms(p => ({ ...p, [eventId]: {} }))
      setTimeout(() => setSavedEventId(null), 3000)
      setQueueCount(getQueueCount('rpe'))
      if (!result.queued) loadData()
    } catch (err) {
      setSaveError(p => ({ ...p, [eventId]: err.message || 'Erreur inconnue' }))
    } finally {
      setSavingEventId(null)
    }
  }

  const rpeEntrainement = rpeHistory.filter(r => r.evenements?.type === 'seance')
  const rpeMatch = rpeHistory.filter(r => r.evenements?.type === 'match')
  const selectedRpe = rpeHistory.find(r => r.evenement_id === selectedHistEvent)

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''
    return `${ev.type === 'match' ? '⚽' : '🏃'} ${ev.titre} — ${dateStr}`
  }

  const tabs = [
    ['afaire', `📝 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
    ['historique', '📋 Historique'],
    ['bilan-entrainement', '🏃 Bilan entr.'],
    ['bilan-match', '⚽ Bilan match'],
  ]

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon RPE" />

      {queueCount > 0 && (
        <div style={{ background: '#FAEEDA', color: '#854F0B', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 8, marginBottom: 10, textAlign: 'center' }}>
          📡 {queueCount} RPE en attente de synchronisation
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `0.5px solid ${tab === 'afaire' && eventsAFaire.length > 0 ? '#A32D2D' : '#D1D5DB'}`,
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : tab === 'afaire' && eventsAFaire.length > 0 ? '#A32D2D' : '#6B7280',
            fontWeight: activeTab === tab || (tab === 'afaire' && eventsAFaire.length > 0) ? 600 : 400
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
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>RPE rempli pour tous les événements récents.</p>
                </div>
              </Card>
            ) : (
              eventsAFaire.map(ev => {
                const form = forms[ev.id] || {}
                const hasValues = Object.keys(form).length > 0
                return (
                  <Card key={ev.id} style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{ev.titre}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                      </p>
                    </div>
                    {RPE_ITEMS.map(item => {
                      const val = form[item.key]
                      return (
                        <div key={item.key} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</label>
                            <span style={{ fontSize: 13, fontWeight: 700, color: val !== undefined ? rpeColor(val) : '#D1D5DB' }}>{val !== undefined ? val : '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {[0,1,2,3,4,5].map(v => (
                              <button key={v} onClick={() => setForms(p => ({ ...p, [ev.id]: { ...(p[ev.id]||{}), [item.key]: v } }))} style={{
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
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Commentaire (optionnel)</label>
                      <textarea value={commentaires[ev.id] || ''} onChange={e => setCommentaires(p => ({ ...p, [ev.id]: e.target.value }))}
                        placeholder="Comment tu t'es senti ?" rows={2}
                        style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>
                    {savedEventId === ev.id && (
                      savedWasQueued[ev.id] ? (
                        <div style={{ background: '#FAEEDA', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: '#854F0B', textAlign: 'center', fontWeight: 600 }}>📡 Pas de réseau — sera synchronisé automatiquement</div>
                      ) : (
                        <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>✅ RPE enregistré !</div>
                      )
                    )}
                    {saveError[ev.id] && (
                      <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 13, color: '#A32D2D', textAlign: 'center', fontWeight: 600 }}>⚠️ Échec de l'enregistrement : {saveError[ev.id]}</div>
                    )}
                    <button onClick={() => handleSave(ev.id)} disabled={savingEventId === ev.id || !hasValues}
                      style={{ width: '100%', padding: 13, background: hasValues ? THEME.gradient : '#E5E7EB', color: hasValues ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: hasValues ? 'pointer' : 'not-allowed' }}>
                      {savingEventId === ev.id ? 'Enregistrement...' : '💾 Enregistrer mon RPE'}
                    </button>
                  </Card>
                )
              })
            )
          )}

          {/* HISTORIQUE — menu déroulant */}
          {activeTab === 'historique' && (
            rpeHistory.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucun RPE enregistré.</p></Card>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Choisir un événement</label>
                  <select value={selectedHistEvent} onChange={e => setSelectedHistEvent(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    {rpeHistory.map(r => (
                      <option key={r.id} value={r.evenement_id}>{formatEventLabel(r.evenements)}</option>
                    ))}
                  </select>
                </div>
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
                        {(() => { const avg = (RPE_ITEMS.reduce((s,i) => s+(selectedRpe[i.key]||0),0)/RPE_ITEMS.length).toFixed(1); return (<><div style={{ fontSize: 20, fontWeight: 800, color: rpeColor(parseFloat(avg)) }}>{avg}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Moy./5</div></>) })()}
                      </div>
                    </div>
                    {RPE_ITEMS.map(item => {
                      const val = selectedRpe[item.key]
                      return (
                        <div key={item.key} style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                            <span>{item.label}</span>
                            <span style={{ fontWeight: 700, color: val != null ? rpeColor(val) : '#9CA3AF' }}>{val ?? '—'}/5</span>
                          </div>
                          <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, background: val != null ? rpeColor(val) : '#E5E7EB', width: `${val != null ? val/5*100 : 0}%` }} />
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
            )
          )}

          {/* BILAN ENTRAÎNEMENT */}
          {activeTab === 'bilan-entrainement' && (
            <Card>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Moyennes sur {rpeEntrainement.length} séance(s)</p>
              {rpeEntrainement.length === 0
                ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de données d'entraînement.</p>
                : <RpeBarChart rpeList={rpeEntrainement} title="🏃 Bilan entraînements" />
              }
            </Card>
          )}

          {/* BILAN MATCH */}
          {activeTab === 'bilan-match' && (
            <Card>
              <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Moyennes sur {rpeMatch.length} match(s)</p>
              {rpeMatch.length === 0
                ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de données de match.</p>
                : <RpeBarChart rpeList={rpeMatch} title="⚽ Bilan matchs" />
              }
            </Card>
          )}
        </>
      )}
    </div>
  )
}
