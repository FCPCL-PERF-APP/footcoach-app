import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Target, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { bilanTabJoueur, bilanPenaltysJoueur } from '../lib/tirsAuBut'
import { Card } from './UI'

const pct = (r, t) => (t ? Math.round(r / t * 100) : 0)

function Ligne({ titre, date, detail, ok }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '0.5px solid var(--bg-secondary)', fontSize: 12, gap: 8 }}>
      <span style={{ minWidth: 0 }}>
        {titre}
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{date ? ` · ${format(parseISO(date), 'd MMM', { locale: fr })}` : ''}{detail ? ` · ${detail}` : ''}</span>
      </span>
      {ok}
    </div>
  )
}
const Reussi = ({ n }) => <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><CheckCircle2 size={13} /> {n > 1 ? `${n} réussis` : 'Réussi'}</span>
const Rate = ({ n }) => <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><XCircle size={13} /> {n > 1 ? `${n} ratés` : 'Raté'}</span>

// Pénaltys en match (temps réglementaire) et tirs au but d'un joueur sur la saison :
// sert à choisir les tireurs. Fiche joueur (staff) et « Ma saison » (joueur).
// N'affiche rien tant que le joueur n'a tiré ni pénalty ni tir au but.
export default function TirsAuButJoueur({ joueurId, titre = 'Pénaltys et tirs au but' }) {
  const [tab, setTab] = useState(null)
  const [pen, setPen] = useState(null)

  useEffect(() => {
    if (!joueurId) return
    let actif = true
    const { debut, fin } = bornesSaison()
    supabase.from('stats_collectives')
      .select('evenement_id, tab_tireurs, evenements!inner(titre, date_heure)')
      .not('tab_tireurs', 'is', null)
      .gte('evenements.date_heure', debut).lte('evenements.date_heure', fin)
      .then(({ data, error }) => { if (actif && !error) setTab(bilanTabJoueur(data || [], joueurId)) })
    supabase.from('stats_match')
      .select('evenement_id, penaltys_marques, penaltys_rates, evenements!inner(titre, date_heure)')
      .eq('joueur_id', joueurId)
      .gte('evenements.date_heure', debut).lte('evenements.date_heure', fin)
      .then(({ data, error }) => { if (actif && !error) setPen(bilanPenaltysJoueur(data || [])) })
    return () => { actif = false }
  }, [joueurId])

  const nbTab = tab?.tires || 0, nbPen = pen?.tires || 0
  if (!nbTab && !nbPen) return null
  const total = nbTab + nbPen, reussisTotal = (tab?.reussis || 0) + (pen?.reussis || 0)

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} color={'var(--warning)'} /> {titre}
        </p>
        <span style={{ fontSize: 14, fontWeight: 800 }}>
          {reussisTotal}/{total} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>· {pct(reussisTotal, total)} %</span>
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[['En match', pen], ['Tirs au but', tab]].map(([l, b]) => (
          <div key={l} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{b?.tires ? `${b.reussis}/${b.tires}` : '—'}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l}{b?.tires ? ` · ${pct(b.reussis, b.tires)} %` : ''}</div>
          </div>
        ))}
      </div>
      {(pen?.matchs || []).map(m => (
        <Ligne key={`p${m.evenement_id}`} titre={m.titre} date={m.date} detail="pénalty en match"
          ok={<span style={{ display: 'flex', gap: 8 }}>{m.marques > 0 && <Reussi n={m.marques} />}{m.rates > 0 && <Rate n={m.rates} />}</span>} />
      ))}
      {(tab?.tirs || []).map((t, i) => (
        <Ligne key={`t${i}`} titre={t.titre} date={t.date} detail={`TAB · ${t.ordre}${t.ordre === 1 ? 'er' : 'e'} tireur`}
          ok={t.reussi ? <Reussi n={1} /> : <Rate n={1} />} />
      ))}
    </Card>
  )
}
