import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { THEME, CAT_COLORS } from '../theme'
import { computeAlertes, getAlertesTraitees, fetchNonConvoqueSet } from '../lib/alertes'
import {
  Calendar, Users, MessageCircle, LayoutDashboard, Menu,
  Heart, Radio, BarChart3, Settings, Archive, Folder,
  ListChecks, Gamepad2, Compass, Home, User, Award, ClipboardList, Shuffle, CalendarRange
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
    { path: '/sondages',          icon: ListChecks,    label: 'Sondages', cat: 'amber' },
    { path: '/fun',               icon: Gamepad2,      label: 'Fun & Jeux', cat: 'pink' },
    { path: '/cpa',               icon: Compass,       label: 'CPA', cat: 'cyan' },
    { path: '/tirage-au-sort',    icon: Shuffle,       label: 'Tirage au sort', cat: 'violet' },
    { path: '/calendrier-general', icon: CalendarRange, label: 'Calendrier général', cat: 'blue' },
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
  { section: 'Suivi & analyse', items: [
    { path: '/rpe',        icon: Heart,     label: 'RPE équipe', cat: 'rose' },
    { path: '/footbar',    icon: Radio,     label: 'Footbar équipe', cat: 'orange' },
    { path: '/analyse',    icon: BarChart3, label: 'Analyse', cat: 'purple' },
    { path: '/ressources', icon: Folder,    label: 'Ressources', cat: 'teal' },
  ]},
  { section: 'Autres', items: [
    { path: '/staff',           icon: Settings,      label: 'Staff', cat: 'slate' },
    { path: '/sondages',        icon: ListChecks,    label: 'Sondages', cat: 'amber' },
    { path: '/cpa',             icon: Compass,       label: 'CPA', cat: 'cyan' },
    { path: '/fun',             icon: Gamepad2,      label: 'Fun & Jeux', cat: 'pink' },
    { path: '/tirage-au-sort',  icon: Shuffle,       label: 'Tirage au sort', cat: 'violet' },
    { path: '/calendrier-general', icon: CalendarRange, label: 'Calendrier général', cat: 'blue' },
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
    { path: '/calendrier-general', icon: CalendarRange, label: 'Calendrier général', cat: 'blue' },
  ]},
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, isCoach, isAdjoint, isJoueur, isStaff } = useAuth()
  const [showMore, setShowMore] = useState(false)
  const [nbAlertes, setNbAlertes] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)

  const mainItems = isCoach ? NAV_COACH_MAIN : isAdjoint ? NAV_STAFF_MAIN : NAV_JOUEUR_MAIN
  const moreItems = isCoach ? NAV_COACH_MORE : isAdjoint ? NAV_STAFF_MORE : NAV_JOUEUR_MORE

  // Charge le nombre d'alertes actives pour le badge — recalculé à chaque navigation
  // (comme loadUnread) pour refléter tout de suite une alerte marquée "traitée" sur le
  // Dashboard, plutôt que de rester bloqué jusqu'au prochain rechargement complet.
  useEffect(() => {
    if (isCoach) loadAlertes()
  }, [isCoach, pathname])

  // Charge le nombre de messages privés non lus — recalculé à chaque navigation
  // pour refléter les messages marqués "lu" en ouvrant une conversation.
  useEffect(() => { loadUnread() }, [profile, pathname])

  async function loadUnread() {
    const myAuthId = profile?.auth_id || profile?.id
    if (!myAuthId) return
    // Messages privés non lus : suivi via la colonne `lu`. Messages de canal (groupe
    // général, et staff pour le staff) : pas de destinataire ni de colonne "lu" par
    // utilisateur, donc on compare à la date du dernier message vu par canal — lue
    // depuis message_lectures (serveur), pas depuis le localStorage de cet appareil :
    // sinon lire les messages sur un appareil ne faisait jamais disparaître la pastille
    // sur les autres (ex. lu sur iPhone, toujours marqué non lu sur iPad). Si ce repère
    // n'existe pas encore (jamais ouvert ce canal sur aucun appareil), tous les messages
    // existants comptent comme non lus : c'est la réalité, pas une valeur par défaut à
    // zéro qui laisserait le badge muet indéfiniment.
    async function unreadForCanal(canal) {
      const { data: lecture } = await supabase.from('message_lectures')
        .select('derniere_lecture').eq('user_id', myAuthId).eq('canal', canal).maybeSingle()
      let query = supabase.from('messages').select('expediteur_id').eq('groupe', true).eq('canal', canal)
      if (lecture?.derniere_lecture) query = query.gt('created_at', lecture.derniere_lecture)
      const { data } = await query
      return (data || []).filter(m => m.expediteur_id !== myAuthId).length
    }

    const [{ count: privCount }, generalUnread, staffUnread] = await Promise.all([
      supabase.from('messages').select('*', { count: 'exact', head: true })
        .eq('destinataire_id', myAuthId).eq('lu', false),
      unreadForCanal('general'),
      isStaff ? unreadForCanal('staff') : Promise.resolve(0),
    ])
    setUnreadCount((privCount || 0) + generalUnread + staffUnread)
  }

  // Même calcul que DashboardPage.jsx (cf. lib/alertes.js) — avant, ce badge avait sa
  // propre logique (différente !) et sa propre clé de dismiss, ce qui le faisait
  // paraître bloqué indéfiniment même après avoir traité les alertes sur le Dashboard.
  async function loadAlertes() {
    try {
      const [{ data: rpeData }, { data: joueursData }, { data: absencesData }, { data: statsDataRaw }] = await Promise.all([
        supabase.from('rpe').select('*, joueurs(id,nom,prenom), evenements(date_heure,type)')
          .order('date_heure', { foreignTable: 'evenements', ascending: false }).limit(300),
        supabase.from('joueurs').select('id,nom,prenom').order('nom'),
        supabase.from('presences').select('joueur_id, statut').in('statut', ['absent', 'blesse']),
        supabase.from('stats_collectives').select('buts_marques, buts_encaisses, evenements(date_heure, match_type)')
          .order('created_at', { ascending: false }).limit(20),
      ])

      const statsData = (statsDataRaw || [])
        .filter(s => s.evenements?.match_type !== 'preparation')
        .sort((a, b) => new Date(b.evenements?.date_heure || 0) - new Date(a.evenements?.date_heure || 0))
      const matchResults = statsData.map(s => s.buts_marques > s.buts_encaisses ? 'V' : s.buts_marques === s.buts_encaisses ? 'N' : 'D')

      // Exclut du calcul collectif les RPE remplis par un joueur non convoqué (cf.
      // MonSuiviPage.jsx / lib/alertes.js) — mêmes règles que DashboardPage.jsx pour que
      // ce badge reste cohérent avec le détail affiché sur le Dashboard.
      const nonConvoqueSet = await fetchNonConvoqueSet(supabase, rpeData || [])
      const { alertes, alertesCollectives } = computeAlertes({ rpeData, joueursData, matchResults, absencesData, nonConvoqueSet })
      const traitees = getAlertesTraitees()
      setNbAlertes(Math.max(0, alertes.length + alertesCollectives.length - traitees.length))
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
            maxWidth: 'var(--app-max-width)', margin: '0 auto',
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
        maxWidth: 'var(--app-max-width)', margin: '0 auto'
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
