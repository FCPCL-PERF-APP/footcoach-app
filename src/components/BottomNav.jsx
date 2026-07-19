import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { THEME, CAT_COLORS } from '../theme'
import {
  Calendar, Users, MessageCircle, LayoutDashboard, Menu,
  Heart, Radio, BarChart3, Settings, Archive, Folder,
  ListChecks, Gamepad2, Compass, Home, User, Award, ClipboardList
} from 'lucide-react'

const NAV_COACH_MAIN = [
  { path: '/calendrier', icon: Calendar,        label: 'Agenda' },
  { path: '/joueurs',    icon: Users,           label: 'Joueurs' },
  { path: '/messages',   icon: MessageCircle,   label: 'Messages' },
  { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/plus',       icon: Menu,            label: 'Plus' },
]
const NAV_COACH_MORE = [
  { section: 'Suivi & analyse', items: [
    { path: '/rpe',      icon: Heart,     label: 'RPE équipe', cat: 'rose' },
    { path: '/footbar',  icon: Radio,     label: 'Footbar équipe', cat: 'orange' },
    { path: '/analyse',  icon: BarChart3, label: 'Analyse', cat: 'purple' },
  ]},
  { section: 'Administration', items: [
    { path: '/staff',           icon: Settings, label: 'Staff', cat: 'slate' },
    { path: '/archive-saison',  icon: Archive,  label: 'Archiver saison', cat: 'slate' },
    { path: '/ressources',      icon: Folder,   label: 'Ressources', cat: 'teal' },
  ]},
  { section: 'Autres', items: [
    { path: '/sondages', icon: ListChecks, label: 'Sondages', cat: 'amber' },
    { path: '/fun',      icon: Gamepad2,   label: 'Fun & Jeux', cat: 'pink' },
    { path: '/cpa',      icon: Compass,    label: 'CPA', cat: 'cyan' },
  ]},
]
const NAV_STAFF_MAIN = [
  { path: '/calendrier', icon: Calendar,        label: 'Agenda' },
  { path: '/joueurs',    icon: Users,           label: 'Joueurs' },
  { path: '/messages',   icon: MessageCircle,   label: 'Messages' },
  { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/plus',       icon: Menu,            label: 'Plus' },
]
const NAV_STAFF_MORE = [
  { section: null, items: [
    { path: '/rpe',        icon: Heart,  label: 'RPE équipe', cat: 'rose' },
    { path: '/footbar',    icon: Radio,  label: 'Footbar équipe', cat: 'orange' },
    { path: '/ressources', icon: Folder, label: 'Ressources', cat: 'teal' },
  ]},
]
const NAV_JOUEUR_MAIN = [
  { path: '/mon-dashboard', icon: Home,          label: 'Dashboard' },
  { path: '/calendrier',    icon: Calendar,      label: 'Agenda' },
  { path: '/ma-fiche',      icon: User,          label: 'Ma fiche' },
  { path: '/messages',      icon: MessageCircle, label: 'Messages' },
  { path: '/plus',          icon: Menu,          label: 'Plus' },
]
const NAV_JOUEUR_MORE = [
  { section: null, items: [
    { path: '/mon-suivi',   icon: Heart,          label: 'Mon suivi', cat: 'rose' },
    { path: '/mes-badges',  icon: Award,          label: 'Mes badges', cat: 'gold' },
    { path: '/staff',       icon: ClipboardList,  label: 'Staff', cat: 'slate' },
    { path: '/sondages',    icon: ListChecks,     label: 'Sondages', cat: 'amber' },
    { path: '/cpa',         icon: Compass,        label: 'CPA', cat: 'cyan' },
    { path: '/fun',         icon: Gamepad2,       label: 'Fun & Jeux', cat: 'pink' },
    { path: '/ressources',  icon: Folder,         label: 'Ressources', cat: 'teal' },
  ]},
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, isCoach, isAdjoint, isJoueur } = useAuth()
  const [showMore, setShowMore] = useState(false)
  const [nbAlertes, setNbAlertes] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const mainItems = isCoach ? NAV_COACH_MAIN : isAdjoint ? NAV_STAFF_MAIN : NAV_JOUEUR_MAIN
  const moreItems = isCoach ? NAV_COACH_MORE : isAdjoint ? NAV_STAFF_MORE : NAV_JOUEUR_MORE

  // Charge le nombre d'alertes actives pour le badge
  useEffect(() => {
    if (isCoach) loadAlertes()
  }, [isCoach])

  // Charge le nombre de messages privés non lus — recalculé à chaque navigation
  // pour refléter les messages marqués "lu" en ouvrant une conversation.
  useEffect(() => { loadUnread() }, [profile, pathname])

  async function loadUnread() {
    const myAuthId = profile?.auth_id || profile?.id
    if (!myAuthId) return
    // Messages privés non lus : suivi via la colonne `lu`. Messages du canal groupe :
    // pas de destinataire ni de colonne "lu" par utilisateur, donc on compare à la date
    // du dernier message groupe vu (posée par MessagesPage.jsx en localStorage). Si ce
    // repère n'existe pas encore (jamais ouvert le canal sur cet appareil — nouveau
    // joueur, ou nouvel appareil), tous les messages groupe existants comptent comme
    // non lus : c'est la réalité (ils n'ont jamais été vus), pas une valeur par défaut
    // à zéro qui laissait le badge muet indéfiniment tant que personne n'avait ouvert
    // l'onglet Messages au moins une fois.
    const lastGroupRead = localStorage.getItem('fc-group-messages-last-read')
    const [{ count: privCount }, groupResult] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('destinataire_id', myAuthId).eq('lu', false),
      lastGroupRead
        ? supabase.from('messages').select('expediteur_id').eq('groupe', true).gt('created_at', lastGroupRead)
        : supabase.from('messages').select('expediteur_id').eq('groupe', true),
    ])
    const groupUnread = (groupResult.data || []).filter(m => m.expediteur_id !== myAuthId).length
    setUnreadCount((privCount || 0) + groupUnread)
  }

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
            borderTop: `1px solid ${'var(--primary)'}`,
            maxWidth: 480, margin: '0 auto',
            boxShadow: '0 -4px 20px rgba(0,0,0,.4)'
          }}>
            {moreItems.map(({ section, items }) => (
              <div key={section || 'default'}>
                {section && (
                  <p style={{
                    fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)',
                    textTransform: 'uppercase', letterSpacing: '.5px',
                    padding: '10px 20px 4px'
                  }}>{section}</p>
                )}
                {items.map(item => {
                  const cat = CAT_COLORS[item.cat] || { color: 'rgba(255,255,255,.85)', bg: 'rgba(255,255,255,.1)' }
                  return (
                    <button key={item.path} onClick={() => { navigate(item.path); setShowMore(false) }} style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 20px', border: 'none',
                      background: pathname.startsWith(item.path) ? 'rgba(255,255,255,.08)' : 'transparent',
                      cursor: 'pointer', borderBottom: '0.5px solid rgba(255,255,255,.06)'
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9, background: item.cat ? cat.color + '33' : 'rgba(255,255,255,.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <item.icon size={17} color={item.cat ? cat.color : 'rgba(255,255,255,.85)'} strokeWidth={2} />
                      </div>
                      <span style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{item.label}</span>
                      {pathname.startsWith(item.path) && (
                        <span style={{ marginLeft: 'auto', color: 'var(--primary-light)', fontSize: 12 }}>●</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </>
      )}

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: THEME.black,
        borderTop: `2px solid ${'var(--primary)'}`,
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
              borderTop: active || isMoreOpen ? `2px solid ${'var(--primary-light)'}` : '2px solid transparent',
            }}>
              <item.icon size={19} color={active || isMoreOpen ? 'var(--primary-light)' : 'rgba(255,255,255,.6)'} strokeWidth={2} />

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
                  background: 'var(--danger)', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  minWidth: 15, height: 15, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px'
                }}>{nbAlertes}</span>
              )}

              <span style={{
                fontSize: 9,
                color: active || isMoreOpen ? 'var(--primary-light)' : 'rgba(255,255,255,.5)',
                fontWeight: active || isMoreOpen ? 700 : 400
              }}>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
