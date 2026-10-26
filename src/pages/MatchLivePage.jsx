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
