import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Select, Spinner, BarChart } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

const FIELDS = [
  { key: 'distance_km',     label: 'Distance parcourue', unit: 'km',   placeholder: '8.4',  step: '0.1', max: 15 },
  { key: 'sprints',         label: 'Nombre de sprints',  unit: '',     placeholder: '12',   step: '1',   max: 40 },
  { key: 'ballons_touches', label: 'Ballons touchés',    unit: '',     placeholder: '47',   step: '1',   max: 120 },
  { key: 'vitesse_max',     label: 'Vitesse max',        unit: 'km/h', placeholder: '28.5', step: '0.1', max: 40 },
  { key: 'accelerations',   label: 'Accélérations',      unit: '',     placeholder: '22',   step: '1',   max: 60 },
  { key: 'distance_hi',     label: 'Dist. haute intensité', unit: 'm', placeholder: '680',  step: '1',   max: 1500 },
]

export default function MonFootbarPage() {
  const { profile } = useAuth()
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [form, setForm] = useState({})
  const [history, setHistory] = useState([])
  const [activeTab, setActiveTab] = useState('saisie')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [alreadyFilled, setAlreadyFilled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedEvent) checkExisting() }, [selectedEvent])

  async function loadData() {
    setLoading(true)
    const since = subDays(new Date(), 7).toISOString()
    const [{ data: evs }, { data: hist }] = await Promise.all([
      supabase.from('evenements').select('*').gte('date_heure', since).order('date_heure', { ascending: false }),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)').eq('joueur_id', profile?.id).order('created_at', { ascending: false }).limit(10)
    ])
    setEvents(evs || [])
    if (evs?.length) setSelectedEvent(evs[0].id)
    setHistory(hist || [])
    setLoading(false)
  }

  async function checkExisting() {
    const { data } = await supabase.from('footbar').select('*')
      .eq('evenement_id', selectedEvent).eq('joueur_id', profile?.id).single()
    if (data) { setAlreadyFilled(true); setForm(data) }
    else { setAlreadyFilled(false); setForm({}) }
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      evenement_id: selectedEvent,
      joueur_id: profile?.id,
      ...Object.fromEntries(FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null]))
    }
    await supabase.from('footbar').upsert(payload, { onConflict: 'evenement_id,joueur_id' })
    setSaving(false)
    setSaved(true)
    setAlreadyFilled(true)
    loadData()
  }

  const currentEvent = events.find(e => e.id === selectedEvent)

  // Moyennes pour les stats
  const avgData = FIELDS.slice(0, 4).map(f => ({
    label: `${f.label} ${f.unit ? `(${f.unit})` : ''}`,
    value: history.length ? parseFloat((history.reduce((s, h) => s + (h[f.key] || 0), 0) / history.filter(h => h[f.key]).length || 0).toFixed(1)) : 0,
    color: THEME.primary
  }))

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon Footbar" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['saisie','📥 Saisie'],['stats','📊 Mes stats']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* SAISIE */}
          {activeTab === 'saisie' && (
            <>
              {events.length === 0 ? (
                <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucun événement récent.</p></Card>
              ) : (
                <>
                  <Select
                    label="Événement"
                    value={selectedEvent}
                    onChange={v => { setSelectedEvent(v); setSaved(false) }}
                    options={events.map(e => ({ value: e.id, label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}` }))}
                  />

                  {saved ? (
                    <Card>
                      <div style={{ textAlign: 'center', padding: 20 }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: THEME.success }}>Données enregistrées !</p>
                        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Merci pour ta saisie Footbar.</p>
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        📡 {currentEvent?.type === 'match' ? 'Données match' : 'Données séance'}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                        {alreadyFilled ? 'Tu peux modifier tes données ci-dessous.' : 'Saisis tes données Footbar.'}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {FIELDS.map(f => (
                          <div key={f.key}>
                            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
                              {f.label} {f.unit && <span style={{ color: '#9CA3AF' }}>({f.unit})</span>}
                            </label>
                            <input
                              type="number" step={f.step} placeholder={f.placeholder}
                              value={form[f.key] || ''}
                              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                        ))}
                      </div>

                      <Button variant="primary" style={{ width: '100%', marginTop: 14 }} onClick={handleSave} disabled={saving}>
                        {saving ? 'Enregistrement...' : alreadyFilled ? '💾 Mettre à jour' : '💾 Enregistrer mes données'}
                      </Button>
                    </Card>
                  )}
                </>
              )}
            </>
          )}

          {/* MES STATS */}
          {activeTab === 'stats' && (
            <>
              {history.length === 0 ? (
                <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucune donnée Footbar pour l'instant.</p></Card>
              ) : (
                <>
                  <Card>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes moyennes</p>
                    <BarChart data={avgData} maxValue={15} />
                  </Card>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                      ['Dist. moy.', `${(history.reduce((s,h) => s+(h.distance_km||0),0)/history.filter(h=>h.distance_km).length||0).toFixed(1)} km`],
                      ['Max sprints', Math.max(...history.map(h => h.sprints || 0))],
                      ['V. max', `${Math.max(...history.map(h => h.vitesse_max || 0))} km/h`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: THEME.primary }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Historique</p>
                  {history.map(h => (
                    <Card key={h.id}>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        {h.evenements?.titre} · {h.evenements?.date_heure ? format(parseISO(h.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {[
                          ['Distance', `${h.distance_km}km`],
                          ['Sprints', h.sprints],
                          ['Ballons', h.ballons_touches],
                          ['V.max', `${h.vitesse_max}km/h`],
                          ['Accél.', h.accelerations],
                          ['Dist.HI', `${h.distance_hi}m`],
                        ].map(([lbl, val]) => (
                          <div key={lbl} style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{val ?? '—'}</div>
                            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
