import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Input, Select, Textarea, Spinner } from '../components/UI'

export default function StatsPage() {
  const { id: eventId } = useParams()
  const { isCoach } = useAuth()
  const [event, setEvent] = useState(null)
  const [joueurs, setJoueurs] = useState([])
  const [activeTab, setActiveTab] = useState('collectives')
  const [collectif, setCollectif] = useState({ buts_marques: '', buts_encaisses: '', buts_0_15: '', buts_15_30: '', buts_30_45: '', buts_45_60: '', buts_60_75: '', buts_75_90: '', attaque_placee: '', contre_attaque: '', corner: '', cf_indirect: '', cf_direct: '', penalty: '' })
  const [indivStats, setIndivStats] = useState({})
  const [rapport, setRapport] = useState({ score_mi_temps: '', score_final: '', arbitre: '', causerie: '', animation_offensive: '', animation_defensive: '', points_positifs_off: '', problemes_off: '', points_positifs_def: '', problemes_def: '', points_forts_globaux: '', points_faibles_globaux: '', compo_adversaire: '' })
  const [compo, setCompo] = useState(Array(16).fill(''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: jrs }, { data: col }, { data: rpt }, { data: ind }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('joueurs').select('id,nom,prenom,poste,numero').order('nom'),
      supabase.from('stats_collectives').select('*').eq('evenement_id', eventId).single(),
      supabase.from('rapports_match').select('*').eq('evenement_id', eventId).single(),
      supabase.from('stats_match').select('*').eq('evenement_id', eventId),
    ])
    setEvent(ev)
    setJoueurs(jrs || [])
    if (col) setCollectif(col)
    if (rpt) { setRapport(rpt); if (rpt.compo) setCompo(JSON.parse(rpt.compo)) }
    if (ind) {
      const map = {}
      for (const s of ind) map[s.joueur_id] = s
      setIndivStats(map)
    }
    setLoading(false)
  }

  async function saveCollectif() {
    setSaving(true)
    const payload = { evenement_id: eventId, ...Object.fromEntries(Object.entries(collectif).map(([k, v]) => [k, v === '' ? null : parseInt(v)])) }
    await supabase.from('stats_collectives').upsert(payload, { onConflict: 'evenement_id' })
    setSaving(false); showSaved()
  }

  async function saveIndiv() {
    setSaving(true)
    for (const [joueurId, stats] of Object.entries(indivStats)) {
      const payload = {
        evenement_id: eventId, joueur_id: joueurId,
        note: stats.note ? parseFloat(stats.note) : null,
        temps_jeu: stats.temps_jeu ? parseInt(stats.temps_jeu) : null,
        buts: parseInt(stats.buts) || 0,
        passes_decisives: parseInt(stats.passes_decisives) || 0,
        carton_jaune: stats.carton_jaune || false,
        carton_rouge: stats.carton_rouge || false,
        titulaire: stats.titulaire !== false
      }
      await supabase.from('stats_match').upsert(payload, { onConflict: 'evenement_id,joueur_id' })
    }
    setSaving(false); showSaved()
  }

  async function saveRapport() {
    setSaving(true)
    await supabase.from('rapports_match').upsert({ evenement_id: eventId, ...rapport, compo: JSON.stringify(compo) }, { onConflict: 'evenement_id' })
    setSaving(false); showSaved()
  }

  function showSaved() { setSaved(true); setTimeout(() => setSaved(false), 3000) }

  function updateIndiv(joueurId, key, value) {
    setIndivStats(p => ({ ...p, [joueurId]: { ...(p[joueurId] || {}), [joueurId]: joueurId, [key]: value } }))
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const tabs = [
    { key: 'collectives', label: '🏟 Collectives' },
    { key: 'indiv', label: '👤 Individuelles' },
    { key: 'compo', label: '⬜ Compo' },
    { key: 'rapport', label: '📋 Rapport' },
  ]

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={event?.titre || 'Stats match'} />
      {saved && <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>✅ Enregistré !</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
            background: activeTab === t.key ? '#E6F1FB' : 'transparent',
            color: activeTab === t.key ? '#185FA5' : '#6B7280',
            fontWeight: activeTab === t.key ? 600 : 400
          }}>{t.label}</button>
        ))}
      </div>

      {/* COLLECTIVES */}
      {activeTab === 'collectives' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Résultat</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Buts marqués" type="number" value={collectif.buts_marques} onChange={v => setCollectif(p => ({ ...p, buts_marques: v }))} />
              <Input label="Buts encaissés" type="number" value={collectif.buts_encaisses} onChange={v => setCollectif(p => ({ ...p, buts_encaisses: v }))} />
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Buts marqués par période</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[['buts_0_15','0-15'],['buts_15_30','15-30'],['buts_30_45','30-45'],['buts_45_60','45-60'],['buts_60_75','60-75'],['buts_75_90','75-90']].map(([key, lbl]) => (
                <Input key={key} label={lbl} type="number" value={collectif[key]} onChange={v => setCollectif(p => ({ ...p, [key]: v }))} />
              ))}
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Type d'action offensive</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['attaque_placee','Attaque placée'],['contre_attaque','Contre-attaque'],['corner','Corner'],['cf_indirect','CF indirect'],['cf_direct','CF direct'],['penalty','Pénalty']].map(([key, lbl]) => (
                <Input key={key} label={lbl} type="number" value={collectif[key]} onChange={v => setCollectif(p => ({ ...p, [key]: v }))} />
              ))}
            </div>
            <Button variant="primary" style={{ width: '100%', marginTop: 8 }} onClick={saveCollectif} disabled={saving}>
              {saving ? 'Enregistrement...' : '💾 Enregistrer stats collectives'}
            </Button>
          </Card>
        </>
      )}

      {/* INDIVIDUELLES */}
      {activeTab === 'indiv' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Stats individuelles</p>
          {joueurs.map(j => {
            const s = indivStats[j.id] || {}
            return (
              <div key={j.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '0.5px solid #F3F4F6' }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{j.nom} {j.prenom} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>— {j.poste}</span></p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <Input label="Note (/10)" type="number" step="0.5" value={s.note || ''} onChange={v => updateIndiv(j.id, 'note', v)} />
                  <Input label="Temps de jeu (min)" type="number" value={s.temps_jeu || ''} onChange={v => updateIndiv(j.id, 'temps_jeu', v)} />
                  <Input label="Buts" type="number" value={s.buts || ''} onChange={v => updateIndiv(j.id, 'buts', v)} />
                  <Input label="Passes déc." type="number" value={s.passes_decisives || ''} onChange={v => updateIndiv(j.id, 'passes_decisives', v)} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Select label="Statut" value={s.titulaire === false ? 'rempl' : 'titu'}
                    onChange={v => updateIndiv(j.id, 'titulaire', v === 'titu')}
                    options={[{ value: 'titu', label: 'Titulaire' }, { value: 'rempl', label: 'Remplaçant' }]} />
                  <Select label="Carton" value={s.carton_rouge ? 'rouge' : s.carton_jaune ? 'jaune' : ''}
                    onChange={v => { updateIndiv(j.id, 'carton_jaune', v === 'jaune'); updateIndiv(j.id, 'carton_rouge', v === 'rouge') }}
                    options={[{ value: '', label: 'Aucun' }, { value: 'jaune', label: '🟡 Jaune' }, { value: 'rouge', label: '🔴 Rouge' }]} />
                </div>
              </div>
            )
          })}
          <Button variant="primary" style={{ width: '100%' }} onClick={saveIndiv} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer stats individuelles'}
          </Button>
        </Card>
      )}

      {/* COMPOSITION */}
      {activeTab === 'compo' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Composition — 16 joueurs</p>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>N°1 = Gardien · N°2-4 = Défenseurs · etc.</p>
          {/* Terrain visuel */}
          <div style={{ width: '100%', height: 180, background: '#2d7a3a', borderRadius: 12, position: 'relative', marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: 0, border: '1.5px solid rgba(255,255,255,.3)' }} />
            {[[50,88],[20,72],[40,72],[60,72],[80,72],[25,52],[50,52],[75,52],[30,30],[70,30],[50,14]].map((pos, i) => (
              <div key={i} style={{ position: 'absolute', left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#185FA5', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>{i + 1}</div>
                <div style={{ fontSize: 7, color: '#fff', background: 'rgba(0,0,0,.5)', padding: '1px 3px', borderRadius: 3, maxWidth: 48, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {compo[i] || '?'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {compo.map((val, i) => (
              <div key={i}>
                <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>N°{i + 1}</label>
                <input
                  value={val}
                  onChange={e => { const c = [...compo]; c[i] = e.target.value; setCompo(c) }}
                  list={`players-list-${i}`}
                  placeholder="Nom joueur"
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                />
                <datalist id={`players-list-${i}`}>
                  {joueurs.map(j => <option key={j.id} value={`${j.nom} ${j.prenom}`} />)}
                </datalist>
              </div>
            ))}
          </div>
          <Button variant="primary" style={{ width: '100%', marginTop: 12 }} onClick={saveRapport} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer la composition'}
          </Button>
        </Card>
      )}

      {/* RAPPORT */}
      {activeTab === 'rapport' && (
        <>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Informations match</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input label="Score mi-temps" value={rapport.score_mi_temps} onChange={v => setRapport(p => ({ ...p, score_mi_temps: v }))} placeholder="0-0" />
              <Input label="Score final" value={rapport.score_final} onChange={v => setRapport(p => ({ ...p, score_final: v }))} placeholder="2-1" />
            </div>
            <Input label="Arbitre" value={rapport.arbitre} onChange={v => setRapport(p => ({ ...p, arbitre: v }))} />
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Analyse tactique</p>
            <Textarea label="Causerie d'avant-match" value={rapport.causerie} onChange={v => setRapport(p => ({ ...p, causerie: v }))} rows={3} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Textarea label="Animation offensive" value={rapport.animation_offensive} onChange={v => setRapport(p => ({ ...p, animation_offensive: v }))} rows={3} />
              <Textarea label="Animation défensive" value={rapport.animation_defensive} onChange={v => setRapport(p => ({ ...p, animation_defensive: v }))} rows={3} />
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Analyse du match</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Textarea label="✅ Offensif — Points positifs" value={rapport.points_positifs_off} onChange={v => setRapport(p => ({ ...p, points_positifs_off: v }))} rows={3} />
              <Textarea label="⚠️ Offensif — Problèmes" value={rapport.problemes_off} onChange={v => setRapport(p => ({ ...p, problemes_off: v }))} rows={3} />
              <Textarea label="✅ Défensif — Points positifs" value={rapport.points_positifs_def} onChange={v => setRapport(p => ({ ...p, points_positifs_def: v }))} rows={3} />
              <Textarea label="⚠️ Défensif — Problèmes" value={rapport.problemes_def} onChange={v => setRapport(p => ({ ...p, problemes_def: v }))} rows={3} />
            </div>
            <Textarea label="Points forts globaux" value={rapport.points_forts_globaux} onChange={v => setRapport(p => ({ ...p, points_forts_globaux: v }))} />
            <Textarea label="Points faibles globaux" value={rapport.points_faibles_globaux} onChange={v => setRapport(p => ({ ...p, points_faibles_globaux: v }))} />
            <Textarea label="Composition adversaire" value={rapport.compo_adversaire} onChange={v => setRapport(p => ({ ...p, compo_adversaire: v }))} placeholder="Schéma, joueurs clés, points forts..." />
            <Button variant="primary" style={{ width: '100%', marginTop: 8 }} onClick={saveRapport} disabled={saving}>
              {saving ? 'Enregistrement...' : '💾 Enregistrer le rapport'}
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}
