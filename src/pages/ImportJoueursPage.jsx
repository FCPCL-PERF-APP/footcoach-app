import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { ArrowLeft, Upload, FolderOpen, ClipboardList, Link2, AlertTriangle, Check, PartyPopper, ArrowRight } from 'lucide-react'

export default function ImportJoueursPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [csvData, setCsvData] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const DB_FIELDS = [
    { key: 'nom', label: 'Nom *', required: true },
    { key: 'prenom', label: 'Prénom *', required: true },
    { key: 'poste', label: 'Poste' },
    { key: 'numero', label: 'Numéro' },
    { key: 'groupe', label: 'Groupe/Pôle' },
    { key: 'date_naissance', label: 'Date naissance' },
    { key: 'licence', label: 'N° Licence' },
    { key: 'pied', label: 'Pied fort' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
    { key: 'taille', label: 'Taille (cm)' },
    { key: 'poids', label: 'Poids (kg)' },
  ]

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return { headers: [], rows: [] }
    // Détecte le séparateur (virgule, point-virgule ou tabulation)
    const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ','
    const headers = lines[0].split(sep).map(h => h.trim().replace(/"/g, ''))
    const rows = lines.slice(1).map(line =>
      line.split(sep).map(cell => cell.trim().replace(/"/g, ''))
    ).filter(row => row.some(cell => cell.length > 0))
    return { headers, rows }
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev.target.result)
        if (!headers.length) { setError('Fichier vide ou format non reconnu.'); return }
        setHeaders(headers)
        setCsvData(rows)
        // Auto-mapping intelligent
        const autoMap = {}
        const matchWords = {
          nom: ['nom','name','lastname','surname'],
          prenom: ['prenom','prénom','firstname','first'],
          poste: ['poste','position','pos'],
          numero: ['numero','numéro','num','number','n°'],
          groupe: ['groupe','group','pole','pôle','equipe'],
          date_naissance: ['naissance','birth','dob','né','date'],
          licence: ['licence','license'],
          pied: ['pied','foot'],
          telephone: ['tel','phone','mobile','portable'],
          email: ['mail','email'],
          taille: ['taille','height','cm'],
          poids: ['poids','weight','kg'],
        }
        for (const [dbKey, words] of Object.entries(matchWords)) {
          const found = headers.find(h =>
            words.some(w => h.toLowerCase().includes(w))
          )
          if (found) autoMap[dbKey] = found
        }
        setMapping(autoMap)
        setStep(2)
      } catch (err) {
        setError('Erreur de lecture du fichier.')
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function handleImport() {
    if (!mapping.nom || !mapping.prenom) {
      setError('Tu dois mapper au minimum Nom et Prénom.')
      return
    }
    setImporting(true)
    let success = 0, errors = 0

    for (const row of csvData) {
      const rowObj = {}
      headers.forEach((h, i) => rowObj[h] = row[i] || '')

      const joueur = {}
      for (const field of DB_FIELDS) {
        const csvCol = mapping[field.key]
        if (csvCol && rowObj[csvCol]) {
          let val = rowObj[csvCol]
          if (field.key === 'numero' || field.key === 'taille') {
            const parsed = parseInt(val)
            val = Number.isNaN(parsed) ? null : parsed
          }
          if (field.key === 'poids') {
            const parsed = parseFloat(val)
            val = Number.isNaN(parsed) ? null : parsed
          }
          if (field.key === 'nom') val = val.toUpperCase()
          joueur[field.key] = val
        }
      }

      if (!joueur.nom || !joueur.prenom) { errors++; continue }
      if (!joueur.groupe) joueur.groupe = 'A'

      const { error } = await supabase.from('joueurs').insert(joueur)
      if (error) errors++
      else success++
    }

    setImporting(false)
    setResult({ success, errors, total: csvData.length })
    setStep(3)
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => navigate('/joueurs')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={THEME.primary} /></button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Import Excel / CSV</h1>
      </div>

      {/* Étapes */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[1,2,3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? THEME.primary : '#E5E7EB', transition: 'background .3s' }} />
        ))}
      </div>

      {/* ÉTAPE 1 — Upload */}
      {step === 1 && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Upload size={14} color={THEME.primary} /> Importer ton fichier</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Exporte ton Excel en CSV depuis Excel (Fichier → Enregistrer sous → CSV) puis importe-le ici.
          </p>

          <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 11, color: 'var(--text-secondary)' }}>
            <p style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><ClipboardList size={11} /> Format attendu :</p>
            <p>Le fichier doit avoir une ligne d'en-tête avec les noms des colonnes.</p>
            <p style={{ marginTop: 4 }}>Colonnes reconnues automatiquement : <strong>Nom, Prénom, Poste, Numéro, Groupe, Date naissance, Licence, Pied, Téléphone, Email, Taille, Poids</strong></p>
          </div>

          <div onClick={() => document.getElementById('csv-input').click()}
            style={{ border: '2px dashed #D1D5DB', borderRadius: 12, padding: 24, textAlign: 'center', cursor: 'pointer', background: '#FAFAFA' }}>
            <FolderOpen size={28} color="#9CA3AF" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, fontWeight: 500 }}>Appuyer pour choisir un fichier</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>CSV ou Excel exporté en CSV</p>
          </div>
          <input id="csv-input" type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleFile} />

          {error && <p style={{ color: THEME.danger, fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={12} /> {error}</p>}
        </Card>
      )}

      {/* ÉTAPE 2 — Mapping */}
      {step === 2 && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={14} color={THEME.primary} /> Associer les colonnes</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {csvData.length} joueur(s) détecté(s). Vérifie que chaque champ est bien associé à la bonne colonne.
          </p>

          {DB_FIELDS.map(field => (
            <div key={field.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: field.required ? 600 : 400 }}>
                {field.label}
              </p>
              <select
                value={mapping[field.key] || ''}
                onChange={e => setMapping(p => ({ ...p, [field.key]: e.target.value }))}
                style={{ padding: '6px 8px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="">— Ignorer —</option>
                {headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}

          {/* Aperçu */}
          {csvData.length > 0 && (
            <div style={{ background: '#F9FAFB', borderRadius: 8, padding: 10, marginTop: 10, marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Aperçu — 3 premiers joueurs :</p>
              {csvData.slice(0,3).map((row, i) => {
                const obj = {}
                headers.forEach((h, j) => obj[h] = row[j])
                return (
                  <p key={i} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                    {i+1}. {obj[mapping.nom] || '?'} {obj[mapping.prenom] || '?'}
                    {mapping.poste && obj[mapping.poste] ? ` · ${obj[mapping.poste]}` : ''}
                  </p>
                )
              })}
            </div>
          )}

          {error && <p style={{ color: THEME.danger, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={12} /> {error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => setStep(1)}><ArrowLeft size={12} /> Retour</Button>
            <Button variant="primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleImport} disabled={importing}>
              {importing ? `Import en cours...` : <><Check size={13} /> Importer {csvData.length} joueur(s)</>}
            </Button>
          </div>
        </Card>
      )}

      {/* ÉTAPE 3 — Résultat */}
      {step === 3 && result && (
        <Card>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ marginBottom: 12 }}>
              {result.errors === 0 ? <PartyPopper size={44} color={THEME.success} /> : <AlertTriangle size={44} color={THEME.warning} />}
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              {result.errors === 0 ? 'Import réussi !' : 'Import terminé avec des erreurs'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '16px 0' }}>
              <div style={{ background: THEME.successBg, borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: THEME.success }}>{result.success}</div>
                <div style={{ fontSize: 11, color: THEME.success }}>Importés</div>
              </div>
              <div style={{ background: result.errors > 0 ? THEME.dangerBg : '#F3F4F6', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: result.errors > 0 ? THEME.danger : '#6B7280' }}>{result.errors}</div>
                <div style={{ fontSize: 11, color: result.errors > 0 ? THEME.danger : '#6B7280' }}>Erreurs</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button style={{ flex: 1 }} onClick={() => { setStep(1); setCsvData([]); setHeaders([]); setMapping({}); setResult(null) }}>
                Nouvel import
              </Button>
              <Button variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => navigate('/joueurs')}>
                Voir l'effectif <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
