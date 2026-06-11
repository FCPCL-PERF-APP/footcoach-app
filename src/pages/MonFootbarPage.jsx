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
  const [existingId, setExistingId] = useState(null) // id de la ligne existante
  const [loading, setLoading] = useState(true)

  // L'id joueur dans la table joueurs
  const joueurId = profile?.id

  useEffect(() => { if (joueurId) loadData() }, [joueurId])
  useEffect(() => { if (selectedEvent && joueurId) checkExisting() }, [selectedEvent, joueurId])

  async function loadData() {
    setLoading(true)
    // Récupère les événements des 14 derniers jours
    const since = subDays(new Date(), 14).toISOString()
    const [{ data: evs }, { data: hist }] = await Promise.all([
      supabase.from('evenements').select('*')
        .gte('date_heure', since)
        .order('date_heure', { ascending: false }),
      supabase.from('footbar')
        .select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId)
        .order('created_at', { ascending: false })
        .limit(10)
    ])
    setEvents(evs || [])
    if (evs?.length) setSelectedEvent(evs[0].id)
    setHistory(hist || [])
    setLoading(false)
  }

  async function checkExisting() {
    // Cherche une entrée existante pour ce joueur et cet événement
    const { data } = await supabase
      .from('footbar')
      .select('*')
      .eq('evenement_id', selectedEvent)
      .eq('joueur_id', joueurId)
      .maybeSingle()

    if (data) {
      setExistingId(data.id)
      // Pré-remplit le formulaire avec les données existantes
      const prefill = {}
      FIELDS.forEach(f => { if (data[f.key] !== null) prefill[f.key] = String(data[f.key]) })
      setForm(prefill)
    } else {
      setExistingId(null)
      setForm({})
    }
    setSaved(false)
  }

  async function handleSave() {
    if (!joueurId || !selectedEvent) return
    setSaving(true)

    const payload = {
      evenement_id: selectedEvent,
      joueur_id: joueurId,
      ...Object.fromEntries(
        FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null])
      )
    }

    let error
    if (existingId) {
      // Met à jour la ligne existante
      const { error: e } = await supabase
        .from('footbar')
        .update(payload)
        .eq('id', existingId)
      error = e
    } else {
      // Crée une nouvelle ligne
      const { error: e } = await supabase
        .from('footbar')
        .insert(payload)
      error = e
    }

    if (error) {
      console.error('Erreur Footbar:', error)
      alert('Erreur lors de l\'enregistrement. Réessaie.')
    } else {
      setSaved(true)
      loadData()
      // Recheck pour mettre à jour l'existingId
      await checkExisting()
    }
    setSaving(false)
  }

  const currentEvent = events.find(e => e.id === selectedEvent)

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
          {activeTab === 'saisie' && (
            <>
              {events.length === 0 ? (
                <Card>
                  <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                    Aucun événement récent (14 derniers jours).
                  </p>
                </Card>
              ) : (
                <>
                  <Select
                    label="Événement"
                    value={selectedEvent}
                    onChange={v => { setSelectedEvent(v); setSaved(false) }}
                    options={events.map(e => ({
                      value: e.id,
                      label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}`
                    }))}
                  />

                  {/* Indicateur déjà rempli */}
                  {existingId && !saved && (
                    <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#3B6D11' }}>Footbar déjà rempli pour cet événement</p>
                        <p style={{ fontSize: 11, color: '#3B6D11' }}>Tu peux modifier tes données ci-dessous.</p>
                      </div>
                    </div>
                  )}

                  {saved ? (
                    <Card>
                      <div style={{ textAlign: 'center', padding: 20 }}>
                        <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: THEME.success }}>
                          {existingId ? 'Données mises à jour !' : 'Données enregistrées !'}
                        </p>
                        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Ton coach peut maintenant les consulter.</p>
                        <Button variant="default" style={{ marginTop: 12 }} onClick={() => setSaved(false)}>
                          Modifier
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <Card>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        📡 {currentEvent?.type === 'match' ? 'Données match' : 'Données séance'}
                      </p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                        Saisis tes données Footbar pour cet événement.
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
                              style={{
                                width: '100%', padding: '8px 10px',
                                border: '0.5px solid #D1D5DB', borderRadius: 10,
                                fontSize: 13, outline: 'none', boxSizing: 'border-box'
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="primary"
                        style={{ width: '100%', marginTop: 14 }}
                        onClick={handleSave}
                        disabled={saving}
                      >
                        {saving ? 'Enregistrement...' : existingId ? '💾 Mettre à jour' : '💾 Enregistrer mes données'}
                      </Button>
                    </Card>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'stats' && (
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                    {[
                      ['Dist. moy.', `${(history.filter(h=>h.distance_km).reduce((s,h)=>s+h.distance_km,0)/Math.max(history.filter(h=>h.distance_km).length,1)).toFixed(1)} km`],
                      ['Max sprints', Math.max(...history.map(h => h.sprints || 0))],
                      ['V. max', `${Math.max(...history.map(h => h.vitesse_max || 0))} km/h`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: 10, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: THEME.primary }}>{val}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                    Historique
                  </p>
                  {history.map(h => (
                    <Card key={h.id}>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        {h.evenements?.titre} · {h.evenements?.date_heure
                          ? format(parseISO(h.evenements.date_heure), 'd MMM yyyy', { locale: fr })
                          : ''}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {[
                          ['Distance', h.distance_km ? `${h.distance_km}km` : '—'],
                          ['Sprints', h.sprints ?? '—'],
                          ['Ballons', h.ballons_touches ?? '—'],
                          ['V.max', h.vitesse_max ? `${h.vitesse_max}km/h` : '—'],
                          ['Accél.', h.accelerations ?? '—'],
                          ['Dist.HI', h.distance_hi ? `${h.distance_hi}m` : '—'],
                        ].map(([lbl, val]) => (
                          <div key={lbl} style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{val}</div>
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
