import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { THEME } from '../theme'

const NAV_COACH = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/rpe',        icon: '❤️', label: 'RPE' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
]
const NAV_STAFF = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/ressources', icon: '📁', label: 'Docs' },
]
const NAV_JOUEUR = [
  { path: '/mon-rpe',    icon: '❤️', label: 'Mon RPE' },
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/ma-fiche',   icon: '👤', label: 'Ma fiche' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/ressources', icon: '📁', label: 'Docs' },
]

export default function BottomNav({ unreadCount = 0 }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isCoach, isAdjoint, isJoueur } = useAuth()
  const items = isCoach ? NAV_COACH : isAdjoint ? NAV_STAFF : NAV_JOUEUR

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: THEME.black,
      borderTop: `2px solid ${THEME.primary}`,
      display: 'flex', zIndex: 100,
      paddingBottom: 'env(safe-area-inset-bottom)',
      boxShadow: '0 -4px 20px rgba(0,0,0,.3)'
    }}>
      {items.map(item => {
        const active = pathname.startsWith(item.path)
        const showBadge = item.path === '/messages' && unreadCount > 0
        return (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3,
            padding: '10px 4px 8px',
            border: 'none', background: 'transparent', cursor: 'pointer',
            position: 'relative',
            borderTop: active ? `2px solid ${THEME.primaryLight}` : '2px solid transparent',
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
            <span style={{ fontSize: 9, color: active ? THEME.primaryLight : 'rgba(255,255,255,.5)', fontWeight: active ? 700 : 400 }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
