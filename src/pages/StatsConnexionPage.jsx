import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function StatsConnexionPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueurs, setJoueurs] = useState([])
  const [filter, setFilter] = useState('tous')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    // Récupère les joueurs avec leur auth_id
    const { data: joueursData } = await supabase
      .from('joueurs').select('id, nom, prenom, poste, groupe, auth_id, email').order('nom')

    // Récupère les users Supabase Auth pour avoir last_sign_in
    const { data: { users } } = await supabase.auth.admin.listUsers()

    // Croise les données
    const enriched = (joueursData || []).map(j => {
      const authUser = (users || []).find(u => u.id === j.auth_id)
      return {
        ...j,
        lastSignIn: authUser?.last_sign_in_at || null,
        createdAt: authUser?.created_at || null,
        confirmed: !!authUser?.email_confirmed_at,
        hasAccount: !!j.auth_id,
        joursInactif: authUser?.last_sign_in_at
          ? differenceInDays(new Date(), new Date(authUser.last_sign_in_at))
          : null
      }
    })

    setJoueurs(enriched)
    setLoading(false)
  }

  const filtered = joueurs.filter(j => {
    if (filter === 'actifs') return j.hasAccount && j.joursInactif !== null && j.joursInactif <= 7
    if (filter === 'inactifs') return j.hasAccount && (j.joursInactif === null || j.joursInactif > 7)
    if (filter === 'sans_compte') return !j.hasAccount
    return true
  })

  const nbActifs = joueurs.filter(j => j.hasAccount && j.joursInactif !== null && j.joursInactif <= 7).length
  const nbInactifs = joueurs.filter(j => j.hasAccount && (j.joursInactif === null || j.joursInactif > 7)).length
  const nbSansCompte = joueurs.filter(j => !j.hasAccount).length

  function getStatutStyle(j) {
    if (!j.hasAccount) return { color: '#9CA3AF', bg: '#F3F4F6', label: '❌ Pas de compte' }
    if (j.joursInactif === null) return { color: '#854F0B', bg: '#FAEEDA', label: '⚠️ Jamais connecté' }
    if (j.joursInactif <= 2) return { color: '#3B6D11', bg: '#EAF3DE', label: `✅ Actif (${j.joursInactif}j)` }
    if (j.joursInactif <= 7) return { color: '#185FA5', bg: '#E6F1FB', label: `🟢 Actif (${j.joursInactif}j)` }
    if (j.joursInactif <= 30) return { color: '#BA7517', bg: '#FDFAEE', label: `🟡 Inactif (${j.joursInactif}j)` }
    return { color: '#A32D2D', bg: '#FCEBEB', label: `🔴 Inactif (${j.joursInactif}j)` }
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="📱 Connexions joueurs" />

      {/* Résumé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { label: 'Total', value: joueurs.length, color: THEME.primary, bg: '#E6F1FB', key: 'tous' },
          { label: 'Actifs 7j', value: nbActifs, color: '#3B6D11', bg: '#EAF3DE', key: 'actifs' },
          { label: 'Inactifs', value: nbInactifs, color: '#BA7517', bg: '#FDFAEE', key: 'inactifs' },
          { label: 'Sans compte', value: nbSansCompte, color: '#A32D2D', bg: '#FCEBEB', key: 'sans_compte' },
        ].map(m => (
          <button key={m.key} onClick={() => setFilter(m.key)} style={{
            background: filter === m.key ? m.bg : '#fff',
            border: `1.5px solid ${filter === m.key ? m.color : '#E5E7EB'}`,
            borderRadius: 12, padding: '8px 4px', cursor: 'pointer', textAlign: 'center'
          }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
            <div style={{ fontSize: 9, color: m.color, marginTop: 2 }}>{m.label}</div>
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 8 }}>{filtered.length} joueur(s)</p>
          {filtered.map((j, i) => {
            const statut = getStatutStyle(j)
            return (
              <div key={j.id} onClick={() => navigate(`/joueurs/${j.id}`)}
                style={{ background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 12, padding: '10px 14px', marginBottom: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {j.poste || '—'}{j.groupe ? ` · Pôle ${j.groupe}` : ''}
                  </p>
                  {j.lastSignIn && (
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
                      Dernière connexion : {format(parseISO(j.lastSignIn), 'd MMM à HH:mm', { locale: fr })}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: statut.color, background: statut.bg, padding: '3px 8px', borderRadius: 20 }}>
                    {statut.label}
                  </span>
                  {!j.hasAccount && j.email && (
                    <span style={{ fontSize: 9, color: '#9CA3AF' }}>📧 {j.email}</span>
                  )}
                </div>
              </div>
            )
          })}

          {filtered.length === 0 && (
            <Card>
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>
                Aucun joueur dans cette catégorie.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
