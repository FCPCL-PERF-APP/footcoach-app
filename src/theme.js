// Thème FC PCL — Plouagat Châtelaudren Lanrodec
export const THEME = {
  primary:      '#1E4D8C', // Bleu club
  primaryDark:  '#0F2347', // Bleu foncé
  primaryLight: '#3B6FC4', // Bleu clair
  accent:       '#1E4D8C', // Bleu accent
  black:        '#111318', // Noir club
  blackSoft:    '#1E2128', // Noir doux
  white:        '#FFFFFF',
  bgPage:       '#F0F2F5', // Fond général
  bgCard:       '#FFFFFF', // Fond cartes
  bgSecondary:  '#F5F7FA', // Fond secondaire
  border:       '#E2E6ED', // Bordures
  textPrimary:  '#111318', // Texte principal
  textSecondary:'#6B7280', // Texte secondaire
  textMuted:    '#9CA3AF', // Texte tertiaire
  success:      '#2F8F3E', // Vert
  warning:      '#D08A1E', // Orange
  danger:       '#C13B3B', // Rouge
  // Fonds pastel assortis (badges, cartes d'alerte, tuiles d'icônes)
  successBg:    '#E9F6EA',
  warningBg:    '#FCF1E0',
  dangerBg:     '#FBECEC',
  primaryBg:    '#E8EFFA',
  surfaceMuted: '#F3F4F6', // Fond des tuiles d'icônes neutres
  radiusMd: 12,
  radiusLg: 16,
  // Dégradé header
  gradient: 'linear-gradient(135deg, #0F2347 0%, #1E4D8C 50%, #3B6FC4 100%)',
}

// Palette de couleurs par catégorie — donne à chaque type de raccourci/icône sa
// propre teinte vive (au lieu du bleu uniforme) pour un repérage visuel rapide,
// tout en gardant les couleurs fonctionnelles (succès/alerte/danger) de THEME
// réservées aux statuts (présence, alertes...).
export const CAT_COLORS = {
  blue:   { color: '#1E5FCC', bg: '#E5EDFB' }, // Agenda
  violet: { color: '#7C3AED', bg: '#F1E9FE' }, // Joueurs
  teal:   { color: '#0D9488', bg: '#E1F5F2' }, // Messages
  rose:   { color: '#E11D6E', bg: '#FCE4EF' }, // RPE / cœur
  orange: { color: '#EA6C1F', bg: '#FDECDF' }, // Footbar
  purple: { color: '#9333EA', bg: '#F4E7FD' }, // Analyse / stats
  amber:  { color: '#D97706', bg: '#FDF0DA' }, // Sondages
  pink:   { color: '#DB2777', bg: '#FCE4F0' }, // Fun & jeux
  cyan:   { color: '#0891B2', bg: '#DFF4F8' }, // CPA
  slate:  { color: '#475569', bg: '#E9EDF2' }, // Staff / administration
  gold:   { color: '#B8860B', bg: '#FBF0D9' }, // Badges
}
