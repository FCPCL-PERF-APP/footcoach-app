import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { differenceInDays, differenceInHours } from 'date-fns'

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
    actif_jour:      { label: "Actif aujourd'hui", emoji: "🟢", color: '#3B6D11', bg: '#EAF3DE' },
    actif_semaine:   { label: "Cette semaine",      emoji: "🟡", color: '#BA7517', bg: '#FDFAEE' },
    actif_mois:      { label: "Ce mois",            emoji: "🔵", color: '#185FA5', bg: '#E6F1FB' },
    inactif:         { label: "Inactif +30j",       emoji: "🔴", color: '#A32D2D', bg: '#FCEBEB' },
    jamais_connecte: { label: "Jamais connecte",    emoji: "⚪", color: '#6B7280', bg: '#F3F4F6' },
    non_invite:      { label: "Non invite",          emoji: "⬛", color: '#374151', bg: '#F9FAFB' },
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
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>📱 Adoption de l'app</h1>
      </div>

      {/* Résumé 6 cases */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          ["Actifs aujourd'hui", counts.actif_jour,      '#3B6D11', '#EAF3DE'],
          ["Cette semaine",      counts.actif_semaine,   '#BA7517', '#FDFAEE'],
          ["Ce mois",            counts.actif_mois,      '#185FA5', '#E6F1FB'],
          ["Inactifs +30j",      counts.inactif,         '#A32D2D', '#FCEBEB'],
          ["Jamais connectes",   counts.jamais_connecte, '#6B7280', '#F3F4F6'],
          ["Non invites",        counts.non_invite,      '#374151', '#F9FAFB'],
        ].map(([label, val, color, bg]) => (
          <div key={label} style={{ background: bg, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color }}>{val}</p>
            <p style={{ fontSize: 9, color, lineHeight: 1.3 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Taux adoption */}
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Taux d'adoption</p>
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span>Invites</span>
            <span style={{ fontWeight: 700 }}>{invites}/{total} ({tauxInvit}%)</span>
          </div>
          <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${tauxInvit}%`, height: '100%', background: THEME.primary, borderRadius: 4 }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span>Connectes au moins 1 fois</span>
            <span style={{ fontWeight: 700 }}>{connectes}/{invites} ({tauxConnex}%)</span>
          </div>
          <div style={{ height: 8, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${tauxConnex}%`, height: '100%', background: '#3B6D11', borderRadius: 4 }} />
          </div>
        </div>
      </Card>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        <button onClick={() => setFilter('tous')} style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
          border: `0.5px solid ${filter === 'tous' ? THEME.primary : '#E5E7EB'}`,
          background: filter === 'tous' ? '#E6F1FB' : 'transparent',
          color: filter === 'tous' ? THEME.primary : '#6B7280',
          fontWeight: filter === 'tous' ? 600 : 400
        }}>Tous ({enriched.length})</button>
        {Object.entries(STATUTS).map(([key, val]) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `0.5px solid ${filter === key ? val.color : '#E5E7EB'}`,
            background: filter === key ? val.bg : 'transparent',
            color: filter === key ? val.color : '#6B7280',
            fontWeight: filter === key ? 600 : 400
          }}>{val.emoji} {val.label} ({counts[key]})</button>
        ))}
      </div>

      {/* Liste joueurs */}
      <Card>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucun joueur dans cette categorie.</p>
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
            <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '0.5px solid #F3F4F6' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  {j.onboarding_done && (
                    <span style={{ fontSize: 9, background: '#EAF3DE', color: '#3B6D11', borderRadius: 6, padding: '1px 5px' }}>
                      App installee
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {j.poste || ''}
                  {vuIlYa && ` · Vu ${vuIlYa}`}
                  {!j.last_seen && j.auth_id && ' · Invitation envoyee'}
                  {!j.auth_id && j.email && ` · ${j.email}`}
                </p>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, color: st.color, background: st.bg,
                padding: '3px 8px', borderRadius: 8, whiteSpace: 'nowrap'
              }}>
                {st.emoji} {st.label}
              </span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
