import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { validateFile, sanitizeFileName } from '../lib/upload'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import {
  FileText, Video, Folder, Swords, Footprints, Plus, X, Upload,
  CheckCircle2, Download, ExternalLink, Trash2, Search, Play, Film
} from 'lucide-react'

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
    const key = r.categorie === 'general' ? 'Général' : (r.evenements?.titre || 'Événement')
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  function getVideoIcon(url = '') {
    if (url.includes('youtube') || url.includes('youtu.be')) return Play
    return Film
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
            {showAdd ? <><X size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Fermer</> : <><Plus size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Ajouter</>}
          </Button>
        )}
      />

      {/* Formulaire ajout */}
      {showAdd && canAdd && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Ajouter une ressource</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[['pdf', FileText, 'PDF'],['video', Video, 'Vidéo']].map(([tab, Icon, lbl]) => (
              <button key={tab} onClick={() => setAddTab(tab)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12,
                cursor: 'pointer', fontWeight: 600,
                border: addTab === tab ? `2px solid ${'var(--primary)'}` : '1px solid var(--border)',
                background: addTab === tab ? 'var(--primary-bg)' : 'transparent',
                color: addTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
              }}><Icon size={13} /> {lbl}</button>
            ))}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Titre *</label>
            <input value={form.titre} onChange={e => setForm(p => ({ ...p, titre: e.target.value }))}
              placeholder={addTab === 'pdf' ? 'Ex : Programme de reprise' : 'Ex : Match vs RC Metz B'}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {addTab === 'pdf' ? (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Fichier PDF</label>
              <div onClick={() => document.getElementById('file-input').click()}
                style={{ border: file ? `2px solid ${'var(--success)'}` : '1.5px dashed var(--border)', borderRadius: 12, padding: 16, textAlign: 'center', cursor: 'pointer', background: file ? 'var(--success-bg)' : 'var(--bg-secondary)' }}>
                {file ? <CheckCircle2 size={26} color={'var(--success)'} style={{ marginBottom: 6 }} /> : <Upload size={26} color="var(--text-muted)" style={{ marginBottom: 6 }} />}
                <p style={{ fontSize: 12, color: file ? 'var(--success)' : 'var(--text-secondary)', fontWeight: file ? 600 : 400 }}>
                  {file ? file.name : 'Appuyer pour choisir un PDF'}
                </p>
              </div>
              <input id="file-input" type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; setFile(f); if (!form.titre) setForm(p => ({ ...p, titre: f.name.replace('.pdf', '') })) }} />
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Lien YouTube ou Vimeo</label>
              <input type="url" value={form.url} onChange={e => checkVideoUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                style={{ width: '100%', padding: '8px 10px', border: `0.5px solid ${videoValid ? 'var(--success)' : 'var(--border)'}`, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              {videoValid && <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Lien valide</p>}
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Catégorie</label>
            <select value={form.categorie} onChange={e => setForm(p => ({ ...p, categorie: e.target.value }))}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
              <option value="general">Général (visible par tous)</option>
              <option value="match">Lié à un match</option>
              <option value="seance">Lié à une séance</option>
            </select>
          </div>

          {form.categorie !== 'general' && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Événement associé</label>
              <select value={form.evenement_id} onChange={e => setForm(p => ({ ...p, evenement_id: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                <option value="">— Choisir —</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.titre}</option>)}
              </select>
            </div>
          )}

          <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleSave} disabled={uploading}>
            {uploading ? 'Publication...' : <><Upload size={13} /> Publier</>}
          </Button>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[['pdf', FileText, 'Documents PDF'],['video', Video, 'Vidéos']].map(([tab, Icon, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid var(--border)',
            background: activeTab === tab ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === tab ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl}</button>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une ressource..."
          style={{ width: '100%', padding: '8px 12px 8px 34px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }} />
      </div>

      {loading ? <Spinner /> : (
        Object.keys(grouped).length === 0 ? (
          <Card>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
              {search ? `Aucune ressource pour "${search}"` : 'Aucune ressource pour l\'instant.'}
              {canAdd && !search && <><br /><span style={{ color: 'var(--primary)' }}>Clique sur "+ Ajouter".</span></>}
            </p>
          </Card>
        ) : (
          Object.entries(grouped).map(([groupe, items]) => (
            <div key={groupe}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 5 }}>
                {groupe === 'Général' ? <Folder size={11} /> : <Swords size={11} />} {groupe}
              </p>
              <Card style={{ padding: '4px 14px' }}>
                {items.map((r, i) => {
                  const VideoIcon = getVideoIcon(r.url)
                  return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < items.length - 1 ? '0.5px solid var(--bg-secondary)' : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: r.type === 'pdf' ? 'var(--danger-bg)' : 'var(--primary-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {r.type === 'pdf' ? <FileText size={17} color={'var(--danger)'} /> : <VideoIcon size={17} color={'var(--primary)'} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {r.type === 'pdf' ? 'PDF' : r.url?.includes('youtube') || r.url?.includes('youtu.be') ? 'YouTube' : 'Vimeo'}
                        {' · '}{new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {r.url && (
                        <a href={r.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', flexShrink: 0, textDecoration: 'none', display: 'flex' }}>
                          {r.type === 'pdf' ? <Download size={17} /> : <ExternalLink size={17} />}
                        </a>
                      )}
                      {canAdd && (
                        <button onClick={() => deleteRessource(r.id)}
                          style={{ border: 'none', background: 'var(--danger-bg)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', display: 'flex' }}><Trash2 size={12} color={'var(--danger)'} /></button>
                      )}
                    </div>
                  </div>
                  )
                })}
              </Card>
            </div>
          ))
        )
      )}
    </div>
  )
}
