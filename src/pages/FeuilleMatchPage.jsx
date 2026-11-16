import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, CheckCircle2, Circle, ChevronRight, ChevronDown, ClipboardList, Bell, Save
} from 'lucide-react'
import { supabase, authHeaders } from '../lib/supabase'
import { chargerFeuilleMatch } from '../lib/chargerFeuilleMatch'
import { CRITERES_COACH, noteSur10 } from '../lib/feuilleMatch'
import { noterPronostics } from '../lib/pronostics'
import { resumeTab } from '../lib/tirsAuBut'
import { Card, Spinner } from '../components/UI'

// Couleur d'une note rapide 1-5.
const couleurNote = n => (n >= 4 ? 'var(--success)' : n === 3 ? 'var(--warning)' : 'var(--danger)')

// Feuille de match : toutes les étapes de saisie d'un match au même endroit, avec leur
// avancement. Score et notes des joueurs se saisissent ici directement ; les autres
// étapes ouvrent la page dédiée sur le bon onglet.
export default function FeuilleMatchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [f, setF] = useState(null)
  const [ouverte, setOuverte] = useState(null)

  const charger = useCallback(async () => {
    const r = await chargerFeuilleMatch(id)
    setF(r)
  }, [id])
  useEffect(() => { setF(null); charger() }, [charger])

  if (!f) return <div style={{ padding: 12 }}><Spinner /></div>
  if (f.erreur) return <div style={{ padding: 12 }}><Card><p style={{ fontSize: 13, color: 'var(--danger)' }}>Erreur de chargement : {f.erreur}</p></Card></div>

  const liens = {
    convocations: `/convocations/${id}`,
    compo: `/stats/${id}?onglet=compo`,
    suivi: `/stats/${id}?onglet=suivi`,
    indiv: `/stats/${id}?onglet=individuel`,
    rpe: `/rpe?event=${id}`,
    footbar: `/footbar?event=${id}`,
    rapport: `/stats/${id}?onglet=rapport`,
  }
  const enLigne = { score: ScoreEtape, notes: NotesEtape, rpe: RpeEtape }
  let moment = null

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }} aria-label="Retour"><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={17} color={'var(--primary)'} /> Feuille de match</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {f.event?.titre} · {f.event?.date_heure ? format(parseISO(f.event.date_heure), 'EEE d MMM', { locale: fr }) : ''}
          </p>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: f.faites === f.total ? 'var(--success)' : 'var(--primary)' }}>{f.faites}/{f.total}</span>
      </div>
      <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, marginBottom: 14 }}>
        <div style={{ height: '100%', width: `${f.faites / f.total * 100}%`, background: f.faites === f.total ? 'var(--success)' : 'var(--primary)', borderRadius: 3, transition: 'width .3s' }} />
      </div>

      {f.etapes.map(e => {
        const titreMoment = e.moment !== moment ? (moment = e.moment) : null
        const Panneau = enLigne[e.cle]
        const estOuverte = ouverte === e.cle
        return (
          <div key={e.cle}>
            {titreMoment && <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '10px 0 6px' }}>{titreMoment}</p>}
            <div style={{ background: 'var(--bg-card)', border: `0.5px solid ${estOuverte ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 12, marginBottom: 6 }}>
              <button onClick={() => Panneau ? setOuverte(estOuverte ? null : e.cle) : navigate(liens[e.cle])} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
                border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left'
              }}>
                {e.fait ? <CheckCircle2 size={18} color="var(--success)" /> : <Circle size={18} color={e.obligatoire ? 'var(--primary)' : 'var(--border)'} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)' }}>{e.detail}</span>
                </span>
                {Panneau ? (estOuverte ? <ChevronDown size={16} color="var(--primary)" /> : <ChevronRight size={16} color="var(--text-muted)" />) : <ChevronRight size={16} color="var(--text-muted)" />}
              </button>
              {Panneau && estOuverte && (
                <div style={{ padding: '0 12px 12px' }}>
                  <Panneau f={f} id={id} recharger={charger} lienComplet={liens[e.cle]} navigate={navigate} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScoreEtape({ f, id, recharger, navigate }) {
  const chrono = Array.isArray(f.rapport?.chronologie) ? f.rapport.chronologie : []
  const depuisLive = chrono.some(e => e.type === 'but_pour' || e.type === 'but_contre')
  const [nous, setNous] = useState(f.score?.buts_marques ?? '')
  const [adv, setAdv] = useState(f.score?.buts_encaisses ?? '')
  const [envoi, setEnvoi] = useState(false)
  const tab = resumeTab(f.score)
  const nul = nous !== '' && adv !== '' && Number(nous) === Number(adv)

  async function enregistrer() {
    if (nous === '' || adv === '') return
    setEnvoi(true)
    const payload = { evenement_id: id, buts_marques: parseInt(nous), buts_encaisses: parseInt(adv) }
    if (!nul) Object.assign(payload, { tab_tireurs: null, tab_marques: null, tab_encaisses: null })
    const { error } = await supabase.from('stats_collectives').upsert(payload, { onConflict: 'evenement_id' })
    if (!error) {
      const echecs = await noterPronostics(id, f.event?.domicile, payload.buts_marques, payload.buts_encaisses)
      if (echecs) alert(`${echecs} pronostic(s) n'ont pas pu être notés.`)
    }
    setEnvoi(false)
    if (error) { alert('Erreur : ' + error.message); return }
    recharger()
  }

  const champ = (val, set, label) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</label>
      <input type="number" min="0" inputMode="numeric" value={val} disabled={depuisLive} onChange={e => set(e.target.value)}
        style={{ width: '100%', padding: '10px 0', textAlign: 'center', fontSize: 22, fontWeight: 800, border: '0.5px solid var(--border)', borderRadius: 10, boxSizing: 'border-box', background: depuisLive ? 'var(--bg-secondary)' : 'var(--bg-card)' }} />
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 8 }}>
        {champ(nous, setNous, 'FC PCL')}
        <span style={{ fontSize: 20, fontWeight: 700, paddingBottom: 10 }}>-</span>
        {champ(adv, setAdv, 'Adversaire')}
      </div>
      {depuisLive
        ? <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Score calculé depuis le suivi live.</p>
        : <button onClick={enregistrer} disabled={envoi || nous === '' || adv === ''} style={btnPrincipal}><Save size={13} /> {envoi ? 'Enregistrement…' : 'Enregistrer le score'}</button>}
      {f.event?.match_type === 'coupe' && nul && (
        <p style={{ fontSize: 11, marginTop: 8 }}>
          {tab ? <b style={{ color: tab.qualifie ? 'var(--success)' : 'var(--danger)' }}>{tab.qualifie ? 'Qualifiés' : 'Éliminés'} · {tab.label}</b> : 'Match nul en coupe :'}{' '}
          <button onClick={() => navigate(`/stats/${id}?onglet=collectif`)} style={lienTexte}>{tab ? 'modifier les tirs au but' : 'saisir les tirs au but'}</button>
        </p>
      )}
      <button onClick={() => navigate(`/stats/${id}?onglet=collectif`)} style={{ ...lienTexte, marginTop: 8, display: 'block' }}>Stats collectives détaillées (buts par type, par période…)</button>
    </>
  )
}

function NotesEtape({ f, id, recharger }) {
  const [notes, setNotes] = useState(() => Object.fromEntries(f.notes.map(n => [n.joueur_id, n])))
  const [detail, setDetail] = useState(null)
  const [erreur, setErreur] = useState(null)

  async function enregistrer(joueurId, champs) {
    const fusion = { ...(notes[joueurId] || {}), ...champs }
    setNotes(p => ({ ...p, [joueurId]: fusion }))
    setErreur(null)
    const { error } = await supabase.from('rpe_coach').upsert({ evenement_id: id, joueur_id: joueurId, ...champs }, { onConflict: 'evenement_id,joueur_id' })
    if (error) { setErreur(error.message); return }
    // La note /10 de Stats match suit la note du coach (même règle que la page RPE).
    const note = noteSur10(fusion)
    if (note != null) await supabase.from('stats_match').upsert({ evenement_id: id, joueur_id: joueurId, note }, { onConflict: 'evenement_id,joueur_id' })
  }

  if (!f.cibles.length) return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fais d'abord les convocations (ou la compo) pour savoir quels joueurs noter.</p>

  return (
    <>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>1 = très insuffisant · 5 = excellent. Enregistré dès que tu touches une note.</p>
      {erreur && <p style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 6 }}>Erreur : {erreur}</p>}
      {f.cibles.map(j => {
        const n = notes[j.id] || {}
        const aDetail = CRITERES_COACH.some(c => n[c.key] != null)
        const ouvert = detail === j.id
        return (
          <div key={j.id} style={{ borderTop: '0.5px solid var(--bg-secondary)', padding: '7px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.prenom} {j.nom}</span>
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => enregistrer(j.id, { note_globale: v })} style={{
                  width: 30, height: 30, borderRadius: '50%', fontSize: 12, cursor: 'pointer', flexShrink: 0,
                  fontWeight: n.note_globale === v ? 800 : 400,
                  border: `1.5px solid ${n.note_globale === v ? couleurNote(v) : 'var(--border)'}`,
                  background: n.note_globale === v ? couleurNote(v) : 'var(--bg-card)',
                  color: n.note_globale === v ? '#fff' : 'var(--text-secondary)',
                }}>{v}</button>
              ))}
              <button onClick={() => setDetail(ouvert ? null : j.id)} aria-label="Détail" style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', color: aDetail ? 'var(--primary)' : 'var(--text-muted)' }}>
                {ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {ouvert && (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 8, marginTop: 6 }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Détail facultatif (0 à 5) — s'il est rempli, sa moyenne remplace la note rapide.</p>
                {CRITERES_COACH.map(c => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 11 }}>{c.label}</span>
                    {[0, 1, 2, 3, 4, 5].map(v => (
                      <button key={v} onClick={() => enregistrer(j.id, { [c.key]: n[c.key] === v ? null : v })} style={{
                        width: 24, height: 24, borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        border: `1px solid ${n[c.key] === v ? 'var(--primary)' : 'var(--border)'}`,
                        background: n[c.key] === v ? 'var(--primary)' : 'var(--bg-card)',
                        color: n[c.key] === v ? '#fff' : 'var(--text-secondary)',
                      }}>{v}</button>
                    ))}
                  </div>
                ))}
                {noteSur10(n) != null && <p style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>Note retenue : {noteSur10(n)}/10</p>}
              </div>
            )}
          </div>
        )
      })}
      <button onClick={recharger} style={{ ...lienTexte, marginTop: 8 }}>Mettre à jour l'avancement</button>
    </>
  )
}

function RpeEtape({ f, lienComplet, navigate }) {
  const manquants = f.cibles.filter(j => !f.rpeIds.has(j.id))
  const [etat, setEtat] = useState(null)

  async function relancer() {
    setEtat('Envoi…')
    try {
      const res = await fetch('/api/notif-manquants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ type: 'rpe', eventTitre: f.event?.titre, joueurIds: manquants.map(j => j.id) }),
      })
      const data = await res.json()
      setEtat(data.success ? (data.total > 0 ? `${data.sent}/${data.total} notification(s) envoyée(s)` : 'Aucun de ces joueurs n\'a activé les notifications') : `Erreur : ${data.error || 'inconnue'}`)
    } catch {
      setEtat('Erreur réseau')
    }
  }

  return (
    <>
      {manquants.length === 0
        ? <p style={{ fontSize: 12, color: 'var(--success)' }}>Tous les joueurs ont rempli leur RPE.</p>
        : <>
            <p style={{ fontSize: 12, marginBottom: 6 }}>Pas encore rempli : {manquants.map(j => `${j.prenom} ${j.nom}`).join(', ')}</p>
            <button onClick={relancer} disabled={etat === 'Envoi…'} style={btnPrincipal}><Bell size={13} /> Relancer ces {manquants.length} joueur(s)</button>
            {etat && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{etat}</p>}
          </>}
      <button onClick={() => navigate(lienComplet)} style={{ ...lienTexte, marginTop: 8, display: 'block' }}>Voir le détail des RPE</button>
    </>
  )
}

const btnPrincipal = {
  width: '100%', padding: 10, borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
}
const lienTexte = { border: 'none', background: 'none', padding: 0, color: 'var(--primary)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }
