import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Select, Button, Spinner, BarChart } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { BarChart3, Users, ClipboardEdit, Hourglass, CheckCircle2, Save, Bell } from 'lucide-react'

const FOOTBAR_FIELDS = [
  { key: 'distance_km',     label: 'Distance',        unit: 'km',   placeholder: '8.4',  step: '0.1', max: 15 },
  { key: 'sprint_max',      label: 'Sprint max',      unit: 'km/h', placeholder: '28.5', step: '0.1', max: 40 },
  { key: 'sprints',         label: 'Nb sprints',      unit: '',     placeholder: '12',   step: '1',   max: 40 },
  { key: 'distance_hi',     label: 'Haute intensité', unit: 'm',    placeholder: '680',  step: '1',   max: 1500 },
  { key: 'temps_jeu',       label: 'Temps de jeu',    unit: 'min',  placeholder: '90',   step: '1',   max: 120 },
  { key: 'ballons_touches', label: 'Nb ballons',      unit: '',     placeholder: '47',   step: '1',   max: 120 },
  { key: 'nb_passes',       label: 'Nb passes',       unit: '',     placeholder: '32',   step: '1',   max: 100 },
  { key: 'nb_tirs',         label: 'Nb tirs',         unit: '',     placeholder: '3',    step: '1',   max: 30 },
]

// Formate le titre d'un événement avec sa date
function formatEventLabel(ev) {
  if (!ev) return ''
  const dateStr = ev.date_heure
    ? format(parseISO(ev.date_heure), 'd MMM', { locale: fr })
    : ''
  return `${ev.titre} — ${dateStr}`
}

export default function FootbarPage() {
  const [searchParams] = useSearchParams()
  const eventIdParam = searchParams.get('event')
  const [activeTab, setActiveTab] = useState('bilan')
  const [events, setEvents] = useState([])
  const [joueurs, setJoueurs] = useState([])
  const [convoqueIds, setConvoqueIds] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(eventIdParam || '')
  const [footData, setFootData] = useState([])
  const [loading, setLoading] = useState(true)

  // Pour la saisie
  const [selectedJoueur, setSelectedJoueur] = useState('')
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [relanceState, setRelanceState] = useState(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedEvent) { loadFootbar(); loadConvocations() } }, [selectedEvent])

  async function loadData() {
    // Pas de limite arbitraire — cf. RpePage.jsx, sinon les événements les plus anciens
    // disparaissaient du menu dès que plus de 30 événements plus récents/futurs existaient.
    // Ordre chronologique (du plus ancien au plus récent).
    const [{ data: evs }, { data: jrs }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: true }),
      supabase.from('joueurs').select('id,nom,prenom,poste').order('nom')
    ])
    setEvents(evs || [])
    setJoueurs(jrs || [])
    if (!selectedEvent && evs?.length) {
      // Par défaut : l'événement passé le plus récent, sinon le plus proche à venir.
      const now = new Date()
      const passes = evs.filter(e => new Date(e.date_heure) <= now)
      setSelectedEvent((passes[passes.length - 1] || evs[0]).id)
    }
    if (jrs?.length) setSelectedJoueur(jrs[0].id)
    setLoading(false)
  }

  async function loadFootbar() {
    const { data } = await supabase
      .from('footbar')
      .select('*, joueurs(id,nom,prenom,poste)')
      .eq('evenement_id', selectedEvent)
    setFootData(data || [])
  }

  // Sur un match, seuls les joueurs convoqués sont concernés par le Footbar
  async function loadConvocations() {
    const { data: ev } = await supabase.from('evenements').select('type').eq('id', selectedEvent).single()
    if (ev?.type !== 'match') { setConvoqueIds(null); return }
    const { data } = await supabase.from('convocations').select('joueur_id').eq('evenement_id', selectedEvent).eq('convoque', true)
    setConvoqueIds(new Set((data || []).map(c => c.joueur_id)))
  }

  async function handleSave() {
    if (!selectedEvent || !selectedJoueur) return
    setSaving(true)
    const payload = {
      evenement_id: selectedEvent,
      joueur_id: selectedJoueur,
      ...Object.fromEntries(FOOTBAR_FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null]))
    }
    // Vérifie si une entrée existe déjà
    const { data: existing } = await supabase.from('footbar').select('id')
      .eq('evenement_id', selectedEvent).eq('joueur_id', selectedJoueur).maybeSingle()

    if (existing) {
      await supabase.from('footbar').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('footbar').insert(payload)
    }
    setSaving(false)
    setSaved(true)
    setForm({})
    setTimeout(() => setSaved(false), 3000)
    loadFootbar()
  }

  const currentEvent = events.find(e => e.id === selectedEvent)
  // Effectif ciblé : tout le monde pour une séance, seulement les convoqués pour un match
  const joueursCibles = convoqueIds ? joueurs.filter(j => convoqueIds.has(j.id)) : joueurs
  const joueursSansFootbar = joueursCibles.filter(j => !footData.find(f => f.joueur_id === j.id))

  async function relancerManquants() {
    setRelanceState('sending')
    try {
      const res = await fetch('/api/notif-manquants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          type: 'footbar',
          eventTitre: currentEvent?.titre,
          joueurIds: joueursSansFootbar.map(j => j.id)
        })
      })
      const data = await res.json()
      setRelanceState(data.success ? `${data.sent} notification(s) envoyée(s)` : `Erreur : ${data.error || 'inconnue'}`)
    } catch {
      setRelanceState('Erreur réseau')
    }
    setTimeout(() => setRelanceState(null), 4000)
  }

  // Données comparatives pour les barres
  function getBarData(key) {
    return footData
      .filter(d => d[key] !== null && d[key] !== undefined)
      .map(d => ({
        label: `${d.joueurs?.nom?.split(' ')[0] || ''} ${d.joueurs?.prenom?.charAt(0) || ''}.`,
        value: parseFloat(d[key]),
        color: 'var(--primary)'
      }))
      .sort((a, b) => b.value - a.value)
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Footbar équipe" />

      {/* Sélecteur événement avec date */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>
          Événement
        </label>
        <select
          value={selectedEvent}
          onChange={e => { setSelectedEvent(e.target.value); setSaved(false) }}
          style={{
            width: '100%', padding: '8px 10px',
            border: '0.5px solid var(--border)', borderRadius: 10,
            fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)',
            outline: 'none', boxSizing: 'border-box'
          }}>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{formatEventLabel(ev)}</option>
          ))}
        </select>
      </div>

      {/* Tabs identiques au RPE */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          ['bilan', BarChart3, 'Bilan groupe'],
          ['detail', Users, 'Par joueur'],
          ['saisie', ClipboardEdit, 'Saisie'],
          ['manquants', Hourglass, 'Manquants'],
        ].map(([tab, Icon, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid var(--border)', whiteSpace: 'nowrap',
            background: activeTab === tab ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === tab ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* BILAN GROUPE */}
          {activeTab === 'bilan' && (
            <>
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  Moyennes équipe — {footData.length} réponse(s)
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {currentEvent?.titre} — {currentEvent?.date_heure ? format(parseISO(currentEvent.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                </p>
                {footData.length === 0
                  ? <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune donnée Footbar pour cet événement.</p>
                  : FOOTBAR_FIELDS.map(f => {
                      const vals = footData.map(d => d[f.key]).filter(v => v !== null && v !== undefined)
                      if (!vals.length) return null
                      const avg = (vals.reduce((a,b) => a+b, 0) / vals.length)
                      return (
                        <div key={f.key} style={{ marginBottom: 7 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            <span>{f.label}</span>
                            <span>{avg.toFixed(1)}{f.unit ? ` ${f.unit}` : ''}</span>
                          </div>
                          <div style={{ height: 7, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, background: 'var(--primary)', width: `${Math.min(100, avg/f.max*100).toFixed(0)}%` }} />
                          </div>
                        </div>
                      )
                    })
                }
              </Card>

              {/* Taux de complétion */}
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Taux de complétion</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    border: `6px solid ${footData.length / Math.max(joueursCibles.length, 1) >= 0.8 ? 'var(--success)' : '#D85A30'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700
                  }}>
                    {joueursCibles.length ? Math.round(footData.length / joueursCibles.length * 100) : 0}%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{footData.length}</strong> joueur(s) ont rempli leur Footbar<br />
                    sur <strong style={{ color: 'var(--text-primary)' }}>{joueursCibles.length}</strong> {convoqueIds ? 'convoqué(s)' : 'dans l\'effectif'}
                  </div>
                </div>
              </Card>
            </>
          )}

          {/* DÉTAIL PAR JOUEUR */}
          {activeTab === 'detail' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Footbar par joueur</p>
              {footData.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>Aucune donnée.</p>
                : footData.map(d => (
                    <div key={d.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{d.joueurs?.nom} {d.joueurs?.prenom}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{d.joueurs?.poste}</span>
                        </div>
                        {d.distance_km && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{d.distance_km} km</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                        {FOOTBAR_FIELDS.map(f => (
                          <div key={f.key} style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '5px 6px', textAlign: 'center' }}>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{d[f.key] != null ? `${d[f.key]}${f.unit ? f.unit : ''}` : '—'}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{f.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              }
            </Card>
          )}

          {/* SAISIE */}
          {activeTab === 'saisie' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Saisie données Footbar</p>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>Joueur</label>
                <select value={selectedJoueur} onChange={e => setSelectedJoueur(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom} — {j.poste}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FOOTBAR_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      {f.label} {f.unit && <span style={{ color: 'var(--text-muted)' }}>({f.unit})</span>}
                    </label>
                    <input type="number" step={f.step} placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                  </div>
                ))}
              </div>
              {saved && <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> Données enregistrées !</div>}
              <button onClick={handleSave} disabled={saving} style={{
                width: '100%', marginTop: 12, padding: 12,
                background: 'var(--gradient)', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>
                {saving ? 'Enregistrement...' : <><Save size={14} /> Enregistrer les données Footbar</>}
              </button>
            </Card>
          )}

          {/* MANQUANTS */}
          {activeTab === 'manquants' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Joueurs sans données Footbar</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Envoie une notification pour les relancer.
              </p>
              {joueursSansFootbar.length === 0
                ? <p style={{ fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Tous les joueurs ont rempli leur Footbar !</p>
                : <>
                    {joueursSansFootbar.map(j => (
                      <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{j.nom} {j.prenom}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{j.poste}</div>
                        </div>
                        <span style={{ fontSize: 11, color: '#D85A30', display: 'flex', alignItems: 'center', gap: 4 }}><Hourglass size={11} /> En attente</span>
                      </div>
                    ))}
                    <button onClick={relancerManquants} disabled={relanceState === 'sending'}
                      style={{ width: '100%', marginTop: 12, padding: 10, background: 'var(--gradient)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {relanceState === 'sending' ? 'Envoi...' : relanceState || <><Bell size={12} /> Relancer par notification push</>}
                    </button>
                  </>
              }
            </Card>
          )}
        </>
      )}
    </div>
  )
}
