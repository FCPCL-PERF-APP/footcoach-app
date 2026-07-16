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

  // Pastilles pleines (au lieu d'un simple contour translucide) : une couleur vive par
  // action, icône blanche dessus — se détache nettement du dégradé sombre du header,
  // plus qu'une teinte pastel qui se noyait dedans.
  function btnStyle(bg) {
    return {
      background: bg,
      border: 'none',
      borderRadius: '50%',
      width: 30, height: 30,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 4px rgba(0,0,0,.25)'
    }
  }
  const CHIP = { search: '#0EA5E9', mode: '#F59E0B', profil: '#8B5CF6', trophy: '#EAB308' }
  // Déconnexion : bouton discret (silhouette) plutôt qu'une pastille colorée —
  // action de sortie, pas besoin d'être mise en avant comme les autres.
  const discreetStyle = {
    background: 'rgba(255,255,255,.15)',
    border: 'none', borderRadius: '50%',
    width: 30, height: 30,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
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
        <div onClick={() => navigate(isCoach ? '/calendrier' : '/mon-dashboard')}
          style={{ width: 32, height: 32, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.4)', background: '#fff', padding: 2, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src="/icons/logo.jpg" alt="FC PCL" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{title}</p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>
            FC PCL · Saison 2026/2027
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
        {/* Recherche */}
        <button onClick={() => navigate('/search')} style={btnStyle(CHIP.search)}><Search size={15} color="#fff" /></button>

        {/* Mode sombre */}
        <button onClick={toggleTheme} style={btnStyle(CHIP.mode)}>
          {darkMode ? <Sun size={15} color="#fff" /> : <Moon size={15} color="#fff" />}
        </button>

        {/* Profil staff */}
        {isStaff && (
          <button onClick={() => navigate('/mon-profil')} style={btnStyle(CHIP.profil)}><User size={15} color="#fff" /></button>
        )}

        {/* Bilan saison coach */}
        {isCoach && (
          <button onClick={() => navigate('/bilan-saison')} style={btnStyle(CHIP.trophy)}><Trophy size={15} color="#fff" /></button>
        )}

        {/* Profil joueur */}
        {isJoueur && (
          <button onClick={() => navigate('/mon-profil-joueur')} style={btnStyle(CHIP.profil)}><User size={15} color="#fff" /></button>
        )}

        {/* Bilan saison joueur */}
        {isJoueur && (
          <button onClick={() => navigate('/mon-bilan')} style={btnStyle(CHIP.trophy)}><Trophy size={15} color="#fff" /></button>
        )}

        {/* Déconnexion */}
        <button onClick={signOut} style={{
          ...discreetStyle,
          borderRadius: 20,
          width: 'auto', padding: '6px 12px',
          fontSize: 12,
          color: 'rgba(255,255,255,.85)', fontWeight: 600,
          gap: 5
        }}>
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </header>
  )
}
