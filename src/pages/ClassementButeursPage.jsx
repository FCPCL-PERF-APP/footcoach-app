import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'

const MEDALS = ['🥇', '🥈', '🥉']

function Top5({ title, data, valueKey, valueLabel, valueSuffix = '' }) {
  const top5 = data.slice(0, 5)
  const max = top5[0]?.[valueKey] || 1
  return (
    <Card>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{title}</p>
      {top5.length === 0 ? (
        <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Pas encore de données.</p>
      ) : (
        top5.map((item, i) => (
          <div key={item.joueur_id} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: i < 3 ? 18 : 14, width: 24, textAlign: 'center' }}>
                  {i < 3 ? MEDALS[i] : `${i+1}.`}
                </span>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{item.nom} {item.prenom}</p>
                  <p style={{ fontSize: 10, color: '#9CA3AF' }}>{item.poste || '—'}</p>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, color: THEME.primary }}>
                {typeof item[valueKey] === 'number' ? item[valueKey].toFixed(item[valueKey] % 1 !== 0 ? 1 : 0) : item[valueKey]}{valueSuffix}
              </span>
            </div>
            <div style={{ height: 6, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : THEME.primary, width: `${item[valueKey]/max*100}%` }} />
            </div>
          </div>
        ))
      )}
    </Card>
  )
}

export default function ClassementButeursPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('buts')
  const [classements, setClassements] = useState({
    buteurs: [], passeurs: [], titularisations: [],
    tempsJeu: [], matchsJoues: [], distanceMoyMatch: []
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { debut, fin } = bornesSaison()
    const { data: eventsSaisonIds } = await supabase.from('evenements').select('id')
      .gte('date_heure', debut).lte('date_heure', fin)
    const idsSaison = (eventsSaisonIds || []).map(e => e.id)

    const [{ data: stats }, { data: footbar }, { data: joueurs }] = await Promise.all([
      supabase.from('stats_match')
        .select('*, joueurs(id,nom,prenom,poste), evenements(match_type)').in('evenement_id', idsSaison),
      supabase.from('footbar')
        .select('joueur_id, distance_km, evenements(type)').in('evenement_id', idsSaison),
      supabase.from('joueurs').select('id,nom,prenom,poste'),
    ])

    const jMap = {}
    ;(joueurs || []).forEach(j => { jMap[j.id] = j })

    // Filtrer matchs officiels (pas prépa)
    const statsOfficiels = (stats || []).filter(s => s.evenements?.match_type !== 'preparation')

    // Agrégation par joueur
    const agg = {}
    statsOfficiels.forEach(s => {
      const id = s.joueur_id
      if (!agg[id]) agg[id] = { joueur_id: id, ...jMap[id], buts: 0, pd: 0, titularisations: 0, tempsTotal: 0, nbMatchs: 0, tempsJeuVals: [] }
      agg[id].buts += s.buts || 0
      agg[id].pd += s.passes_decisives || 0
      if (s.titulaire) agg[id].titularisations++
      if (s.temps_jeu > 0) { agg[id].tempsTotal += s.temps_jeu; agg[id].tempsJeuVals.push(s.temps_jeu) }
      agg[id].nbMatchs++
    })

    // Distance moyenne en match (footbar)
    const distAgg = {}
    ;(footbar || []).filter(f => f.evenements?.type === 'match').forEach(f => {
      const id = f.joueur_id
      if (!distAgg[id]) distAgg[id] = { joueur_id: id, ...jMap[id], distances: [] }
      if (f.distance_km > 0) distAgg[id].distances.push(f.distance_km)
    })

    const sort = (arr, key) => [...arr].sort((a, b) => b[key] - a[key])
    const aggArr = Object.values(agg)

    setClassements({
      buteurs: sort(aggArr.filter(a => a.buts > 0), 'buts').map(a => ({...a, buts: a.buts})),
      passeurs: sort(aggArr.filter(a => a.pd > 0), 'pd').map(a => ({...a, pd: a.pd})),
      titularisations: sort(aggArr.filter(a => a.titularisations > 0), 'titularisations'),
      tempsJeu: sort(
        aggArr.filter(a => a.tempsJeuVals.length > 0).map(a => ({
          ...a, tempsMoy: Math.round(a.tempsTotal / a.tempsJeuVals.length)
        })),
        'tempsMoy'
      ),
      matchsJoues: sort(aggArr.filter(a => a.nbMatchs > 0), 'nbMatchs'),
      distanceMoyMatch: sort(
        Object.values(distAgg).filter(d => d.distances.length > 0).map(d => ({
          ...d, distMoy: parseFloat((d.distances.reduce((a,b) => a+b,0)/d.distances.length).toFixed(1))
        })),
        'distMoy'
      )
    })

    setLoading(false)
  }

  const tabs = [
    { key: 'buts',     label: '⚽ Buteurs' },
    { key: 'pd',       label: '🎯 Passeurs' },
    { key: 'stats',    label: '📊 Stats' },
  ]

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="🏆 Classements" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === t.key ? '#E6F1FB' : 'transparent',
            color: activeTab === t.key ? THEME.primary : '#6B7280',
            fontWeight: activeTab === t.key ? 600 : 400
          }}>{t.label}</button>
        ))}
      </div>

      <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 10 }}>
        * Saison en cours · matchs de championnat et de coupe uniquement (préparation exclus)
      </p>

      {loading ? <Spinner /> : (
        <>
          {activeTab === 'buts' && (
            <>
              <Top5 title="⚽ Top buteurs" data={classements.buteurs} valueKey="buts" valueSuffix=" but(s)" />
              <Top5 title="🎯 Top passeurs" data={classements.passeurs} valueKey="pd" valueSuffix=" PD" />
            </>
          )}
          {activeTab === 'pd' && (
            <Top5 title="🎯 Top passeurs décisifs" data={classements.passeurs} valueKey="pd" valueSuffix=" PD" />
          )}
          {activeTab === 'stats' && (
            <>
              <Top5 title="📋 Titularisations" data={classements.titularisations} valueKey="titularisations" valueSuffix=" tit." />
              <Top5 title="⏱️ Temps de jeu moyen" data={classements.tempsJeu} valueKey="tempsMoy" valueSuffix="'" />
              <Top5 title="🏃 Distance moy. en match" data={classements.distanceMoyMatch} valueKey="distMoy" valueSuffix=" km" />
              <Top5 title="🎮 Matchs joués" data={classements.matchsJoues} valueKey="nbMatchs" valueSuffix=" match(s)" />
            </>
          )}
        </>
      )}
    </div>
  )
}
