import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarCheck, MessageSquareQuote, Send, Gauge } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { chargesDepuisRpe } from '../lib/charge'
import { resumeSemaine, motRecent } from '../lib/maSemaine'
import { Card, Spinner } from './UI'

const JOUR = 24 * 60 * 60 * 1000

// Carte « Ma semaine » : bilan des 7 derniers jours d'un joueur + mot du coach.
// Côté joueur (accueil) en lecture ; côté staff (fiche joueur) avec `editable`,
// pour écrire le mot et voir exactement ce que le joueur voit.
export default function MaSemaineCard({ joueurId, editable = false, auteurNom = '' }) {
  const [loading, setLoading] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [resume, setResume] = useState(null)
  const [mot, setMot] = useState(null)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)

  const charger = useCallback(async () => {
    setLoading(true)
    setErreur(null)
    const maintenant = new Date()
    const depuis28 = new Date(maintenant.getTime() - 28 * JOUR).toISOString()
    const [r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from('rpe').select('joueur_id, evenement_id, intensite, difficulte, fatigue, evenements!inner(date_heure)')
        .eq('joueur_id', joueurId).gte('evenements.date_heure', depuis28),
      supabase.from('evenements').select('id, type, date_heure, duree_min')
        .gte('date_heure', depuis28).lte('date_heure', maintenant.toISOString()),
      supabase.from('stats_match').select('evenement_id, joueur_id, temps_jeu').eq('joueur_id', joueurId),
      supabase.from('presences').select('evenement_id, statut').eq('joueur_id', joueurId),
      supabase.from('mots_coach').select('*').eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(5),
    ])
    const err = r1.error || r2.error || r3.error || r4.error
    if (err) { setErreur(err.message); setLoading(false); return }
    const evenements = r2.data || []
    const charges = chargesDepuisRpe({ rpe: r1.data || [], evenements, stats: r3.data || [] })
    const debut7 = maintenant.getTime() - 7 * JOUR
    const evenements7 = evenements.filter(e => new Date(e.date_heure).getTime() >= debut7)
    setResume(resumeSemaine({
      charges, evenements: evenements7, presences: r4.data || [],
      rpeIds: new Set((r1.data || []).map(r => r.evenement_id)), fin: maintenant,
    }))
    // Table absente (migration pas encore lancée) : la carte s'affiche sans le mot.
    setMot(r5.error ? null : motRecent(r5.data || [], maintenant))
    setLoading(false)
  }, [joueurId])

  useEffect(() => { if (joueurId) charger() }, [joueurId, charger])

  async function envoyerMot() {
    const t = texte.trim()
    if (!t) return
    setEnvoi(true)
    const { error } = await supabase.from('mots_coach').insert({ joueur_id: joueurId, texte: t, auteur_nom: auteurNom || null })
    setEnvoi(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setTexte('')
    charger()
  }

  if (loading) return <Card><Spinner /></Card>
  if (erreur) return <Card><p style={{ fontSize: 12, color: 'var(--danger)' }}>Ma semaine indisponible : {erreur}</p></Card>

  const r = resume
  return (
    <Card style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        <CalendarCheck size={14} color={'var(--primary)'} /> {editable ? 'Sa semaine' : 'Ma semaine'}
        <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)' }}>· 7 derniers jours</span>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 10 }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{r.nbSeances ? `${r.nbSeancesPresent}/${r.nbSeances}` : '—'}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Séances</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: r.nbRpe < r.nbRpeAttendus ? 'var(--warning)' : 'inherit' }}>
            {r.nbRpeAttendus ? `${r.nbRpe}/${r.nbRpeAttendus}` : '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>RPE remplis</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: r.zone?.couleur || 'inherit' }}>{r.charge7j || '—'}</div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Gauge size={9} /> Charge{r.zone ? ` · ${r.zone.label}` : ''}
          </div>
        </div>
      </div>

      {r.conseils.map((c, i) => (
        <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, lineHeight: 1.4 }}>• {c}</p>
      ))}

      {mot && (
        <div style={{ background: 'var(--primary-bg)', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <MessageSquareQuote size={12} /> Mot du coach{mot.auteur_nom ? ` · ${mot.auteur_nom}` : ''}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {format(parseISO(mot.created_at), 'd MMM', { locale: fr })}</span>
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{mot.texte}</p>
        </div>
      )}

      {editable && (
        <div style={{ marginTop: 10 }}>
          <textarea value={texte} onChange={e => setTexte(e.target.value)} maxLength={500} rows={2}
            placeholder="Écrire un mot au joueur (visible sur son accueil pendant 14 jours)"
            style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          <button onClick={envoyerMot} disabled={envoi || !texte.trim()} style={{
            marginTop: 6, width: '100%', padding: 9, borderRadius: 10, border: 'none',
            background: texte.trim() ? 'var(--primary)' : 'var(--border)', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: texte.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}><Send size={12} /> {envoi ? 'Envoi...' : 'Publier le mot'}</button>
        </div>
      )}
    </Card>
  )
}
