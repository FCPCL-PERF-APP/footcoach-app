import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { THEME } from '../theme'

const PAGE_TITLES = {
  '/calendrier': 'Calendrier',
  '/calendrier-visuel': 'Calendrier',
  '/rpe': 'Suivi RPE',
  '/mon-rpe': 'Mon RPE',
  '/footbar': 'Footbar équipe',
  '/mon-footbar': 'Mon Footbar',
  '/joueurs': 'Joueurs',
  '/messages': 'Messages',
  '/dashboard': 'Dashboard',
  '/mon-dashboard': 'Dashboard',
  '/ressources': 'Ressources',
  '/staff': 'Staff technique',
  '/ma-fiche': 'Ma fiche',
  '/bilan-saison': 'Bilan de saison',
  '/mon-bilan': 'Mon bilan',
  '/mon-profil': 'Mon profil',
  '/mon-profil-joueur': 'Mon profil',
}

export default function AppHeader() {
  const { pathname } = useLocation()
  const { signOut, profile, isCoach, isJoueur } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const title = PAGE_TITLES[pathname] ||
    (pathname.startsWith('/joueurs/') ? 'Fiche joueur' : 'FC PCL')

  const btnStyle = {
    background: 'rgba(255,255,255,.15)',
    border: '1px solid rgba(255,255,255,.2)',
    borderRadius: 8,
    padding: '5px 8px',
    cursor: 'pointer',
    fontSize: 14
  }

  return (
    <header style={{
      background: THEME.gradient,
      padding: '12px 14px 10px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 99,
      boxShadow: '0 2px 12px rgba(0,0,0,.2)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/icons/logo.jpg" alt="FC PCL"
          style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.4)', objectFit: 'cover', cursor: 'pointer' }}
          onClick={() => navigate(isCoach ? '/calendrier' : '/mon-dashboard')} />
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{title}</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>
            FC PCL · {profile?.role || 'joueur'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Mode sombre */}
        <button onClick={toggleTheme} style={btnStyle}>
          {darkMode ? '☀️' : '🌙'}
        </button>

        {/* Profil coach */}
        {isCoach && (
          <button onClick={() => navigate('/mon-profil')} style={btnStyle}>👤</button>
        )}

        {/* Bilan saison coach */}
        {isCoach && (
          <button onClick={() => navigate('/bilan-saison')} style={btnStyle}>🏆</button>
        )}

        {/* Profil joueur */}
        {isJoueur && (
          <button onClick={() => navigate('/mon-profil-joueur')} style={btnStyle}>👤</button>
        )}

        {/* Bilan saison joueur */}
        {isJoueur && (
          <button onClick={() => navigate('/mon-bilan')} style={btnStyle}>🏆</button>
        )}

        {/* Déconnexion */}
        <button onClick={signOut} style={{
          background: 'rgba(255,255,255,.15)',
          border: '1px solid rgba(255,255,255,.2)',
          borderRadius: 8, padding: '5px 10px',
          cursor: 'pointer', fontSize: 12,
          color: '#fff', fontWeight: 600
        }}>
          Déconnexion
        </button>
      </div>
    </header>
  )
}
