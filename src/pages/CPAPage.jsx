import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'

const CPA_TYPES = [
  { key: 'corner_off',   label: '📐 Corner offensif',    color: '#3B6D11' },
  { key: 'corner_def',   label: '🛡️ Corner défensif',    color: '#185FA5' },
  { key: 'cf_off',       label: '🎯 Coup-franc offensif', color: '#854F0B' },
  { key: 'cf_def',       label: '🧱 Coup-franc défensif', color: '#A32D2D' },
  { key: 'penalty_off',  label: '⚽ Pénalty offensif',   color: '#3B6D11' },
  { key: 'penalty_def',  label: '🧤 Pénalty défensif',   color: '#185FA5' },
  { key: 'remise_jeu',   label: '🔄 Remise en jeu',      color: '#6B7280' },
]

const COULEURS_JOUEUR = ['#FFDD57', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F0B27A', '#85C1E9']

export default function CPAPage() {
  const { isCoach, isJoueur, profile } = useAuth()
  const [cpas, setCpas] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState('tous')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedCpa, setSelectedCpa] = useState(null)
  const [joueurs, setJoueurs] = useState([])

  const [form, setForm] = useState({
    titre: '',
    type: 'corner_off',
    description: '',
    phase: 'offensive',
  })

  const [joueursPlacements, setJoueursPlacements] = useState([])
  const [fleches, setFleches] = useState([])
  const [modeEdition, setModeEdition] = useState('joueur') // joueur, fleche, ballon
  const [ballonPos, setBallonPos] = useState({ x: 50, y: 50 })
  const [selectedJoueur, setSelectedJoueur] = useState(null)
  const [saving, setSaving] = useState(false)
  const terrainRef = useRef(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: cpaData }, { data: jrs }] = await Promise.all([
      supabase.from('cpa').select('*').order('created_at', { ascending: false }),
      supabase.from('joueurs').select('id, nom, prenom, poste, numero').order('nom'),
    ])
    setCpas(cpaData || [])
    setJoueurs(jrs || [])
    setLoading(false)
  }

  function getCoords(e, ref) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return null
    const x = ((e.clientX - rect.left) / rect.width * 100)
    const y = ((e.clientY - rect.top) / rect.height * 100)
    return { x: Math.round(x), y: Math.round(y) }
  }

  function handleTerrainClick(e) {
    if (!isCoach || !showCreate) return
    const coords = getCoords(e, terrainRef)
    if (!coords) return

    if (modeEdition === 'joueur' && selectedJoueur) {
      // Placer le joueur sélectionné
      setJoueursPlacements(p => {
        const existing = p.find(pl => pl.joueurId === selectedJoueur)
        if (existing) return p.map(pl => pl.joueurId === selectedJoueur ? { ...pl, ...coords } : pl)
        const j = joueurs.find(j => j.id === selectedJoueur)
        return [...p, { joueurId: selectedJoueur, nom: j?.nom, numero: j?.numero, ...coords, couleur: COULEURS_JOUEUR[p.length % COULEURS_JOUEUR.length] }]
      })
    } else if (modeEdition === 'ballon') {
      setBallonPos(coords)
    }
  }

  async function saveCpa() {
    if (!form.titre) return
    setSaving(true)
    const payload = {
      titre: form.titre,
      type: form.type,
      description: form.description,
      joueurs_placements: joueursPlacements,
      ballon_pos: ballonPos,
      fleches,
      created_by: profile?.auth_id || profile?.id,
    }
    await supabase.from('cpa').insert(payload)
    setSaving(false)
    setShowCreate(false)
    resetForm()
    loadData()
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
      contenu: `📐 CPA partagé : ${cpa.titre}\n${type?.label || ''}\n${cpa.description ? `💬 ${cpa.description}` : ''}\n\nConsultez-le dans Menu → CPA`
    })
    alert('✅ Schéma partagé dans le canal groupe !')
  }

  function resetForm() {
    setForm({ titre: '', type: 'corner_off', description: '' })
    setJoueursPlacements([])
    setFleches([])
    setBallonPos({ x: 50, y: 50 })
    setSelectedJoueur(null)
  }

  const cpaFiltres = activeFilter === 'tous' ? cpas : cpas.filter(c => c.type === activeFilter)

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>📐 CPA</h1>
        {isCoach && (
          <button onClick={() => { setShowCreate(!showCreate); setSelectedCpa(null); resetForm() }}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: showCreate ? '#6B7280' : THEME.primary, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            {showCreate ? '✕ Annuler' : '+ Créer'}
          </button>
        )}
      </div>

      {/* Filtres type */}
      <div style={{ display: 'flex', gap: 5, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
        <button onClick={() => setActiveFilter('tous')} style={{
          padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
          border: '0.5px solid #D1D5DB',
          background: activeFilter === 'tous' ? '#E6F1FB' : 'transparent',
          color: activeFilter === 'tous' ? THEME.primary : '#6B7280',
          fontWeight: activeFilter === 'tous' ? 600 : 400
        }}>Tous</button>
        {CPA_TYPES.map(t => (
          <button key={t.key} onClick={() => setActiveFilter(t.key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: `0.5px solid ${activeFilter === t.key ? t.color : '#D1D5DB'}`,
            background: activeFilter === t.key ? `${t.color}15` : 'transparent',
            color: activeFilter === t.key ? t.color : '#6B7280',
            fontWeight: activeFilter === t.key ? 600 : 400
          }}>{t.label}</button>
        ))}
      </div>

      {/* Formulaire création */}
      {showCreate && isCoach && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Nouveau schéma CPA</p>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Titre</label>
            <input value={form.titre} onChange={e => setForm(p => ({...p, titre: e.target.value}))}
              placeholder="Corner côté gauche — option 1"
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Type de CPA</label>
            <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
              {CPA_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Description / Consignes</label>
            <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
              placeholder="Décris le schéma, les déplacements, les options..."
              rows={3} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Terrain interactif */}
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Placement sur le terrain</p>

          {/* Modes d'édition */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {[['joueur', '👥 Placer joueur'], ['ballon', '⚽ Placer ballon']].map(([mode, label]) => (
              <button key={mode} onClick={() => setModeEdition(mode)} style={{
                padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: `0.5px solid ${modeEdition === mode ? THEME.primary : '#D1D5DB'}`,
                background: modeEdition === mode ? '#E6F1FB' : 'transparent',
                color: modeEdition === mode ? THEME.primary : '#6B7280',
                fontWeight: modeEdition === mode ? 600 : 400
              }}>{label}</button>
            ))}
          </div>

          {/* Sélecteur joueur */}
          {modeEdition === 'joueur' && (
            <div style={{ marginBottom: 8 }}>
              <select value={selectedJoueur || ''} onChange={e => setSelectedJoueur(e.target.value)}
                style={{ width: '100%', padding: '6px 10px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— Choisir un joueur à placer —</option>
                {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}{j.numero ? ` (${j.numero})` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Terrain SVG interactif */}
          <div ref={terrainRef} onClick={handleTerrainClick}
            style={{ background: '#2d7a27', borderRadius: 10, overflow: 'hidden', cursor: 'crosshair', position: 'relative', marginBottom: 10 }}>
            <TerrainSVG placements={joueursPlacements} ballonPos={ballonPos} fleches={fleches} />
          </div>

          {/* Joueurs placés */}
          {joueursPlacements.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Joueurs placés :</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {joueursPlacements.map(pl => (
                  <div key={pl.joueurId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: pl.couleur }} />
                    <span>{pl.nom}</span>
                    <button onClick={() => setJoueursPlacements(p => p.filter(x => x.joueurId !== pl.joueurId))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 12, padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={saveCpa} disabled={saving || !form.titre} style={{
            width: '100%', padding: 12, borderRadius: 10, border: 'none',
            background: form.titre ? THEME.gradient : '#E5E7EB',
            color: form.titre ? '#fff' : '#9CA3AF',
            fontSize: 14, fontWeight: 700, cursor: form.titre ? 'pointer' : 'not-allowed'
          }}>
            {saving ? 'Enregistrement...' : '💾 Sauvegarder le schéma'}
          </button>
        </Card>
      )}

      {/* Vue détail d'un CPA */}
      {selectedCpa && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{selectedCpa.titre}</p>
              <span style={{ fontSize: 11, color: CPA_TYPES.find(t => t.key === selectedCpa.type)?.color || '#6B7280', fontWeight: 600 }}>
                {CPA_TYPES.find(t => t.key === selectedCpa.type)?.label}
              </span>
            </div>
            <button onClick={() => setSelectedCpa(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>

          <div style={{ background: '#2d7a27', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
            <TerrainSVG
              placements={selectedCpa.joueurs_placements || []}
              ballonPos={selectedCpa.ballon_pos || { x: 50, y: 50 }}
              fleches={selectedCpa.fleches || []}
            />
          </div>

          {selectedCpa.description && (
            <div style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>💬 Consignes</p>
              <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{selectedCpa.description}</p>
            </div>
          )}

          {/* Légende joueurs */}
          {selectedCpa.joueurs_placements?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {selectedCpa.joueurs_placements.map(pl => (
                <div key={pl.joueurId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F3F4F6', borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: pl.couleur }} />
                  <span>{pl.numero ? `N°${pl.numero} ` : ''}{pl.nom}</span>
                </div>
              ))}
            </div>
          )}

          {isCoach && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => partagerCpa(selectedCpa)} style={{
                flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${THEME.primary}`,
                background: '#E6F1FB', color: THEME.primary, fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}>💬 Partager dans le groupe</button>
              <button onClick={() => deleteCpa(selectedCpa.id)} style={{
                padding: '10px 14px', borderRadius: 10, border: 'none',
                background: '#FCEBEB', color: '#A32D2D', fontSize: 12, cursor: 'pointer'
              }}>🗑️</button>
            </div>
          )}
        </Card>
      )}

      {/* Liste des CPA */}
      {loading ? <Spinner /> : (
        <>
          {!selectedCpa && (
            cpaFiltres.length === 0 ? (
              <Card>
                <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                  {activeFilter === 'tous' ? 'Aucun schéma CPA créé.' : `Aucun schéma pour ce type.`}
                  {isCoach && ' Clique sur "+ Créer" !'}
                </p>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {cpaFiltres.map(cpa => {
                  const typeInfo = CPA_TYPES.find(t => t.key === cpa.type)
                  return (
                    <div key={cpa.id} onClick={() => setSelectedCpa(cpa)} style={{
                      background: '#fff', border: `1.5px solid ${typeInfo?.color || '#E5E7EB'}`,
                      borderRadius: 12, overflow: 'hidden', cursor: 'pointer'
                    }}>
                      {/* Miniature terrain */}
                      <div style={{ background: '#2d7a27', height: 80 }}>
                        <TerrainSVG
                          placements={cpa.joueurs_placements || []}
                          ballonPos={cpa.ballon_pos || { x: 50, y: 50 }}
                          fleches={cpa.fleches || []}
                          mini
                        />
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{cpa.titre}</p>
                        <span style={{ fontSize: 10, fontWeight: 600, color: typeInfo?.color }}>
                          {typeInfo?.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}

function TerrainSVG({ placements = [], ballonPos = { x: 50, y: 50 }, fleches = [], mini = false }) {
  // Demi-terrain : viewBox 100x80
  const W = 100, H = 80

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {/* Fond */}
      <rect width={W} height={H} fill="#2d7a27" />
      {/* Bordure terrain */}
      <rect x="3" y="3" width="94" height="74" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".7" />
      {/* Ligne médiane */}
      <line x1="3" y1="3" x2="97" y2="3" stroke="rgba(255,255,255,.5)" strokeWidth=".7" />
      {/* Surface de réparation */}
      <rect x="22" y="58" width="56" height="18" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".7" />
      {/* Petit surface */}
      <rect x="35" y="68" width="30" height="9" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" />
      {/* But */}
      <rect x="42" y="74" width="16" height="6" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth=".8" />
      {/* Point de pénalty */}
      <circle cx="50" cy="63" r=".8" fill="rgba(255,255,255,.7)" />
      {/* Arc surface */}
      <path d="M 33 58 A 13 13 0 0 0 67 58" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".5" />
      {/* Coins */}
      <path d="M 3 73 Q 3 77 7 77" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".5" />
      <path d="M 97 73 Q 97 77 93 77" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".5" />

      {/* Ballon */}
      <text x={ballonPos.x} y={ballonPos.y * 0.78 + 2} textAnchor="middle"
        fontSize={mini ? 4 : 6} style={{ userSelect: 'none' }}>⚽</text>

      {/* Joueurs - pastilles plus petites */}
      {placements.map((pl, i) => (
        <g key={pl.joueurId}>
          <circle cx={pl.x} cy={pl.y * 0.78}
            r={mini ? 3 : 4.5}
            fill={pl.couleur || '#FFDD57'}
            stroke="#fff" strokeWidth=".7" />
          <text x={pl.x} y={pl.y * 0.78 + (mini ? 1.2 : 1.8)}
            textAnchor="middle" fontSize={mini ? 2.5 : 3.5}
            fontWeight="700" fill="#111">
            {pl.numero || (i + 1)}
          </text>
          {!mini && (
            <text x={pl.x} y={pl.y * 0.78 + 8}
              textAnchor="middle" fontSize="2.8" fill="rgba(255,255,255,.9)">
              {pl.nom?.slice(0, 7)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
