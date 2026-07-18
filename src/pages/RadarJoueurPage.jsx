import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { ArrowLeft, ClipboardList, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const AXES = [
  { key: 'perf_individuelle', label: 'Perf. indiv.' },
  { key: 'perf_collective',   label: 'Perf. coll.' },
  { key: 'motivation',        label: 'Motivation' },
  { key: 'implication',       label: 'Implication' },
  { key: 'difficulte',        label: 'Difficulté' },
  { key: 'fatigue',           label: 'Fatigue' },
]

function RadarChart({ joueurData, equipeData, joueurNom, size = 220 }) {
  const cx = size / 2, cy = size / 2
  const r = size * 0.36
  const n = AXES.length
  const maxVal = 5

  function getPoint(i, val) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    const d = (val / maxVal) * r
    return { x: cx + d * Math.cos(angle), y: cy + d * Math.sin(angle) }
  }

  function getLabelPoint(i) {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    const d = r + 22
    return { x: cx + d * Math.cos(angle), y: cy + d * Math.sin(angle) }
  }

  const joueurPoints = AXES.map((a, i) => getPoint(i, joueurData[a.key] || 0))
  const equipePoints = AXES.map((a, i) => getPoint(i, equipeData[a.key] || 0))
  const toPath = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z'

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: size }}>
      {/* Cercles de référence */}
      {[1,2,3,4,5].map(v => (
        <polygon key={v} points={AXES.map((_, i) => { const p = getPoint(i, v); return `${p.x},${p.y}` }).join(' ')}
          fill="none" stroke="var(--border)" strokeWidth="0.5" />
      ))}
      {/* Axes */}
      {AXES.map((_, i) => {
        const p = getPoint(i, 5)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth="0.5" />
      })}
      {/* Zone équipe */}
      <path d={toPath(equipePoints)} fill="rgba(24,95,165,.08)" stroke="rgba(24,95,165,.3)" strokeWidth="1.5" strokeDasharray="4,3" />
      {/* Zone joueur */}
      <path d={toPath(joueurPoints)} fill="rgba(163,45,45,.15)" stroke="var(--danger)" strokeWidth="2" />
      {/* Points joueur */}
      {joueurPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--danger)" />)}
      {/* Labels */}
      {AXES.map((a, i) => {
        const p = getLabelPoint(i)
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill="var(--text-secondary)" fontWeight="500">{a.label}</text>
        )
      })}
      {/* Valeurs joueur */}
      {joueurPoints.map((p, i) => {
        const val = joueurData[AXES[i].key]
        return val ? <text key={i} x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="var(--danger)" fontWeight="700">{val}</text> : null
      })}
    </svg>
  )
}

export default function RadarJoueurPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueur, setJoueur] = useState(null)
  const [joueurData, setJoueurData] = useState({})
  const [equipeData, setEquipeData] = useState({})
  const [comparaison, setComparaison] = useState({})
  // Ignore une réponse devenue obsolète si l'utilisateur navigue vers un autre joueur
  // avant qu'elle ne revienne (ex: retour/avant rapide dans le navigateur).
  const idRef = useRef(id)

  useEffect(() => { idRef.current = id; loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const [{ data: j }, { data: rpeJoueur }, { data: rpeEquipe }] = await Promise.all([
      supabase.from('joueurs').select('nom,prenom,poste,photo_url').eq('id', id).single(),
      supabase.from('rpe').select('*').eq('joueur_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('rpe').select('*').order('created_at', { ascending: false }).limit(200),
    ])
    if (idRef.current !== id) return

    setJoueur(j)

    // Moyenne joueur
    const avgJoueur = {}
    AXES.forEach(a => {
      const vals = (rpeJoueur || []).map(r => r[a.key]).filter(v => v != null)
      avgJoueur[a.key] = vals.length ? parseFloat((vals.reduce((x,y) => x+y,0)/vals.length).toFixed(1)) : 0
    })
    setJoueurData(avgJoueur)

    // Moyenne équipe
    const avgEquipe = {}
    AXES.forEach(a => {
      const vals = (rpeEquipe || []).map(r => r[a.key]).filter(v => v != null)
      avgEquipe[a.key] = vals.length ? parseFloat((vals.reduce((x,y) => x+y,0)/vals.length).toFixed(1)) : 0
    })
    setEquipeData(avgEquipe)

    // Comparaison joueur vs équipe
    const comp = {}
    AXES.forEach(a => {
      const diff = avgJoueur[a.key] - avgEquipe[a.key]
      comp[a.key] = parseFloat(diff.toFixed(1))
    })
    setComparaison(comp)

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate(`/joueurs/${id}`)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Radar RPE</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{joueur?.nom} {joueur?.prenom} · {joueur?.poste}</p>
        </div>
      </div>

      {/* Graphique radar */}
      <Card>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 3, background: 'var(--danger)', borderRadius: 2 }} />
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{joueur?.prenom}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 3, background: 'rgba(24,95,165,.5)', borderRadius: 2, borderStyle: 'dashed' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Moyenne équipe</span>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <RadarChart joueurData={joueurData} equipeData={equipeData} joueurNom={joueur?.prenom} />
        </div>
      </Card>

      {/* Tableau comparatif */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Joueur vs Équipe</p>
        {AXES.map(a => {
          const diff = comparaison[a.key]
          const isAbove = diff > 0.3
          const isBelow = diff < -0.3
          return (
            <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-primary)', width: 90 }}>{a.label}</span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', width: 28 }}>{joueurData[a.key] || '—'}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: 'var(--danger)', width: `${(joueurData[a.key] || 0) / 5 * 100}%` }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 28 }}>{equipeData[a.key] || '—'}</span>
                <span style={{ fontSize: 11, fontWeight: 600, width: 36, textAlign: 'right',
                  color: isAbove ? 'var(--success)' : isBelow ? 'var(--danger)' : 'var(--text-muted)' }}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              </div>
            </div>
          )
        })}
      </Card>

      {/* Analyse textuelle */}
      <Card>
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={16} color={'var(--primary)'} /> Analyse</p>
        {AXES.map(a => {
          const diff = comparaison[a.key]
          if (Math.abs(diff) < 0.5) return null
          return (
            <div key={a.key} style={{ padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
              <p style={{ fontSize: 12, color: diff > 0 ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} <strong>{a.label}</strong> : {diff > 0 ? 'au-dessus' : 'en dessous'} de la moyenne équipe ({diff > 0 ? '+' : ''}{diff} pts)
              </p>
            </div>
          )
        }).filter(Boolean)}
        {Object.values(comparaison).every(v => Math.abs(v) < 0.5) && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dans la moyenne de l'équipe sur tous les items.</p>
        )}
      </Card>
    </div>
  )
}
