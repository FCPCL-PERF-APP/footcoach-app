import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Button, Spinner, IconTile } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Download, Users, Heart, Radio, Swords, Calendar, Lightbulb } from 'lucide-react'

function toCSV(headers, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.map(escape).join(';'), ...rows.map(r => r.map(escape).join(';'))].join('\n')
}

function downloadCSV(content, filename) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function ExportDonneesPage() {
  const [loading, setLoading] = useState(false)
  const [counts, setCounts] = useState({})

  useEffect(() => { loadCounts() }, [])

  async function loadCounts() {
    const [{ count: nj }, { count: nr }, { count: nf }, { count: ns }, { count: ne }] = await Promise.all([
      supabase.from('joueurs').select('*', { count: 'exact', head: true }),
      supabase.from('rpe').select('*', { count: 'exact', head: true }),
      supabase.from('footbar').select('*', { count: 'exact', head: true }),
      supabase.from('stats_match').select('*', { count: 'exact', head: true }),
      supabase.from('evenements').select('*', { count: 'exact', head: true }),
    ])
    setCounts({ joueurs: nj, rpe: nr, footbar: nf, stats: ns, evenements: ne })
  }

  async function exportJoueurs() {
    setLoading(true)
    const { data } = await supabase.from('joueurs').select('*').order('nom')
    const headers = ['Nom','Prénom','Poste','Numéro','Groupe','Date naissance','Licence','Pied','Téléphone','Email','Taille','Poids','VMA','FC max','FC repos']
    const rows = (data || []).map(j => [j.nom, j.prenom, j.poste, j.numero, j.groupe, j.date_naissance, j.licence, j.pied, j.telephone, j.email, j.taille, j.poids, j.vma, j.fc_max, j.fc_repos])
    downloadCSV(toCSV(headers, rows), `FCPCL_joueurs_${format(new Date(), 'dd-MM-yyyy')}.csv`)
    setLoading(false)
  }

  async function exportRPE() {
    setLoading(true)
    const { data } = await supabase.from('rpe').select('*, joueurs(nom,prenom), evenements(titre,date_heure,type)').order('created_at', { ascending: false })
    const headers = ['Joueur','Événement','Type','Date','Difficulté','Fatigue','Implication','Motivation','Perf. indiv.','Perf. coll.','Commentaire']
    const rows = (data || []).map(r => [
      `${r.joueurs?.nom} ${r.joueurs?.prenom}`,
      r.evenements?.titre,
      r.evenements?.type,
      r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'dd/MM/yyyy', { locale: fr }) : '',
      r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective, r.commentaire
    ])
    downloadCSV(toCSV(headers, rows), `FCPCL_RPE_${format(new Date(), 'dd-MM-yyyy')}.csv`)
    setLoading(false)
  }

  async function exportFootbar() {
    setLoading(true)
    const { data } = await supabase.from('footbar').select('*, joueurs(nom,prenom), evenements(titre,date_heure)').order('created_at', { ascending: false })
    const headers = ['Joueur','Événement','Date','Distance (km)','Sprint max (km/h)','Nb sprints','Haute intensité (m)','Temps jeu (min)','Nb ballons','Nb passes','Nb tirs']
    const rows = (data || []).map(f => [
      `${f.joueurs?.nom} ${f.joueurs?.prenom}`,
      f.evenements?.titre,
      f.evenements?.date_heure ? format(parseISO(f.evenements.date_heure), 'dd/MM/yyyy', { locale: fr }) : '',
      f.distance_km, f.sprint_max, f.sprints, f.distance_hi, f.temps_jeu, f.ballons_touches, f.nb_passes, f.nb_tirs
    ])
    downloadCSV(toCSV(headers, rows), `FCPCL_Footbar_${format(new Date(), 'dd-MM-yyyy')}.csv`)
    setLoading(false)
  }

  async function exportStats() {
    setLoading(true)
    const { data } = await supabase.from('stats_match').select('*, joueurs(nom,prenom), evenements(titre,date_heure)').order('created_at', { ascending: false })
    const headers = ['Joueur','Match','Date','Note','Temps jeu (min)','Buts','Passes déc.','Titulaire','Carton jaune','Carton rouge']
    const rows = (data || []).map(s => [
      `${s.joueurs?.nom} ${s.joueurs?.prenom}`,
      s.evenements?.titre,
      s.evenements?.date_heure ? format(parseISO(s.evenements.date_heure), 'dd/MM/yyyy', { locale: fr }) : '',
      s.note, s.temps_jeu, s.buts, s.passes_decisives,
      s.titulaire ? 'Oui' : 'Non',
      s.carton_jaune ? 'Oui' : 'Non',
      s.carton_rouge ? 'Oui' : 'Non'
    ])
    downloadCSV(toCSV(headers, rows), `FCPCL_Stats_${format(new Date(), 'dd-MM-yyyy')}.csv`)
    setLoading(false)
  }

  async function exportPresences() {
    setLoading(true)
    const { data } = await supabase.from('presences').select('*, joueurs(nom,prenom), evenements(titre,date_heure,type)').order('created_at', { ascending: false })
    const headers = ['Joueur','Événement','Type','Date','Statut']
    const rows = (data || []).map(p => [
      `${p.joueurs?.nom} ${p.joueurs?.prenom}`,
      p.evenements?.titre,
      p.evenements?.type,
      p.evenements?.date_heure ? format(parseISO(p.evenements.date_heure), 'dd/MM/yyyy', { locale: fr }) : '',
      p.statut
    ])
    downloadCSV(toCSV(headers, rows), `FCPCL_Presences_${format(new Date(), 'dd-MM-yyyy')}.csv`)
    setLoading(false)
  }

  const exports = [
    { icon: Users, cat: 'blue', label: 'Joueurs', sub: `${counts.joueurs || 0} joueur(s)`, fn: exportJoueurs },
    { icon: Heart, cat: 'rose', label: 'Données RPE', sub: `${counts.rpe || 0} entrée(s)`, fn: exportRPE },
    { icon: Radio, cat: 'orange', label: 'Données Footbar', sub: `${counts.footbar || 0} entrée(s)`, fn: exportFootbar },
    { icon: Swords, cat: 'amber', label: 'Stats match', sub: `${counts.stats || 0} entrée(s)`, fn: exportStats },
    { icon: Calendar, cat: 'blue', label: 'Présences', sub: `Tous les événements`, fn: exportPresences },
  ]

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Download size={18} /> Export données</span>} />

      <div style={{ background: THEME.primaryBg, borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, color: THEME.primary, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <Lightbulb size={13} style={{ flexShrink: 0, marginTop: 1 }} /> Les fichiers exportés sont au format <strong>CSV</strong> — ouvrable directement dans Excel ou Google Sheets.
      </div>

      {exports.map(({ icon, cat, label, sub, fn }) => (
        <Card key={label} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IconTile icon={icon} color={CAT_COLORS[cat].color} bg={CAT_COLORS[cat].bg} size={19} tileSize={42} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{label}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</p>
              </div>
            </div>
            <button onClick={fn} disabled={loading} style={{
              padding: '8px 14px', borderRadius: 10, border: 'none',
              background: THEME.gradient, color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 5
            }}>
              {loading ? '...' : <><Download size={12} /> CSV</>}
            </button>
          </div>
        </Card>
      ))}
    </div>
  )
}
