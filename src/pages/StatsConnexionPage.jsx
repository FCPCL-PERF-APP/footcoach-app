import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { differenceInDays, differenceInHours } from 'date-fns'
import { ArrowLeft, Smartphone, Circle } from 'lucide-react'

export default function StatsConnexionPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueurs, setJoueurs] = useState([])
  const [filter, setFilter] = useState('tous')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase
      .from('joueurs')
      .select('id, nom, prenom, poste, groupe, auth_id, email, last_seen, onboarding_done')
      .order('nom')
    setJoueurs(data || [])
    setLoading(false)
  }

  function getStatut(j) {
    if (!j.auth_id) return 'non_invite'
    if (!j.last_seen) return 'jamais_connecte'
    const heures = differenceInHours(new Date(), new Date(j.last_seen))
    const jours = differenceInDays(new Date(), new Date(j.last_seen))
    if (heures < 24) return 'actif_jour'
    if (jours <= 7) return 'actif_semaine'
    if (jours <= 30) return 'actif_mois'
    return 'inactif'
  }

  const STATUTS = {
    actif_jour:      { label: "Actif aujourd'hui", color: 'var(--success)', bg: 'var(--success-bg)' },
    actif_semaine:   { label: "Cette semaine",      color: 'var(--warning)', bg: '#FDFAEE' },
    actif_mois:      { label: "Ce mois",            color: 'var(--primary)', bg: 'var(--primary-bg)' },
    inactif:         { label: "Inactif +30j",       color: 'var(--danger)', bg: 'var(--danger-bg)' },
    jamais_connecte: { label: "Jamais connecte",    color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
    non_invite:      { label: "Non invite",          color: 'var(--text-primary)', bg: 'var(--bg-secondary)' },
  }

  const enriched = joueurs.map(j => ({ ...j, statut: getStatut(j) }))
  const filtered = filter === 'tous' ? enriched : enriched.filter(j => j.statut === filter)

  const counts = {}
  Object.keys(STATUTS).forEach(k => {
    counts[k] = enriched.filter(j => j.statut === k).length
  })

  const connectes = enriched.filter(j => j.last_seen).length
  const invites = enriched.filter(j => j.auth_id).length
  const total = enriched.length
  const tauxInvit = total ? Math.round(invites / total * 100) : 0
  const tauxConnex = invites ? Math.round(connectes / invites * 100) : 0

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}><Smartphone size={17} color={'var(--primary)'} /> Adoption de l'app</h1>
      </div>

      {/* Résumé 6 cases */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          ["Actifs aujourd'hui", counts.actif_jour,      'var(--success)', 'var(--success-bg)'],
          ["Cette semaine",      counts.actif_semaine,   'var(--warning)', 'var(--warning-bg)'],
          ["Ce mois",            counts.actif_mois,      'var(--primary)', 'var(--primary-bg)'],
          ["Inactifs +30j",      counts.inactif,         'var(--danger)', 'var(--danger-bg)'],
          ["Jamais connectes",   counts.jamais_connecte, 'var(--text-secondary)', 'var(--bg-secondary)'],
          ["Non invites",        counts.non_invite,      'var(--text-primary)', 'var(--bg-secondary)'],
        ].map(([label, val, color, bg]) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color }}>{val}</p>
            <p style={{ fontSize: 9, color, lineHeight: 1.3 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Taux adoption */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Taux d'adoption</p>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span>Invites</span>
            <span style={{ fontWeight: 700 }}>{invites}/{total} ({tauxInvit}%)</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${tauxInvit}%`, height: '100%', background: 'var(--primary)', borderRadius: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span>Connectes au moins 1 fois</span>
            <span style={{ fontWeight: 700 }}>{connectes}/{invites} ({tauxConnex}%)</span>
          </div>
          <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${tauxConnex}%`, height: '100%', background: 'var(--success)', borderRadius: 4 }} />
          </div>
        </div>
      </Card>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        <button onClick={() => setFilter('tous')} style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
          border: `0.5px solid ${filter === 'tous' ? 'var(--primary)' : 'var(--border)'}`,
          background: filter === 'tous' ? 'var(--primary-bg)' : 'transparent',
          color: filter === 'tous' ? 'var(--primary)' : 'var(--text-secondary)',
          fontWeight: filter === 'tous' ? 600 : 400
        }}>Tous ({enriched.length})</button>
        {Object.entries(STATUTS).map(([key, val]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `0.5px solid ${filter === key ? val.color : 'var(--border)'}`,
            background: filter === key ? val.bg : 'transparent',
            color: filter === key ? val.color : 'var(--text-secondary)',
            fontWeight: filter === key ? 600 : 400,
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}><Circle size={7} fill={val.color} color={val.color} /> {val.label} ({counts[key]})</button>
        ))}
      </div>

      {/* Liste joueurs */}
      <Card>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Aucun joueur dans cette categorie.</p>
        ) : filtered.map(j => {
          const st = STATUTS[j.statut]
          const jours = j.last_seen ? differenceInDays(new Date(), new Date(j.last_seen)) : null
          const heures = j.last_seen ? differenceInHours(new Date(), new Date(j.last_seen)) : null
          const vuIlYa = heures !== null
            ? heures < 1 ? "Il y a moins d'1h"
            : heures < 24 ? `Il y a ${heures}h`
            : `Il y a ${jours}j`
            : null
          return (
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  {j.onboarding_done && (
                    <span style={{ fontSize: 9, background: '#EAF3DE', color: 'var(--success)', borderRadius: 6, padding: '1px 5px' }}>
                      App installee
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {j.poste || ''}
                  {vuIlYa && ` · Vu ${vuIlYa}`}
                  {!j.last_seen && j.auth_id && ' · Invitation envoyee'}
                  {!j.auth_id && j.email && ` · ${j.email}`}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, color: st.color, background: st.bg,
                padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 4
              }}>
                <Circle size={7} fill={st.color} color={st.color} /> {st.label}
              </span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
