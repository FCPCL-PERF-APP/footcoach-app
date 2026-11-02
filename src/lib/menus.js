// Menus de navigation par rôle (barre du bas + « Plus »).
import {
  Calendar, Users, MessageCircle, LayoutDashboard, Menu,
  Heart, Radio, BarChart3, Settings, Archive, Folder,
  ListChecks, Gamepad2, Compass, Home, User, ClipboardList, Trophy
} from 'lucide-react'

export const NAV_COACH_MAIN = [
  { path: '/calendrier', icon: Calendar,        label: 'Agenda' },
  { path: '/joueurs',    icon: Users,           label: 'Joueurs' },
  { path: '/messages',   icon: MessageCircle,   label: 'Messages' },
  { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/plus',       icon: Menu,            label: 'Plus' },
]
export const NAV_COACH_MORE = [
  { section: 'Suivi & analyse', items: [
    { path: '/rpe',      icon: Heart,     label: 'RPE équipe', cat: 'rose' },
    { path: '/footbar',  icon: Radio,     label: 'Footbar équipe', cat: 'orange' },
    { path: '/analyse',  icon: BarChart3, label: 'Analyse', cat: 'purple' },
    { path: '/championnat', icon: Trophy, label: 'Championnat', cat: 'gold' },
    { path: '/cpa',         icon: Compass, label: 'CPA', cat: 'cyan' },
  ]},
  { section: 'Club', items: [
    { path: '/staff',           icon: Settings,   label: 'Staff', cat: 'slate' },
    { path: '/ressources',      icon: Folder,     label: 'Ressources', cat: 'teal' },
    { path: '/sondages',        icon: ListChecks, label: 'Sondages', cat: 'amber' },
    { path: '/archive-saison',  icon: Archive,    label: 'Archiver saison', cat: 'slate' },
  ]},
]
export const NAV_STAFF_MAIN = [
  { path: '/calendrier', icon: Calendar,        label: 'Agenda' },
  { path: '/joueurs',    icon: Users,           label: 'Joueurs' },
  { path: '/messages',   icon: MessageCircle,   label: 'Messages' },
  { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/plus',       icon: Menu,            label: 'Plus' },
]
export const NAV_STAFF_MORE = [
  { section: 'Suivi & analyse', items: [
    { path: '/rpe',        icon: Heart,     label: 'RPE équipe', cat: 'rose' },
    { path: '/footbar',    icon: Radio,     label: 'Footbar équipe', cat: 'orange' },
    { path: '/analyse',    icon: BarChart3, label: 'Analyse', cat: 'purple' },
    { path: '/championnat', icon: Trophy, label: 'Championnat', cat: 'gold' },
    { path: '/cpa',         icon: Compass, label: 'CPA', cat: 'cyan' },
  ]},
  { section: 'Club', items: [
    { path: '/staff',      icon: Settings,   label: 'Staff', cat: 'slate' },
    { path: '/ressources', icon: Folder,     label: 'Ressources', cat: 'teal' },
    { path: '/sondages',   icon: ListChecks, label: 'Sondages', cat: 'amber' },
  ]},
]
export const NAV_JOUEUR_MAIN = [
  { path: '/mon-dashboard', icon: Home,          label: 'Accueil' },
  { path: '/calendrier',    icon: Calendar,      label: 'Agenda' },
  { path: '/mon-bilan',     icon: Trophy,        label: 'Ma saison' },
  { path: '/messages',      icon: MessageCircle, label: 'Messages' },
  { path: '/plus',          icon: Menu,          label: 'Plus' },
]
export const NAV_JOUEUR_MORE = [
  { section: null, items: [
    { path: '/mon-suivi',   icon: Heart,          label: 'Mon suivi (RPE)', cat: 'rose' },
    { path: '/ma-fiche',    icon: User,           label: 'Ma fiche', cat: 'violet' },
    { path: '/championnat', icon: Trophy,         label: 'Championnat', cat: 'blue' },
    { path: '/staff',       icon: ClipboardList,  label: 'Staff', cat: 'slate' },
    { path: '/sondages',    icon: ListChecks,     label: 'Sondages', cat: 'amber' },
    { path: '/cpa',         icon: Compass,        label: 'CPA', cat: 'cyan' },
    { path: '/fun',         icon: Gamepad2,       label: 'Fun & Jeux', cat: 'pink' },
    { path: '/ressources',  icon: Folder,         label: 'Ressources', cat: 'teal' },
  ]},
]
