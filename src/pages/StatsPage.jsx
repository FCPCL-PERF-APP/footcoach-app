import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Button, Input, Select, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { exportRapportPDF } from '../utils/exportPDF'

const POSTES = ['Gardien','Défenseur central','Latéral droit','Latéral gauche','Milieu défensif','Milieu central','Milieu offensif','Ailier droit','Ailier gauche','Attaquant']

export default function StatsPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const { isCoach, isAdjoint } = useAuth()
  const [event, setEvent] = useState(null)
  const [joueurs, setJoueurs] = useState([])
  const [statsIndiv, setStatsIndiv] = useState([])
  const [statsCollectives, setStatsCollectives] = useState(null)
  const [rapport, setRapport] = useState(null)
  const [activeTab, setActiveTab] = useState('individuel')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [compo, setCompo] = useState(Array(16).fill(''))

  // Formulaires
  const [formIndiv, setFormIndiv] = useState({})
  const [formCollectif, setFormCollectif] = useState({
    buts_marques: '', buts_encaisses: '',
    score_mi_temps: '', score_final: '',
    attaque_placee: '', contre_attaque: '', corner: '', penalty: '',
    buts_0_15: '', buts_15_30: '', buts_30_45: '',
    buts_45_60: '', buts_60_75: '', buts_75_90: '',
  })
  const [formRapport, setFormRapport] = useState({
    causerie: '', animation_offensive: '', animation_defensive: '',
    points_positifs_off: '', problemes_off: '',
    points_positifs_def: '', problemes_def: '',
    points_forts_globaux: '', points_faibles_globaux: '',
    compo_adversaire: '', arbitre: '',
  })
  const [selectedJoueur, setSelectedJoueur] = useState('')
  const [formJ, setFormJ] = useState({
    note: '', temps_jeu: '', buts: '', passes_decisives: '',
    titulaire: true, carton_jaune: false, carton_rouge: false
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
    if (sc) { setStatsCollectives(sc); setFormCollectif({ ...formCollectif, ...sc }) }
    if (rp) { setRapport(rp); setFormRapport({ ...formRapport, ...rp }); if (rp.compo) setCompo(rp.compo) }
    if (jrs?.length) setSelectedJoueur(jrs[0].id)
    setLoading(false)
  }

  async function saveStatsCollectives() {
    setSaving(true)
    const payload = {
      evenement_id: eventId,
      ...Object.fromEntries(Object.entries(formCollectif).map(([k, v]) => [k, v !== '' ? parseInt(v) || v : null]))
    }
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
      titulaire: formJ.titulaire,
      carton_jaune: formJ.carton_jaune,
      carton_rouge: formJ.carton_rouge,
    }
    if (existing) await supabase.from('stats_match').update(payload).eq('id', existing.id)
    else await supabase.from('stats_match').insert(payload)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); loadData()
  }

  async function saveRapport() {
    setSaving(true)
    const payload = { evenement_id: eventId, ...formRapport, compo }
    if (rapport) await supabase.from('rapports_match').update(payload).eq('id', rapport.id)
    else await supabase.from('rapports_match').insert(payload)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); loadData()
  }

  async function shareRapportInApp() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase.from('staff').select('nom,prenom').eq('auth_id', user?.id).maybeSingle()
    const auteurNom = staff ? `${staff.nom} ${staff.prenom}` : 'Coach'
    const contenu = `📊 Rapport de match — ${event?.titre}\n\n` +
      `Score : ${formRapport.score_final || '—'}\n` +
      (formRapport.points_forts_globaux ? `✅ Points forts : ${formRapport.points_forts_globaux}\n` : '') +
      (formRapport.points_faibles_globaux ? `⚠️ Points à améliorer : ${formRapport.points_faibles_globaux}` : '')
    await supabase.from('messages').insert({
      expediteur_id: user?.id,
      expediteur_nom: auteurNom,
      expediteur_role: 'coach',
      groupe: true,
      contenu
    })
    alert('✅ Rapport partagé dans le canal groupe !')
  }

  const tabs = [
    { key: 'individuel', label: '👤 Individuelles' },
    { key: 'collectif',  label: '📊 Collectives' },
    { key: 'rapport',    label: '📝 Rapport' },
    { key: 'compo',      label: '⚽ Compo' },
  ]

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700 }}>Stats match</p>
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>{event?.titre} · {event?.date_heure ? format(parseISO(event.date_heure), 'd MMM yyyy', { locale: fr }) : ''}</p>
        </div>
      </div>

      {saved && <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3B6D11' }}>✅ Enregistré !</div>}

      {/* Score rapide */}
      {(formCollectif.score_final || (formCollectif.buts_marques !== '' && formCollectif.buts_encaisses !== '')) && (
        <div style={{ background: THEME.gradient, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>FC PCL</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{formCollectif.buts_marques ?? '—'}</div>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>—</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{event?.titre?.replace('vs ','') || 'Adversaire'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{formCollectif.buts_encaisses ?? '—'}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB', whiteSpace: 'nowrap',
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
                const existing = statsIndiv.find(s => s.joueur_id === e.target.value)
                if (existing) setFormJ({ note: existing.note || '', temps_jeu: existing.temps_jeu || '', buts: existing.buts || 0, passes_decisives: existing.passes_decisives || 0, titulaire: existing.titulaire !== false, carton_jaune: existing.carton_jaune || false, carton_rouge: existing.carton_rouge || false })
                else setFormJ({ note: '', temps_jeu: '', buts: 0, passes_decisives: 0, titulaire: true, carton_jaune: false, carton_rouge: false })
              }} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom} — {j.poste}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[['Note (/10)','note','number','0.5'],['Temps jeu (min)','temps_jeu','number','1'],['Buts','buts','number','1'],['Passes déc.','passes_decisives','number','1']].map(([label, field, type, step]) => (
                <div key={field} style={{ marginBottom: 8 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{label}</label>
                  <input type={type} step={step} value={formJ[field] || ''} onChange={e => setFormJ(p => ({...p, [field]: e.target.value}))}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[['Titulaire','titulaire'],['Carton 🟡','carton_jaune'],['Carton 🔴','carton_rouge']].map(([label, field]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={formJ[field]} onChange={e => setFormJ(p => ({...p, [field]: e.target.checked}))} />
                  {label}
                </label>
              ))}
            </div>
            <Button variant="primary" style={{ width: '100%' }} onClick={saveStatsJoueur} disabled={saving}>
              {saving ? 'Enregistrement...' : '💾 Enregistrer'}
            </Button>
          </Card>

          {/* Tableau récap */}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['Score mi-temps','score_mi_temps'],['Score final','score_final']].map(([label, field]) => (
              <div key={field} style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{label}</label>
                <input value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))} placeholder="2-1"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            {[['Buts marqués','buts_marques'],['Buts encaissés','buts_encaisses'],['Attaque placée','attaque_placee'],['Contre-attaque','contre_attaque'],['Corner','corner'],['Pénalty','penalty']].map(([label, field]) => (
              <div key={field} style={{ marginBottom: 8 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>{label}</label>
                <input type="number" min="0" value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>

          {/* Buts par période */}
          <p style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', margin: '10px 0 8px' }}>Buts par période</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
            {[['0-15','buts_0_15'],['15-30','buts_15_30'],['30-45','buts_30_45'],['45-60','buts_45_60'],['60-75','buts_60_75'],['75-90','buts_75_90']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 10, color: '#9CA3AF', marginBottom: 3, textAlign: 'center' }}>{label}'</label>
                <input type="number" min="0" value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              </div>
            ))}
          </div>
          <Button variant="primary" style={{ width: '100%', marginTop: 12 }} onClick={saveStatsCollectives} disabled={saving}>
            {saving ? 'Enregistrement...' : '💾 Enregistrer'}
          </Button>
        </Card>
      )}

      {/* RAPPORT */}
      {activeTab === 'rapport' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Rapport de match</p>
          {[
            ['Causerie d\'avant-match', 'causerie'],
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
            <Button variant="primary" style={{ flex: 1 }} onClick={saveRapport} disabled={saving}>
              {saving ? '...' : '💾 Enregistrer'}
            </Button>
            <Button style={{ flex: 1 }} onClick={() => exportRapportPDF(formRapport, event, statsCollectives, compo)}>
              📄 PDF
            </Button>
            <Button style={{ flex: 1 }} onClick={shareRapportInApp}>
              💬 Partager
            </Button>
          </div>
        </Card>
      )}

      {/* COMPOSITION */}
      {activeTab === 'compo' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Composition — 16 joueurs</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {compo.map((nom, i) => (
              <div key={i}>
                <label style={{ display: 'block', fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>#{i+1}</label>
                <select value={nom} onChange={e => { const c = [...compo]; c[i] = e.target.value; setCompo(c) }}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">— Choisir —</option>
                  {joueurs.map(j => <option key={j.id} value={`${j.nom} ${j.prenom}`}>{j.nom} {j.prenom}</option>)}
                </select>
              </div>
            ))}
          </div>
          <Button variant="primary" style={{ width: '100%', marginTop: 12 }} onClick={saveRapport} disabled={saving}>
            {saving ? '...' : '💾 Enregistrer la compo'}
          </Button>
        </Card>
      )}
    </div>
  )
}
