import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const FOOTBAR_FIELDS = [
  { key: 'distance_km',     label: 'Distance',          unit: 'km',   placeholder: '8.4',  step: '0.1' },
  { key: 'sprint_max',      label: 'Sprint max',         unit: 'km/h', placeholder: '28.5', step: '0.1' },
  { key: 'sprints',         label: 'Nb sprints',         unit: '',     placeholder: '12',   step: '1' },
  { key: 'distance_hi',     label: 'Haute intensité',    unit: 'm',    placeholder: '680',  step: '1' },
  { key: 'temps_jeu',       label: 'Temps de jeu',       unit: 'min',  placeholder: '90',   step: '1' },
  { key: 'ballons_touches', label: 'Ballons touchés',    unit: '',     placeholder: '47',   step: '1' },
  { key: 'nb_passes',       label: 'Nb passes',          unit: '',     placeholder: '32',   step: '1' },
  { key: 'nb_tirs',         label: 'Nb tirs',            unit: '',     placeholder: '3',    step: '1' },
]

export default function MonFootbarPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('event')

  const [activeTab, setActiveTab] = useState(eventIdParam ? 'saisie' : 'afaire')
  const [events, setEvents] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(eventIdParam || '')
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadData() }, [profile])

  async function loadData() {
    setLoading(true)
    const [{ data: evs }, { data: foot }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(30),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)').eq('joueur_id', profile.id).order('created_at', { ascending: false }).limit(20)
    ])

    setEvents(evs || [])
    setFootHistory(foot || [])

    const footIds = new Set((foot || []).map(f => f.evenement_id))
    const passesRecents = (evs || []).filter(e => new Date(e.date_heure) < new Date())
    const aFaire = passesRecents.filter(e => !footIds.has(e.id))
    setEventsAFaire(aFaire)

    if (!selectedEvent && evs?.length) {
      const eventSansFoot = passesRecents.find(e => !footIds.has(e.id))
      setSelectedEvent(eventIdParam || eventSansFoot?.id || evs[0].id)
    }

    setLoading(false)
  }

  async function handleSave() {
    if (!selectedEvent) return
    const vals = FOOTBAR_FIELDS.map(f => form[f.key]).filter(v => v !== undefined && v !== null && v !== '')
    if (vals.length === 0) return

    setSaving(true)
    const payload = {
      joueur_id: profile.id,
      evenement_id: selectedEvent,
      ...Object.fromEntries(FOOTBAR_FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null]))
    }

    const existing = footHistory.find(f => f.evenement_id === selectedEvent)
    if (existing) {
      await supabase.from('footbar').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('footbar').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    setForm({})
    setTimeout(() => setSaved(false), 3000)
    loadData()
  }

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM', { locale: fr }) : ''
    return `${ev.type === 'match' ? '⚽' : '🏃'} ${ev.titre} — ${dateStr}`
  }

  const currentEvent = events.find(e => e.id === selectedEvent)
  const isMatch = currentEvent?.type === 'match'

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon Footbar" />

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
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Tu as rempli ton Footbar pour tous les événements récents.</p>
                  </div>
                </Card>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>
                    {eventsAFaire.length} session(s) sans données Footbar :
                  </p>
                  {eventsAFaire.map(ev => (
                    <div key={ev.id} onClick={() => { setSelectedEvent(ev.id); setActiveTab('saisie') }}
                      style={{ background: '#fff', border: `0.5px solid ${ev.type === 'match' ? '#1A3A6B' : '#E5E7EB'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {ev.type === 'match' ? '⚽ Match' : '🏃 Séance'} · {ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {ev.type === 'match' && <span style={{ fontSize: 10, color: '#185FA5', fontWeight: 600, background: '#E6F1FB', padding: '2px 6px', borderRadius: 6 }}>Recommandé</span>}
                        {ev.type === 'seance' && <span style={{ fontSize: 10, color: '#9CA3AF' }}>Optionnel</span>}
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
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Saisir mes données Footbar</p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Événement</label>
                <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{formatEventLabel(ev)}</option>)}
                </select>
              </div>

              {isMatch && (
                <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '7px 10px', marginBottom: 12, fontSize: 11, color: '#185FA5', fontWeight: 500 }}>
                  ⚽ Match détecté — remplir le Footbar est recommandé pour ce type d'événement.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FOOTBAR_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
                      {f.label} {f.unit && <span style={{ color: '#9CA3AF' }}>({f.unit})</span>}
                    </label>
                    <input type="number" step={f.step} placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              {saved && (
                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '10px 12px', marginTop: 12, marginBottom: 4, fontSize: 13, color: '#3B6D11', textAlign: 'center', fontWeight: 600 }}>
                  ✅ Données Footbar enregistrées !
                </div>
              )}

              <button onClick={handleSave} disabled={saving || Object.keys(form).filter(k => form[k]).length === 0}
                style={{
                  width: '100%', padding: 14, marginTop: 14,
                  background: Object.keys(form).filter(k => form[k]).length > 0 ? THEME.gradient : '#E5E7EB',
                  color: Object.keys(form).filter(k => form[k]).length > 0 ? '#fff' : '#9CA3AF',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: Object.keys(form).filter(k => form[k]).length > 0 ? 'pointer' : 'not-allowed'
                }}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer mon Footbar'}
              </button>
            </Card>
          )}

          {/* HISTORIQUE */}
          {activeTab === 'historique' && (
            <>
              {footHistory.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucune donnée Footbar pour l'instant.</p>
                </Card>
              ) : (
                footHistory.map(f => (
                  <Card key={f.id}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                      {f.evenements?.titre} — {f.evenements?.date_heure ? format(parseISO(f.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                      {FOOTBAR_FIELDS.map(field => (
                        <div key={field.key} style={{ background: '#F9FAFB', borderRadius: 8, padding: '5px 4px', textAlign: 'center' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: THEME.primary }}>
                            {f[field.key] != null ? `${f[field.key]}${field.unit}` : '—'}
                          </div>
                          <div style={{ fontSize: 9, color: '#9CA3AF' }}>{field.label}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
