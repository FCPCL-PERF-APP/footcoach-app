import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'

const NAV_COACH_MAIN = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/plus',       icon: '☰',  label: 'Plus' },
]
const NAV_COACH_MORE = [
  { path: '/rpe',        icon: '❤️', label: 'RPE équipe' },
  { path: '/footbar',    icon: '📡', label: 'Footbar' },
  { path: '/ressources', icon: '📁', label: 'Ressources' },
  { path: '/staff',      icon: '⚙️', label: 'Staff' },
]
const NAV_STAFF = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/ressources', icon: '📁', label: 'Docs' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
]
const NAV_JOUEUR = [
  { path: '/mon-rpe',     icon: '❤️', label: 'Mon RPE' },
  { path: '/mon-footbar', icon: '📡', label: 'Footbar' },
  { path: '/calendrier',  icon: '📅', label: 'Agenda' },
  { path: '/ma-fiche',    icon: '👤', label: 'Ma fiche' },
  { path: '/messages',    icon: '💬', label: 'Messages' },
]

export default function BottomNav({ unreadCount = 0 }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isCoach, isAdjoint, isJoueur } = useAuth()
  const [showMore, setShowMore] = useState(false)

  const items = isCoach ? NAV_COACH_MAIN : isAdjoint ? NAV_STAFF : NAV_JOUEUR

  function handleNav(path) {
    if (path === '/plus') { setShowMore(!showMore); return }
    setShowMore(false)
    navigate(path)
  }

  return (
    <>
      {/* Menu "Plus" pour coach */}
      {showMore && isCoach && (
        <div style={{
          position: 'fixed', bottom: 64, left: 0, right: 0,
          background: THEME.blackSoft, zIndex: 99,
          borderTop: `1px solid ${THEME.primary}`,
          maxWidth: 480, margin: '0 auto',
          boxShadow: '0 -4px 20px rgba(0,0,0,.4)'
        }}>
          {NAV_COACH_MORE.map(item => (
            <button key={item.path} onClick={() => { navigate(item.path); setShowMore(false) }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px', border: 'none',
              background: pathname.startsWith(item.path) ? 'rgba(255,255,255,.08)' : 'transparent',
              cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,.06)'
            }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{item.label}</span>
              {pathname.startsWith(item.path) && <span style={{ marginLeft: 'auto', color: THEME.primaryLight, fontSize: 12 }}>●</span>}
            </button>
          ))}
        </div>
      )}

      {/* Overlay pour fermer le menu */}
      {showMore && (
        <div onClick={() => setShowMore(false)} style={{
          position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,.3)'
        }} />
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
        {items.map(item => {
          const active = item.path !== '/plus' && pathname.startsWith(item.path)
          const isMoreOpen = item.path === '/plus' && showMore
          const showBadge = item.path === '/messages' && unreadCount > 0
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
              {showBadge && (
                <span style={{
                  position: 'absolute', top: 6, right: 'calc(50% - 14px)',
                  background: '#EF4444', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  width: 15, height: 15, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{unreadCount}</span>
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
