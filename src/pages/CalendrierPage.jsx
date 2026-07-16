import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { savePresenceOrQueue, flushQueue, getQueueCount } from '../lib/offlineQueue'
import { useAuth } from '../hooks/useAuth'
import { Card, Badge, Button, Input, Select, Spinner } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO, isAfter, isBefore } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarDays, Repeat, Plus, X, Pencil, Trash2, MapPin, Clock, Send, Hourglass,
  CheckCircle2, RefreshCw, XCircle, Bandage, BarChart3, Heart, Radio, Copy,
  Swords, Footprints, History, WifiOff, Save, Check, Circle
} from 'lucide-react'

export default function CalendrierPage() {
  const { isCoach, isAdjoint, isJoueur, profile } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [filterType, setFilterType] = useState('tous')
  const [filterPeriode, setFilterPeriode] = useState('avenir')
  const [selectedPastEvent, setSelectedPastEvent] = useState('')
  const [editingEvent, setEditingEvent] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState({
    type: 'match', titre: '', date: '', heure: '15:00',
    lieu: '', domicile: true, rdv_heure: '14:00', rdv_lieu: '',
    match_type: 'championnat'
  })
  const [saving, setSaving] = useState(false)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => { loadEvents() }, [])

  // Synchronise les présences saisies hors-ligne (ex: au stade, en zone blanche) dès
  // que la page se charge, en plus du flush automatique déclenché au retour réseau.
  useEffect(() => {
    if (!isJoueur) return
    flushQueue('presences').then(() => setQueueCount(getQueueCount('presences')))
    function onQueueChange() { setQueueCount(getQueueCount('presences')) }
    window.addEventListener('fc-offline-queue-changed', onQueueChange)
    return () => window.removeEventListener('fc-offline-queue-changed', onQueueChange)
  }, [isJoueur])

  async function loadEvents() {
    setLoading(true)
    const { data } = await supabase.from('evenements').select('*').order('date_heure', { ascending: true })
    setEvents(data || [])
    setLoading(false)
  }

  async function saveEvent() {
    if (!form.titre || !form.date) return
    setSaving(true)
    const payload = {
      type: form.type, titre: form.titre,
      date_heure: `${form.date}T${form.heure}:00`,
      lieu: form.lieu, domicile: form.domicile,
      rdv_heure: form.type === 'match' ? form.rdv_heure : null,
      rdv_lieu: form.type === 'match' ? form.rdv_lieu : null,
      match_type: form.type === 'match' ? form.match_type : null,
    }
    const { error } = editingEvent
      ? await supabase.from('evenements').update(payload).eq('id', editingEvent.id)
      : await supabase.from('evenements').insert(payload)
    setSaving(false)
    if (error) {
      alert('Erreur lors de l\'enregistrement : ' + error.message)
      return
    }
    setShowAdd(false); setEditingEvent(null)
    setForm({ type: 'match', titre: '', date: '', heure: '15:00', lieu: '', domicile: true, rdv_heure: '14:00', rdv_lieu: '' })
    loadEvents()
  }

  function startEdit(ev) {
    setEditingEvent(ev)
    setForm({
      type: ev.type, titre: ev.titre,
      date: ev.date_heure?.split('T')[0] || '',
      heure: ev.date_heure?.split('T')[1]?.slice(0,5) || '15:00',
      lieu: ev.lieu || '', domicile: ev.domicile !== false,
      rdv_heure: ev.rdv_heure || '14:00', rdv_lieu: ev.rdv_lieu || '',
      match_type: ev.match_type || 'championnat'
    })
    setShowAdd(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteEvent(ev) {
    const { error } = await supabase.from('evenements').delete().eq('id', ev.id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    setDeleteConfirm(null); loadEvents()
  }

  function duplicateEvent(ev) {
    setEditingEvent(null)
    setForm({
      type: ev.type, titre: ev.titre,
      date: ev.date_heure?.split('T')[0] || '',
      heure: ev.date_heure?.split('T')[1]?.slice(0,5) || '15:00',
      lieu: ev.lieu || '', domicile: ev.domicile !== false,
      rdv_heure: ev.rdv_heure || '14:00', rdv_lieu: ev.rdv_lieu || '',
      match_type: ev.match_type || 'championnat'
    })
    setShowAdd(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = events.filter(e => filterType === 'tous' || e.type === filterType)
  const upcoming = filtered.filter(e => isAfter(parseISO(e.date_heure), new Date()))
  const past = filtered.filter(e => isBefore(parseISO(e.date_heure), new Date())).reverse()

  // Initialiser l'événement passé sélectionné
  useEffect(() => {
    if (past.length > 0 && !selectedPastEvent) setSelectedPastEvent(past[0].id)
  }, [past.length])

  const selectedPastEventData = past.find(e => e.id === selectedPastEvent)

  function formatEventLabel(ev) {
    if (!ev) return ''
    const dateStr = ev.date_heure ? format(parseISO(ev.date_heure), 'd MMM yyyy', { locale: fr }) : ''
    return `${ev.titre} — ${dateStr}`
  }

  return (
    <div style={{ padding: 12 }}>
      {queueCount > 0 && (
        <div style={{ background: THEME.warningBg, color: '#854F0B', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 8, marginBottom: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <WifiOff size={13} /> {queueCount} présence(s) en attente de synchronisation
        </div>
      )}
      {/* Modal suppression */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 340 }}>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Supprimer cet événement ?</p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}><strong>{deleteConfirm.titre}</strong> sera définitivement supprimé.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: 10, border: '0.5px solid #D1D5DB', borderRadius: 10, cursor: 'pointer', background: 'transparent', fontSize: 13 }}>Annuler</button>
              <button onClick={() => deleteEvent(deleteConfirm)} style={{ flex: 1, padding: 10, border: 'none', borderRadius: 10, cursor: 'pointer', background: '#A32D2D', color: '#fff', fontSize: 13, fontWeight: 600 }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Agenda</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate('/calendrier-visuel')} style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <CalendarDays size={13} /> Vue mois
          </button>
          {isCoach && <button onClick={() => setShowRecurring(!showRecurring)} style={{ padding: '5px 10px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Repeat size={14} />
          </button>}
          {isCoach && <button onClick={() => { setEditingEvent(null); setShowAdd(!showAdd) }}
            style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: THEME.primary, color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            {showAdd && !editingEvent ? <X size={13} /> : <><Plus size={13} /> Ajouter</>}
          </button>}
        </div>
      </div>

      {/* Filtres type */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['tous','match','seance'].map(f => (
          <button key={f} onClick={() => setFilterType(f)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: filterType === f ? THEME.primaryBg : 'transparent',
            color: filterType === f ? THEME.primary : '#6B7280',
            fontWeight: filterType === f ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}>
            {f === 'match' && <Swords size={12} />}
            {f === 'seance' && <Footprints size={12} />}
            {f === 'tous' ? 'Tous' : f === 'match' ? 'Matchs' : 'Séances'}
          </button>
        ))}
      </div>

      {/* Filtres période */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['avenir', CalendarDays, 'À venir'],['passes', History, 'Passés']].map(([p, Icon, lbl]) => (
          <button key={p} onClick={() => setFilterPeriode(p)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: `0.5px solid ${filterPeriode === p ? THEME.primary : '#D1D5DB'}`,
            background: filterPeriode === p ? THEME.primaryBg : 'transparent',
            color: filterPeriode === p ? THEME.primary : '#6B7280',
            fontWeight: filterPeriode === p ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl} ({p === 'avenir' ? upcoming.length : past.length})</button>
        ))}
      </div>

      {/* Formulaire coach */}
      {showAdd && isCoach && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            {editingEvent ? <><Pencil size={14} /> Modifier l'événement</> : 'Nouvel événement'}
          </p>
          <Select label="Type" value={form.type} onChange={v => setForm(p => ({...p, type: v}))}
            options={[{value:'match',label:'Match'},{value:'seance',label:'Séance'}]} />
          <Input label="Adversaire / Intitulé" value={form.titre} onChange={v => setForm(p => ({...p, titre: v}))} placeholder="vs FC Nancy R" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input label="Date" type="date" value={form.date} onChange={v => setForm(p => ({...p, date: v}))} />
            <Input label="Heure" type="time" value={form.heure} onChange={v => setForm(p => ({...p, heure: v}))} />
          </div>
          <Input label="Lieu" value={form.lieu} onChange={v => setForm(p => ({...p, lieu: v}))} placeholder="Stade municipal..." />
          {form.type === 'match' && (
            <>
              <Select label="Domicile / Déplacement" value={form.domicile ? 'dom' : 'dep'}
                onChange={v => setForm(p => ({...p, domicile: v === 'dom'}))}
                options={[{value:'dom',label:'Domicile'},{value:'dep',label:'Déplacement'}]} />
              <Select label="Type de match" value={form.match_type || 'championnat'}
                onChange={v => setForm(p => ({...p, match_type: v}))}
                options={[
                  {value:'championnat',label:'Championnat'},
                  {value:'coupe',label:'Coupe'},
                  {value:'preparation',label:'Préparation'},
                ]} />
              <div style={{ background: THEME.primaryBg, borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: THEME.primary, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={12} /> Rendez-vous joueurs
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Input label="Heure de RDV" type="time" value={form.rdv_heure} onChange={v => setForm(p => ({...p, rdv_heure: v}))} />
                  <Input label="Lieu de RDV" value={form.rdv_lieu} onChange={v => setForm(p => ({...p, rdv_lieu: v}))} placeholder="Vestiaires..." />
                </div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={saveEvent} disabled={saving}>
              {saving ? '...' : editingEvent ? <><Save size={13} /> Modifier</> : <><Check size={13} /> Créer</>}
            </Button>
            {editingEvent && <Button onClick={() => { setEditingEvent(null); setShowAdd(false) }}>Annuler</Button>}
          </div>
        </Card>
      )}

      {showRecurring && isCoach && <RecurringModal onClose={() => setShowRecurring(false)} onSave={loadEvents} />}

      {loading ? <Spinner /> : (
        <>
          {/* À VENIR — liste ordonnée */}
          {filterPeriode === 'avenir' && (
            upcoming.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucun événement à venir.{isCoach && ' Clique sur "+ Ajouter".'}</p></Card>
            ) : (
              upcoming.map(ev => (
                <EventCard key={ev.id} ev={ev} isCoach={isCoach} isAdjoint={isAdjoint} isJoueur={isJoueur}
                  navigate={navigate} profile={profile}
                  onEdit={startEdit} onDelete={() => setDeleteConfirm(ev)} onDuplicate={duplicateEvent} />
              ))
            )
          )}

          {/* PASSÉS — menu déroulant */}
          {filterPeriode === 'passes' && (
            past.length === 0 ? (
              <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucun événement passé.</p></Card>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Choisir un événement</label>
                  <select value={selectedPastEvent} onChange={e => setSelectedPastEvent(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff' }}>
                    {past.map(ev => (
                      <option key={ev.id} value={ev.id}>{formatEventLabel(ev)}</option>
                    ))}
                  </select>
                </div>
                {selectedPastEventData && (
                  <EventCard ev={selectedPastEventData} isCoach={isCoach} isAdjoint={isAdjoint} isJoueur={isJoueur}
                    navigate={navigate} profile={profile}
                    onEdit={startEdit} onDelete={() => setDeleteConfirm(selectedPastEventData)} onDuplicate={duplicateEvent} past />
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}

function EventCard({ ev, isCoach, isAdjoint, isJoueur, navigate, past = false, profile, onEdit, onDelete, onDuplicate }) {
  const isStaff = isCoach || isAdjoint
  const [presenceCount, setPresenceCount] = useState(null)
  const [convoque, setConvoque] = useState(null)
  const date = parseISO(ev.date_heure)
  const dateStr = format(date, "EEE d MMM · HH'h'mm", { locale: fr })

  useEffect(() => {
    if (isStaff) loadPresenceCount()
    if (isJoueur && profile?.id) checkConvocation()
  }, [ev.id])

  async function loadPresenceCount() {
    const { data } = await supabase.from('presences').select('statut').eq('evenement_id', ev.id)
    if (data) setPresenceCount({
      present: data.filter(p => p.statut === 'present').length,
      absent: data.filter(p => p.statut === 'absent').length,
      blesse: data.filter(p => p.statut === 'blesse').length,
      exterieur: data.filter(p => p.statut === 'exterieur').length,
      total: data.length,
      detail: data
    })
  }

  async function checkConvocation() {
    if (ev.type !== 'match') { setConvoque(null); return }
    const { data } = await supabase.from('convocations').select('convoque')
      .eq('evenement_id', ev.id).eq('joueur_id', profile.id).maybeSingle()
    setConvoque(data?.convoque || false)
  }

  // Liseré coloré à gauche pour distinguer les cartes d'un coup d'œil dans la liste
  // (même couleur que le badge type, au lieu d'un simple bloc blanc uniforme).
  const typeColor = ev.type === 'match' ? '#185FA5' : THEME.success

  return (
    <Card style={{ opacity: past ? 0.85 : 1, marginBottom: 10, borderLeft: `3px solid ${typeColor}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          <Badge type={ev.type}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {ev.type === 'match' ? <Swords size={10} /> : <Footprints size={10} />} {ev.type === 'match' ? 'Match' : 'Séance'}
            </span>
          </Badge>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ev.titre}</span>
          {/* Badge convocation joueur */}
          {isJoueur && ev.type === 'match' && convoque !== null && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
              background: convoque ? THEME.primaryBg : '#F3F4F6',
              color: convoque ? THEME.primary : '#9CA3AF',
              display: 'inline-flex', alignItems: 'center', gap: 4
            }}>
              {convoque ? <Send size={10} /> : <Hourglass size={10} />} {convoque ? 'Convoqué' : 'Non convoqué'}
            </span>
          )}
        </div>
        {isCoach && (
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <button onClick={() => onEdit(ev)} style={{ border: 'none', background: 'rgba(24,95,165,.1)', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', display: 'flex' }}><Pencil size={12} color={THEME.primary} /></button>
            <button onClick={() => onDelete(ev)} style={{ border: 'none', background: THEME.dangerBg, borderRadius: 6, padding: '4px 7px', cursor: 'pointer', display: 'flex' }}><Trash2 size={12} color={THEME.danger} /></button>
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <CalendarDays size={11} color={THEME.primary} /> {dateStr}{ev.type === 'match' ? (ev.domicile ? ' · Domicile' : ' · Déplacement') : ''}
      </p>
      {ev.lieu && <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} color={CAT_COLORS.violet.color} /> {ev.lieu}</p>}
      {ev.type === 'match' && ev.rdv_heure && (
        <p style={{ fontSize: 11, color: THEME.primary, marginBottom: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> RDV {ev.rdv_heure}{ev.rdv_lieu ? ` · ${ev.rdv_lieu}` : ''}
        </p>
      )}

      {/* Résumé présences staff */}
      {isStaff && presenceCount !== null && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, padding: '6px 10px', background: '#F9FAFB', borderRadius: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: THEME.success, display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={11} /> {presenceCount.present}</span>
          {presenceCount.exterieur > 0 && <span style={{ fontSize: 11, color: THEME.primary, display: 'flex', alignItems: 'center', gap: 3 }}><RefreshCw size={11} /> {presenceCount.exterieur}</span>}
          <span style={{ fontSize: 11, color: THEME.danger, display: 'flex', alignItems: 'center', gap: 3 }}><XCircle size={11} /> {presenceCount.absent}</span>
          <span style={{ fontSize: 11, color: THEME.warning, display: 'flex', alignItems: 'center', gap: 3 }}><Bandage size={11} /> {presenceCount.blesse}</span>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>· {presenceCount.total} réponse(s)</span>
        </div>
      )}

      {/* Boutons STAFF (coach + adjoint/préparateur/gardien) — icône colorée par
          catégorie pour les distinguer d'un coup d'œil, au lieu d'une rangée de
          pilules grises identiques. */}
      {isStaff && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {isCoach && ev.type === 'match' && <Button size="sm" onClick={() => navigate(`/convocations/${ev.id}`)}><Send size={11} color={CAT_COLORS.blue.color} style={{ marginRight: 4, verticalAlign: -2 }} />Convocations</Button>}
          <Button size="sm" onClick={() => navigate(`/presences/${ev.id}`)}><CheckCircle2 size={11} color={THEME.success} style={{ marginRight: 4, verticalAlign: -2 }} />Présences</Button>
          {ev.type === 'match' && <Button size="sm" onClick={() => navigate(`/stats/${ev.id}`)}><BarChart3 size={11} color={CAT_COLORS.purple.color} style={{ marginRight: 4, verticalAlign: -2 }} />Stats</Button>}
          <Button size="sm" onClick={() => navigate(`/rpe?event=${ev.id}`)}><Heart size={11} color={CAT_COLORS.rose.color} style={{ marginRight: 4, verticalAlign: -2 }} />RPE</Button>
          <Button size="sm" onClick={() => navigate(`/footbar?event=${ev.id}`)}><Radio size={11} color={CAT_COLORS.orange.color} style={{ marginRight: 4, verticalAlign: -2 }} />Footbar</Button>
          {isCoach && <Button size="sm" onClick={() => onDuplicate(ev)}><Copy size={11} color={CAT_COLORS.slate.color} style={{ marginRight: 4, verticalAlign: -2 }} />Dupliquer</Button>}
        </div>
      )}

      {/* Actions JOUEUR */}
      {isJoueur && <JoueurEventActions ev={ev} navigate={navigate} profile={profile} convoque={convoque} />}
    </Card>
  )
}

function JoueurEventActions({ ev, navigate, profile, convoque }) {
  const [statut, setStatut] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wasQueued, setWasQueued] = useState(false)

  useEffect(() => { if (profile?.id) loadStatut() }, [ev.id, profile?.id])

  async function loadStatut() {
    setLoading(true)
    const { data } = await supabase.from('presences').select('statut')
      .eq('evenement_id', ev.id).eq('joueur_id', profile?.id).maybeSingle()
    setStatut(data?.statut || null)
    setLoading(false)
  }

  async function handleStatut(newStatut) {
    if (!profile?.id) return
    setSaving(true)
    setWasQueued(false)
    let result
    try {
      result = await savePresenceOrQueue(ev.id, profile.id, newStatut)
    } catch (err) {
      setSaving(false)
      alert('Erreur lors de la mise à jour de ta présence : ' + err.message)
      return
    }
    setStatut(newStatut)
    setWasQueued(result.queued)
    // Hors-ligne : pas la peine d'appeler l'API, elle échouerait de toute façon — le
    // coach sera notifié dès que la présence sera synchronisée normalement.
    if (!result.queued) {
      try {
        await fetch('/api/notif-presence-resume', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ eventId: ev.id })
        })
      } catch (err) { console.error(err) }
    }
    setSaving(false)
    if (result.queued) setTimeout(() => setWasQueued(false), 4000)
  }

  const isMatch = ev.type === 'match'

  // Statuts selon le type d'événement — le code couleur reste la source d'info
  // principale (vert/bleu/rouge/orange), l'icône vient en renfort visuel.
  const STATUTS_SEANCE = [
    { key: 'present',   label: 'Présent',   icon: CheckCircle2, bg: THEME.successBg, color: THEME.success, border: THEME.success },
    { key: 'exterieur', label: 'Extérieur', icon: RefreshCw,    bg: THEME.primaryBg, color: THEME.primary, border: THEME.primary },
    { key: 'absent',    label: 'Absent',    icon: XCircle,      bg: THEME.dangerBg,  color: THEME.danger,  border: THEME.danger },
    { key: 'blesse',    label: 'Blessé',    icon: Bandage,      bg: THEME.warningBg, color: '#854F0B',     border: '#854F0B' },
  ]
  const STATUTS_MATCH = [
    { key: 'present', label: 'Présent', icon: CheckCircle2, bg: THEME.successBg, color: THEME.success, border: THEME.success },
    { key: 'absent',  label: 'Absent',  icon: XCircle,      bg: THEME.dangerBg,  color: THEME.danger,  border: THEME.danger },
    { key: 'blesse',  label: 'Blessé',  icon: Bandage,      bg: THEME.warningBg, color: '#854F0B',     border: '#854F0B' },
  ]

  const STATUTS = isMatch ? STATUTS_MATCH : STATUTS_SEANCE

  // Le joueur peut remplir RPE/Footbar si présent ou extérieur
  const peutRemplir = statut === 'present' || statut === 'exterieur'
  const estEmpêche = statut === 'absent' || statut === 'blesse'

  // Si c'est un match et pas convoqué → message informatif
  if (isMatch && convoque === false) {
    return (
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #F3F4F6' }}>
        <div style={{ background: '#F3F4F6', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: '#9CA3AF', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <Hourglass size={12} /> Tu n'es pas convoqué pour ce match
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid #F3F4F6' }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 6 }}>
        {isMatch ? 'Ma présence au match :' : 'Ma présence à l\'entraînement :'}
      </p>

      {wasQueued && (
        <div style={{ background: THEME.warningBg, borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: '#854F0B', textAlign: 'center', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <WifiOff size={12} /> Pas de réseau — sera synchronisé automatiquement
        </div>
      )}

      {loading ? <p style={{ fontSize: 11, color: '#9CA3AF' }}>Chargement...</p> : (
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: isMatch ? 'nowrap' : 'wrap' }}>
          {STATUTS.map(s => (
            <button key={s.key} onClick={() => handleStatut(s.key)} disabled={saving} style={{
              flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: isMatch ? 10 : 11,
              border: `1.5px solid ${statut === s.key ? s.border : '#E5E7EB'}`,
              background: statut === s.key ? s.bg : 'transparent',
              color: statut === s.key ? s.color : '#9CA3AF',
              fontWeight: statut === s.key ? 600 : 400,
              cursor: saving ? 'not-allowed' : 'pointer', transition: 'all .15s',
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
            }}><s.icon size={isMatch ? 11 : 12} /> {s.label}</button>
          ))}
        </div>
      )}

      {/* Extérieur info */}
      {statut === 'exterieur' && (
        <div style={{ background: THEME.primaryBg, borderRadius: 8, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: THEME.primary, display: 'flex', alignItems: 'center', gap: 5 }}>
          <RefreshCw size={12} /> Entraînement extérieur — RPE et Footbar disponibles
        </div>
      )}

      {/* Bloqué si absent/blessé */}
      {estEmpêche && (
        <div style={{ background: statut === 'blesse' ? THEME.warningBg : THEME.dangerBg, borderRadius: 8, padding: '7px 10px', fontSize: 11,
          color: statut === 'blesse' ? '#854F0B' : THEME.danger, display: 'flex', alignItems: 'center', gap: 5 }}>
          {statut === 'blesse' ? <><Bandage size={12} /> Tu es blessé — pas de RPE ni Footbar requis.</> : <><XCircle size={12} /> Tu es absent — pas de RPE ni Footbar requis.</>}
        </div>
      )}

      {/* Bouton RPE + Footbar si présent ou extérieur */}
      {peutRemplir && (
        <button onClick={() => navigate('/mon-suivi')}
          style={{ width: '100%', padding: '7px 4px', borderRadius: 8, fontSize: 11, border: '0.5px solid #D1D5DB', background: 'transparent', cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Heart size={12} color={CAT_COLORS.rose.color} /> RPE / <Radio size={12} color={CAT_COLORS.orange.color} /> Footbar
        </button>
      )}

      {/* Statut de forme avant la séance */}
      {(statut === 'present' || statut === 'exterieur') && (
        <FormeWidget evenementId={ev.id} joueurId={profile?.id} />
      )}

      {/* Pas encore répondu */}
      {!statut && !loading && (
        <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 4 }}>
          Indique ta présence pour accéder au RPE et Footbar
        </p>
      )}
    </div>
  )
}

function FormeWidget({ evenementId, joueurId }) {
  const [forme, setForme] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('forme_joueur').select('forme')
      .eq('evenement_id', evenementId).eq('joueur_id', joueurId).maybeSingle()
      .then(({ data }) => { if (data) setForme(data.forme) })
  }, [evenementId, joueurId])

  async function saveForme(val) {
    setSaving(true)
    setForme(val)
    const { data: existing } = await supabase.from('forme_joueur').select('id')
      .eq('evenement_id', evenementId).eq('joueur_id', joueurId).maybeSingle()
    if (existing?.id) {
      await supabase.from('forme_joueur').update({ forme: val }).eq('id', existing.id)
    } else {
      await supabase.from('forme_joueur').insert({ evenement_id: evenementId, joueur_id: joueurId, forme: val })
    }
    setSaving(false)
  }

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', background: '#F9FAFB', borderRadius: 10 }}>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Comment tu te sens aujourd'hui ?</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {[[THEME.success, 'bien', 'Bien'], [THEME.warning, 'moyen', 'Moyen'], [THEME.danger, 'fatigue', 'Fatigué']].map(([dotColor, val, label]) => (
          <button key={val} onClick={() => saveForme(val)} style={{
            flex: 1, padding: '6px 4px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
            border: `1.5px solid ${forme === val ? THEME.primary : '#E5E7EB'}`,
            background: forme === val ? THEME.primaryBg : 'transparent',
            fontSize: 11, fontWeight: forme === val ? 600 : 400,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
          }}>
            <Circle size={9} fill={dotColor} color={dotColor} /> {label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RecurringModal({ onClose, onSave }) {
  const [form, setForm] = useState({ titre: 'Entraînement', jour: '2', heure: '19:30', lieu: '', dateDebut: '', dateFin: '' })
  const JOURS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  const [saving, setSaving] = useState(false)
  const iStyle = { width: '100%', padding: '8px 10px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }

  async function handleSave() {
    if (!form.titre || !form.dateDebut || !form.dateFin) return
    setSaving(true)
    const start = new Date(form.dateDebut), end = new Date(form.dateFin)
    const jourNum = parseInt(form.jour), seances = []
    const current = new Date(start)
    while (current.getDay() !== jourNum) current.setDate(current.getDate() + 1)
    while (current <= end) {
      seances.push({ type: 'seance', titre: form.titre, date_heure: `${current.toISOString().split('T')[0]}T${form.heure}:00`, lieu: form.lieu, domicile: true })
      current.setDate(current.getDate() + 7)
    }
    const { error } = await supabase.from('evenements').insert(seances)
    setSaving(false)
    if (error) {
      alert('Erreur lors de la création des séances : ' + error.message)
      return
    }
    alert(`${seances.length} séances créées !`)
    onSave(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Repeat size={15} color={THEME.primary} /> Séances récurrentes
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Intitulé</label><input value={form.titre} onChange={e => setForm(p => ({...p, titre: e.target.value}))} style={iStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Jour</label><select value={form.jour} onChange={e => setForm(p => ({...p, jour: e.target.value}))} style={iStyle}>{JOURS.map((j,i) => <option key={i} value={i}>{j}</option>)}</select></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Heure</label><input type="time" value={form.heure} onChange={e => setForm(p => ({...p, heure: e.target.value}))} style={iStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date début</label><input type="date" value={form.dateDebut} onChange={e => setForm(p => ({...p, dateDebut: e.target.value}))} style={iStyle} /></div>
          <div><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Date fin</label><input type="date" value={form.dateFin} onChange={e => setForm(p => ({...p, dateFin: e.target.value}))} style={iStyle} /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 3 }}>Lieu</label><input value={form.lieu} onChange={e => setForm(p => ({...p, lieu: e.target.value}))} placeholder="Terrain 1" style={iStyle} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, background: THEME.gradient, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Création...' : 'Créer toutes les séances'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', background: '#F3F4F6', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Annuler</button>
        </div>
      </div>
    </div>
  )
}
