import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/UI'
import { THEME } from '../theme'

const ANALYSES = [
  { path: '/stats-matchs',    icon: '📊', label: 'Bilan des matchs',        desc: 'Résultats, buts marqués et encaissés par période' },
  { path: '/bilan-saison',    icon: '🏆', label: 'Bilan de saison',         desc: 'Trophées individuels et stats collectives de la saison' },
  { path: '/classement',      icon: '🥇', label: 'Classements',             desc: 'Buteurs, passeurs, temps de jeu, distance...' },
  { path: '/charge-hebdo',    icon: '📈', label: 'Charge hebdomadaire',     desc: "RPE et charge d'entraînement sur 12 semaines" },
  { path: '/comparatif',      icon: '⚖️', label: 'Comparatif joueurs',      desc: 'Comparer deux joueurs sur RPE et Footbar' },
  { path: '/correlation',     icon: '📉', label: 'Corrélation RPE / Perf.', desc: 'Lien entre charge perçue et résultats' },
  { path: '/stats-connexion', icon: '📱', label: "Adoption de l'app",       desc: "Taux d'invitation et de connexion des joueurs" },
]

export default function AnalysePage() {
  const navigate = useNavigate()
  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="📊 Analyse" />
      {ANALYSES.map(a => (
        <div key={a.path} onClick={() => navigate(a.path)} style={{
          background: '#fff', border: '0.5px solid #E5E7EB', borderRadius: 14,
          padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <span style={{ fontSize: 24 }}>{a.icon}</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>{a.desc}</p>
          </div>
          <span style={{ fontSize: 16, color: THEME.primary }}>→</span>
        </div>
      ))}
    </div>
  )
}
