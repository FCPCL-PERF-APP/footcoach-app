import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, subDays } from 'date-fns'
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

function rpeColor(v) {
  if (v >= 4.5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  return '#3B6D11'
}

export default function MonRpePage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState('aremplir')
  // Événements à remplir (sans RPE)
  const [eventsAFaire, setEventsAFaire] = useState([])
  // Historique (avec RPE)
  const [history, setHistory] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [values, setValues] = useState({})
  const [commentaire, setCommentaire] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const joueurId = profile?.id

  useEffect(() => { if (joueurId) loadData() }, [joueurId])

  async function loadData() {
    setLoading(true)
    // Récupère les événements récents (30 jours)
    const since = subDays(new Date(), 30).toISOString()
    const [{ data: evs }, { data: rpes }] = await Promise.all([
      supabase.from('evenements').select('*')
        .lte('date_heure', new Date().toISOString()) // seulement les passés
        .gte('date_heure', since)
        .order('date_heure', { ascending: false }),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId)
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    setHistory(rpes || [])

    // Filtre les événements sans RPE rempli
    const rpeEventIds = new Set((rpes || []).map(r => r.evenement_id))
    const aFaire = (evs || []).filter(e => !rpeEventIds.has(e.id))
    setEventsAFaire(aFaire)

    // Sélectionne le premier événement à faire par défaut
    if (aFaire.length > 0 && !selectedEvent) {
      setSelectedEvent(aFaire[0])
    }

    setLoading(false)
  }

  async function handleSave() {
    if (!selectedEvent) return
    const items = selectedEvent.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE
    const allFilled = items.every(i => values[i.key] !== undefined)
    if (!allFilled) { alert('Merci de remplir tous les items avant d\'enregistrer.'); return }

    setSaving(true)
    const { error } = await supabase.from('rpe').insert({
      evenement_id: selectedEvent.id,
      joueur_id: joueurId,
      type: selectedEvent.type || 'seance',
      ...values,
      commentaire
    })

    if (error) {
      console.error('Erreur RPE:', error)
      alert('Erreur lors de l\'enregistrement.')
    } else {
      setSaved(true)
      setValues({})
      setCommentaire('')
      await loadData()
      // Passe à l'onglet historique après sauvegarde
      setTimeout(() => {
        setSaved(false)
        setSelectedEvent(null)
      }, 2000)
    }
    setSaving(false)
  }

  const items = selectedEvent?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Mon RPE" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['aremplir', `📝 À remplir${eventsAFaire.length > 0 ? ` (${eventsAFaire.length})` : ''}`],
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
                      Tu as rempli ton RPE pour tous les événements récents.
                    </p>
                  </div>
                </Card>
              ) : (
                <>
                  {/* Liste des événements à remplir */}
                  {!selectedEvent && (
                    <Card>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                        {eventsAFaire.length} événement(s) en attente de ton RPE
                      </p>
                      {eventsAFaire.map(ev => (
                        <div key={ev.id}
                          onClick={() => { setSelectedEvent(ev); setValues({}); setCommentaire(''); setSaved(false) }}
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

                  {/* Formulaire RPE */}
                  {selectedEvent && (
                    <>
                      {saved ? (
                        <Card>
                          <div style={{ textAlign: 'center', padding: 20 }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
                            <p style={{ fontSize: 14, fontWeight: 600, color: '#3B6D11' }}>RPE enregistré !</p>
                            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Merci pour ton retour.</p>
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
                                {format(parseISO(selectedEvent.date_heure), 'd MMM yyyy', { locale: fr })} · Note de 0 à 5
                              </p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF', marginBottom: 12 }}>
                            <span>0 = Très faible</span><span>5 = Maximal</span>
                          </div>

                          {items.map(item => (
                            <div key={item.key} style={{ marginBottom: 16 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{item.label}</p>
                              <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{item.desc}</p>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {[0,1,2,3,4,5].map(v => {
                                  const selected = values[item.key] === v
                                  return (
                                    <button key={v} onClick={() => setValues(p => ({ ...p, [item.key]: v }))} style={{
                                      flex: 1, height: 40, borderRadius: 8,
                                      border: selected ? 'none' : '0.5px solid #D1D5DB',
                                      background: selected ? RPE_COLORS[v] : 'transparent',
                                      color: selected ? '#fff' : '#374151',
                                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                      transition: 'all .15s'
                                    }}>{v}</button>
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

                          <div style={{ marginBottom: 10 }}>
                            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                              Commentaire (facultatif)
                            </label>
                            <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                              placeholder="Ton ressenti, ce qui s'est bien/mal passé..."
                              rows={3} style={{
                                width: '100%', padding: '8px 10px',
                                border: '0.5px solid #D1D5DB', borderRadius: 10,
                                fontSize: 13, outline: 'none', boxSizing: 'border-box',
                                resize: 'vertical', fontFamily: 'inherit'
                              }} />
                          </div>

                          <Button variant="primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
                            {saving ? 'Enregistrement...' : '✅ Enregistrer mon RPE'}
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
                    Aucun RPE rempli pour l'instant.
                  </p>
                </Card>
              ) : (
                history.map(r => {
                  const items2 = r.evenements?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE
                  const avg = (items2.reduce((s, i) => s + (r[i.key] || 0), 0) / items2.length).toFixed(1)
                  return (
                    <Card key={r.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{r.evenements?.titre}</p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                            {r.evenements?.date_heure
                              ? format(parseISO(r.evenements.date_heure), 'd MMM yyyy', { locale: fr })
                              : ''}
                          </p>
                        </div>
                        <span style={{
                          fontSize: 14, fontWeight: 700, color: '#fff',
                          background: RPE_COLORS[Math.min(5, Math.round(parseFloat(avg)))],
                          padding: '4px 10px', borderRadius: 10
                        }}>{avg}/5</span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {items2.map(item => (
                          <div key={item.key} style={{
                            background: '#F9FAFB', borderRadius: 6, padding: '3px 7px', fontSize: 10
                          }}>
                            <span style={{ color: '#9CA3AF' }}>{item.label.split(' ')[0]} </span>
                            <span style={{ fontWeight: 600, color: rpeColor(r[item.key] || 0) }}>{r[item.key] ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                      {r.commentaire && (
                        <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, fontStyle: 'italic' }}>
                          💬 {r.commentaire}
                        </p>
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
