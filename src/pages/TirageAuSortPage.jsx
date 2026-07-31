import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, Button } from '../components/UI'
import { CAT_COLORS } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Shuffle, Users, Swords, Check, X, Plus, RefreshCw, UserCheck
} from 'lucide-react'

const POT_COLORS = ['blue', 'rose', 'purple', 'orange', 'teal', 'amber']

export default function TirageAuSortPage() {
  const [mode, setMode] = useState('equipes')

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Shuffle size={17} color="var(--primary)" /> Tirage au sort
      </h1>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['equipes', Users, 'Équipes'], ['oppositions', Swords, 'Oppositions']].map(([key, Icon, label]) => (
          <button key={key} onClick={() => setMode(key)} style={{
            flex: 1, padding: '9px 10px', borderRadius: 10, cursor: 'pointer',
            border: `1.5px solid ${mode === key ? 'var(--primary)' : 'var(--border)'}`,
            background: mode === key ? 'var(--primary-bg)' : 'var(--bg-card)',
            color: mode === key ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: mode === key ? 700 : 500, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}><Icon size={14} /> {label}</button>
        ))}
      </div>

      {mode === 'equipes' ? <TirageEquipes /> : <TirageOppositions />}
    </div>
  )
}

// ============================= ÉQUIPES =============================

function TirageEquipes() {
  const [events, setEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [joueurs, setJoueurs] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [nbEquipes, setNbEquipes] = useState(2)
  const [nbChapeaux, setNbChapeaux] = useState(0)
  const [pots, setPots] = useState({}) // joueurId -> numéro de chapeau (1..N) ou undefined
  const [teams, setTeams] = useState(null)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (selectedEvent) loadPresences() }, [selectedEvent])

  async function loadData() {
    setLoading(true)
    const [{ data: evs }, { data: jrs }] = await Promise.all([
      supabase.from('evenements').select('*').order('date_heure', { ascending: false }),
      supabase.from('joueurs').select('id,nom,prenom,poste').order('nom'),
    ])
    setEvents(evs || [])
    setJoueurs(jrs || [])
    if (evs?.length) {
      const now = new Date()
      const prochain = evs.find(e => new Date(e.date_heure) >= now) || evs[0]
      setSelectedEvent(prochain.id)
    } else {
      setLoading(false)
    }
  }

  async function loadPresences() {
    setLoading(true)
    setTeams(null)
    const { data } = await supabase.from('presences').select('joueur_id, statut').eq('evenement_id', selectedEvent)
    if (data?.length) {
      const presentIds = new Set(data.filter(p => p.statut === 'present' || p.statut === 'exterieur').map(p => p.joueur_id))
      setSelectedIds(presentIds)
    } else {
      setSelectedIds(new Set(joueurs.map(j => j.id)))
    }
    setLoading(false)
  }

  function toggleJoueur(id) {
    setSelectedIds(p => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
    setTeams(null)
  }

  function setPot(joueurId, potNum) {
    setPots(p => ({ ...p, [joueurId]: potNum || undefined }))
    setTeams(null)
  }

  function tirer() {
    const participants = joueurs.filter(j => selectedIds.has(j.id))
    if (participants.length < nbEquipes) return

    // Ordonne par chapeau (1, 2, ... puis non affectés), mélange à l'intérieur de
    // chaque chapeau, puis attribue toujours le joueur suivant à l'équipe la plus
    // petite (départage aléatoire) — équilibre les effectifs même si les chapeaux
    // ne se divisent pas exactement par le nombre d'équipes.
    const groupes = {}
    for (const j of participants) {
      const pot = nbChapeaux > 0 ? (pots[j.id] || 0) : 0
      if (!groupes[pot]) groupes[pot] = []
      groupes[pot].push(j)
    }
    const ordreGroupes = Object.keys(groupes).map(Number).sort((a, b) => a - b)
    const ordonnes = ordreGroupes.flatMap(g => shuffle(groupes[g]))

    const result = Array.from({ length: nbEquipes }, () => [])
    for (const j of ordonnes) {
      const candidats = result.map((eq, i) => i).filter(i => result[i].length === Math.min(...result.map(e => e.length)))
      const cible = candidats[Math.floor(Math.random() * candidats.length)]
      result[cible].push(j)
    }
    setTeams(result)
  }

  const participantsCount = joueurs.filter(j => selectedIds.has(j.id)).length

  if (loading) return <Card><p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Chargement...</p></Card>

  return (
    <>
      <Card style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Séance / match</label>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
          style={{ width: '100%', padding: '9px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.titre} — {format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr })}
            </option>
          ))}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Nombre d'équipes</label>
            <input type="number" min={2} max={8} value={nbEquipes}
              onChange={e => { setNbEquipes(Math.max(2, Math.min(8, parseInt(e.target.value) || 2))); setTeams(null) }}
              style={{ width: '100%', padding: '9px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Chapeaux (niveaux)</label>
            <input type="number" min={0} max={6} value={nbChapeaux}
              onChange={e => { setNbChapeaux(Math.max(0, Math.min(6, parseInt(e.target.value) || 0))); setTeams(null) }}
              style={{ width: '100%', padding: '9px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>
        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>0 = tirage 100% aléatoire. Sinon, place chaque joueur dans un chapeau ci-dessous (les non-placés seront répartis au hasard).</p>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <UserCheck size={13} /> Participants ({participantsCount})
          </p>
        </div>
        {joueurs.map(j => {
          const checked = selectedIds.has(j.id)
          const pot = pots[j.id] || 0
          return (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)', opacity: checked ? 1 : 0.4 }}>
              <button onClick={() => toggleJoueur(j.id)} style={{
                width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                background: checked ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
              }}>{checked && <Check size={12} color="#fff" />}</button>
              <p style={{ fontSize: 12, flex: 1 }}>{j.nom} {j.prenom} <span style={{ color: 'var(--text-muted)' }}>{j.poste ? `· ${j.poste}` : ''}</span></p>
              {checked && nbChapeaux > 0 && (
                <select value={pot} onChange={e => setPot(j.id, parseInt(e.target.value))}
                  style={{ fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '0.5px solid var(--border)', outline: 'none' }}>
                  <option value={0}>—</option>
                  {Array.from({ length: nbChapeaux }, (_, i) => i + 1).map(n => <option key={n} value={n}>Chap. {n}</option>)}
                </select>
              )}
            </div>
          )
        })}
      </Card>

      <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={tirer} disabled={participantsCount < nbEquipes}>
        <Shuffle size={14} /> {teams ? 'Relancer le tirage' : 'Tirer au sort'}
      </Button>
      {participantsCount < nbEquipes && (
        <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 6, textAlign: 'center' }}>Il faut au moins {nbEquipes} participants sélectionnés.</p>
      )}

      {teams && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: teams.length > 2 ? '1fr 1fr' : '1fr', gap: 8 }}>
          {teams.map((eq, i) => {
            const cat = CAT_COLORS[POT_COLORS[i % POT_COLORS.length]]
            return (
              <Card key={i} style={{ borderTop: `3px solid ${cat.color}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: cat.color }}>Équipe {i + 1} ({eq.length})</p>
                {eq.map(j => <p key={j.id} style={{ fontSize: 12, padding: '3px 0' }}>{j.nom} {j.prenom}</p>)}
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

// ============================ OPPOSITIONS ===========================

function TirageOppositions() {
  const [nomEquipe, setNomEquipe] = useState('')
  const [equipes, setEquipes] = useState([])
  const [resultat, setResultat] = useState(null)

  function ajouter() {
    const nom = nomEquipe.trim()
    if (!nom || equipes.includes(nom)) return
    setEquipes(p => [...p, nom])
    setNomEquipe('')
    setResultat(null)
  }

  function retirer(nom) {
    setEquipes(p => p.filter(e => e !== nom))
    setResultat(null)
  }

  function tirer() {
    const melange = shuffle(equipes)
    const paires = []
    let exempte = null
    for (let i = 0; i < melange.length; i += 2) {
      if (i + 1 < melange.length) paires.push([melange[i], melange[i + 1]])
      else exempte = melange[i]
    }
    setResultat({ paires, exempte })
  }

  return (
    <>
      <Card style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Équipes en lice</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input value={nomEquipe} onChange={e => setNomEquipe(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ajouter()}
            placeholder="Nom de l'équipe"
            style={{ flex: 1, padding: '9px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={ajouter} style={{ padding: '0 14px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Plus size={16} />
          </button>
        </div>
        {equipes.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Ajoute au moins 2 équipes.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {equipes.map(nom => (
              <span key={nom} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--primary-bg)', color: 'var(--primary)', borderRadius: 20, padding: '5px 10px', fontSize: 12, fontWeight: 600 }}>
                {nom}
                <X size={12} style={{ cursor: 'pointer' }} onClick={() => retirer(nom)} />
              </span>
            ))}
          </div>
        )}
      </Card>

      <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={tirer} disabled={equipes.length < 2}>
        <Shuffle size={14} /> {resultat ? 'Relancer le tirage' : 'Tirer les oppositions'}
      </Button>

      {resultat && (
        <div style={{ marginTop: 14 }}>
          {resultat.paires.map(([a, b], i) => (
            <Card key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <p style={{ fontSize: 14, fontWeight: 700, flex: 1, textAlign: 'right' }}>{a}</p>
                <Swords size={14} color="var(--text-muted)" />
                <p style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{b}</p>
              </div>
            </Card>
          ))}
          {resultat.exempte && (
            <Card style={{ textAlign: 'center', background: 'var(--bg-secondary)' }}>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}><RefreshCw size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />{resultat.exempte} est exempte ce tour-ci</p>
            </Card>
          )}
        </div>
      )}
    </>
  )
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
