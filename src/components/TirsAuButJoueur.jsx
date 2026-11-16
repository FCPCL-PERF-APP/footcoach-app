import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Target, CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { bilanTabJoueur } from '../lib/tirsAuBut'
import { Card } from './UI'

// Bilan des tirs au but d'un joueur sur la saison en cours (fiche staff et « Ma saison »).
// N'affiche rien tant que le joueur n'a tiré aucun tir au but.
export default function TirsAuButJoueur({ joueurId, titre = 'Tirs au but' }) {
  const [bilan, setBilan] = useState(null)

  useEffect(() => {
    if (!joueurId) return
    let actif = true
    const { debut, fin } = bornesSaison()
    supabase.from('stats_collectives')
      .select('evenement_id, tab_tireurs, evenements!inner(titre, date_heure)')
      .not('tab_tireurs', 'is', null)
      .gte('evenements.date_heure', debut).lte('evenements.date_heure', fin)
      .then(({ data, error }) => { if (actif && !error) setBilan(bilanTabJoueur(data || [], joueurId)) })
    return () => { actif = false }
  }, [joueurId])

  if (!bilan || bilan.tires === 0) return null
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Target size={14} color={'var(--warning)'} /> {titre}
        </p>
        <span style={{ fontSize: 14, fontWeight: 800 }}>
          {bilan.reussis}/{bilan.tires} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>réussis</span>
        </span>
      </div>
      {bilan.tirs.map((t, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: '0.5px solid var(--bg-secondary)', fontSize: 12 }}>
          <span>
            {t.titre}
            <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
              {t.date ? ` · ${format(parseISO(t.date), 'd MMM', { locale: fr })}` : ''} · {t.ordre}{t.ordre === 1 ? 'er' : 'e'} tireur
            </span>
          </span>
          {t.reussi
            ? <span style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={13} /> Réussi</span>
            : <span style={{ color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={13} /> Raté</span>}
        </div>
      ))}
    </Card>
  )
}
