import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Select, Input, BarChart, Spinner } from '../components/UI'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

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

export default function FootbarPage() {
  const { isCoach, isAdjoint } = useAuth()
  const [activeTab, setActiveTab] = useState('saisie')
  const [events, setEvents] = useState([])
  const [joueurs, setJoueurs] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [selectedJoueur, setSelectedJoueur] = useState('')
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [teamData, setTeamData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedEvent) loadTeamFootbar() }, [selectedEvent])

  async function loadData() {
    const [{ data: evs }, { data: jrs }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }).limit(20),
      supabase.from('joueurs').select('id,nom,prenom,poste').order('nom')
    ])
    setEvents(evs || [])
    setJoueurs(jrs || [])
    if (evs?.length) setSelectedEvent(evs[0].id)
    if (jrs?.length) setSelectedJoueur(jrs[0].id)
    setLoading(false)
  }

  async function loadTeamFootbar() {
    const { data } = await supabase
      .from('footbar')
      .select('*, joueurs(nom, prenom, poste)')
      .eq('evenement_id', selectedEvent)
    setTeamData(data || [])
  }

  async function handleSave() {
    if (!selectedEvent || !selectedJoueur) return
    setSaving(true)
    const payload = {
      evenement_id: selectedEvent,
      joueur_id: selectedJoueur,
      ...Object.fromEntries(
        FOOTBAR_FIELDS.map(f => [f.key, form[f.key] ? parseFloat(form[f.key]) : null])
      )
    }
    // Upsert : remplace si déjà existant pour ce joueur/événement
    await supabase.from('footbar').upsert(payload, {
      onConflict: 'evenement_id,joueur_id'
    })
    setSaving(false)
    setSaved(true)
    setForm({})
    loadTeamFootbar()
    setTimeout(() => setSaved(false), 3000)
  }

  const currentEvent = events.find(e => e.id === selectedEvent)

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Footbar" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['saisie','📥 Saisie'],['equipe','👥 Équipe'],['stats','📊 Stats']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? '#185FA5' : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* SAISIE */}
          {activeTab === 'saisie' && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Saisie données Footbar</p>
              <Select
                label="Événement"
                value={selectedEvent}
                onChange={v => { setSelectedEvent(v); setSaved(false) }}
                options={events.map(e => ({ value: e.id, label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}` }))}
              />
              <Select
                label="Joueur"
                value={selectedJoueur}
                onChange={setSelectedJoueur}
                options={joueurs.map(j => ({ value: j.id, label: `${j.nom} ${j.prenom} — ${j.poste}` }))}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {FOOTBAR_FIELDS.map(f => (
                  <div key={f.key}>
                    <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>
                      {f.label} {f.unit && <span style={{ color: '#9CA3AF' }}>({f.unit})</span>}
                    </label>
                    <input
                      type="number"
                      placeholder={f.placeholder}
                      step={f.step}
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
              {saved && (
                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginTop: 10, fontSize: 12, color: '#3B6D11' }}>
                  ✅ Données enregistrées avec succès !
                </div>
              )}
              <Button variant="primary" style={{ width: '100%', marginTop: 12 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer les données Footbar'}
              </Button>
            </Card>
          )}

          {/* VUE ÉQUIPE */}
          {activeTab === 'equipe' && (
            <>
              <Select
                label="Événement"
                value={selectedEvent}
                onChange={setSelectedEvent}
                options={events.map(e => ({ value: e.id, label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}` }))}
              />
              {teamData.length === 0
                ? <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucune donnée Footbar pour cet événement.</p></Card>
                : teamData.map(d => (
                    <Card key={d.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{d.joueurs?.nom} {d.joueurs?.prenom}</p>
                          <p style={{ fontSize: 11, color: '#9CA3AF' }}>{d.joueurs?.poste}</p>
                        </div>
                        <span style={{ fontSize: 11, color: '#185FA5', fontWeight: 600 }}>{d.distance_km} km</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                        {[
                          ['Sprints', d.sprints],
                          ['Ballons', d.ballons_touches],
                          ['V.max', d.vitesse_max ? `${d.vitesse_max}km/h` : '—'],
                          ['Accél.', d.accelerations],
                          ['Dist.HI', d.distance_hi ? `${d.distance_hi}m` : '—'],
                        ].map(([lbl, val]) => (
                          <div key={lbl} style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{val ?? '—'}</div>
                            <div style={{ fontSize: 9, color: '#9CA3AF' }}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))
              }
            </>
          )}

          {/* STATS COMPARATIVES */}
          {activeTab === 'stats' && (
            <>
              <Select
                label="Événement"
                value={selectedEvent}
                onChange={setSelectedEvent}
                options={events.map(e => ({ value: e.id, label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}` }))}
              />
              {['distance_km','sprints','ballons_touches','vitesse_max'].map(key => {
                const field = FOOTBAR_FIELDS.find(f => f.key === key)
                const data = teamData
                  .filter(d => d[key])
                  .map(d => ({
                    label: `${d.joueurs?.nom?.split(' ')[0] || ''} ${d.joueurs?.prenom?.charAt(0) || ''}.`,
                    value: parseFloat(d[key]),
                    color: '#185FA5'
                  }))
                  .sort((a, b) => b.value - a.value)
                if (!data.length) return null
                return (
                  <Card key={key}>
                    <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>
                      {field?.label} {field?.unit && `(${field.unit})`}
                    </p>
                    <BarChart data={data} maxValue={field?.max || 10} />
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
