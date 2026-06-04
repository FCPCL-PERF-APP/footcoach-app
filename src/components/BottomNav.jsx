import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV_COACH = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/rpe',       icon: '❤️', label: 'RPE' },
  { path: '/joueurs',   icon: '👥', label: 'Joueurs' },
  { path: '/messages',  icon: '💬', label: 'Messages' },
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
]
const NAV_STAFF = [
  { path: '/calendrier', icon: '📅', label: 'Agenda' },
  { path: '/joueurs',    icon: '👥', label: 'Joueurs' },
  { path: '/messages',   icon: '💬', label: 'Messages' },
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/ressources', icon: '📁', label: 'Docs' },
]
const NAV_JOUEUR = [
  { path: '/mon-rpe',     icon: '❤️', label: 'Mon RPE' },
  { path: '/calendrier',  icon: '📅', label: 'Agenda' },
  { path: '/ma-fiche',    icon: '👤', label: 'Ma fiche' },
  { path: '/messages',    icon: '💬', label: 'Messages' },
  { path: '/ressources',  icon: '📁', label: 'Docs' },
]

export default function BottomNav({ unreadCount = 0 }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { isCoach, isAdjoint, isJoueur } = useAuth()

  const items = isCoach ? NAV_COACH : isAdjoint ? NAV_STAFF : NAV_JOUEUR

  return (
    <nav style={styles.nav}>
      {items.map(item => {
        const active = pathname.startsWith(item.path)
        const showBadge = item.path === '/messages' && unreadCount > 0
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{ ...styles.btn, ...(active ? styles.btnActive : {}) }}
          >
            <span style={styles.icon}>{item.icon}</span>
            {showBadge && <span style={styles.badge}>{unreadCount}</span>}
            <span style={{ ...styles.label, ...(active ? styles.labelActive : {}) }}>
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

const styles = {
  nav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: '#fff',
    borderTop: '0.5px solid #E5E7EB',
    display: 'flex',
    zIndex: 100,
    paddingBottom: 'env(safe-area-inset-bottom)'
  },
  btn: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 2,
    padding: '10px 4px 8px',
    border: 'none', background: 'transparent', cursor: 'pointer',
    position: 'relative'
  },
  btnActive: {},
  icon: { fontSize: 20 },
  label: { fontSize: 9, color: '#9CA3AF' },
  labelActive: { color: '#185FA5', fontWeight: 600 },
  badge: {
    position: 'absolute', top: 6, right: 'calc(50% - 14px)',
    background: '#EF4444', color: '#fff',
    fontSize: 9, fontWeight: 700,
    width: 16, height: 16, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  }
}
