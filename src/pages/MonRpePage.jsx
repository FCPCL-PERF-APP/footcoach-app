import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const RPE_ITEMS = [
  { key: 'difficulte',      label: 'Difficulté ressentie',   desc: '0 = Très faible · 5 = Très élevée' },
  { key: 'fatigue',         label: 'Fatigue ressentie',      desc: '0 = Très faible · 5 = Très élevée' },
  { key: 'implication',     label: 'Implication',            desc: '0 = Très faible · 5 = Très élevée' },
  { key: 'motivation',      label: 'Motivation',             desc: '0 = Très faible · 5 = Très élevée' },
  { key: 'perf_individuelle', label: 'Perf. individuelle',   desc: '0 = Très faible · 5 = Très élevée' },
  { key: 'perf_collective', label: 'Perf. collective',       desc: '0 = Très faible · 5 = Très élevée' },
]

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function MonRpePage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('event')

  const [activeTab, setActiveTab] = useState(eventIdParam ? 'saisie' : 'afaire')
  const [events, setEvents] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [rpeHistory, setRpeHistory] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(eventIdParam || '')
  const [form, setForm] = useState({})
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: evs }, { data: rpe }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(30),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(20)
    ])

    setEvents(evs || [])
    setRpeHistory(rpe || [])

    // Calcule les événements sans RPE
    const rpeIds = new Set((rpe || []).map(r => r.evenement_id))
    const passesRecents = (evs || []).filter(e => new Date(e.date_heure) < new Date())
    const aFaire = passesRecents.filter(e => !rpeIds.has(e.id))
    setEventsAFaire(aFaire)

    if (!selectedEvent && evs?.length) {
      const eventSansRpe = passesRecents.find(e => !rpeIds.has(e.id))
      setSelectedEvent(eventIdParam || eventSansRpe?.id || evs[0].id)
    }

    setLoading(false)
  }

  async function handleSave() {
    if (!selectedEvent) return
    const vals = Object.values(form).filter(v => v !== undefined && v !== null)
    if (vals.length === 0) return

    setSaving(true)
    const payload = {
      joueur_id: profile.id,
      evenement_id: selectedEvent,
      commentaire,
      ...Object.fromEntries(RPE_ITEMS.map(item => [item.key, form[item.key] !== undefined ? parseFloat(form[item.key]) : null]))
    }

    const existing = rpeHistory.find(r => r.evenement_id === selectedEvent)
    if (existing) {
      await supabase.from('rpe').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('rpe').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    setForm({})
    setCommentaire('')
    setTimeout(() => setSaved(false), 3000)
    loadData()
  }

  const currentEvent = events.find(e => e.id === selectedEvent)

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM', { locale: fr }) : ''
    return `${ev.type === 'match' ? '⚽' : '🏃'} ${ev.titre} — ${dateStr}`
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon RPE" />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['afaire', `📝 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
          ['saisie', '✏️ Saisir'],
          ['historique', '📊 Historique'],
        ].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
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
                <>
                  <p style={{ fontSize: 12, color: '#A32D2D', fontWeight: 600, marginBottom: 8 }}>
                    {eventsAFaire.length} session(s) sans RPE :
                  </p>
                  {eventsAFaire.map(ev => (
                    <div key={ev.id} onClick={() => { setSelectedEvent(ev.id); setActiveTab('saisie') }}
                      style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {ev.type === 'match' ? '⚽' : '🏃'} {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#A32D2D', fontWeight: 600 }}>À remplir</span>
                        <span style={{ color: THEME.primary, fontSize: 18 }}>→</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}

          {/* SAISIE */}
          {activeTab === 'saisie' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Saisir mon RPE</p>

              {/* Sélecteur événement */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Événement</label>
                <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{formatEventLabel(ev)}</option>)}
                </select>
              </div>

              {/* Items RPE */}
              {RPE_ITEMS.map(item => (
                <div key={item.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</label>
                    <span style={{ fontSize: 14, fontWeight: 700, color: form[item.key] !== undefined ? rpeColor(form[item.key]) : '#D1D5DB' }}>
                      {form[item.key] !== undefined ? form[item.key] : '—'}
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 6 }}>{item.desc}</p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0, 1, 2, 3, 4, 5].map(v => (
                      <button key={v} onClick={() => setForm(p => ({ ...p, [item.key]: v }))} style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8,
                        border: `1.5px solid ${form[item.key] === v ? rpeColor(v) : '#E5E7EB'}`,
                        background: form[item.key] === v ? `${rpeColor(v)}20` : '#fff',
                        color: form[item.key] === v ? rpeColor(v) : '#6B7280',
                        fontSize: 13, fontWeight: form[item.key] === v ? 700 : 400, cursor: 'pointer'
                      }}>{v}</button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Commentaire */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Commentaire libre (optionnel)</label>
                <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                  placeholder="Comment tu t'es senti ? Des douleurs ?"
                  rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {saved && (
                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>
                  ✅ RPE enregistré avec succès !
                </div>
              )}

              <button onClick={handleSave} disabled={saving || Object.keys(form).length === 0} style={{
                width: '100%', padding: 14,
                background: Object.keys(form).length > 0 ? THEME.gradient : '#E5E7EB',
                color: Object.keys(form).length > 0 ? '#fff' : '#9CA3AF',
                border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                cursor: Object.keys(form).length > 0 ? 'pointer' : 'not-allowed'
              }}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer mon RPE'}
              </button>
            </Card>
          )}

          {/* HISTORIQUE */}
          {activeTab === 'historique' && (
            <>
              {rpeHistory.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucun RPE enregistré pour l'instant.</p>
                </Card>
              ) : (
                rpeHistory.map(r => {
                  const avg = (RPE_ITEMS.reduce((s, i) => s + (r[i.key] || 0), 0) / RPE_ITEMS.length).toFixed(1)
                  return (
                    <Card key={r.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{r.evenements?.titre}</p>
                          <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                            {r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                          </p>
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: rpeColor(parseFloat(avg)), padding: '4px 12px', borderRadius: 20, background: `${rpeColor(parseFloat(avg))}15` }}>
                          {avg}/5
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {RPE_ITEMS.map(item => (
                          <div key={item.key} style={{ background: '#F9FAFB', borderRadius: 6, padding: '3px 8px', fontSize: 10 }}>
                            <span style={{ color: '#9CA3AF' }}>{item.label.split(' ')[0]} </span>
                            <span style={{ fontWeight: 600, color: rpeColor(r[item.key] || 0) }}>{r[item.key] ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                      {r.commentaire && (
                        <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>💬 {r.commentaire}</p>
                      )}
                    </Card>
                  )
                })
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
