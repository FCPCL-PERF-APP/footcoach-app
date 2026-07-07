import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { validateFile, sanitizeFileName } from '../lib/upload'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'

export default function RessourcesPage() {
  const { isCoach, isAdjoint } = useAuth()
  const canAdd = isCoach || isAdjoint
  const [activeTab, setActiveTab] = useState('pdf')
  const [ressources, setRessources] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addTab, setAddTab] = useState('pdf')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ titre: '', url: '', categorie: 'general', evenement_id: '' })
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [videoValid, setVideoValid] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: res }, { data: evs }] = await Promise.all([
      supabase.from('ressources').select('*, evenements(titre)').order('created_at', { ascending: false }),
      supabase.from('evenements').select('id,titre,type').order('date_heure', { ascending: false }).limit(30)
    ])
    setRessources(res || [])
    setEvents(evs || [])
    setLoading(false)
  }

  function checkVideoUrl(url) {
    setForm(p => ({ ...p, url }))
    setVideoValid(url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo'))
  }

  async function handleSave() {
    if (!form.titre) return alert('Merci d\'ajouter un titre.')
    setUploading(true)
    let url = form.url

    if (file && addTab === 'pdf') {
      const fileErr = validateFile(file, 'pdf')
      if (fileErr) { alert(fileErr); setUploading(false); return }
      const path = `pdfs/${Date.now()}_${sanitizeFileName(file.name)}`
      const { error } = await supabase.storage.from('ressources').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('ressources').getPublicUrl(path)
        url = urlData.publicUrl
      } else {
        alert('Erreur upload PDF.')
        setUploading(false)
        return
      }
    }

    const { error: insertError } = await supabase.from('ressources').insert({
      titre: form.titre,
      type: addTab === 'pdf' ? 'pdf' : 'video',
      url,
      categorie: form.categorie,
      evenement_id: form.evenement_id || null
    })

    setUploading(false)
    if (insertError) {
      alert('Erreur lors de l\'enregistrement : ' + insertError.message)
      return
    }
    setShowAdd(false)
    setForm({ titre: '', url: '', categorie: 'general', evenement_id: '' })
    setFile(null)
    setVideoValid(false)
    loadData()
  }

  // Filtrage avec recherche
  const allRessources = ressources.filter(r =>
    r.type === (activeTab === 'pdf' ? 'pdf' : 'video') &&
    (!search || r.titre?.toLowerCase().includes(search.toLowerCase()) ||
     r.evenements?.titre?.toLowerCase().includes(search.toLowerCase()))
  )

  const grouped = allRessources.reduce((acc, r) => {
    const key = r.categorie === 'general' ? '📂 Général' : `⚽ ${r.evenements?.titre || 'Événement'}`
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  function getVideoIcon(url = '') {
    if (url.includes('youtube') || url.includes('youtu.be')) return '▶️'
    if (url.includes('vimeo')) return '🎬'
    return '🎥'
  }

  async function deleteRessource(id) {
    const { error } = await supabase.from('ressources').delete().eq('id', id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    loadData()
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title="Ressources"
        action={canAdd && (
          <Button variant="primary" size="sm" onClick={() => { setShowAdd(!showAdd); setAddTab('pdf') }}>
            {showAdd ? '✕ Fermer' : '+ Ajouter'}
          </Button>
        )}
      />

      {/* Formulaire ajout */}
      {showAdd && canAdd && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ajouter une ressource</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['pdf','📄 PDF'],['video','🎬 Vidéo']].map(([tab, lbl]) => (
              <button key={tab} onClick={() => setAddTab(tab)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12,
                cursor: 'pointer', fontWeight: 600,
                border: addTab === tab ? `2px solid ${THEME.primary}` : '1px solid #D1D5DB',
                background: addTab === tab ? '#E6F1FB' : 'transparent',
                color: addTab === tab ? THEME.primary : '#6B7280'
              }}>{lbl}</button>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Titre *</label>
            <input value={form.titre} onChange={e => setForm(p => ({ ...p, titre: e.target.value }))}
              placeholder={addTab === 'pdf' ? 'Ex : Programme de reprise' : 'Ex : Match vs RC Metz B'}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {addTab === 'pdf' ? (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Fichier PDF</label>
              <div onClick={() => document.getElementById('file-input').click()}
                style={{ border: file ? `2px solid ${THEME.success || '#3B6D11'}` : '1.5px dashed #D1D5DB', borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer', background: file ? '#EAF3DE' : '#F9FAFB' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{file ? '✅' : '📤'}</div>
                <p style={{ fontSize: 12, color: file ? '#3B6D11' : '#6B7280', fontWeight: file ? 600 : 400 }}>
                  {file ? file.name : 'Appuyer pour choisir un PDF'}
                </p>
              </div>
              <input id="file-input" type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; setFile(f); if (!form.titre) setForm(p => ({ ...p, titre: f.name.replace('.pdf', '') })) }} />
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Lien YouTube ou Vimeo</label>
              <input type="url" value={form.url} onChange={e => checkVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                style={{ width: '100%', padding: '8px 10px', border: `0.5px solid ${videoValid ? '#3B6D11' : '#D1D5DB'}`, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              {videoValid && <p style={{ fontSize: 11, color: '#3B6D11', marginTop: 4 }}>✅ Lien valide</p>}
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Catégorie</label>
            <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
              <option value="general">📂 Général (visible par tous)</option>
              <option value="match">⚽ Lié à un match</option>
              <option value="seance">🏃 Lié à une séance</option>
            </select>
          </div>

          {form.categorie !== 'general' && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 3 }}>Événement associé</label>
              <select value={form.evenement_id} onChange={e => setForm(p => ({ ...p, evenement_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— Choisir —</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.type === 'match' ? '⚽' : '🏃'} {e.titre}</option>)}
              </select>
            </div>
          )}

          <Button variant="primary" style={{ width: '100%' }} onClick={handleSave} disabled={uploading}>
            {uploading ? 'Publication...' : '📤 Publier'}
          </Button>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[['pdf','📄 Documents PDF'],['video','🎬 Vidéos']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {/* Recherche */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher une ressource..."
        style={{ width: '100%', padding: '8px 12px', marginBottom: 12, border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />

      {loading ? <Spinner /> : (
        Object.keys(grouped).length === 0 ? (
          <Card>
            <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
              {search ? `Aucune ressource pour "${search}"` : 'Aucune ressource pour l\'instant.'}
              {canAdd && !search && <><br /><span style={{ color: THEME.primary }}>Clique sur "+ Ajouter".</span></>}
            </p>
          </Card>
        ) : (
          Object.entries(grouped).map(([groupe, items]) => (
            <div key={groupe}>
              <p style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 6px' }}>
                {groupe}
              </p>
              <Card style={{ padding: '4px 14px' }}>
                {items.map((r, i) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < items.length - 1 ? '0.5px solid #F3F4F6' : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: r.type === 'pdf' ? '#FCEBEB' : '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {r.type === 'pdf' ? '📄' : getVideoIcon(r.url)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                        {r.type === 'pdf' ? 'PDF' : r.url?.includes('youtube') || r.url?.includes('youtu.be') ? 'YouTube' : 'Vimeo'}
                        {' · '}{new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer" style={{ color: THEME.primary, fontSize: 20, flexShrink: 0, textDecoration: 'none' }}>
                          {r.type === 'pdf' ? '⬇️' : '↗️'}
                        </a>
                      )}
                      {canAdd && (
                        <button onClick={() => deleteRessource(r.id)}
                          style={{ border: 'none', background: 'rgba(163,45,45,.1)', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))
        )
      )}
    </div>
  )
}
