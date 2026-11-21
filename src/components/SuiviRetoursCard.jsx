import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ClipboardCheck, Bell, ChevronDown, ChevronRight, Swords, Footprints } from 'lucide-react'
import { supabase, authHeaders } from '../lib/supabase'
import { toutLire } from '../lib/toutLire'
import { bilansRetours, assiduite } from '../lib/suiviRetours'
import { Card, Spinner } from './UI'

const JOUR = 24 * 60 * 60 * 1000
const couleurTaux = t => (t >= 80 ? 'var(--success)' : t >= 50 ? 'var(--warning)' : 'var(--danger)')
const pct = (n, d) => (d ? Math.round(n / d * 100) : 0)
const nomCourt = j => `${j.prenom || ''} ${j.nom?.[0] ? j.nom[0] + '.' : ''}`.trim()

function Jauge({ label, n, d }) {
  const t = pct(n, d)
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span><b style={{ color: couleurTaux(t) }}>{n}/{d}</b> <span style={{ color: 'var(--text-muted)' }}>· {t} %</span></span>
      </div>
      <div style={{ height: 7, background: 'var(--bg-secondary)', borderRadius: 4 }}>
        <div style={{ height: '100%', width: `${t}%`, background: couleurTaux(t), borderRadius: 4 }} />
      </div>
    </div>
  )
}

// État des lieux des retours joueurs (RPE, Footbar) : dernier événement joué (collecte
// en cours jusqu'au début de l'événement suivant), événements précédents (clos) et
// assiduité de chaque joueur sur 30 jours.
export default function SuiviRetoursCard() {
  const navigate = useNavigate()
  const [donnees, setDonnees] = useState(null)
  const [voirTout, setVoirTout] = useState(false)
  const [relance, setRelance] = useState({})

  useEffect(() => {
    let actif = true
    async function charger() {
      const maintenant = new Date()
      const depuis = new Date(maintenant.getTime() - 30 * JOUR).toISOString()
      const [{ data: evs }, { data: prochains }, { data: joueurs }] = await Promise.all([
        supabase.from('evenements').select('id, titre, type, date_heure').in('type', ['seance', 'match'])
          .gte('date_heure', depuis).lte('date_heure', maintenant.toISOString()).order('date_heure', { ascending: false }),
        supabase.from('evenements').select('date_heure').gt('date_heure', maintenant.toISOString()).order('date_heure', { ascending: true }).limit(1),
        supabase.from('joueurs').select('id, nom, prenom').eq('archive', false).order('nom'),
      ])
      const ids = (evs || []).map(e => e.id)
      if (!ids.length) { if (actif) setDonnees({ bilans: [], assid: [] }); return }
      const [conv, pres, rpe, foot] = await Promise.all([
        toutLire(() => supabase.from('convocations').select('joueur_id, evenement_id').eq('convoque', true).in('evenement_id', ids)),
        toutLire(() => supabase.from('presences').select('joueur_id, evenement_id, statut').in('statut', ['absent', 'blesse']).in('evenement_id', ids)),
        toutLire(() => supabase.from('rpe').select('joueur_id, evenement_id').in('evenement_id', ids)),
        toutLire(() => supabase.from('footbar').select('joueur_id, evenement_id').in('evenement_id', ids)),
      ])
      const grouper = rows => {
        const m = new Map()
        for (const r of rows || []) { if (!m.has(r.evenement_id)) m.set(r.evenement_id, new Set()); m.get(r.evenement_id).add(r.joueur_id) }
        return m
      }
      const ctx = { joueurs: joueurs || [], convoques: grouper(conv.data), absents: grouper(pres.data), prochain: prochains?.[0]?.date_heure || null }
      const bilans = bilansRetours(evs, ctx, { rpe: grouper(rpe.data), foot: grouper(foot.data) }, maintenant)
      if (actif) setDonnees({ bilans, assid: assiduite(bilans, joueurs || []) })
    }
    charger().catch(() => actif && setDonnees({ erreur: true }))
    return () => { actif = false }
  }, [])

  async function relancer(type, b) {
    const joueurIds = (type === 'rpe' ? b.sansRpe : b.sansFoot).map(j => j.id)
    if (!joueurIds.length) return
    const cle = `${type}-${b.ev.id}`
    setRelance(p => ({ ...p, [cle]: 'Envoi…' }))
    try {
      const res = await fetch('/api/notif-manquants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ type, eventTitre: b.ev.titre, joueurIds }),
      })
      const r = await res.json()
      setRelance(p => ({ ...p, [cle]: r.success ? `${r.sent}/${r.total} notification(s) envoyée(s)` : `Erreur : ${r.error || 'inconnue'}` }))
    } catch {
      setRelance(p => ({ ...p, [cle]: 'Erreur réseau' }))
    }
  }

  if (!donnees) return <Card><Spinner /></Card>
  if (donnees.erreur) return null
  const { bilans, assid } = donnees
  if (!bilans.length) return null
  const [dernier, ...precedents] = bilans
  const date = ev => format(parseISO(ev.date_heure), 'EEE d MMM', { locale: fr })
  const Icone = ev => (ev.type === 'match' ? <Swords size={12} /> : <Footprints size={12} />)
  const faibles = assid.filter(s => s.tauxRpe < 50)

  return (
    <Card style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ClipboardCheck size={15} color={'var(--primary)'} /> Suivi des retours joueurs
      </p>

      {/* Dernier événement */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: 10, marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            {Icone(dernier.ev)} <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dernier.ev.titre}</span>
          </span>
          <span style={{ fontSize: 10, color: dernier.clos ? 'var(--text-muted)' : 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {date(dernier.ev)} · {dernier.clos ? 'clos' : 'collecte en cours'}
          </span>
        </div>
        <Jauge label="RPE" n={dernier.rpe} d={dernier.attendus} />
        <Jauge label="Footbar" n={dernier.foot} d={dernier.attendus} />
        {[['rpe', 'RPE', dernier.sansRpe], ['footbar', 'Footbar', dernier.sansFoot]].map(([type, lbl, manquants]) => manquants.length > 0 && (
          <div key={type} style={{ marginTop: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Sans {lbl} : {manquants.map(nomCourt).join(', ')}
            </p>
            <button onClick={() => relancer(type, dernier)} disabled={relance[`${type}-${dernier.ev.id}`] === 'Envoi…'} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5
            }}><Bell size={11} /> Relancer pour le {lbl} ({manquants.length})</button>
            {relance[`${type}-${dernier.ev.id}`] && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{relance[`${type}-${dernier.ev.id}`]}</span>}
          </div>
        ))}
      </div>

      {/* Événements précédents */}
      {precedents.length > 0 && (
        <>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Événements précédents</p>
          {precedents.slice(0, voirTout ? 30 : 4).map(b => (
            <div key={b.ev.id} onClick={() => navigate(`/rpe?event=${b.ev.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--bg-secondary)', cursor: 'pointer', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{Icone(b.ev)}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.ev.titre} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· {date(b.ev)}</span></span>
              <span style={{ fontWeight: 700, color: couleurTaux(pct(b.rpe, b.attendus)), whiteSpace: 'nowrap' }}>RPE {b.rpe}/{b.attendus}</span>
              <span style={{ fontWeight: 600, color: couleurTaux(pct(b.foot, b.attendus)), whiteSpace: 'nowrap', fontSize: 11 }}>Foot {b.foot}/{b.attendus}</span>
            </div>
          ))}
        </>
      )}

      {/* Assiduité 30 jours */}
      {assid.length > 0 && (
        <>
          <button onClick={() => setVoirTout(v => !v)} style={{ width: '100%', marginTop: 10, padding: '8px 0', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
            <span>Assiduité par joueur — 30 jours {faibles.length > 0 && <span style={{ color: 'var(--danger)', fontWeight: 600 }}>· {faibles.length} sous 50 % de RPE</span>}</span>
            {voirTout ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {voirTout && (
            <>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Retours remplis / événements où le joueur était attendu (convoqué en match, hors absent/blessé). Du moins assidu au plus assidu.</p>
              {assid.map(s => (
                <div key={s.joueur.id} onClick={() => navigate(`/joueurs/${s.joueur.id}`)} style={{ display: 'grid', gridTemplateColumns: '1fr 74px 74px', gap: 6, alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--bg-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.joueur.prenom} {s.joueur.nom}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: couleurTaux(s.tauxRpe) }}>RPE {s.rpe}/{s.attendus}</span>
                  <span style={{ textAlign: 'right', color: couleurTaux(s.tauxFoot), fontSize: 11 }}>Foot {s.foot}/{s.attendus}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Card>
  )
}
