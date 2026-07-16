import { useNavigate } from 'react-router-dom'
import { PageHeader, IconTile } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { BarChart3, Trophy, Award, TrendingUp, Scale, TrendingDown, Smartphone, ChevronRight } from 'lucide-react'

const ANALYSES = [
  { path: '/stats-matchs',    icon: BarChart3, cat: 'blue', label: 'Bilan des matchs',        desc: 'Résultats, buts marqués et encaissés par période' },
  { path: '/bilan-saison',    icon: Trophy, cat: 'amber', label: 'Bilan de saison',         desc: 'Trophées individuels et stats collectives de la saison' },
  { path: '/classement',      icon: Award, cat: 'gold', label: 'Classements',             desc: 'Buteurs, passeurs, temps de jeu, distance...' },
  { path: '/charge-hebdo',    icon: TrendingUp, cat: 'rose', label: 'Charge hebdomadaire',     desc: "RPE et charge d'entraînement sur 12 semaines" },
  { path: '/comparatif',      icon: Scale, cat: 'violet', label: 'Comparatif joueurs',      desc: 'Comparer deux joueurs sur RPE et Footbar' },
  { path: '/correlation',     icon: TrendingDown, cat: 'purple', label: 'Corrélation RPE / Perf.', desc: 'Lien entre charge perçue et résultats' },
  { path: '/stats-connexion', icon: Smartphone, cat: 'teal', label: "Adoption de l'app",       desc: "Taux d'invitation et de connexion des joueurs" },
]

export default function AnalysePage() {
  const navigate = useNavigate()
  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={18} /> Analyse</span>} />
      {ANALYSES.map(a => (
        <div key={a.path} onClick={() => navigate(a.path)} style={{
          background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 14,
          padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <IconTile icon={a.icon} color={CAT_COLORS[a.cat].color} bg={CAT_COLORS[a.cat].bg} size={20} tileSize={40} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>{a.desc}</p>
          </div>
          <ChevronRight size={18} color={THEME.primary} />
        </div>
      ))}
    </div>
  )
}
