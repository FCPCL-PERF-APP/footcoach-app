import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Spinner } from '../components/UI'
import { ArrowLeft, Radio, Goal, RefreshCw, Square } from 'lucide-react'

const STATUTS = {
  en_cours:   { label: '1ère mi-temps', live: true },
  mi_temps:   { label: 'Mi-temps', live: true },
  seconde_mt: { label: '2nde mi-temps', live: true },
  termine:    { label: 'Match terminé', live: false },
}

// Visuel de la composition (même rendu que l'onglet Compo côté coach), à partir de la
// version publique figée par le coach — positions, noms, numéros, photos, capitaine.
function CompoTerrain({ compo }) {
  return (
    <>
      <div style={{ background: '#2d7a27', borderRadius: 12, overflow: 'hidden', maxWidth: 360, margin: '0 auto' }}>
        <svg viewBox="0 0 100 150" style={{ width: '100%', aspectRatio: '2/3', display: 'block' }}>
          <defs>
            {compo.joueurs.map((p, i) => p.photo ? (
              <clipPath key={i} id={`lc-clip-${i}`}><circle cx={p.x} cy={p.y * 1.5} r="8.5" /></clipPath>
            ) : null)}
          </defs>
          {[0,1,2,3,4,5,6,7,8,9].map(i => <rect key={i} x="0" y={i * 15} width="100" height="15" fill={i % 2 === 0 ? 'rgba(255,255,255,.03)' : 'transparent'} />)}
          <rect x="5" y="3" width="90" height="144" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" rx="1" />
          <line x1="5" y1="75" x2="95" y2="75" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
          <circle cx="50" cy="75" r="14" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
          <rect x="25" y="3" width="50" height="26" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
          <rect x="37" y="3" width="26" height="12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
          <rect x="25" y="121" width="50" height="26" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
          <rect x="37" y="135" width="26" height="12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
          {compo.joueurs.map((p, i) => {
            const cy = p.y * 1.5
            if (!p.nom) return (
              <g key={i}>
                <circle cx={p.x} cy={cy} r="8.5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.6)" strokeWidth=".5" />
                <text x={p.x} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="4" fill="rgba(255,255,255,.5)">{p.label}</text>
              </g>
            )
            return (
              <g key={i}>
                {p.photo ? (
                  <>
                    <circle cx={p.x} cy={cy} r="9" fill="#fff" />
                    <image href={p.photo} x={p.x - 8.5} y={cy - 8.5} width="17" height="17" clipPath={`url(#lc-clip-${i})`} preserveAspectRatio="xMidYMid slice" />
                    <circle cx={p.x} cy={cy} r="8.5" fill="none" stroke="var(--primary)" strokeWidth=".7" />
                  </>
                ) : (
                  <>
                    <circle cx={p.x} cy={cy} r="8.5" fill="var(--primary)" stroke="rgba(255,255,255,.6)" strokeWidth=".5" />
                    <text x={p.x} y={cy + 1.2} textAnchor="middle" dominantBaseline="middle" fontSize="4.5" fill="#fff" fontWeight="700">{p.numero}</text>
                  </>
                )}
                {p.cap && (
                  <>
                    <circle cx={p.x - 6.5} cy={cy - 6.5} r="3.4" fill="#FACC15" stroke="#fff" strokeWidth=".5" />
                    <text x={p.x - 6.5} y={cy - 5.6} textAnchor="middle" dominantBaseline="middle" fontSize="3.4" fill="#111" fontWeight="800">C</text>
                  </>
                )}
                <circle cx={p.x + 6.5} cy={cy + 6.5} r="3.2" fill="var(--primary)" stroke="#fff" strokeWidth=".5" />
                <text x={p.x + 6.5} y={cy + 7.4} textAnchor="middle" dominantBaseline="middle" fontSize="3" fill="#fff" fontWeight="700">{p.numero}</text>
                <rect x={p.x - 9.5} y={cy + 10.5} width="19" height="5.2" rx="1.2" fill="rgba(0,0,0,.6)" />
                <text x={p.x} y={cy + 14.2} textAnchor="middle" fontSize="3.2" fill="#fff" fontWeight="600">{p.nom?.slice(0, 7)}</text>
              </g>
            )
          })}
        </svg>
      </div>
      {compo.banc?.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10 }}>
          <b>Remplaçants :</b> {compo.banc.map(b => `${b.numero ? b.numero + ' ' : ''}${b.nom}`).join(' · ')}
        </p>
      )}
    </>
  )
}

function Fait({ f }) {
  const base = { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '0.5px solid var(--bg-secondary)' }
  const min = <span style={{ width: 34, fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{f.minute}'</span>
  if (f.type === 'but_pour') return (
    <div style={base}>{min}<Goal size={16} color="var(--success)" />
      <div><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>BUT ! {f.buteur || ''}</p>
        {f.passeur && <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Passe de {f.passeur}</p>}</div></div>
  )
  if (f.type === 'but_contre') return (
    <div style={base}>{min}<Goal size={16} color="var(--danger)" />
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)' }}>But encaissé</p></div>
  )
  if (f.type === 'carton_jaune' || f.type === 'carton_rouge') return (
    <div style={base}>{min}<Square size={16} fill={f.type === 'carton_jaune' ? '#FACC15' : '#DC2626'} color="transparent" />
      <p style={{ fontSize: 13 }}>{f.type === 'carton_jaune' ? 'Carton jaune' : 'Carton rouge'}{f.joueur ? ` — ${f.joueur}` : ''}</p></div>
  )
  if (f.type === 'changement') return (
    <div style={base}>{min}<RefreshCw size={15} color="var(--primary)" />
      <p style={{ fontSize: 13 }}>Changement : <span style={{ color: 'var(--success)' }}>↑ {f.entrant || '?'}</span> <span style={{ color: 'var(--danger)' }}>↓ {f.sortant || '?'}</span></p></div>
  )
  return null
}

// Suivi du match en direct, ouvert à tous les joueurs connectés (absents, blessés, non
// convoqués...). Alimenté par le coach depuis Suivi live (StatsPage) ; se met à jour tout
// seul (Realtime + relecture toutes les 15 s au cas où la connexion temps réel décroche).
export default function MatchLivePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [live, setLive] = useState(undefined) // undefined = chargement, null = pas de diffusion
  const [, setTick] = useState(0)

  useEffect(() => {
    let actif = true
    async function charger() {
      const [{ data: ev }, { data: l }] = await Promise.all([
        supabase.from('evenements').select('titre, domicile, date_heure').eq('id', id).maybeSingle(),
        supabase.from('match_live').select('*').eq('evenement_id', id).maybeSingle(),
      ])
      if (!actif) return
      setEvent(ev); setLive(l || null)
    }
    charger()
    const timer = setInterval(() => { charger(); setTick(t => t + 1) }, 15000)
    const sub = supabase.channel(`match-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_live', filter: `evenement_id=eq.${id}` }, charger)
      .subscribe()
    return () => { actif = false; clearInterval(timer); supabase.removeChannel(sub) }
  }, [id])

  if (live === undefined) return <div style={{ padding: 12 }}><Spinner /></div>

  const adversaire = (event?.titre || '').replace(/^vs\s+/i, '') || 'Adversaire'
  const st = STATUTS[live?.statut] || STATUTS.en_cours
  const domicile = event?.domicile !== false
  const gauche = { nom: 'FC PCL', score: live?.score_pour ?? 0 }
  const droite = { nom: adversaire, score: live?.score_contre ?? 0 }
  const [dom, ext] = domicile ? [gauche, droite] : [droite, gauche]
  const faits = [...(live?.faits || [])].sort((a, b) => b.minute - a.minute)
  const maj = live?.updated_at ? new Date(live.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color="var(--primary)" /></button>
        <p style={{ fontSize: 16, fontWeight: 700 }}>Match en direct</p>
      </div>

      {!live ? (
        <Card><p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
          Le suivi en direct n'est pas (ou plus) diffusé pour ce match.
        </p></Card>
      ) : (
        <>
          <div style={{ background: 'var(--gradient)', borderRadius: 16, padding: '16px 14px', marginBottom: 14, color: '#fff' }}>
            <p style={{ fontSize: 11, textAlign: 'center', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: .9 }}>
              {st.live && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444', display: 'inline-block' }} />}
              <Radio size={12} /> {st.live ? 'EN DIRECT' : 'TERMINÉ'} · {st.label}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{dom.nom}</p>
              <p style={{ fontSize: 34, fontWeight: 800, letterSpacing: 2 }}>{dom.score} - {ext.score}</p>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{ext.nom}</p>
            </div>
            {maj && <p style={{ fontSize: 10, textAlign: 'center', marginTop: 10, opacity: .7 }}>Mis à jour à {maj} · actualisation automatique</p>}
          </div>

          {live.compo && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Composition · {live.compo.formation}</p>
              <CompoTerrain compo={live.compo} />
            </Card>
          )}

          <Card>
            <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Faits de jeu</p>
            {faits.length === 0
              ? <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 0' }}>Rien à signaler pour l'instant.</p>
              : faits.map((f, i) => <Fait key={i} f={f} />)}
          </Card>
        </>
      )}
    </div>
  )
}
