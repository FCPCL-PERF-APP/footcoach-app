import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Input, Select, Spinner } from '../components/UI'

export default function RessourcesPage() {
  const { isCoach } = useAuth()
  const [activeTab, setActiveTab] = useState('pdf')
  const [ressources, setRessources] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ titre: '', type: 'pdf', url: '', categorie: 'general', evenement_id: '' })
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: res }, { data: evs }] = await Promise.all([
      supabase.from('ressources').select('*, evenements(titre)').order('created_at', { ascending: false }),
      supabase.from('evenements').select('id,titre,type').order('date_heure', { ascending: false }).limit(20)
    ])
    setRessources(res || [])
    setEvents(evs || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.titre) return
    setUploading(true)
    let url = form.url

    if (file && form.type === 'pdf') {
      const path = `pdfs/${Date.now()}_${file.name}`
      const { data, error } = await supabase.storage.from('ressources').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('ressources').getPublicUrl(path)
        url = urlData.publicUrl
      }
    }

    await supabase.from('ressources').insert({
      titre: form.titre, type: form.type, url,
      categorie: form.categorie,
      evenement_id: form.evenement_id || null
    })
    setUploading(false)
    setShowAdd(false)
    setForm({ titre: '', type: 'pdf', url: '', categorie: 'general', evenement_id: '' })
    setFile(null)
    loadData()
  }

  const pdfs = ressources.filter(r => r.type === 'pdf')
  const videos = ressources.filter(r => r.type === 'video')
  const displayed = activeTab === 'pdf' ? pdfs : videos

  const grouped = displayed.reduce((acc, r) => {
    const key = r.categorie === 'general' ? 'Général' : r.evenements?.titre || 'Autre'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  function getVideoIcon(url = '') {
    if (url.includes('youtube') || url.includes('youtu.be')) return '▶️'
    if (url.includes('vimeo')) return '🎬'
    return '🎥'
  }

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title="Ressources"
        action={isCoach && (
          <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '✕' : '+ Ajouter'}
          </Button>
        )}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['pdf','📄 Documents PDF'], ['video','🎬 Vidéos']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? '#185FA5' : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {/* Formulaire ajout */}
      {showAdd && isCoach && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {activeTab === 'pdf' ? '📄 Déposer un PDF' : '🎬 Ajouter une vidéo'}
          </p>
          <Input label="Titre" value={form.titre} onChange={v => setForm(p => ({ ...p, titre: v }))} placeholder="Ex : Programme de reprise 2025-26" />

          {activeTab === 'pdf' ? (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Fichier PDF</label>
              <div style={{ border: '1px dashed #D1D5DB', borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer', background: '#F9FAFB' }}
                onClick={() => document.getElementById('file-input').click()}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>📤</div>
                <p style={{ fontSize: 12, color: '#6B7280' }}>{file ? file.name : 'Appuyer pour choisir un PDF'}</p>
                <p style={{ fontSize: 10, color: '#9CA3AF' }}>Max 20 Mo</p>
              </div>
              <input id="file-input" type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={e => { setFile(e.target.files[0]); setForm(p => ({ ...p, titre: p.titre || e.target.files[0]?.name.replace('.pdf','') })) }} />
            </div>
          ) : (
            <>
              <Input label="Lien YouTube ou Vimeo" value={form.url} onChange={v => setForm(p => ({ ...p, url: v }))} placeholder="https://youtube.com/watch?v=..." />
              {form.url && (form.url.includes('youtube') || form.url.includes('vimeo') || form.url.includes('youtu.be')) && (
                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#3B6D11' }}>
                  ✅ Lien valide détecté
                </div>
              )}
            </>
          )}

          <Select label="Catégorie" value={form.categorie} onChange={v => setForm(p => ({ ...p, categorie: v }))}
            options={[
              { value: 'general', label: 'Général (visible par tous)' },
              { value: 'match', label: 'Lié à un match' },
              { value: 'seance', label: 'Lié à une séance' },
            ]} />

          {form.categorie !== 'general' && (
            <Select label="Événement associé" value={form.evenement_id} onChange={v => setForm(p => ({ ...p, evenement_id: v }))}
              options={[{ value: '', label: '— Choisir un événement —' }, ...events.map(e => ({ value: e.id, label: `${e.type === 'match' ? '⚽' : '🏃'} ${e.titre}` }))]} />
          )}

          <Button variant="primary" style={{ width: '100%', marginTop: 4 }} onClick={handleSave} disabled={uploading}>
            {uploading ? 'Publication...' : '📤 Publier'}
          </Button>
        </Card>
      )}

      {loading ? <Spinner /> : (
        Object.keys(grouped).length === 0 ? (
          <Card>
            <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
              Aucune ressource pour l'instant.{isCoach && ' Clique sur "+ Ajouter" pour commencer.'}
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
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 0',
                    borderBottom: i < items.length - 1 ? '0.5px solid #F3F4F6' : 'none'
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      background: r.type === 'pdf' ? '#FCEBEB' : '#E6F1FB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16
                    }}>
                      {r.type === 'pdf' ? '📄' : getVideoIcon(r.url)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>
                        {r.type === 'pdf' ? 'PDF' : r.url?.includes('youtube') ? 'YouTube' : 'Vimeo'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" style={{ color: '#185FA5', fontSize: 18, flexShrink: 0, textDecoration: 'none' }}>
                        {r.type === 'pdf' ? '⬇️' : '↗️'}
                      </a>
                    )}
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
