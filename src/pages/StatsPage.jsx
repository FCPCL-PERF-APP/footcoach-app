import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Button, Input, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const FORMATIONS = {
  '4-4-2': {
    label: '1-4-4-2',
    positions: [
      { id: 'GK', label: 'GB', x: 50, y: 88 },
      { id: 'RB', label: 'DD', x: 82, y: 72 }, { id: 'CB1', label: 'DC', x: 62, y: 70 },
      { id: 'CB2', label: 'DC', x: 38, y: 70 }, { id: 'LB', label: 'DG', x: 18, y: 72 },
      { id: 'RM', label: 'MD', x: 82, y: 50 }, { id: 'CM1', label: 'MC', x: 62, y: 48 },
      { id: 'CM2', label: 'MC', x: 38, y: 48 }, { id: 'LM', label: 'MG', x: 18, y: 50 },
      { id: 'ST1', label: 'ATT', x: 62, y: 25 }, { id: 'ST2', label: 'ATT', x: 38, y: 25 },
    ]
  },
  '4-2-3-1': {
    label: '1-4-2-3-1',
    positions: [
      { id: 'GK', label: 'GB', x: 50, y: 88 },
      { id: 'RB', label: 'DD', x: 82, y: 72 }, { id: 'CB1', label: 'DC', x: 62, y: 70 },
      { id: 'CB2', label: 'DC', x: 38, y: 70 }, { id: 'LB', label: 'DG', x: 18, y: 72 },
      { id: 'DM1', label: 'MDef', x: 60, y: 54 }, { id: 'DM2', label: 'MDef', x: 40, y: 54 },
      { id: 'RAM', label: 'MOD', x: 78, y: 36 }, { id: 'CAM', label: 'MOC', x: 50, y: 34 },
      { id: 'LAM', label: 'MOG', x: 22, y: 36 },
      { id: 'ST', label: 'ATT', x: 50, y: 18 },
    ]
  },
  '3-5-2': {
    label: '1-3-5-2',
    positions: [
      { id: 'GK', label: 'GB', x: 50, y: 88 },
      { id: 'CB1', label: 'DC', x: 70, y: 72 }, { id: 'CB2', label: 'DC', x: 50, y: 70 },
      { id: 'CB3', label: 'DC', x: 30, y: 72 },
      { id: 'RM', label: 'PD', x: 88, y: 50 }, { id: 'CM1', label: 'MC', x: 66, y: 48 },
      { id: 'CM2', label: 'MC', x: 50, y: 46 }, { id: 'CM3', label: 'MC', x: 34, y: 48 },
      { id: 'LM', label: 'PG', x: 12, y: 50 },
      { id: 'ST1', label: 'ATT', x: 62, y: 25 }, { id: 'ST2', label: 'ATT', x: 38, y: 25 },
    ]
  },
}

export default function StatsPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [joueurs, setJoueurs] = useState([])
  const [statsIndiv, setStatsIndiv] = useState([])
  const [statsCollectives, setStatsCollectives] = useState(null)
  const [rapport, setRapport] = useState(null)
  const [activeTab, setActiveTab] = useState('individuel')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [formation, setFormation] = useState('4-4-2')
  const [compo, setCompo] = useState({})

  const [formIndiv, setFormIndiv] = useState({})
  const [selectedJoueur, setSelectedJoueur] = useState('')
  const [formJ, setFormJ] = useState({ note: '', temps_jeu: '', buts: 0, passes_decisives: 0, titulaire: true, carton_jaune: false, carton_rouge: false })

  const [formCollectif, setFormCollectif] = useState({
    buts_marques: '', buts_encaisses: '',
    score_mi_temps: '', score_final: '',
    // Buts marqués par type
    but_marque_attaque_placee: '', but_marque_contre_attaque: '',
    but_marque_corner: '', but_marque_penalty: '', but_marque_coup_franc: '',
    // Buts encaissés par type
    but_enc_attaque_placee: '', but_enc_contre_attaque: '',
    but_enc_corner: '', but_enc_penalty: '', but_enc_coup_franc: '',
    // Buts par période
    buts_0_15: '', buts_15_30: '', buts_30_45: '',
    buts_45_60: '', buts_60_75: '', buts_75_90: '',
    // Buts encaissés par période
    buts_enc_0_15: '', buts_enc_15_30: '', buts_enc_30_45: '',
    buts_enc_45_60: '', buts_enc_60_75: '', buts_enc_75_90: '',
  })

  const [formRapport, setFormRapport] = useState({
    causerie: '', animation_offensive: '', animation_defensive: '',
    points_positifs_off: '', problemes_off: '',
    points_positifs_def: '', problemes_def: '',
    points_forts_globaux: '', points_faibles_globaux: '',
    compo_adversaire: '', arbitre: '',
  })

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: jrs }, { data: si }, { data: sc }, { data: rp }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('joueurs').select('id,nom,prenom,poste,numero').order('nom'),
      supabase.from('stats_match').select('*').eq('evenement_id', eventId),
      supabase.from('stats_collectives').select('*').eq('evenement_id', eventId).maybeSingle(),
      supabase.from('rapports_match').select('*').eq('evenement_id', eventId).maybeSingle(),
    ])
    setEvent(ev)
    setJoueurs(jrs || [])
    setStatsIndiv(si || [])
    if (sc) { setStatsCollectives(sc); setFormCollectif(p => ({ ...p, ...sc })) }
    if (rp) {
      setRapport(rp)
      setFormRapport(p => ({ ...p, ...rp }))
      if (rp.formation) setFormation(rp.formation)
      if (rp.compo_visuelle) setCompo(rp.compo_visuelle)
    }
    if (jrs?.length) setSelectedJoueur(jrs[0].id)
    setLoading(false)
  }

  // Calcule résultat depuis le score
  const scoreMarques = parseInt(formCollectif.buts_marques) || 0
  const scoreEncaisses = parseInt(formCollectif.buts_encaisses) || 0
  const resultat = scoreMarques > scoreEncaisses ? 'V' : scoreMarques < scoreEncaisses ? 'D' : 'N'
  const resultatColors = { V: '#3B6D11', N: '#BA7517', D: '#A32D2D' }
  const resultatLabels = { V: '✅ Victoire', N: '🟡 Match nul', D: '❌ Défaite' }

  async function saveStatsCollectives() {
    setSaving(true)
    const payload = { evenement_id: eventId, ...formCollectif }
    if (statsCollectives) await supabase.from('stats_collectives').update(payload).eq('id', statsCollectives.id)
    else await supabase.from('stats_collectives').insert(payload)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); loadData()
  }

  async function saveStatsJoueur() {
    setSaving(true)
    const existing = statsIndiv.find(s => s.joueur_id === selectedJoueur)
    const payload = {
      evenement_id: eventId, joueur_id: selectedJoueur,
      note: formJ.note ? parseFloat(formJ.note) : null,
      temps_jeu: formJ.temps_jeu ? parseInt(formJ.temps_jeu) : null,
      buts: formJ.buts ? parseInt(formJ.buts) : 0,
      passes_decisives: formJ.passes_decisives ? parseInt(formJ.passes_decisives) : 0,
      titulaire: formJ.titulaire, carton_jaune: formJ.carton_jaune, carton_rouge: formJ.carton_rouge,
    }
    if (existing) await supabase.from('stats_match').update(payload).eq('id', existing.id)
    else await supabase.from('stats_match').insert(payload)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); loadData()
  }

  async function saveRapport() {
    setSaving(true)
    const payload = { evenement_id: eventId, ...formRapport, formation, compo_visuelle: compo }
    if (rapport) await supabase.from('rapports_match').update(payload).eq('id', rapport.id)
    else await supabase.from('rapports_match').insert(payload)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); loadData()
  }

  async function shareRapportInApp() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase.from('staff').select('nom,prenom').eq('auth_id', user?.id).maybeSingle()
    const auteurNom = staff ? `${staff.nom} ${staff.prenom}` : 'Coach'
    const r = resultat
    const contenu = `📊 ${event?.titre} — ${r === 'V' ? '✅ Victoire' : r === 'N' ? '🟡 Nul' : '❌ Défaite'} ${formCollectif.buts_marques}-${formCollectif.buts_encaisses}\n` +
      (formRapport.points_forts_globaux ? `✅ Points forts : ${formRapport.points_forts_globaux}\n` : '') +
      (formRapport.points_faibles_globaux ? `⚠️ À améliorer : ${formRapport.points_faibles_globaux}` : '')
    await supabase.from('messages').insert({
      expediteur_id: user?.id, expediteur_nom: auteurNom,
      expediteur_role: 'coach', groupe: true, contenu
    })
    alert('✅ Résumé partagé dans le canal groupe !')
  }

  const currentFormation = FORMATIONS[formation]

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const tabs = [
    { key: 'individuel', label: '👤 Indiv.' },
    { key: 'collectif',  label: '📊 Collectif' },
    { key: 'compo',      label: '⚽ Compo' },
    { key: 'rapport',    label: '📝 Rapport' },
  ]

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Stats match</p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{event?.titre} · {event?.date_heure ? format(parseISO(event.date_heure), 'd MMM yyyy', { locale: fr }) : ''}</p>
        </div>
      </div>

      {saved && <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>✅ Enregistré !</div>}

      {/* Score + résultat */}
      {(formCollectif.buts_marques !== '' || formCollectif.buts_encaisses !== '') && (
        <div style={{ background: THEME.gradient, borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>FC PCL</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{formCollectif.buts_marques}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: resultatColors[resultat], background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 10px' }}>
              {resultatLabels[resultat]}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{event?.titre?.replace('vs ', '') || 'Adv.'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{formCollectif.buts_encaisses}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: '0.5px solid #D1D5DB',
            background: activeTab === t.key ? '#E6F1FB' : 'transparent',
            color: activeTab === t.key ? THEME.primary : '#6B7280',
            fontWeight: activeTab === t.key ? 600 : 400
          }}>{t.label}</button>
        ))}
      </div>

      {/* STATS INDIVIDUELLES */}
      {activeTab === 'individuel' && (
        <>
          <Card>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Joueur</label>
              <select value={selectedJoueur} onChange={e => {
                setSelectedJoueur(e.target.value)
                const ex = statsIndiv.find(s => s.joueur_id === e.target.value)
                if (ex) setFormJ({ note: ex.note || '', temps_jeu: ex.temps_jeu || '', buts: ex.buts || 0, passes_decisives: ex.passes_decisives || 0, titulaire: ex.titulaire !== false, carton_jaune: ex.carton_jaune || false, carton_rouge: ex.carton_rouge || false })
                else setFormJ({ note: '', temps_jeu: '', buts: 0, passes_decisives: 0, titulaire: true, carton_jaune: false, carton_rouge: false })
              }} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom} — {j.poste}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[['Note (/10)', 'note', '0.5'], ['Temps jeu (min)', 'temps_jeu', '1'], ['Buts', 'buts', '1'], ['Passes déc.', 'passes_decisives', '1']].map(([label, field, step]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{label}</label>
                  <input type="number" step={step} value={formJ[field] || ''} onChange={e => setFormJ(p => ({...p, [field]: e.target.value}))}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              {[['Titulaire', 'titulaire'], ['Carton 🟡', 'carton_jaune'], ['Carton 🔴', 'carton_rouge']].map(([label, field]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formJ[field]} onChange={e => setFormJ(p => ({...p, [field]: e.target.checked}))} />
                  {label}
                </label>
              ))}
            </div>
            <Button variant="primary" style={{ width: '100%' }} onClick={saveStatsJoueur} disabled={saving}>💾 Enregistrer</Button>
          </Card>

          {statsIndiv.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Récap — {statsIndiv.length} joueur(s)</p>
              {statsIndiv.map(s => {
                const j = joueurs.find(j => j.id === s.joueur_id)
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #F3F4F6' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{j?.nom} {j?.prenom}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>{s.temps_jeu}min · {s.titulaire ? 'Titu.' : 'Rempl.'} {s.carton_jaune ? '🟡' : ''}{s.carton_rouge ? '🔴' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.note || '—'}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Note</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11' }}>{s.buts || 0}</div><div style={{ fontSize: 9, color: '#9CA3AF' }}>Buts</div></div>
                    </div>
                  </div>
                )
              })}
            </Card>
          )}
        </>
      )}

      {/* STATS COLLECTIVES */}
      {activeTab === 'collectif' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Stats collectives</p>

          {/* Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[['Score mi-temps', 'score_mi_temps', 'text'], ['Score final', 'score_final', 'text'],
              ['Buts marqués', 'buts_marques', 'number'], ['Buts encaissés', 'buts_encaisses', 'number']].map(([label, field, type]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{label}</label>
                <input type={type} value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  placeholder={type === 'text' ? '2-1' : ''}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>

          {/* Buts marqués par type */}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#3B6D11', margin: '12px 0 8px' }}>⚽ Buts marqués — par type</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
            {[['Att. placée', 'but_marque_attaque_placee'], ['Contre-att.', 'but_marque_contre_attaque'],
              ['Corner', 'but_marque_corner'], ['Pénalty', 'but_marque_penalty'], ['Coup-franc', 'but_marque_coup_franc']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 10, color: '#6B7280', marginBottom: 2, textAlign: 'center' }}>{label}</label>
                <input type="number" min="0" value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #3B6D11', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
            ))}
          </div>

          {/* Buts encaissés par type */}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', margin: '12px 0 8px' }}>🥅 Buts encaissés — par type</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
            {[['Att. placée', 'but_enc_attaque_placee'], ['Contre-att.', 'but_enc_contre_attaque'],
              ['Corner', 'but_enc_corner'], ['Pénalty', 'but_enc_penalty'], ['Coup-franc', 'but_enc_coup_franc']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 10, color: '#6B7280', marginBottom: 2, textAlign: 'center' }}>{label}</label>
                <input type="number" min="0" value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #A32D2D', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
            ))}
          </div>

          {/* Buts marqués par période */}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#3B6D11', margin: '12px 0 8px' }}>⚽ Buts marqués — par période</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, marginBottom: 12 }}>
            {[['0-15', 'buts_0_15'], ['15-30', 'buts_15_30'], ['30-45', 'buts_30_45'], ['45-60', 'buts_45_60'], ['60-75', 'buts_60_75'], ['75-90', 'buts_75_90']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 9, color: '#9CA3AF', marginBottom: 2, textAlign: 'center' }}>{label}'</label>
                <input type="number" min="0" value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 4px', border: '0.5px solid #3B6D11', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
            ))}
          </div>

          {/* Buts encaissés par période */}
          <p style={{ fontSize: 12, fontWeight: 700, color: '#A32D2D', margin: '12px 0 8px' }}>🥅 Buts encaissés — par période</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, marginBottom: 12 }}>
            {[['0-15', 'buts_enc_0_15'], ['15-30', 'buts_enc_15_30'], ['30-45', 'buts_enc_30_45'], ['45-60', 'buts_enc_45_60'], ['60-75', 'buts_enc_60_75'], ['75-90', 'buts_enc_75_90']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 9, color: '#9CA3AF', marginBottom: 2, textAlign: 'center' }}>{label}'</label>
                <input type="number" min="0" value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 4px', border: '0.5px solid #A32D2D', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
            ))}
          </div>

          <Button variant="primary" style={{ width: '100%' }} onClick={saveStatsCollectives} disabled={saving}>💾 Enregistrer</Button>
        </Card>
      )}

      {/* COMPOSITION VISUELLE */}
      {activeTab === 'compo' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Composition sur terrain</p>

          {/* Choix formation */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {Object.entries(FORMATIONS).map(([key, f]) => (
              <button key={key} onClick={() => setFormation(key)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: `1.5px solid ${formation === key ? THEME.primary : '#E5E7EB'}`,
                background: formation === key ? '#E6F1FB' : 'transparent',
                color: formation === key ? THEME.primary : '#6B7280',
                fontWeight: formation === key ? 700 : 400
              }}>{f.label}</button>
            ))}
          </div>

          {/* Terrain SVG */}
          <div style={{ position: 'relative', background: '#2d7a27', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', aspectRatio: '2/3' }}>
              {/* Terrain */}
              <rect x="5" y="2" width="90" height="96" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" rx="1" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <circle cx="50" cy="50" r="10" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <circle cx="50" cy="50" r=".8" fill="rgba(255,255,255,.5)" />
              {/* Surface de réparation */}
              <rect x="25" y="2" width="50" height="18" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <rect x="35" y="2" width="30" height="8" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <rect x="25" y="80" width="50" height="18" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <rect x="35" y="90" width="30" height="8" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />

              {/* Joueurs sur le terrain */}
              {currentFormation.positions.map((pos, i) => {
                const joueurId = compo[pos.id]
                const joueur = joueurs.find(j => j.id === joueurId)
                return (
                  <g key={pos.id}>
                    <circle cx={pos.x} cy={pos.y} r="6"
                      fill={joueurId ? THEME.primary : 'rgba(255,255,255,.2)'}
                      stroke="rgba(255,255,255,.6)" strokeWidth=".5" />
                    {joueur ? (
                      <>
                        <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                          fontSize="3.5" fill="#fff" fontWeight="700">
                          {joueur.numero || (i+1)}
                        </text>
                        <text x={pos.x} y={pos.y + 9} textAnchor="middle" fontSize="3" fill="rgba(255,255,255,.9)">
                          {joueur.nom?.slice(0,6)}
                        </text>
                      </>
                    ) : (
                      <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                        fontSize="3" fill="rgba(255,255,255,.5)">{pos.label}</text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Sélection joueurs par poste */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {currentFormation.positions.map(pos => (
              <div key={pos.id}>
                <label style={{ display: 'block', fontSize: 10, color: '#6B7280', marginBottom: 2 }}>{pos.label}</label>
                <select value={compo[pos.id] || ''} onChange={e => setCompo(p => ({...p, [pos.id]: e.target.value}))}
                  style={{ width: '100%', padding: '5px 8px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 11, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">— Choisir —</option>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}{j.numero ? ` (${j.numero})` : ''}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1 }} onClick={saveRapport} disabled={saving}>💾 Enregistrer</Button>
            <Button style={{ flex: 1 }} onClick={shareRapportInApp}>💬 Partager</Button>
          </div>
        </Card>
      )}

      {/* RAPPORT */}
      {activeTab === 'rapport' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Rapport de match</p>
          {[
            ["Causerie d'avant-match", 'causerie'],
            ['Animation offensive', 'animation_offensive'],
            ['Animation défensive', 'animation_defensive'],
            ['✅ Points positifs offensifs', 'points_positifs_off'],
            ['⚠️ Problèmes offensifs', 'problemes_off'],
            ['✅ Points positifs défensifs', 'points_positifs_def'],
            ['⚠️ Problèmes défensifs', 'problemes_def'],
            ['Points forts globaux', 'points_forts_globaux'],
            ['Points faibles globaux', 'points_faibles_globaux'],
            ['Composition adversaire', 'compo_adversaire'],
          ].map(([label, field]) => (
            <div key={field} style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{label}</label>
              <textarea value={formRapport[field] || ''} onChange={e => setFormRapport(p => ({...p, [field]: e.target.value}))}
                rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          ))}
          <Input label="Arbitre" value={formRapport.arbitre || ''} onChange={v => setFormRapport(p => ({...p, arbitre: v}))} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button variant="primary" style={{ flex: 1 }} onClick={saveRapport} disabled={saving}>💾 Enregistrer</Button>
            <Button style={{ flex: 1 }} onClick={shareRapportInApp}>💬 Partager</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
