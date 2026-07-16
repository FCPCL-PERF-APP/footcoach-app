import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { upsertOrQueue, flushQueue, getQueueCount } from '../lib/offlineQueue'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ClipboardList, History, Footprints, Swords, WifiOff, CheckCircle2,
  AlertTriangle, Heart, Radio, MessageSquare, Save
} from 'lucide-react'

const RPE_ITEMS = [
  { key: 'difficulte',        label: 'Difficulté ressentie' },
  { key: 'fatigue',           label: 'Fatigue ressentie' },
  { key: 'implication',       label: 'Implication' },
  { key: 'motivation',        label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. individuelle' },
  { key: 'perf_collective',   label: 'Perf. collective' },
]

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

function rpeColor(v) {
  if (v >= 4.5) return THEME.danger
  if (v >= 4) return '#D85A30'
  if (v >= 3) return THEME.warning
  return THEME.success
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

export default function MonSuiviPage() {
  const { profile } = useAuth()

  const [activeTab, setActiveTab] = useState('afaire')
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [rpeHistory, setRpeHistory] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [selectedHistEvent, setSelectedHistEvent] = useState('')
  const [rpeForms, setRpeForms] = useState({})
  const [footForms, setFootForms] = useState({})
  const [commentaires, setCommentaires] = useState({})
  const [savingEventId, setSavingEventId] = useState(null)
  const [savedEventId, setSavedEventId] = useState(null)
  const [savedWasQueued, setSavedWasQueued] = useState({})
  const [saveError, setSaveError] = useState({})
  const [queueCountRpe, setQueueCountRpe] = useState(0)
  const [queueCountFoot, setQueueCountFoot] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    Promise.all([flushQueue('rpe'), flushQueue('footbar')]).then(() => {
      setQueueCountRpe(getQueueCount('rpe'))
      setQueueCountFoot(getQueueCount('footbar'))
      loadData()
    })
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return
    function onQueueChange() {
      setQueueCountRpe(getQueueCount('rpe'))
      setQueueCountFoot(getQueueCount('footbar'))
      loadData()
    }
    window.addEventListener('fc-offline-queue-changed', onQueueChange)
    return () => window.removeEventListener('fc-offline-queue-changed', onQueueChange)
  }, [profile])

  async function loadData() {
    if (!profile?.id) return
    setLoading(true)
    const { debut, fin } = bornesSaison()

    // Événements de la saison en cours, sans limite arbitraire (une saison ne dépasse
    // jamais quelques centaines d'événements) — sinon les entrées RPE/Footbar les plus
    // anciennes de la saison (ex: août) disparaissaient de l'historique et des bilans
    // dès que plus de 50 entrées plus récentes existaient.
    const { data: evs } = await supabase.from('evenements').select('*')
      .gte('date_heure', debut).lte('date_heure', fin)
      .order('date_heure', { ascending: false })
    const idsSaison = (evs || []).map(e => e.id)

    const [{ data: rpe }, { data: foot }] = await Promise.all([
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', profile.id).in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', profile.id).in('evenement_id', idsSaison).order('created_at', { ascending: false }),
    ])
    setRpeHistory(rpe || [])
    setFootHistory(foot || [])

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

    // Le Footbar est facultatif (capteur pas toujours dispo/porté, club amateur) : seul
    // le RPE conditionne la sortie de "à faire", pour un match comme pour une séance.
    const eligibles = passes.filter(e => presMap[e.id] !== 'absent' && presMap[e.id] !== 'blesse')
    setEventsAFaire(eligibles.filter(e => !rpeIds.has(e.id)))

    if (!selectedHistEvent) {
      // Le premier événement (par date, pas par date de saisie) ayant un RPE ou un
      // Footbar — cohérent avec l'ordre affiché dans le menu déroulant "Historique".
      const footIds = new Set((foot || []).map(f => f.evenement_id))
      const firstEvent = (evs || []).find(e => rpeIds.has(e.id) || footIds.has(e.id))
      if (firstEvent) setSelectedHistEvent(firstEvent.id)
    }
    setLoading(false)
  }

  async function handleSave(eventId) {
    const rpeForm = rpeForms[eventId] || {}
    const footForm = footForms[eventId] || {}
    const doRpe = Object.keys(rpeForm).length > 0
    const doFoot = Object.values(footForm).some(v => v !== undefined && v !== null && v !== '')
    if (!doRpe && !doFoot) return

    setSavingEventId(eventId)
    const queued = {}
    const errors = {}

    if (doRpe) {
      const payload = {
        joueur_id: profile.id, evenement_id: eventId,
        commentaire: commentaires[eventId] || '',
        ...Object.fromEntries(RPE_ITEMS.map(i => [i.key, rpeForm[i.key] !== undefined ? parseFloat(rpeForm[i.key]) : null]))
      }
      try {
        const result = await upsertOrQueue('rpe', payload, 'evenement_id,joueur_id')
        queued.rpe = result.queued
        setRpeForms(p => ({ ...p, [eventId]: {} }))
      } catch (err) {
        errors.rpe = err.message || 'Erreur inconnue'
      }
    }

    if (doFoot) {
      const payload = {
        joueur_id: profile.id, evenement_id: eventId,
        ...Object.fromEntries(FOOTBAR_FIELDS.map(f => [f.key, footForm[f.key] ? parseFloat(footForm[f.key]) : null]))
      }
      try {
        const result = await upsertOrQueue('footbar', payload, 'evenement_id,joueur_id')
        queued.footbar = result.queued
        setFootForms(p => ({ ...p, [eventId]: {} }))
      } catch (err) {
        errors.footbar = err.message || 'Erreur inconnue'
      }
    }

    setSavedEventId(eventId)
    setSavedWasQueued(p => ({ ...p, [eventId]: queued }))
    setSaveError(p => ({ ...p, [eventId]: errors }))
    setTimeout(() => setSavedEventId(null), 3000)
    setQueueCountRpe(getQueueCount('rpe'))
    setQueueCountFoot(getQueueCount('footbar'))
    if (queued.rpe === false || queued.footbar === false) loadData()
    setSavingEventId(null)
  }

  const rpeEntrainement = rpeHistory.filter(r => r.evenements?.type === 'seance')
  const rpeMatch = rpeHistory.filter(r => r.evenements?.type === 'match')
  const footEntrainement = footHistory.filter(f => f.evenements?.type === 'seance')
  const footMatch = footHistory.filter(f => f.evenements?.type === 'match')
  const selectedRpe = rpeHistory.find(r => r.evenement_id === selectedHistEvent)
  const selectedFoot = footHistory.find(f => f.evenement_id === selectedHistEvent)

  // Union dédupliquée des événements présents dans l'historique RPE ou Footbar, triée par date
  const histEventsMap = new Map()
  for (const r of rpeHistory) if (!histEventsMap.has(r.evenement_id)) histEventsMap.set(r.evenement_id, r.evenements)
  for (const f of footHistory) if (!histEventsMap.has(f.evenement_id)) histEventsMap.set(f.evenement_id, f.evenements)
  const histEvents = Array.from(histEventsMap.entries())
    .map(([id, ev]) => ({ id, ev }))
    .sort((a, b) => new Date(b.ev?.date_heure || 0) - new Date(a.ev?.date_heure || 0))

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''
    return `${ev.titre} — ${dateStr}`
  }

  const tabs = [
    ['afaire', ClipboardList, `À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
    ['historique', History, 'Historique'],
    ['bilan-entrainement', Footprints, 'Bilan entr.'],
    ['bilan-match', Swords, 'Bilan match'],
  ]

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon suivi" />

      {(queueCountRpe > 0 || queueCountFoot > 0) && (
        <div style={{ background: THEME.warningBg, color: '#854F0B', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 8, marginBottom: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <WifiOff size={13} /> {[queueCountRpe > 0 && `${queueCountRpe} RPE`, queueCountFoot > 0 && `${queueCountFoot} Footbar`].filter(Boolean).join(' + ')} en attente de synchronisation
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(([tab, Icon, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `0.5px solid ${tab === 'afaire' && eventsAFaire.length > 0 ? THEME.danger : '#D1D5DB'}`,
            background: activeTab === tab ? THEME.primaryBg : 'transparent',
            color: activeTab === tab ? THEME.primary : tab === 'afaire' && eventsAFaire.length > 0 ? THEME.danger : '#6B7280',
            fontWeight: activeTab === tab || (tab === 'afaire' && eventsAFaire.length > 0) ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* À FAIRE */}
          {activeTab === 'afaire' && (
            eventsAFaire.length === 0 ? (
              <Card>
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <CheckCircle2 size={36} color={THEME.success} style={{ marginBottom: 8 }} />
                  <p style={{ fontSize: 14, fontWeight: 600, color: THEME.success }}>Tout est à jour !</p>
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>RPE et Footbar remplis pour tous les événements récents.</p>
                </div>
              </Card>
            ) : (
              eventsAFaire.map(ev => {
                const rpeForm = rpeForms[ev.id] || {}
                const footForm = footForms[ev.id] || {}
                const hasRpe = Object.keys(rpeForm).length > 0
                const hasFoot = Object.values(footForm).some(v => v !== undefined && v !== null && v !== '')
                const hasAny = hasRpe || hasFoot
                const errors = saveError[ev.id] || {}
                const queued = savedWasQueued[ev.id] || {}
                return (
                  <Card key={ev.id} style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 14, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                      <p style={{ fontSize: 13, fontWeight: 700 }}>{ev.titre}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {ev.type === 'match' ? <Swords size={11} /> : <Footprints size={11} />} {ev.type === 'match' ? 'Match' : 'Séance'} · {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                      </p>
                    </div>

                    {/* Bloc RPE */}
                    <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Heart size={13} color={CAT_COLORS.rose.color} /> RPE
                    </p>
                    {RPE_ITEMS.map(item => {
                      const val = rpeForm[item.key]
                      return (
                        <div key={item.key} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <label style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</label>
                            <span style={{ fontSize: 13, fontWeight: 700, color: val !== undefined ? rpeColor(val) : '#D1D5DB' }}>{val !== undefined ? val : '—'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {[0,1,2,3,4,5].map(v => (
                              <button key={v} onClick={() => setRpeForms(p => ({ ...p, [ev.id]: { ...(p[ev.id]||{}), [item.key]: v } }))} style={{
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
                    <div style={{ marginBottom: 4 }}>
                      <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Commentaire (optionnel)</label>
                      <textarea value={commentaires[ev.id] || ''} onChange={e => setCommentaires(p => ({ ...p, [ev.id]: e.target.value }))}
                        placeholder="Comment tu t'es senti ?" rows={2}
                        style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    <div style={{ borderTop: '0.5px solid #F3F4F6', margin: '14px 0' }} />

                    {/* Bloc Footbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Radio size={13} color={CAT_COLORS.orange.color} /> Footbar
                      </p>
                      {ev.type === 'match'
                        ? <span style={{ fontSize: 10, color: THEME.primary, background: THEME.primaryBg, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Recommandé</span>
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
                            value={footForm[f.key] || ''}
                            onChange={e => setFootForms(p => ({ ...p, [ev.id]: { ...(p[ev.id]||{}), [f.key]: e.target.value } }))}
                            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </div>

                    {savedEventId === ev.id && queued.rpe !== undefined && (
                      queued.rpe
                        ? <div style={{ background: THEME.warningBg, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: '#854F0B', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><WifiOff size={14} /> RPE — pas de réseau, sera synchronisé automatiquement</div>
                        : <div style={{ background: THEME.successBg, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: THEME.success, textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={14} /> RPE enregistré !</div>
                    )}
                    {savedEventId === ev.id && queued.footbar !== undefined && (
                      queued.footbar
                        ? <div style={{ background: THEME.warningBg, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: '#854F0B', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><WifiOff size={14} /> Footbar — pas de réseau, sera synchronisé automatiquement</div>
                        : <div style={{ background: THEME.successBg, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: THEME.success, textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><CheckCircle2 size={14} /> Footbar enregistré !</div>
                    )}
                    {errors.rpe && (
                      <div style={{ background: THEME.dangerBg, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: THEME.danger, textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><AlertTriangle size={13} /> RPE : {errors.rpe}</div>
                    )}
                    {errors.footbar && (
                      <div style={{ background: THEME.dangerBg, borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 13, color: THEME.danger, textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><AlertTriangle size={13} /> Footbar : {errors.footbar}</div>
                    )}

                    <button onClick={() => handleSave(ev.id)} disabled={savingEventId === ev.id || !hasAny}
                      style={{ width: '100%', padding: 13, background: hasAny ? THEME.gradient : '#E5E7EB', color: hasAny ? '#fff' : '#9CA3AF', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: hasAny ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {savingEventId === ev.id ? 'Enregistrement...' : <><Save size={14} /> Enregistrer</>}
                    </button>
                  </Card>
                )
              })
            )
          )}

          {/* HISTORIQUE — menu déroulant */}
          {activeTab === 'historique' && (
            histEvents.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucune donnée enregistrée.</p></Card>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Choisir un événement</label>
                  <select value={selectedHistEvent} onChange={e => setSelectedHistEvent(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    {histEvents.map(({ id, ev }) => (
                      <option key={id} value={id}>{formatEventLabel(ev)}</option>
                    ))}
                  </select>
                </div>

                <Card style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Heart size={13} color={CAT_COLORS.rose.color} /> RPE
                  </p>
                  {!selectedRpe ? (
                    <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de RPE pour cet événement.</p>
                  ) : (
                    <>
                      <div style={{ textAlign: 'right', marginBottom: 8 }}>
                        {(() => { const avg = (RPE_ITEMS.reduce((s,i) => s+(selectedRpe[i.key]||0),0)/RPE_ITEMS.length).toFixed(1); return (
                          <span style={{ fontSize: 16, fontWeight: 800, color: rpeColor(parseFloat(avg)) }}>{avg}/5</span>
                        ) })()}
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
                        <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px', marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <MessageSquare size={12} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 2 }} />
                          <p style={{ fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>{selectedRpe.commentaire}</p>
                        </div>
                      )}
                    </>
                  )}
                </Card>

                <Card>
                  <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Radio size={13} color={CAT_COLORS.orange.color} /> Footbar
                  </p>
                  {!selectedFoot ? (
                    <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de Footbar pour cet événement.</p>
                  ) : (
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
                  )}
                </Card>
              </>
            )
          )}

          {/* BILAN ENTRAÎNEMENT */}
          {activeTab === 'bilan-entrainement' && (
            <>
              <Card style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Moyennes sur {rpeEntrainement.length} séance(s)</p>
                {rpeEntrainement.length === 0
                  ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de données d'entraînement.</p>
                  : <RpeBarChart rpeList={rpeEntrainement} title="Bilan RPE entraînements" />
                }
              </Card>
              <Card><FootbarBilan footList={footEntrainement} title="Bilan Footbar entraînements" /></Card>
            </>
          )}

          {/* BILAN MATCH */}
          {activeTab === 'bilan-match' && (
            <>
              <Card style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>Moyennes sur {rpeMatch.length} match(s)</p>
                {rpeMatch.length === 0
                  ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Pas de données de match.</p>
                  : <RpeBarChart rpeList={rpeMatch} title="Bilan RPE matchs" />
                }
              </Card>
              <Card><FootbarBilan footList={footMatch} title="Bilan Footbar matchs" /></Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
