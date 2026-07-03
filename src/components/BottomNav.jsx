import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { THEME } from '../theme'

const NAV_COACH_MAIN = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/plus',       icon: '☰',  label: 'Plus' },
]
const NAV_COACH_MORE = [
  { path: '/rpe',           icon: '❤️', label: 'RPE équipe' },
  { path: '/footbar',       icon: '📡', label: 'Footbar équipe' },
  { path: '/ressources',    icon: '📁', label: 'Ressources' },
  { path: '/staff',         icon: '⚙️', label: 'Staff' },
  { path: '/correlation',   icon: '📈', label: 'Corrélation' },
  { path: '/charge-hebdo',  icon: '📊', label: 'Charge hebdo' },
  { path: '/comparatif',    icon: '⚖️', label: 'Comparatif' },
  { path: '/archive-saison',icon: '📦', label: 'Archiver saison' },
  { path: '/sondages',      icon: '📊', label: 'Sondages' },
  { path: '/fun',           icon: '🎮', label: 'Fun & Jeux' },
  { path: '/cpa',           icon: '📐', label: 'CPA' },
]
const NAV_STAFF_MAIN = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/plus',       icon: '☰',  label: 'Plus' },
]
const NAV_STAFF_MORE = [
  { path: '/ressources', icon: '📁', label: 'Ressources' },
]
const NAV_JOUEUR_MAIN = [
  { path: '/mon-dashboard', icon: '🏠', label: 'Dashboard' },
  { path: '/calendrier',    icon: '📅', label: 'Agenda' },
  { path: '/ma-fiche',      icon: '👤', label: 'Ma fiche' },
  { path: '/messages',      icon: '💬', label: 'Messages' },
  { path: '/plus',          icon: '☰',  label: 'Plus' },
]
const NAV_JOUEUR_MORE = [
  { path: '/mon-rpe',     icon: '❤️', label: 'Mon RPE' },
  { path: '/mon-footbar', icon: '📡', label: 'Mon Footbar' },
  { path: '/mes-badges',  icon: '🏅', label: 'Mes badges' },
  { path: '/sondages',    icon: '📊', label: 'Sondages' },
  { path: '/cpa',         icon: '📐', label: 'CPA' },
  { path: '/fun',         icon: '🎮', label: 'Fun & Jeux' },
  { path: '/ressources',  icon: '📁', label: 'Ressources' },
]

export default function BottomNav({ unreadCount = 0 }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isCoach, isAdjoint, isJoueur } = useAuth()
  const [showMore, setShowMore] = useState(false)
  const [nbAlertes, setNbAlertes] = useState(0)

  const mainItems = isCoach ? NAV_COACH_MAIN : isAdjoint ? NAV_STAFF_MAIN : NAV_JOUEUR_MAIN
  const moreItems = isCoach ? NAV_COACH_MORE : isAdjoint ? NAV_STAFF_MORE : NAV_JOUEUR_MORE

  // Charge le nombre d'alertes actives pour le badge
  useEffect(() => {
    if (isCoach) loadAlertes()
  }, [isCoach])

  async function loadAlertes() {
    try {
      const [{ data: rpeData }, { data: joueursData }] = await Promise.all([
        supabase.from('rpe').select('joueur_id, difficulte, fatigue, implication, motivation, perf_individuelle, perf_collective')
          .order('created_at', { ascending: false }).limit(100),
        supabase.from('joueurs').select('id').order('nom')
      ])

      let count = 0
      const joueurMap = {}
      for (const r of (rpeData || [])) {
        const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
        if (!vals.length) continue
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length
        if (!joueurMap[r.joueur_id]) joueurMap[r.joueur_id] = []
        joueurMap[r.joueur_id].push(avg)
      }

      // Surcharges individuelles
      for (const [, sessions] of Object.entries(joueurMap)) {
        const last3 = sessions.slice(0, 3)
        const avg = last3.reduce((a, b) => a + b, 0) / last3.length
        if (avg >= 4.5) count++
      }

      // Joueurs sans RPE — seulement s'il y a eu des événements récents (14 derniers jours)
      const { data: recentEvents } = await supabase.from('evenements')
        .select('id').lte('date_heure', new Date().toISOString())
        .gte('date_heure', new Date(Date.now() - 14*24*60*60*1000).toISOString())
        .limit(1)

      if (recentEvents?.length > 0) {
        const joueursAvecRpe = new Set(Object.keys(joueurMap))
        // Ne compter que les joueurs qui n'ont JAMAIS eu de RPE (pas juste cette semaine)
        const nouveauxSansRpe = (joueursData || []).filter(j => !joueursAvecRpe.has(j.id)).length
        count += Math.min(nouveauxSansRpe, 3) // Limiter à 3 max pour éviter le spam
      }

      // Soustraire les alertes déjà traitées dans localStorage
      const traitees = JSON.parse(localStorage.getItem('fcpcl-alertes-traitees') || '[]')
      count = Math.max(0, count - traitees.length)

      setNbAlertes(count)
    } catch (err) {
      console.error('Erreur alertes:', err)
    }
  }

  function handleNav(path) {
    if (path === '/plus') { setShowMore(!showMore); return }
    setShowMore(false)
    navigate(path)
  }

  // Badge Plus = alertes actives
  const showPlusBadge = isCoach && nbAlertes > 0

  return (
    <>
      {/* Menu Plus */}
      {showMore && (
        <>
          <div onClick={() => setShowMore(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,.4)' }} />
          <div style={{
            position: 'fixed', bottom: 64, left: 0, right: 0,
            background: THEME.blackSoft, zIndex: 99,
            borderTop: `1px solid ${THEME.primary}`,
            maxWidth: 480, margin: '0 auto',
            boxShadow: '0 -4px 20px rgba(0,0,0,.4)'
          }}>
            {moreItems.map(item => (
              <button key={item.path} onClick={() => { navigate(item.path); setShowMore(false) }} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 20px', border: 'none',
                background: pathname.startsWith(item.path) ? 'rgba(255,255,255,.08)' : 'transparent',
                cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,.06)'
              }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{item.label}</span>
                {pathname.startsWith(item.path) && (
                  <span style={{ marginLeft: 'auto', color: THEME.primaryLight, fontSize: 12 }}>●</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: THEME.black,
        borderTop: `2px solid ${THEME.primary}`,
        display: 'flex', zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 20px rgba(0,0,0,.3)',
        maxWidth: 480, margin: '0 auto'
      }}>
        {mainItems.map(item => {
          const active = item.path !== '/plus' && pathname.startsWith(item.path)
          const isMoreOpen = item.path === '/plus' && showMore
          const showMsgBadge = item.path === '/messages' && unreadCount > 0
          const showPlusBadgeItem = item.path === '/plus' && showPlusBadge && !showMore

          return (
            <button key={item.path} onClick={() => handleNav(item.path)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
              padding: '10px 4px 8px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              position: 'relative',
              borderTop: active || isMoreOpen ? `2px solid ${THEME.primaryLight}` : '2px solid transparent',
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>

              {/* Badge messages non lus */}
              {showMsgBadge && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 16px)',
                  background: '#EF4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  minWidth: 15, height: 15, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px'
                }}>{unreadCount}</span>
              )}

              {/* Badge alertes sur Plus */}
              {showPlusBadgeItem && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 16px)',
                  background: '#A32D2D', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  minWidth: 15, height: 15, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px'
                }}>{nbAlertes}</span>
              )}

              <span style={{
                fontSize: 9,
                color: active || isMoreOpen ? THEME.primaryLight : 'rgba(255,255,255,.5)',
                fontWeight: active || isMoreOpen ? 700 : 400
              }}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
