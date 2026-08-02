import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { bornesSaison } from '../lib/saison'
import { Card, Spinner } from '../components/UI'
import { CAT_COLORS } from '../theme'
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarRange, X, Trash2, Check } from 'lucide-react'

// Entraînement/Championnat/Coupe/Amical sont recalculés depuis evenements (source
// unique de vérité) — jamais stockés ici, pour ne jamais se désynchroniser d'une
// séance ou d'un match déplacé. Les 3 types de match partagent une même famille de
// teinte (jaune → orange → marron), du plus léger (amical) au plus fort (championnat),
// pour bien les regrouper visuellement comme "matchs" ; l'entraînement reste à part.
const MATCH_CATS = {
  entrainement: { label: 'Entraînement', color: CAT_COLORS.blue.color, bg: CAT_COLORS.blue.bg },
  amical:       { label: 'Match amical', color: '#78350F', bg: '#F0DFCB' },
  coupe:        { label: 'Coupe',        color: '#C2410C', bg: '#FFEDD5' },
  championnat:  { label: 'Championnat',  color: '#A16207', bg: '#FEF9C3' },
}

// Catégories placées à la main par le staff, une par ligne de calendrier_jours,
// éventuellement sur une plage de plusieurs jours. Toutes en teintes pastel neutres
// exprès : ce ne sont pas des "événements" à mettre en valeur comme un match, juste
// des repères de période — mais chacune avec une teinte distincte (gris / sable /
// bleu-gris) pour rester lisible entre elles.
const MANUAL_CATS = {
  vacances_scolaires: { label: 'Vacances scolaires',  color: '#6B7280', bg: '#ECEDF0' },
  jour_ferie:         { label: 'Jour férié',           color: '#92795E', bg: '#F3ECDF' },
  semaine_coupure:    { label: 'Semaine de coupure',   color: '#3F6B85', bg: '#DCE6EC' },
}

function toISODate(d) { return format(d, 'yyyy-MM-dd') }

export default function CalendrierGeneralPage() {
  const { isStaff } = useAuth()
  const [loading, setLoading] = useState(true)
  const [seasonStart, setSeasonStart] = useState(null)
  const [matchesByDate, setMatchesByDate] = useState({})
  const [joursManuel, setJoursManuel] = useState([])
  const [editingDate, setEditingDate] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { year } = bornesSaison()
    const debut = new Date(year, 6, 1)
    const fin = new Date(year + 1, 5, 30)
    setSeasonStart(debut)

    const [{ data: evs }, { data: jours }] = await Promise.all([
      supabase.from('evenements').select('id, titre, type, match_type, date_heure')
        .gte('date_heure', debut.toISOString()).lte('date_heure', fin.toISOString())
        .order('date_heure', { ascending: true }),
      supabase.from('calendrier_jours').select('*')
        .lte('date_debut', toISODate(fin)).gte('date_fin', toISODate(debut)),
    ])

    let nChamp = 0, nCoupe = 0
    const map = {}
    for (const ev of (evs || [])) {
      const dateStr = ev.date_heure.slice(0, 10)
      let kind, label
      if (ev.type === 'seance') { kind = 'entrainement'; label = '' }
      else if (ev.match_type === 'coupe') { nCoupe++; kind = 'coupe'; label = `CDF${nCoupe}` }
      else if (ev.match_type === 'preparation') { kind = 'amical'; label = 'Amical' }
      else { nChamp++; kind = 'championnat'; label = `J${nChamp}` }
      // Un match l'emporte sur un entraînement le même jour (rare, mais un match
      // prime visuellement sur une séance dans une vue d'ensemble de saison).
      if (map[dateStr] && map[dateStr].kind !== 'entrainement' && kind === 'entrainement') continue
      map[dateStr] = { kind, label, evId: ev.id, titre: ev.titre }
    }
    setMatchesByDate(map)
    setJoursManuel(jours || [])
    setLoading(false)
  }

  // Un jour peut être couvert par deux périodes en même temps (ex. la semaine de
  // coupure tombe pendant les vacances de Noël) — renvoie toutes celles qui
  // s'appliquent à cette date, pas seulement la première trouvée.
  function findManuelsForDate(dateStr) {
    return joursManuel.filter(j => j.date_debut <= dateStr && j.date_fin >= dateStr)
  }

  function findManuelForDate(dateStr) {
    return findManuelsForDate(dateStr)[0]
  }

  function handleDayClick(dateStr, hasMatch) {
    if (hasMatch || !isStaff) return
    setEditingDate(dateStr)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  const months = Array.from({ length: 12 }, (_, i) => addMonths(seasonStart, i))

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}>
        <CalendarRange size={17} color="var(--primary)" /> Calendrier général
      </h1>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Vue d'ensemble de la saison{isStaff ? ' — touche un jour pour le marquer.' : '.'}
      </p>

      {/* Légende */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...Object.entries(MATCH_CATS), ...Object.entries(MANUAL_CATS)].map(([key, info]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, background: info.bg, color: info.color, borderRadius: 20, padding: '3px 8px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: info.color, display: 'inline-block' }} />
              {info.label}
            </span>
          ))}
        </div>
      </Card>

      {months.map(month => (
        <MonthGrid key={month.toISOString()} month={month}
          matchesByDate={matchesByDate} findManuelsForDate={findManuelsForDate}
          onDayClick={handleDayClick} />
      ))}

      {editingDate && (
        <JourSheet date={editingDate} existing={findManuelForDate(editingDate)}
          onClose={() => setEditingDate(null)} onSaved={() => { setEditingDate(null); loadData() }} />
      )}
    </div>
  )
}

function MonthGrid({ month, matchesByDate, findManuelsForDate, onDayClick }) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const startPad = (monthStart.getDay() + 6) % 7

  return (
    <Card style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, textTransform: 'capitalize' }}>
        {format(month, 'MMMM yyyy', { locale: fr })}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>{d}</div>
        ))}
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(day => {
          const dateStr = toISODate(day)
          const match = matchesByDate[dateStr]
          // Un jour peut cumuler plusieurs marquages (ex. semaine de coupure pendant
          // les vacances de Noël) — le remplissage privilégie semaine de coupure
          // (plus spécifique) sinon vacances/férié, et le contour reprend la couleur
          // de la période vacances/férié dès qu'elle s'applique, même si elle n'est
          // pas celle utilisée pour le remplissage (ou qu'un match a lieu ce jour-là).
          const manuels = findManuelsForDate(dateStr)
          const manuelBordure = manuels.find(j => j.categorie === 'vacances_scolaires' || j.categorie === 'jour_ferie')
          const manuelRemplissage = manuels.find(j => j.categorie === 'semaine_coupure') || manuelBordure
          const manuelInfo = manuelRemplissage ? MANUAL_CATS[manuelRemplissage.categorie] : null
          const bordureInfo = manuelBordure ? MANUAL_CATS[manuelBordure.categorie] : null
          const info = match ? MATCH_CATS[match.kind] : manuelInfo
          const c = info || null
          const weekend = isWeekend(day) && !c
          return (
            <div key={dateStr} onClick={() => onDayClick(dateStr, !!match)} style={{
              aspectRatio: '1', borderRadius: 7, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: match ? 'default' : 'pointer',
              background: c ? c.bg : weekend ? 'var(--bg-secondary)' : 'transparent',
              color: c ? c.color : 'var(--text-secondary)',
              fontWeight: c ? 700 : 400,
              boxSizing: 'border-box',
              border: bordureInfo ? `2px solid ${bordureInfo.color}` : 'none'
            }} title={[match?.titre, ...manuels.map(m => m.label || MANUAL_CATS[m.categorie]?.label)].filter(Boolean).join(' · ')}>
              <span>{format(day, 'd')}</span>
              {match && <span style={{ fontSize: 7, lineHeight: 1 }}>{match.label}</span>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function JourSheet({ date, existing, onClose, onSaved }) {
  const [categorie, setCategorie] = useState(existing?.categorie || 'vacances_scolaires')
  const [dateFin, setDateFin] = useState(existing?.date_fin || date)
  const [label, setLabel] = useState(existing?.label || '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const payload = { date_debut: existing?.date_debut || date, date_fin: dateFin, categorie, label: label || null }
    const { error } = existing
      ? await supabase.from('calendrier_jours').update(payload).eq('id', existing.id)
      : await supabase.from('calendrier_jours').insert(payload)
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onSaved()
  }

  async function remove() {
    if (!existing || !window.confirm('Supprimer cette période ?')) return
    await supabase.from('calendrier_jours').delete().eq('id', existing.id)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '18px 18px 0 0', padding: 16, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700 }}>
            {format(new Date(date), 'd MMMM yyyy', { locale: fr })}
          </p>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} color="var(--text-secondary)" /></button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Catégorie</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {Object.entries(MANUAL_CATS).map(([key, info]) => {
            const c = info
            const active = categorie === key
            return (
              <button key={key} onClick={() => setCategorie(key)} style={{
                fontSize: 11, padding: '6px 10px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${active ? c.color : 'var(--border)'}`,
                background: active ? c.bg : 'transparent', color: active ? c.color : 'var(--text-secondary)',
                fontWeight: active ? 700 : 400
              }}>{info.label}</button>
            )
          })}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Jusqu'au (pour une période de plusieurs jours)</p>
        <input type="date" value={dateFin} min={existing?.date_debut || date} onChange={e => setDateFin(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />

        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Précision (optionnel)</p>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex : Vacances de la Toussaint"
          style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />

        <div style={{ display: 'flex', gap: 8 }}>
          {existing && (
            <button onClick={remove} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--danger-bg)', color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}><Trash2 size={14} /></button>
          )}
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: 'var(--gradient)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {saving ? 'Enregistrement...' : <><Check size={14} /> Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  )
}
