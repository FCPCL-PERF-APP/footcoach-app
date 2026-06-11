import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner, BarChart } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'

const FIELDS = [
  { key: 'distance_km',     label: 'Distance',        unit: 'km',   placeholder: '8.4',  step: '0.1', max: 15 },
  { key: 'sprint_max',      label: 'Sprint max',      unit: 'km/h', placeholder: '28.5', step: '0.1', max: 40 },
  { key: 'sprints',         label: 'Nb sprints',      unit: '',     placeholder: '12',   step: '1',   max: 40 },
  { key: 'distance_hi',     label: 'Haute intensité', unit: 'm',    placeholder: '680',  step: '1',   max: 1500 },
  { key: 'temps_jeu',       label: 'Temps de jeu',    unit: 'min',  placeholder: '90',   step: '1',   max: 120 },
  { key: 'ballons_touches', label: 'Nb ballons',      unit: '',     placeholder: '47',   step: '1',   max: 120 },
  { key: 'nb_passes',       label: 'Nb passes',       unit: '',     placeholder: '32',   step: '1',   max: 100 },
  { key: 'nb_tirs',         label: 'Nb tirs',         unit: '',     placeholder: '3',    step: '1',   max: 30 },
]

export default function MonFootbarPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('aremplir')
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [history, setHistory] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const joueurId = profile?.id

  useEffect(() => { if (joueurId) loadData() }, [joueurId])

  async function loadData() {
    setLoading(true)
    const since = subDays(new Date(), 30).toISOString()
    const [{ data: evs }, { data: footData }] = await Promise.all([
      supabase.from('evenements').select('*')
        .lte('date_heure', new Date().toISOString())
        .gte('date_heure', since)
        .order('date_heure', { ascending: false }),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId)
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    setHistory(footData || [])

    // Filtre les événements sans Footbar rempli
    const footEventIds = new Set((footData || []).map(f => f.evenement_id))
    const aFaire = (evs || []).filter(e => !footEventIds.has(e.id))
    setEventsAFaire(aFaire)
    setLoading(false)
  }

  async function handleSave() {
    if (!selectedEvent || !joueurId) return
    setSaving(true)

    const payload = {
      evenement_id: selectedEvent.id,
      joueur_id: joueurId,
      ...Object.fromEntries(FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null]))
    }

    const { error } = await supabase.from('footbar').insert(payload)

    if (error) {
      console.error('Erreur Footbar:', error)
      alert('Erreur lors de l\'enregistrement. Réessaie.')
    } else {
      setSaved(true)
      setForm({})
      await loadData()
      setTimeout(() => { setSaved(false); setSelectedEvent(null) }, 2000)
    }
    setSaving(false)
  }

  const avgData = FIELDS.slice(0, 4).map(f => {
    const vals = history.map(h => h[f.key]).filter(v => v !== null && v !== undefined)
    return {
      label: `${f.label}${f.unit ? ` (${f.unit})` : ''}`,
      value: vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0,
      color: THEME.primary
    }
  })

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon Footbar" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['aremplir', `📥 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
          ['historique', '📊 Historique']
        ].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: eventsAFaire.length > 0 && tab === 'aremplir' ? `1.5px solid ${THEME.primary}` : '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* À REMPLIR */}
          {activeTab === 'aremplir' && (
            <>
              {eventsAFaire.length === 0 ? (
                <Card>
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>Tout est à jour !</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                      Tu as rempli ton Footbar pour tous les événements récents.
                    </p>
                  </div>
                </Card>
              ) : (
                <>
                  {!selectedEvent && (
                    <Card>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                        {eventsAFaire.length} événement(s) en attente
                      </p>
                      {eventsAFaire.map(ev => (
                        <div key={ev.id}
                          onClick={() => { setSelectedEvent(ev); setForm({}); setSaved(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer'
                          }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</p>
                            <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                              {ev.type === 'match' ? '⚽' : '🏃'} {format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr })}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, color: '#D85A30', fontWeight: 500 }}>À remplir</span>
                            <span style={{ color: '#D1D5DB', fontSize: 18 }}>›</span>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}

                  {selectedEvent && (
                    <>
                      {saved ? (
                        <Card>
                          <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>Footbar enregistré !</p>
                            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Ton coach peut maintenant les consulter.</p>
                          </div>
                        </Card>
                      ) : (
                        <Card>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: '0.5px solid #F3F4F6' }}>
                            <button onClick={() => setSelectedEvent(null)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>←</button>
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 600 }}>{selectedEvent.titre}</p>
                              <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                                {format(parseISO(selectedEvent.date_heure), 'd MMM yyyy', { locale: fr })}
                              </p>
                            </div>
                          </div>

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
                                  style={{
                                    width: '100%', padding: '8px 10px',
                                    border: '0.5px solid #D1D5DB', borderRadius: 10,
                                    fontSize: 13, outline: 'none', boxSizing: 'border-box'
                                  }}
                                />
                              </div>
                            ))}
                          </div>

                          <Button variant="primary" style={{ width: '100%', marginTop: 14 }}
                            onClick={handleSave} disabled={saving}>
                            {saving ? 'Enregistrement...' : '💾 Enregistrer mes données Footbar'}
                          </Button>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* HISTORIQUE */}
          {activeTab === 'historique' && (
            <>
              {history.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                    Aucune donnée Footbar pour l'instant.
                  </p>
                </Card>
              ) : (
                <>
                  <Card>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mes moyennes</p>
                    <BarChart data={avgData} maxValue={15} />
                  </Card>
                  {history.map(h => (
                    <Card key={h.id}>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        {h.evenements?.titre} · {h.evenements?.date_heure
                          ? format(parseISO(h.evenements.date_heure), 'd MMM yyyy', { locale: fr })
                          : ''}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {FIELDS.map(f => (
                          <div key={f.key} style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {h[f.key] != null ? `${h[f.key]}${f.unit}` : '—'}
                            </div>
                            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{f.label}</div>
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
