import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { THEME } from '../theme'
import { Search, Moon, Sun, User, Trophy, LogOut } from 'lucide-react'

const PAGE_TITLES = {
  '/calendrier': 'Calendrier',
  '/calendrier-visuel': 'Calendrier',
  '/rpe': 'Suivi RPE',
  '/footbar': 'Footbar équipe',
  '/mon-suivi': 'Mon suivi',
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
  const { signOut, profile, isCoach, isStaff, isJoueur } = useAuth()
  const { darkMode, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const title = PAGE_TITLES[pathname] ||
    (pathname.startsWith('/joueurs/') ? 'Fiche joueur' : 'FC PCL')

  // Teintes pastel réglées pour rester lisibles sur le dégradé sombre du header
  // (distinctes de CAT_COLORS, pensé pour des fonds clairs) — une couleur par action
  // pour un repérage rapide, comme sur le reste de la navigation.
  function btnStyle(tint) {
    return {
      background: `rgba(${tint},.18)`,
      border: `1px solid rgba(${tint},.3)`,
      borderRadius: 8,
      padding: '6px',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }
  }
  const TINT = { search: '125,211,252', mode: '253,224,71', profil: '196,181,253', trophy: '250,204,21', logout: '252,165,165' }

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
            FC PCL · Saison 2026/2027
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Recherche */}
        <button onClick={() => navigate('/search')} style={btnStyle(TINT.search)}><Search size={16} color={`rgb(${TINT.search})`} /></button>

        {/* Mode sombre */}
        <button onClick={toggleTheme} style={btnStyle(TINT.mode)}>
          {darkMode ? <Sun size={16} color={`rgb(${TINT.mode})`} /> : <Moon size={16} color={`rgb(${TINT.mode})`} />}
        </button>

        {/* Profil staff */}
        {isStaff && (
          <button onClick={() => navigate('/mon-profil')} style={btnStyle(TINT.profil)}><User size={16} color={`rgb(${TINT.profil})`} /></button>
        )}

        {/* Bilan saison coach */}
        {isCoach && (
          <button onClick={() => navigate('/bilan-saison')} style={btnStyle(TINT.trophy)}><Trophy size={16} color={`rgb(${TINT.trophy})`} /></button>
        )}

        {/* Profil joueur */}
        {isJoueur && (
          <button onClick={() => navigate('/mon-profil-joueur')} style={btnStyle(TINT.profil)}><User size={16} color={`rgb(${TINT.profil})`} /></button>
        )}

        {/* Bilan saison joueur */}
        {isJoueur && (
          <button onClick={() => navigate('/mon-bilan')} style={btnStyle(TINT.trophy)}><Trophy size={16} color={`rgb(${TINT.trophy})`} /></button>
        )}

        {/* Déconnexion */}
        <button onClick={signOut} style={{
          ...btnStyle(TINT.logout),
          padding: '6px 10px',
          fontSize: 12,
          color: `rgb(${TINT.logout})`, fontWeight: 600,
          gap: 5
        }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </header>
  )
}
