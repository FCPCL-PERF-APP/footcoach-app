import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'

const CPA_TYPES = [
  { key: 'corner_off',  label: '📐 Corner offensif',     color: '#3B6D11' },
  { key: 'corner_def',  label: '🛡️ Corner défensif',     color: '#185FA5' },
  { key: 'cf_off',      label: '🎯 Coup-franc offensif',  color: '#854F0B' },
  { key: 'cf_def',      label: '🧱 Coup-franc défensif',  color: '#A32D2D' },
  { key: 'penalty_off', label: '⚽ Pénalty offensif',    color: '#3B6D11' },
  { key: 'penalty_def', label: '🧤 Pénalty défensif',    color: '#185FA5' },
  { key: 'remise_jeu',  label: '🔄 Remise en jeu',       color: '#6B7280' },
]

const COULEURS = ['#FFDD57','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD','#F0B27A','#BB8FCE']
const MODES = [
  { key: 'joueur',    label: '👥 Joueur',  desc: 'Clique sur le terrain' },
  { key: 'ballon',    label: '⚽ Ballon',  desc: 'Repositionne le ballon' },
  { key: 'fleche_bal',label: '→ Trajectoire ballon', desc: 'Flèche pleine' },
  { key: 'fleche_crs',label: '⤳ Course joueur',     desc: 'Flèche pointillée' },
  { key: 'zone',      label: '⬜ Zone',    desc: 'Zone de tir/espace' },
]

export default function CPAPage() {
  const { isCoach, isJoueur, profile } = useAuth()
  const [cpas, setCpas] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('tous')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCpa, setSelectedCpa] = useState(null)
  const [joueurs, setJoueurs] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [form, setForm] = useState({ titre: '', type: 'corner_off', description: '' })
  const [placements, setPlacements] = useState([])
  const [ballonPos, setBallonPos] = useState({ x: 50, y: 50 })
  const [fleches, setFleches] = useState([])
  const [modeEdition, setModeEdition] = useState('joueur')
  const [selectedJoueur, setSelectedJoueur] = useState('')
  const [drawStart, setDrawStart] = useState(null)

  const terrainRef = useRef(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cpaData, error }, { data: jrs }] = await Promise.all([
      supabase.from('cpa').select('*').order('created_at', { ascending: false }),
      supabase.from('joueurs').select('id,nom,prenom,poste,numero').order('nom'),
    ])
    if (error) console.error('Erreur chargement CPA:', error)
    setCpas(cpaData || [])
    setJoueurs(jrs || [])
    setLoading(false)
  }

  function getCoords(e) {
    const rect = terrainRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: Math.round((e.clientX - rect.left) / rect.width * 100),
      y: Math.round((e.clientY - rect.top) / rect.height * 100)
    }
  }

  function handleTerrainClick(e) {
    if (!isCoach) return
    const coords = getCoords(e)
    if (!coords) return

    if (modeEdition === 'joueur' && selectedJoueur) {
      const j = joueurs.find(j => j.id === selectedJoueur)
      setPlacements(p => {
        const exists = p.find(pl => pl.joueurId === selectedJoueur)
        if (exists) return p.map(pl => pl.joueurId === selectedJoueur ? { ...pl, ...coords } : pl)
        return [...p, { joueurId: selectedJoueur, nom: j?.nom, numero: j?.numero, ...coords, couleur: COULEURS[p.length % COULEURS.length] }]
      })
    } else if (modeEdition === 'ballon') {
      setBallonPos(coords)
    } else if (modeEdition === 'fleche_bal' || modeEdition === 'fleche_crs' || modeEdition === 'zone') {
      if (!drawStart) {
        setDrawStart(coords)
      } else {
        setFleches(f => [...f, { type: modeEdition, x1: drawStart.x, y1: drawStart.y, x2: coords.x, y2: coords.y }])
        setDrawStart(null)
      }
    }
  }

  async function saveCpa() {
    if (!form.titre) { setSaveError('Ajoute un titre.'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        titre: form.titre,
        type: form.type,
        description: form.description || '',
        joueurs_placements: placements,
        ballon_pos: ballonPos,
        fleches,
        created_by: profile?.auth_id || profile?.id,
      }
      const { error } = await supabase.from('cpa').insert(payload)
      if (error) throw error
      setShowCreate(false)
      resetForm()
      loadData()
    } catch (err) {
      setSaveError('Erreur : ' + err.message)
    }
    setSaving(false)
  }

  function resetForm() {
    setForm({ titre: '', type: 'corner_off', description: '' })
    setPlacements([])
    setBallonPos({ x: 50, y: 50 })
    setFleches([])
    setDrawStart(null)
    setSelectedJoueur('')
    setSaveError(null)
  }

  async function deleteCpa(id) {
    if (!window.confirm('Supprimer ce schéma ?')) return
    await supabase.from('cpa').delete().eq('id', id)
    setSelectedCpa(null)
    loadData()
  }

  async function partagerCpa(cpa) {
    const { data: { user } } = await supabase.auth.getUser()
    const type = CPA_TYPES.find(t => t.key === cpa.type)
    await supabase.from('messages').insert({
      expediteur_id: user?.id,
      expediteur_nom: 'Coach',
      expediteur_role: 'coach',
      groupe: true,
      contenu: `📐 CPA — ${cpa.titre}\n${type?.label || ''}\n${cpa.description ? `\n💬 ${cpa.description}` : ''}\n\nConsulte le schéma dans Menu ☰ → CPA`
    })
    alert('✅ Schéma partagé dans le groupe !')
  }

  const cpaFiltres = activeFilter === 'tous' ? cpas : cpas.filter(c => c.type === activeFilter)

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>📐 CPA</h1>
        {isCoach && (
          <button onClick={() => { setShowCreate(!showCreate); setSelectedCpa(null); if (showCreate) resetForm() }}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: showCreate ? '#6B7280' : THEME.primary, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            {showCreate ? '✕ Annuler' : '+ Créer'}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
        <button onClick={() => setActiveFilter('tous')} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', border: '0.5px solid #D1D5DB', background: activeFilter === 'tous' ? '#E6F1FB' : 'transparent', color: activeFilter === 'tous' ? THEME.primary : '#6B7280', fontWeight: activeFilter === 'tous' ? 600 : 400 }}>Tous</button>
        {CPA_TYPES.map(t => (
          <button key={t.key} onClick={() => setActiveFilter(t.key)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', border: `0.5px solid ${activeFilter === t.key ? t.color : '#D1D5DB'}`, background: activeFilter === t.key ? `${t.color}15` : 'transparent', color: activeFilter === t.key ? t.color : '#6B7280', fontWeight: activeFilter === t.key ? 600 : 400 }}>{t.label}</button>
        ))}
      </div>

      {/* Formulaire création */}
      {showCreate && isCoach && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nouveau schéma CPA</p>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Titre *</label>
            <input value={form.titre} onChange={e => setForm(p => ({...p, titre: e.target.value}))}
              placeholder="Corner côté gauche — option 1"
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Type</label>
            <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
              {CPA_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Consignes</label>
            <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              placeholder="Déplacements, options, timing..." rows={2}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'none', fontFamily: 'inherit' }} />
          </div>

          {/* Modes d'édition */}
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>Mode d'édition :</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
            {MODES.map(m => (
              <button key={m.key} onClick={() => { setModeEdition(m.key); setDrawStart(null) }} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: `0.5px solid ${modeEdition === m.key ? THEME.primary : '#D1D5DB'}`,
                background: modeEdition === m.key ? '#E6F1FB' : 'transparent',
                color: modeEdition === m.key ? THEME.primary : '#6B7280',
                fontWeight: modeEdition === m.key ? 600 : 400
              }}>{m.label}</button>
            ))}
          </div>

          {/* Sélecteur joueur */}
          {modeEdition === 'joueur' && (
            <select value={selectedJoueur} onChange={e => setSelectedJoueur(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}>
              <option value="">— Choisir un joueur —</option>
              {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}{j.numero ? ` (${j.numero})` : ''}</option>)}
            </select>
          )}

          {(modeEdition === 'fleche_bal' || modeEdition === 'fleche_crs' || modeEdition === 'zone') && (
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#6B7280' }}>
              {drawStart ? '✅ Point de départ placé — clique pour le point d\'arrivée' : '👆 Clique sur le terrain pour le point de départ'}
            </div>
          )}

          {/* Terrain */}
          <div ref={terrainRef} onClick={handleTerrainClick}
            style={{ background: '#2d7a27', borderRadius: 10, overflow: 'hidden', cursor: 'crosshair', marginBottom: 10 }}>
            <TerrainSVG placements={placements} ballonPos={ballonPos} fleches={fleches} drawStart={drawStart} />
          </div>

          {/* Actions terrain */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {placements.length > 0 && (
              <button onClick={() => setPlacements(p => p.slice(0,-1))}
                style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', fontSize: 11, cursor: 'pointer' }}>
                ↩ Annuler joueur
              </button>
            )}
            {fleches.length > 0 && (
              <button onClick={() => setFleches(f => f.slice(0,-1))}
                style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', fontSize: 11, cursor: 'pointer' }}>
                ↩ Annuler flèche
              </button>
            )}
          </div>

          {saveError && <p style={{ fontSize: 12, color: '#A32D2D', marginBottom: 8 }}>{saveError}</p>}

          <button onClick={saveCpa} disabled={saving || !form.titre}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: form.titre ? THEME.gradient : '#E5E7EB', color: form.titre ? '#fff' : '#9CA3AF', fontSize: 14, fontWeight: 700, cursor: form.titre ? 'pointer' : 'not-allowed' }}>
            {saving ? '⏳ Enregistrement...' : '💾 Sauvegarder le schéma'}
          </button>
        </Card>
      )}

      {/* Vue détail */}
      {selectedCpa && !showCreate && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedCpa.titre}</p>
              <span style={{ fontSize: 11, color: CPA_TYPES.find(t => t.key === selectedCpa.type)?.color, fontWeight: 600 }}>
                {CPA_TYPES.find(t => t.key === selectedCpa.type)?.label}
              </span>
            </div>
            <button onClick={() => setSelectedCpa(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
          <div style={{ background: '#2d7a27', borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
            <TerrainSVG placements={selectedCpa.joueurs_placements || []} ballonPos={selectedCpa.ballon_pos || {x:50,y:50}} fleches={selectedCpa.fleches || []} />
          </div>
          {selectedCpa.description && (
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>💬 Consignes</p>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{selectedCpa.description}</p>
            </div>
          )}
          {/* Légende */}
          {selectedCpa.joueurs_placements?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {selectedCpa.joueurs_placements.map(pl => (
                <span key={pl.joueurId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: pl.couleur, display: 'inline-block' }} />
                  {pl.numero ? `N°${pl.numero} ` : ''}{pl.nom}
                </span>
              ))}
            </div>
          )}
          {/* Légende flèches */}
          {selectedCpa.fleches?.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 10, color: '#6B7280' }}>
              {selectedCpa.fleches.some(f => f.type === 'fleche_bal') && <span>— Trajectoire ballon</span>}
              {selectedCpa.fleches.some(f => f.type === 'fleche_crs') && <span>⤳ Course joueur</span>}
              {selectedCpa.fleches.some(f => f.type === 'zone') && <span>⬜ Zone</span>}
            </div>
          )}
          {isCoach && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => partagerCpa(selectedCpa)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${THEME.primary}`, background: '#E6F1FB', color: THEME.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                💬 Partager dans le groupe
              </button>
              <button onClick={() => deleteCpa(selectedCpa.id)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: '#FCEBEB', color: '#A32D2D', fontSize: 12, cursor: 'pointer' }}>🗑️</button>
            </div>
          )}
        </Card>
      )}

      {/* Liste */}
      {loading ? <Spinner /> : !showCreate && !selectedCpa && (
        cpaFiltres.length === 0 ? (
          <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
            {isCoach ? 'Aucun schéma. Clique sur "+ Créer" !' : 'Aucun schéma CPA disponible pour l\'instant.'}
          </p></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {cpaFiltres.map(cpa => {
              const typeInfo = CPA_TYPES.find(t => t.key === cpa.type)
              return (
                <div key={cpa.id} onClick={() => setSelectedCpa(cpa)}
                  style={{ background: '#fff', border: `1.5px solid ${typeInfo?.color || '#E5E7EB'}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ background: '#2d7a27', height: 90 }}>
                    <TerrainSVG placements={cpa.joueurs_placements || []} ballonPos={cpa.ballon_pos || {x:50,y:50}} fleches={cpa.fleches || []} mini />
                  </div>
                  <div style={{ padding: '7px 10px' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{cpa.titre}</p>
                    <span style={{ fontSize: 10, fontWeight: 600, color: typeInfo?.color }}>{typeInfo?.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

function TerrainSVG({ placements = [], ballonPos = { x: 50, y: 50 }, fleches = [], mini = false, drawStart = null }) {
  return (
    <svg viewBox="0 0 100 70" style={{ width: '100%', display: 'block' }}>
      {/* Fond gazon */}
      <rect width="100" height="70" fill="#2d7a27" />
      {/* Lignes bandes alternées */}
      {[0,1,2,3,4].map(i => <rect key={i} x={i*20} y="0" width="10" height="70" fill="rgba(0,0,0,.05)" />)}
      {/* Bordure */}
      <rect x="2" y="2" width="96" height="66" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth=".7" />
      {/* Ligne médiane (haut du demi-terrain) */}
      <line x1="2" y1="2" x2="98" y2="2" stroke="rgba(255,255,255,.6)" strokeWidth=".7" />
      {/* Surface de réparation */}
      <rect x="22" y="46" width="56" height="22" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth=".7" />
      {/* Petite surface */}
      <rect x="36" y="58" width="28" height="10" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".5" />
      {/* But */}
      <rect x="43" y="66" width="14" height="5" fill="rgba(0,0,0,.3)" stroke="rgba(255,255,255,.8)" strokeWidth=".7" />
      {/* Point de pénalty */}
      <circle cx="50" cy="55" r=".8" fill="rgba(255,255,255,.8)" />
      {/* Coins de terrain */}
      <path d="M 2 62 Q 2 68 8 68" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" />
      <path d="M 98 62 Q 98 68 92 68" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" />
      <path d="M 2 8 Q 2 2 8 2" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" />
      <path d="M 98 8 Q 98 2 92 2" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" />

      {/* Flèches */}
      <defs>
        <marker id="arrow-solid" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#FFD700" />
        </marker>
        <marker id="arrow-dash" markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto">
          <polygon points="0 0, 5 2, 0 4" fill="#4ECDC4" />
        </marker>
      </defs>
      {fleches.map((f, i) => {
        if (f.type === 'fleche_bal') return (
          <line key={i} x1={f.x1} y1={f.y1 * 0.7} x2={f.x2} y2={f.y2 * 0.7}
            stroke="#FFD700" strokeWidth="1.5" markerEnd="url(#arrow-solid)" />
        )
        if (f.type === 'fleche_crs') return (
          <line key={i} x1={f.x1} y1={f.y1 * 0.7} x2={f.x2} y2={f.y2 * 0.7}
            stroke="#4ECDC4" strokeWidth="1.2" strokeDasharray="3,2" markerEnd="url(#arrow-dash)" />
        )
        if (f.type === 'zone') return (
          <rect key={i}
            x={Math.min(f.x1, f.x2)} y={Math.min(f.y1, f.y2) * 0.7}
            width={Math.abs(f.x2 - f.x1)} height={Math.abs(f.y2 - f.y1) * 0.7}
            fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.6)" strokeWidth=".8" strokeDasharray="3,2" />
        )
        return null
      })}

      {/* Point de départ flèche en cours */}
      {drawStart && (
        <circle cx={drawStart.x} cy={drawStart.y * 0.7} r="3" fill="rgba(255,255,0,.6)" stroke="#fff" strokeWidth=".5" />
      )}

      {/* Ballon */}
      <text x={ballonPos.x} y={ballonPos.y * 0.7 + 2.5} textAnchor="middle"
        fontSize={mini ? 5 : 7} style={{ userSelect: 'none' }}>⚽</text>

      {/* Joueurs */}
      {placements.map((pl, i) => (
        <g key={pl.joueurId}>
          <circle cx={pl.x} cy={pl.y * 0.7} r={mini ? 3.5 : 5}
            fill={pl.couleur || '#FFDD57'} stroke="#fff" strokeWidth=".8" />
          <text x={pl.x} y={pl.y * 0.7 + (mini ? 1.4 : 2)}
            textAnchor="middle" fontSize={mini ? 3 : 3.8} fontWeight="700" fill="#111">
            {pl.numero || (i + 1)}
          </text>
          {!mini && pl.nom && (
            <text x={pl.x} y={pl.y * 0.7 + 9}
              textAnchor="middle" fontSize="2.5" fill="rgba(255,255,255,.9)">
              {pl.nom.slice(0, 8)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
