import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Badge, Button, Select, Textarea, BarChart, Spinner, AlertCard } from '../components/UI'

const RPE_ITEMS_SEANCE = [
  { key: 'difficulte',        label: 'Difficulté ressentie' },
  { key: 'fatigue',           label: 'Fatigue ressentie' },
  { key: 'implication',       label: 'Implication' },
  { key: 'motivation',        label: 'Motivation' },
  { key: 'perf_individuelle', label: 'Perf. individuelle' },
  { key: 'perf_collective',   label: 'Perf. collective' },
]
const RPE_ITEMS_MATCH = [
  { key: 'perf_individuelle', label: 'Perf. individuelle' },
  { key: 'perf_collective',   label: 'Perf. collective' },
  { key: 'motivation',        label: 'Motivation' },
  { key: 'implication',       label: 'Implication' },
  { key: 'fatigue',           label: 'Fatigue ressentie' },
]

const RPE_COLORS = ['#3B6D11','#639922','#97C459','#BA7517','#D85A30','#A32D2D']

function rpeColor(v) {
  if (v >= 5) return '#A32D2D'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return '#BA7517'
  if (v >= 2) return '#97C459'
  return '#3B6D11'
}

export default function RpePage() {
  const { isCoach } = useAuth()
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('event')

  const [activeTab, setActiveTab] = useState('bilan')
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(eventIdParam || '')
  const [rpeData, setRpeData] = useState([])
  const [joueurs, setJoueurs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadEvents(); loadJoueurs() }, [])
  useEffect(() => { if (selectedEvent) loadRpe() }, [selectedEvent])

  async function loadEvents() {
    const { data } = await supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(20)
    setEvents(data || [])
    if (!selectedEvent && data?.length) setSelectedEvent(data[0].id)
    setLoading(false)
  }

  async function loadJoueurs() {
    const { data } = await supabase.from('joueurs').select('id,nom,prenom,poste').order('nom')
    setJoueurs(data || [])
  }

  async function loadRpe() {
    const { data } = await supabase.from('rpe').select('*, joueurs(nom,prenom,poste)').eq('evenement_id', selectedEvent)
    setRpeData(data || [])
  }

  const currentEvent = events.find(e => e.id === selectedEvent)
  const items = currentEvent?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE

  // Calcul moyennes groupe
  function groupAvg(key) {
    const vals = rpeData.map(r => r[key]).filter(v => v !== null && v !== undefined)
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  const bilanData = items.map(item => ({
    label: item.label,
    value: groupAvg(item.key) ?? 0,
    color: rpeColor(groupAvg(item.key) ?? 0)
  }))

  // Alertes surcharge
  const alerts = rpeData.filter(r => {
    const avg = items.reduce((s, i) => s + (r[i.key] || 0), 0) / items.length
    return avg >= 4.5
  })

  const joueursSansRpe = joueurs.filter(j => !rpeData.find(r => r.joueur_id === j.id))

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Suivi RPE" />

      {/* Sélecteur événement */}
      <Select
        label="Événement"
        value={selectedEvent}
        onChange={setSelectedEvent}
        options={events.map(e => ({
          value: e.id,
          label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}`
        }))}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['bilan','📊 Bilan groupe'],['detail','👥 Par joueur'],['manquants','⏳ Manquants']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? '#185FA5' : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400, whiteSpace: 'nowrap'
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* BILAN GROUPE */}
          {activeTab === 'bilan' && (
            <>
              {alerts.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {alerts.map(r => (
                    <AlertCard key={r.id} type="red"
                      title={`⚠️ ${r.joueurs?.nom} ${r.joueurs?.prenom} — Charge élevée`}
                      message="RPE moyen ≥ 4.5 sur cette session. Surveiller la récupération." />
                  ))}
                </div>
              )}

              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Moyenne équipe — {rpeData.length} réponse(s)
                </p>
                <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 12 }}>
                  0 = Très faible · 5 = Très élevé
                </p>
                {rpeData.length === 0
                  ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Aucune donnée RPE pour cet événement.</p>
                  : <BarChart data={bilanData} maxValue={5} />
                }
              </Card>

              {/* Taux de complétion */}
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Taux de complétion</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    border: `6px solid ${rpeData.length / Math.max(joueurs.length, 1) >= 0.8 ? '#3B6D11' : '#D85A30'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700
                  }}>
                    {joueurs.length ? Math.round(rpeData.length / joueurs.length * 100) : 0}%
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    <strong style={{ color: '#111' }}>{rpeData.length}</strong> joueur(s) ont rempli leur RPE<br />
                    sur <strong style={{ color: '#111' }}>{joueurs.length}</strong> dans l'effectif
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* DÉTAIL PAR JOUEUR */}
          {activeTab === 'detail' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>RPE par joueur</p>
              {rpeData.length === 0
                ? <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Aucune donnée.</p>
                : rpeData.map(r => {
                    const avg = (items.reduce((s, i) => s + (r[i.key] || 0), 0) / items.length).toFixed(1)
                    return (
                      <div key={r.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid #F3F4F6' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.joueurs?.nom} {r.joueurs?.prenom}</span>
                            <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 6 }}>{r.joueurs?.poste}</span>
                          </div>
                          <span style={{
                            fontSize: 13, fontWeight: 700, color: '#fff',
                            background: rpeColor(parseFloat(avg)),
                            padding: '2px 8px', borderRadius: 8
                          }}>{avg}/5</span>
                        </div>
                        <BarChart
                          data={items.map(item => ({ label: item.label, value: r[item.key] || 0, color: rpeColor(r[item.key] || 0) }))}
                          maxValue={5}
                        />
                        {r.commentaire && (
                          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 10px', marginTop: 6, fontSize: 12, color: '#555' }}>
                            💬 {r.commentaire}
                          </div>
                        )}
                      </div>
                    )
                  })
              }
            </Card>
          )}

          {/* JOUEURS MANQUANTS */}
          {activeTab === 'manquants' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Joueurs n'ayant pas rempli leur RPE</p>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10 }}>
                Envoie une notification push pour les relancer.
              </p>
              {joueursSansRpe.length === 0
                ? <p style={{ fontSize: 13, color: '#3B6D11' }}>✅ Tous les joueurs ont rempli leur RPE !</p>
                : <>
                    {joueursSansRpe.map(j => (
                      <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{j.nom} {j.prenom}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{j.poste}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#D85A30' }}>⏳ En attente</span>
                      </div>
                    ))}
                    <Button variant="primary" style={{ width: '100%', marginTop: 12 }}
                      onClick={() => alert(`📱 Notification envoyée à ${joueursSansRpe.length} joueur(s)`)}>
                      📱 Relancer par notification push
                    </Button>
                  </>
              }
            </Card>
          )}
        </>
      )}
    </div>
  )
}
