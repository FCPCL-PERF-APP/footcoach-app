import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Select, Textarea, Spinner } from '../components/UI'
import { format, parseISO, subDays, isAfter } from 'date-fns'
import { fr } from 'date-fns/locale'

const RPE_ITEMS_SEANCE = [
  { key: 'difficulte',        label: 'Difficulté ressentie',  desc: 'À quel point la séance était difficile ?' },
  { key: 'fatigue',           label: 'Fatigue ressentie',     desc: 'Ton niveau de fatigue global ?' },
  { key: 'implication',       label: 'Implication',           desc: 'Tu t\'es impliqué à quel niveau ?' },
  { key: 'motivation',        label: 'Motivation',            desc: 'Ton niveau de motivation aujourd\'hui ?' },
  { key: 'perf_individuelle', label: 'Perf. individuelle',    desc: 'Comment tu évalues ta performance ?' },
  { key: 'perf_collective',   label: 'Perf. collective',      desc: 'Comment tu évalues la perf du groupe ?' },
]
const RPE_ITEMS_MATCH = [
  { key: 'perf_individuelle', label: 'Perf. individuelle',    desc: 'Ta performance sur ce match ?' },
  { key: 'perf_collective',   label: 'Perf. collective',      desc: 'La performance collective du groupe ?' },
  { key: 'motivation',        label: 'Motivation',            desc: 'Ton niveau de motivation avant/pendant ?' },
  { key: 'implication',       label: 'Implication',           desc: 'Ton niveau d\'implication ?' },
  { key: 'fatigue',           label: 'Fatigue ressentie',     desc: 'Fatigue ressentie après le match ?' },
]

const RPE_LABELS = ['Très faible', 'Faible', 'Modéré', 'Élevé', 'Très élevé', 'Maximal']
const RPE_COLORS = ['#3B6D11','#639922','#97C459','#BA7517','#D85A30','#A32D2D']

export default function MonRpePage() {
  const { user, profile } = useAuth()
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [values, setValues] = useState({})
  const [commentaire, setCommentaire] = useState('')
  const [saved, setSaved] = useState(false)
  const [alreadyFilled, setAlreadyFilled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])

  useEffect(() => { loadRecentEvents() }, [])
  useEffect(() => { if (selectedEvent) checkAlreadyFilled() }, [selectedEvent])

  async function loadRecentEvents() {
    // Événements des 7 derniers jours (récents, à évaluer)
    const since = subDays(new Date(), 7).toISOString()
    const { data } = await supabase
      .from('evenements')
      .select('*')
      .gte('date_heure', since)
      .order('date_heure', { ascending: false })
    setEvents(data || [])
    if (data?.length) setSelectedEvent(data[0].id)

    // Historique RPE du joueur
    const { data: hist } = await supabase
      .from('rpe')
      .select('*, evenements(titre, type, date_heure)')
      .eq('joueur_id', profile?.id)
      .order('created_at', { ascending: false })
      .limit(10)
    setHistory(hist || [])
    setLoading(false)
  }

  async function checkAlreadyFilled() {
    const { data } = await supabase
      .from('rpe')
      .select('id')
      .eq('evenement_id', selectedEvent)
      .eq('joueur_id', profile?.id)
      .single()
    setAlreadyFilled(!!data)
    setSaved(false)
    setValues({})
    setCommentaire('')
  }

  async function handleSave() {
    const currentEvent = events.find(e => e.id === selectedEvent)
    const items = currentEvent?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE
    // Vérifie que tous les items sont remplis
    const allFilled = items.every(i => values[i.key] !== undefined)
    if (!allFilled) { alert('Merci de remplir tous les items avant d\'enregistrer.'); return }

    setSaving(true)
    await supabase.from('rpe').insert({
      evenement_id: selectedEvent,
      joueur_id: profile?.id,
      type: currentEvent?.type || 'seance',
      ...values,
      commentaire
    })
    setSaving(false)
    setSaved(true)
    setAlreadyFilled(true)
    loadRecentEvents()
  }

  const currentEvent = events.find(e => e.id === selectedEvent)
  const items = currentEvent?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon RPE" />

      {loading ? <Spinner /> : (
        <>
          {events.length === 0 ? (
            <Card>
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                Aucun événement récent à évaluer.
              </p>
            </Card>
          ) : (
            <>
              <Select
                label="Événement à évaluer"
                value={selectedEvent}
                onChange={v => { setSelectedEvent(v); setSaved(false) }}
                options={events.map(e => ({
                  value: e.id,
                  label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}`
                }))}
              />

              {saved ? (
                <Card>
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>RPE enregistré !</p>
                    <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Merci pour ton retour.</p>
                  </div>
                </Card>
              ) : alreadyFilled ? (
                <Card>
                  <div style={{ textAlign: 'center', padding: 16 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✔️</div>
                    <p style={{ fontSize: 13, color: '#3B6D11', fontWeight: 500 }}>Tu as déjà rempli ton RPE pour cet événement.</p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {currentEvent?.type === 'match' ? '⚽ Évaluation match' : '🏃 Évaluation séance'}
                  </p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 16 }}>
                    Note de 0 (très faible) à 5 (maximal)
                  </p>

                  {items.map(item => (
                    <div key={item.key} style={{ marginBottom: 16 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{item.label}</p>
                      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{item.desc}</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[0,1,2,3,4,5].map(v => {
                          const selected = values[item.key] === v
                          return (
                            <button
                              key={v}
                              onClick={() => setValues(p => ({ ...p, [item.key]: v }))}
                              style={{
                                flex: 1, height: 40, borderRadius: 8,
                                border: selected ? 'none' : '0.5px solid #D1D5DB',
                                background: selected ? RPE_COLORS[v] : 'transparent',
                                color: selected ? '#fff' : '#374151',
                                fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                transition: 'all .15s'
                              }}
                            >
                              {v}
                            </button>
                          )
                        })}
                      </div>
                      {values[item.key] !== undefined && (
                        <p style={{ fontSize: 10, color: RPE_COLORS[values[item.key]], marginTop: 4, fontWeight: 500 }}>
                          {RPE_LABELS[values[item.key]]}
                        </p>
                      )}
                    </div>
                  ))}

                  <Textarea
                    label="Commentaire (facultatif)"
                    value={commentaire}
                    onChange={setCommentaire}
                    placeholder="Ton ressenti, ce qui s'est bien/mal passé..."
                    rows={3}
                  />

                  <Button variant="primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
                    {saving ? 'Enregistrement...' : '✅ Enregistrer mon RPE'}
                  </Button>
                </Card>
              )}
            </>
          )}

          {/* Historique */}
          {history.length > 0 && (
            <>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', margin: '16px 0 8px' }}>
                Mon historique RPE
              </p>
              {history.map(r => {
                const items2 = r.evenements?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE
                const avg = (items2.reduce((s, i) => s + (r[i.key] || 0), 0) / items2.length).toFixed(1)
                return (
                  <Card key={r.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{r.evenements?.titre}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 14, fontWeight: 700, color: '#fff',
                        background: RPE_COLORS[Math.round(parseFloat(avg))],
                        padding: '4px 10px', borderRadius: 10
                      }}>{avg}/5</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {items2.map(item => (
                        <div key={item.key} style={{
                          background: '#F9FAFB', borderRadius: 6, padding: '4px 8px',
                          fontSize: 11, display: 'flex', gap: 4, alignItems: 'center'
                        }}>
                          <span style={{ color: '#9CA3AF' }}>{item.label.split(' ')[0]}</span>
                          <span style={{ fontWeight: 600, color: RPE_COLORS[r[item.key] || 0] }}>{r[item.key] ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                    {r.commentaire && (
                      <p style={{ fontSize: 11, color: '#6B7280', marginTop: 8, fontStyle: 'italic' }}>
                        💬 {r.commentaire}
                      </p>
                    )}
                  </Card>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}
