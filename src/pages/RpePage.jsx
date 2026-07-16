import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { supabase, authHeaders } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Badge, Button, Select, Textarea, BarChart, Spinner, AlertCard } from '../components/UI'
import { THEME } from '../theme'
import { BarChart3, Users, Hourglass, AlertTriangle, CheckCircle2, MessageSquare, Bell } from 'lucide-react'

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
  const [convoqueIds, setConvoqueIds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [relanceState, setRelanceState] = useState(null)

  useEffect(() => { loadEvents(); loadJoueurs() }, [])
  useEffect(() => { if (selectedEvent) { loadRpe(); loadConvocations() } }, [selectedEvent])

  async function loadEvents() {
    // Pas de limite arbitraire — une saison ne dépasse jamais quelques centaines
    // d'événements (cf. MonSuiviPage.jsx), sinon les événements les plus anciens
    // (ex: matchs de préparation de juillet/août) disparaissaient du menu dès que
    // plus de 20 événements plus récents/futurs existaient. Ordre chronologique
    // (du plus ancien au plus récent) pour un menu déroulant lisible.
    const { data } = await supabase.from('evenements').select('*').order('date_heure', { ascending: true })
    setEvents(data || [])
    if (!selectedEvent && data?.length) {
      // Par défaut : l'événement passé le plus récent (le plus utile à renseigner),
      // sinon le plus proche à venir s'il n'y a encore aucun événement passé.
      const now = new Date()
      const passes = data.filter(e => new Date(e.date_heure) <= now)
      setSelectedEvent((passes[passes.length - 1] || data[0]).id)
    }
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

  // Sur un match, seuls les joueurs convoqués sont concernés par le RPE — requête directe
  // sur l'événement (pas via la liste `events`) pour éviter un souci d'ordre de chargement
  // quand la page est ouverte directement sur un match via ?event=.
  async function loadConvocations() {
    const { data: ev } = await supabase.from('evenements').select('type').eq('id', selectedEvent).single()
    if (ev?.type !== 'match') { setConvoqueIds(null); return }
    const { data } = await supabase.from('convocations').select('joueur_id').eq('evenement_id', selectedEvent).eq('convoque', true)
    setConvoqueIds(new Set((data || []).map(c => c.joueur_id)))
  }

  const currentEvent = events.find(e => e.id === selectedEvent)
  const items = currentEvent?.type === 'match' ? RPE_ITEMS_MATCH : RPE_ITEMS_SEANCE
  // Effectif ciblé par cet événement : tout le monde pour une séance, seulement les
  // convoqués pour un match (les autres n'ont pas à remplir leur RPE).
  const joueursCibles = convoqueIds ? joueurs.filter(j => convoqueIds.has(j.id)) : joueurs

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

  const joueursSansRpe = joueursCibles.filter(j => !rpeData.find(r => r.joueur_id === j.id))

  async function relancerManquants() {
    setRelanceState('sending')
    try {
      const res = await fetch('/api/notif-manquants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          type: 'rpe',
          eventTitre: currentEvent?.titre,
          joueurIds: joueursSansRpe.map(j => j.id)
        })
      })
      const data = await res.json()
      setRelanceState(data.success ? `${data.sent} notification(s) envoyée(s)` : `Erreur : ${data.error || 'inconnue'}`)
    } catch {
      setRelanceState('Erreur réseau')
    }
    setTimeout(() => setRelanceState(null), 4000)
  }

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
          label: `${e.titre} — ${e.date_heure ? format(parseISO(e.date_heure), 'd MMM', { locale: fr }) : ''}`
        }))}
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['bilan', BarChart3, 'Bilan groupe'],['detail', Users, 'Par joueur'],['manquants', Hourglass, 'Manquants']].map(([tab, Icon, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? THEME.primaryBg : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl}</button>
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
                      title={<span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} /> {r.joueurs?.nom} {r.joueurs?.prenom} — Charge élevée</span>}
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
                    border: `6px solid ${rpeData.length / Math.max(joueursCibles.length, 1) >= 0.8 ? THEME.success : '#D85A30'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700
                  }}>
                    {joueursCibles.length ? Math.round(rpeData.length / joueursCibles.length * 100) : 0}%
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    <strong style={{ color: '#111' }}>{rpeData.length}</strong> joueur(s) ont rempli leur RPE<br />
                    sur <strong style={{ color: '#111' }}>{joueursCibles.length}</strong> {convoqueIds ? 'convoqué(s)' : 'dans l\'effectif'}
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
                          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 10px', marginTop: 6, fontSize: 12, color: '#555', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            <MessageSquare size={12} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 2 }} /> {r.commentaire}
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
                ? <p style={{ fontSize: 13, color: THEME.success, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Tous les joueurs ont rempli leur RPE !</p>
                : <>
                    {joueursSansRpe.map(j => (
                      <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{j.nom} {j.prenom}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{j.poste}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#D85A30', display: 'flex', alignItems: 'center', gap: 4 }}><Hourglass size={11} /> En attente</span>
                      </div>
                    ))}
                    <Button variant="primary" style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      disabled={relanceState === 'sending'}
                      onClick={relancerManquants}>
                      {relanceState === 'sending' ? 'Envoi...' : relanceState || <><Bell size={13} /> Relancer par notification push</>}
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
