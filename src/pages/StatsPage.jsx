import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, authHeaders } from '../lib/supabase'
import { upsertOrQueue, flushQueue, getQueueCount } from '../lib/offlineQueue'
import { validateFile } from '../lib/upload'
import { Card, Button, Input, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  ArrowLeft, CheckCircle2, User, BarChart3, Swords, FileText,
  Save, Share2, ThumbsUp, AlertTriangle, Goal, Shield, WifiOff, ImagePlus, X, Loader2,
  Target, Plus, Trash2
} from 'lucide-react'

const STATS_QUEUE_TABLES = ['stats_match', 'stats_collectives', 'rapports_match']
function statsQueueCount() {
  return STATS_QUEUE_TABLES.reduce((sum, t) => sum + getQueueCount(t), 0)
}

// Liste exhaustive des champs du formulaire "Stats collectives" — sert aussi de liste
// blanche au moment de l'enregistrement (cf. saveStatsCollectives) : loadData() fait
// setFormCollectif(p => ({ ...p, ...sc })) avec la ligne existante en base, qui contient
// aussi id/evenement_id/created_at. Sans cette liste blanche, ces colonnes internes se
// glissaient dans le payload renvoyé et created_at (un timestamp) se faisait tronquer
// en entier par erreur ("2026"), que Postgres refusait pour une colonne timestamp.
const FORM_COLLECTIF_INITIAL = {
  buts_marques: '', buts_encaisses: '',
  score_mi_temps: '', score_final: '',
  // Sert de base au calcul du temps de jeu depuis les changements de la chronologie
  // (Suivi live) — 90' par défaut si laissé vide.
  duree_match: '',
  // Buts marqués par type
  but_marque_attaque_placee: '', but_marque_contre_attaque: '',
  but_marque_corner: '', but_marque_penalty: '', but_marque_coup_franc: '',
  // Buts encaissés par type
  but_enc_attaque_placee: '', but_enc_contre_attaque: '',
  but_enc_corner: '', but_enc_penalty: '', but_enc_coup_franc: '',
  // Buts par période
  buts_0_15: '', buts_15_30: '', buts_30_45: '',
  buts_45_60: '', buts_60_75: '', buts_75_90: '',
  // Buts encaissés par période
  buts_enc_0_15: '', buts_enc_15_30: '', buts_enc_30_45: '',
  buts_enc_45_60: '', buts_enc_60_75: '', buts_enc_75_90: '',
}

const FORMATIONS = {
  '4-4-2': {
    label: '1-4-4-2',
    positions: [
      { id: 'GK', label: 'GB', x: 50, y: 88 },
      { id: 'RB', label: 'DD', x: 82, y: 72 }, { id: 'CB1', label: 'DC', x: 62, y: 70 },
      { id: 'CB2', label: 'DC', x: 38, y: 70 }, { id: 'LB', label: 'DG', x: 18, y: 72 },
      { id: 'RM', label: 'MD', x: 82, y: 50 }, { id: 'CM1', label: 'MC', x: 62, y: 48 },
      { id: 'CM2', label: 'MC', x: 38, y: 48 }, { id: 'LM', label: 'MG', x: 18, y: 50 },
      { id: 'ST1', label: 'ATT', x: 62, y: 25 }, { id: 'ST2', label: 'ATT', x: 38, y: 25 },
    ]
  },
  '4-2-3-1': {
    label: '1-4-2-3-1',
    positions: [
      { id: 'GK', label: 'GB', x: 50, y: 88 },
      { id: 'RB', label: 'DD', x: 82, y: 72 }, { id: 'CB1', label: 'DC', x: 62, y: 70 },
      { id: 'CB2', label: 'DC', x: 38, y: 70 }, { id: 'LB', label: 'DG', x: 18, y: 72 },
      { id: 'DM1', label: 'MDef', x: 60, y: 54 }, { id: 'DM2', label: 'MDef', x: 40, y: 54 },
      { id: 'RAM', label: 'MOD', x: 78, y: 36 }, { id: 'CAM', label: 'MOC', x: 50, y: 34 },
      { id: 'LAM', label: 'MOG', x: 22, y: 36 },
      { id: 'ST', label: 'ATT', x: 50, y: 18 },
    ]
  },
  '3-5-2': {
    label: '1-3-5-2',
    positions: [
      { id: 'GK', label: 'GB', x: 50, y: 88 },
      { id: 'CB1', label: 'DC', x: 70, y: 72 }, { id: 'CB2', label: 'DC', x: 50, y: 70 },
      { id: 'CB3', label: 'DC', x: 30, y: 72 },
      { id: 'RM', label: 'PD', x: 88, y: 50 }, { id: 'CM1', label: 'MC', x: 66, y: 48 },
      { id: 'CM2', label: 'MC', x: 50, y: 46 }, { id: 'CM3', label: 'MC', x: 34, y: 48 },
      { id: 'LM', label: 'PG', x: 12, y: 50 },
      { id: 'ST1', label: 'ATT', x: 62, y: 25 }, { id: 'ST2', label: 'ATT', x: 38, y: 25 },
    ]
  },
}

// Emplacement pour un schéma tactique (photo, ex. slide PowerPoint exportée en image).
// Composant au niveau module (pas imbriqué dans StatsPage) pour éviter que React ne
// démonte/remonte l'input à chaque re-render — cf. le bug clavier corrigé sur
// FicheJoueurPage.jsx pour la même raison.
function SchemaField({ label, value, uploading, onUpload, onRemove }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
      {value ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img src={value} alt={label} onClick={() => window.open(value, '_blank')}
            style={{ maxWidth: 160, maxHeight: 160, borderRadius: 10, border: '0.5px solid var(--border)', cursor: 'zoom-in', display: 'block' }} />
          <button onClick={onRemove} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
            background: 'var(--danger)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10,
          border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {uploading ? <Loader2 size={14} style={{ animation: 'fc-schema-spin 0.8s linear infinite' }} /> : <ImagePlus size={14} />}
          {uploading ? 'Envoi...' : 'Ajouter un schéma (photo)'}
          <input type="file" accept="image/*" hidden disabled={uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />
        </label>
      )}
      <style>{`@keyframes fc-schema-spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// Types d'événements de la chronologie live — mêmes items que le carnet papier (but
// pour/contre, cartons, changement) + une case libre.
const CHRONO_TYPES = {
  but_pour:     { label: 'But pour',       color: 'var(--success)', bg: 'var(--success-bg)' },
  but_contre:   { label: 'But contre',     color: 'var(--danger)', bg: 'var(--danger-bg)' },
  carton_jaune: { label: 'Carton jaune',   color: '#A16207', bg: '#FEF9C3' },
  carton_rouge: { label: 'Carton rouge',   color: 'var(--danger)', bg: 'var(--danger-bg)' },
  changement:   { label: 'Changement',     color: 'var(--primary)', bg: 'var(--primary-bg)' },
  autre:        { label: 'Autre',          color: 'var(--text-secondary)', bg: 'var(--bg-secondary)' },
}

// Mêmes catégories que "Buts marqués/encaissés — par type" dans l'onglet Collectif —
// choisir la phase sur un but de la chronologie alimente directement ces compteurs, au
// lieu de les ressaisir séparément.
const PHASES_BUT = [
  { key: 'attaque_placee', label: 'Attaque placée' },
  { key: 'contre_attaque', label: 'Contre-attaque' },
  { key: 'corner',         label: 'Corner' },
  { key: 'penalty',        label: 'Penalty' },
  { key: 'coup_franc',     label: 'Coup franc' },
]

// Découpage en périodes de 15' — identique à "Buts marqués/encaissés — par période"
// dans l'onglet Collectif, déduit automatiquement de la minute saisie sur l'événement.
function periodeButs(minute, prefix) {
  const m = minute || 0
  // Bornes inclusives sur la fin de période — un but à la 45' (souvent le cas, fin de
  // 1ère mi-temps/temps additionnel) doit tomber dans la période 30-45, pas 45-60 qui
  // est en réalité le début de la 2nde mi-temps (46').
  if (m <= 15) return `${prefix}0_15`
  if (m <= 30) return `${prefix}15_30`
  if (m <= 45) return `${prefix}30_45`
  if (m <= 60) return `${prefix}45_60`
  if (m <= 75) return `${prefix}60_75`
  return `${prefix}75_90`
}

export default function StatsPage() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [joueurs, setJoueurs] = useState([])
  const [statsIndiv, setStatsIndiv] = useState([])
  const [activeTab, setActiveTab] = useState('individuel')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [formation, setFormation] = useState('4-4-2')
  const [compo, setCompo] = useState({})
  // Remplaçants (numéros 12 à 16) — juste pour savoir qui est sur le banc, distinct de
  // `compo` (qui ne doit contenir que les titulaires : recomputeFromChronologie s'en
  // sert pour déduire qui a commencé le match).
  const [banc, setBanc] = useState(['', '', '', '', ''])

  const [formIndiv, setFormIndiv] = useState({})
  const [selectedJoueur, setSelectedJoueur] = useState('')
  const [formJ, setFormJ] = useState({ note: '', temps_jeu: '', buts: 0, passes_decisives: 0, titulaire: true, carton_jaune: false, carton_rouge: false })

  const [formCollectif, setFormCollectif] = useState({ ...FORM_COLLECTIF_INITIAL })

  const [formRapport, setFormRapport] = useState({
    causerie: '', animation_offensive: '', animation_defensive: '',
    points_positifs_off: '', problemes_off: '',
    points_positifs_def: '', problemes_def: '',
    points_forts_globaux: '', points_faibles_globaux: '',
    compo_adversaire: '', arbitre: '',
    // Schémas tactiques (photos, ex. slides PowerPoint exportées) — complètent le texte
    // pour tout ce qui se lit mieux en image qu'en description écrite.
    schema_animation_offensive: '', schema_animation_defensive: '',
    schema_cpa_corner_pour: '', schema_cpa_corner_contre: '', schema_cpa_interieur: '',
    schema_compo_adverse: '', joueurs_a_surveiller: '',
    // Suivi en direct pendant le match — remplace le carnet papier rempli en tribune :
    // croix de placement (supériorités de zone) + chronologie horodatée + notes de
    // mi-temps, avant la synthèse "Après-match" une fois le match terminé.
    terrain_marks: [], chronologie: [],
    recap_mi_temps: '', mt_axes_amelioration: '', mt_projection: '', mt_note_adjoint: '',
    notes_libres: '',
  })
  const [uploadingSchema, setUploadingSchema] = useState(null)
  const [schemaError, setSchemaError] = useState('')

  // Suivi live — couleur active pour la prochaine croix posée sur le terrain, et
  // formulaire d'ajout d'un événement à la chronologie.
  const [markTeam, setMarkTeam] = useState('nous')
  const [chronoForm, setChronoForm] = useState({
    minute: '', type: 'but_pour', description: '',
    buteur_id: '', passeur_id: '', phase: '', joueur_id: '', sortant_id: '', entrant_id: ''
  })

  const [queueCount, setQueueCount] = useState(0)

  // Ignore une réponse devenue obsolète si le coach navigue vers un autre match avant
  // qu'elle ne revienne.
  const eventIdRef = useRef(eventId)

  useEffect(() => { eventIdRef.current = eventId; loadData() }, [eventId])

  // Synchronise les stats/rapport saisis hors-ligne (au stade, en zone blanche) dès que
  // la page se charge, en plus du flush automatique déclenché au retour réseau.
  useEffect(() => {
    Promise.all(STATS_QUEUE_TABLES.map(t => flushQueue(t))).then(() => setQueueCount(statsQueueCount()))
    function onQueueChange() { setQueueCount(statsQueueCount()) }
    window.addEventListener('fc-offline-queue-changed', onQueueChange)
    return () => window.removeEventListener('fc-offline-queue-changed', onQueueChange)
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: ev }, { data: jrs }, { data: si }, { data: sc }, { data: rp }] = await Promise.all([
      supabase.from('evenements').select('*').eq('id', eventId).single(),
      supabase.from('joueurs').select('id,nom,prenom,poste,numero,photo_url').order('nom'),
      supabase.from('stats_match').select('*').eq('evenement_id', eventId),
      supabase.from('stats_collectives').select('*').eq('evenement_id', eventId).maybeSingle(),
      supabase.from('rapports_match').select('*').eq('evenement_id', eventId).maybeSingle(),
    ])
    if (eventIdRef.current !== eventId) return
    setEvent(ev)
    setJoueurs(jrs || [])
    setStatsIndiv(si || [])
    if (sc) setFormCollectif(p => ({ ...p, ...sc }))
    if (rp) {
      setFormRapport(p => ({ ...p, ...rp }))
      setFormation(rp.formation || '4-4-2')
      // Toujours réinitialisés (pas de `if (rp.xxx)` conditionnel) — sinon en changeant
      // d'événement vers un match dont la Compo n'a jamais été remplie, l'état gardait
      // par erreur la compo/le banc du match précédent (contaminait le calcul du temps
      // de jeu de recomputeFromChronologie).
      setCompo(rp.compo_visuelle || {})
      setBanc(rp.banc || ['', '', '', '', ''])
    } else {
      setFormation('4-4-2'); setCompo({}); setBanc(['', '', '', '', ''])
    }
    if (jrs?.length) setSelectedJoueur(jrs[0].id)
    setLoading(false)
  }

  // Calcule résultat depuis le score
  const scoreMarques = parseInt(formCollectif.buts_marques) || 0
  const scoreEncaisses = parseInt(formCollectif.buts_encaisses) || 0
  const resultat = scoreMarques > scoreEncaisses ? 'V' : scoreMarques < scoreEncaisses ? 'D' : 'N'
  const resultatColors = { V: 'var(--success)', N: 'var(--warning)', D: 'var(--danger)' }
  const resultatLabels = { V: 'Victoire', N: 'Match nul', D: 'Défaite' }

  // Seuls ces deux champs sont du texte libre ("1 - 0") — tous les autres champs de
  // formCollectif sont des colonnes numériques : un champ laissé vide reste une chaîne
  // vide '' dans le state (input contrôlé), que Postgres refuse pour une colonne
  // entière ("invalid input syntax for type integer"), il faut donc convertir en null.
  const CHAMPS_TEXTE_COLLECTIF = new Set(['score_mi_temps', 'score_final'])

  // Dès qu'un fait de jeu est tracé en direct dans la chronologie (Suivi live), les
  // champs correspondants ailleurs (Collectif, Indiv.) deviennent calculés
  // automatiquement et se grisent — sinon (aucun suivi live sur ce match) ils restent
  // modifiables à la main comme avant.
  const chronologieList = formRapport.chronologie || []
  const hasButPourLive = chronologieList.some(e => e.type === 'but_pour')
  const hasButContreLive = chronologieList.some(e => e.type === 'but_contre')
  const hasCartonsLive = chronologieList.some(e => e.type === 'carton_jaune' || e.type === 'carton_rouge')
  // Tout événement qui nomme un joueur (but, passe, carton, changement) peut désormais
  // faire calculer son temps de jeu (cf. recomputeFromChronologie) — pas seulement un
  // changement le concernant directement.
  const hasChangementsLive = chronologieList.some(e => e.type === 'changement' || e.buteur_id || e.passeur_id || e.joueur_id)

  // Modifie le numéro de maillot d'un joueur depuis l'écran Compo (évite d'avoir à
  // aller sur sa fiche pour un profil qui n'a jamais eu de numéro renseigné) : mise à
  // jour immédiate en local pour un retour visuel fluide pendant la saisie, écriture en
  // base seulement à la perte du focus pour ne pas spammer une requête par frappe.
  function updateNumeroLocal(joueurId, valeur) {
    setJoueurs(p => p.map(j => j.id === joueurId ? { ...j, numero: valeur } : j))
  }
  async function persistNumero(joueurId, valeur) {
    const numero = valeur === '' ? null : parseInt(valeur)
    const { error } = await supabase.from('joueurs').update({ numero }).eq('id', joueurId)
    if (error) console.error('Erreur mise à jour numéro:', error)
  }

  async function saveStatsCollectives() {
    setSaving(true)
    const payload = {
      evenement_id: eventId,
      // Object.keys(FORM_COLLECTIF_INITIAL), pas Object.entries(formCollectif) : formCollectif
      // peut contenir des colonnes internes (id, created_at...) fusionnées depuis la ligne
      // existante par loadData(), qu'il ne faut surtout pas renvoyer telles quelles.
      ...Object.fromEntries(Object.keys(FORM_COLLECTIF_INITIAL).map(k => {
        const v = formCollectif[k]
        return [k, CHAMPS_TEXTE_COLLECTIF.has(k) ? (v || null) : (v === '' || v === null || v === undefined ? null : parseInt(v))]
      }))
    }
    let result
    try {
      result = await upsertOrQueue('stats_collectives', payload, 'evenement_id')
    } catch (err) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement : ' + err.message)
      return
    }
    setQueueCount(statsQueueCount())

    // Le calcul des pronostics a besoin du score en base — pas de sens hors-ligne, il se
    // fera de lui-même la prochaine fois que la page sera rouverte avec du réseau.
    if (!result.queued) {
      await calculerPointsPronostics(parseInt(formCollectif.buts_marques) || 0, parseInt(formCollectif.buts_encaisses) || 0)
    }

    setSaving(false); setSaved(true); setSavedOffline(result.queued); setTimeout(() => setSaved(false), 2000)
    if (!result.queued) loadData()
  }

  async function calculerPointsPronostics(butsMarques, butsEncaisses) {
    // Récupérer tous les pronostics pour ce match
    const { data: pronos } = await supabase.from('pronostics')
      .select('*').eq('evenement_id', eventId)
    if (!pronos?.length) return

    // pronostics.score_domicile/score_exterieur représentent l'équipe à domicile/à
    // l'extérieur (au sens propre) : on traduit donc "buts marqués/encaissés par FC PCL"
    // selon que FC PCL joue à domicile ou à l'extérieur pour ce match.
    const scoreReel_dom = event?.domicile !== false ? butsMarques : butsEncaisses
    const scoreReel_ext = event?.domicile !== false ? butsEncaisses : butsMarques

    const tendanceReelle = scoreReel_dom > scoreReel_ext ? 'V' : scoreReel_dom < scoreReel_ext ? 'D' : 'N'

    let echecs = 0
    for (const prono of pronos) {
      const dom = prono.score_domicile
      const ext = prono.score_exterieur
      let pts = 0

      if (dom === scoreReel_dom && ext === scoreReel_ext) {
        pts = 3 // Score exact
      } else {
        const tendanceProno = dom > ext ? 'V' : dom < ext ? 'D' : 'N'
        if (tendanceProno === tendanceReelle) pts = 1 // Bonne tendance
      }

      const { error } = await supabase.from('pronostics').update({ score_points: pts }).eq('id', prono.id)
      if (error) echecs++
    }
    // Une échec isolé ne doit pas empêcher le reste de la saisie du match de
    // s'enregistrer (déjà fait à ce stade) — juste prévenir qu'un pronostic n'a pas
    // été noté, plutôt que de laisser un joueur avec des points manquants sans trace.
    if (echecs > 0) alert(`${echecs} pronostic(s) n'ont pas pu être notés (erreur réseau/serveur). Réessaie en rouvrant cette page.`)
  }

  async function saveStatsJoueur() {
    // Garde-fou anti-double-soumission au niveau de la fonction elle-même (pas
    // seulement via `disabled` sur le bouton) : sans contrainte d'unicité en base sur
    // (evenement_id, joueur_id), deux appels concurrents créeraient deux lignes
    // stats_match pour le même joueur au lieu de mettre à jour la même ligne.
    if (saving) return
    setSaving(true)
    const payload = {
      evenement_id: eventId, joueur_id: selectedJoueur,
      note: formJ.note ? parseFloat(formJ.note) : null,
      temps_jeu: formJ.temps_jeu ? parseInt(formJ.temps_jeu) : null,
      buts: formJ.buts ? parseInt(formJ.buts) : 0,
      passes_decisives: formJ.passes_decisives ? parseInt(formJ.passes_decisives) : 0,
      titulaire: formJ.titulaire, carton_jaune: formJ.carton_jaune, carton_rouge: formJ.carton_rouge,
    }
    let result
    try {
      result = await upsertOrQueue('stats_match', payload, 'evenement_id,joueur_id')
    } catch (err) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement : ' + err.message)
      return
    }
    setQueueCount(statsQueueCount())
    setSaving(false); setSaved(true); setSavedOffline(result.queued); setTimeout(() => setSaved(false), 2000)
    if (!result.queued) loadData()
  }

  // Recalcule Collectif (buts marqués/encaissés, par type et par période) et Indiv.
  // (buts, passes décisives, cartons, temps de jeu, titulaire) à partir de la
  // chronologie — recompté en entier à chaque appel (pas d'incrément/décrément) pour
  // rester juste même après correction ou suppression d'un événement. Ne touche que les
  // champs concernés : si aucun but/carton/changement n'est tracé en live, les champs
  // correspondants restent tels quels, modifiables à la main.
  async function recomputeFromChronologie(chronologie) {
    const entries = chronologie || []
    const butsPour = entries.filter(e => e.type === 'but_pour')
    const butsContre = entries.filter(e => e.type === 'but_contre')
    const cartons = entries.filter(e => e.type === 'carton_jaune' || e.type === 'carton_rouge')

    // --- Stats collectives : buts marqués / encaissés, par type et par période ---
    if (butsPour.length || butsContre.length) {
      const payloadCollectif = { evenement_id: eventId }
      if (butsPour.length) {
        payloadCollectif.buts_marques = butsPour.length
        const phase = { attaque_placee: 0, contre_attaque: 0, corner: 0, penalty: 0, coup_franc: 0 }
        const periode = { buts_0_15: 0, buts_15_30: 0, buts_30_45: 0, buts_45_60: 0, buts_60_75: 0, buts_75_90: 0 }
        for (const e of butsPour) {
          if (e.phase && phase[e.phase] !== undefined) phase[e.phase]++
          periode[periodeButs(e.minute, 'buts_')]++
        }
        payloadCollectif.but_marque_attaque_placee = phase.attaque_placee
        payloadCollectif.but_marque_contre_attaque = phase.contre_attaque
        payloadCollectif.but_marque_corner = phase.corner
        payloadCollectif.but_marque_penalty = phase.penalty
        payloadCollectif.but_marque_coup_franc = phase.coup_franc
        Object.assign(payloadCollectif, periode)
      }
      if (butsContre.length) {
        payloadCollectif.buts_encaisses = butsContre.length
        const phase = { attaque_placee: 0, contre_attaque: 0, corner: 0, penalty: 0, coup_franc: 0 }
        const periode = { buts_enc_0_15: 0, buts_enc_15_30: 0, buts_enc_30_45: 0, buts_enc_45_60: 0, buts_enc_60_75: 0, buts_enc_75_90: 0 }
        for (const e of butsContre) {
          if (e.phase && phase[e.phase] !== undefined) phase[e.phase]++
          periode[periodeButs(e.minute, 'buts_enc_')]++
        }
        payloadCollectif.but_enc_attaque_placee = phase.attaque_placee
        payloadCollectif.but_enc_contre_attaque = phase.contre_attaque
        payloadCollectif.but_enc_corner = phase.corner
        payloadCollectif.but_enc_penalty = phase.penalty
        payloadCollectif.but_enc_coup_franc = phase.coup_franc
        Object.assign(payloadCollectif, periode)
      }
      await supabase.from('stats_collectives').upsert(payloadCollectif, { onConflict: 'evenement_id' })
    }

    // --- Stats individuelles : buts et passes décisives ---
    if (butsPour.length) {
      const buts = {}, passes = {}
      for (const e of butsPour) {
        if (e.buteur_id) buts[e.buteur_id] = (buts[e.buteur_id] || 0) + 1
        if (e.passeur_id) passes[e.passeur_id] = (passes[e.passeur_id] || 0) + 1
      }
      const concernes = new Set([...Object.keys(buts), ...Object.keys(passes), ...statsIndiv.map(s => s.joueur_id)])
      for (const joueurId of concernes) {
        await supabase.from('stats_match').upsert({
          evenement_id: eventId, joueur_id: joueurId,
          buts: buts[joueurId] || 0, passes_decisives: passes[joueurId] || 0,
        }, { onConflict: 'evenement_id,joueur_id' })
      }
    }

    // --- Cartons ---
    if (cartons.length) {
      const jaune = new Set(cartons.filter(e => e.type === 'carton_jaune' && e.joueur_id).map(e => e.joueur_id))
      const rouge = new Set(cartons.filter(e => e.type === 'carton_rouge' && e.joueur_id).map(e => e.joueur_id))
      const concernes = new Set([...jaune, ...rouge, ...statsIndiv.map(s => s.joueur_id)])
      for (const joueurId of concernes) {
        await supabase.from('stats_match').upsert({
          evenement_id: eventId, joueur_id: joueurId,
          carton_jaune: jaune.has(joueurId), carton_rouge: rouge.has(joueurId),
        }, { onConflict: 'evenement_id,joueur_id' })
      }
    }

    // --- Temps de jeu et titulaire ---
    // Un joueur qui marque, passe ou prend un carton a forcément été sur le terrain à ce
    // moment-là, même sans changement le concernant (cas le plus fréquent : un titulaire
    // qui joue le match entier n'apparaît jamais dans un événement "changement"). Chaque
    // joueur mentionné n'importe où dans la chronologie est donc par défaut supposé avoir
    // débuté à la 0' et être resté jusqu'à la fin, sauf indication contraire.
    // Gère aussi les allers-retours (sorti puis rentré plus tard dans le match) : les
    // événements sortant/entrant du joueur sont rejoués dans l'ordre chronologique pour
    // cumuler tous ses passages sur le terrain, pas juste une seule sortie/entrée.
    const titulaireIds = new Set([
      ...Object.values(compo).filter(Boolean),
      ...statsIndiv.filter(s => s.titulaire).map(s => s.joueur_id),
    ])
    const joueursVusEnChrono = new Set()
    const mouvementsParJoueur = {}
    for (const e of entries) {
      for (const id of [e.buteur_id, e.passeur_id, e.joueur_id, e.sortant_id, e.entrant_id]) {
        if (id) joueursVusEnChrono.add(id)
      }
      if (e.type === 'changement') {
        if (e.sortant_id) (mouvementsParJoueur[e.sortant_id] ||= []).push({ minute: e.minute || 0, sens: 'sort' })
        if (e.entrant_id) (mouvementsParJoueur[e.entrant_id] ||= []).push({ minute: e.minute || 0, sens: 'entre' })
      }
    }
    const concernes = new Set([...titulaireIds, ...joueursVusEnChrono])
    if (concernes.size) {
      const duree = parseInt(formCollectif.duree_match) || 90
      for (const joueurId of concernes) {
        const mouvements = (mouvementsParJoueur[joueurId] || []).slice().sort((a, b) => a.minute - b.minute)
        // Titulaire = déjà connu comme tel, ou aucun mouvement "entre" avant un premier
        // mouvement "sort" (on ne peut pas sortir sans avoir déjà commencé le match).
        const titulaire = titulaireIds.has(joueurId) || mouvements[0]?.sens !== 'entre'
        let surLeTerrain = titulaire, depuis = 0, tempsJeu = 0
        for (const m of mouvements) {
          if (m.sens === 'sort' && surLeTerrain) { tempsJeu += Math.max(0, m.minute - depuis); surLeTerrain = false }
          else if (m.sens === 'entre' && !surLeTerrain) { surLeTerrain = true; depuis = m.minute }
        }
        if (surLeTerrain) tempsJeu += Math.max(0, duree - depuis)
        await supabase.from('stats_match').upsert({
          evenement_id: eventId, joueur_id: joueurId,
          temps_jeu: tempsJeu, titulaire,
        }, { onConflict: 'evenement_id,joueur_id' })
      }
    }
  }

  async function saveRapport() {
    setSaving(true)
    const payload = { evenement_id: eventId, ...formRapport, formation, compo_visuelle: compo, banc }
    let result
    try {
      result = await upsertOrQueue('rapports_match', payload, 'evenement_id')
    } catch (err) {
      setSaving(false)
      alert('Erreur lors de l\'enregistrement : ' + err.message)
      return
    }
    setQueueCount(statsQueueCount())
    // Hors-ligne, la synchro se fera à la prochaine ouverture avec réseau, comme pour
    // le calcul des points pronostics (calculerPointsPronostics).
    if (!result.queued) await recomputeFromChronologie(payload.chronologie)
    setSaving(false); setSaved(true); setSavedOffline(result.queued); setTimeout(() => setSaved(false), 2000)
    if (!result.queued) loadData()
  }

  // Schémas tactiques (photos, ex. slides PowerPoint exportées en image) — même bucket
  // Storage "joueurs" que les photos de messagerie, un dossier "rapports" dédié.
  async function uploadSchema(field, file) {
    const err = validateFile(file, 'image')
    if (err) { setSchemaError(err); return }
    setSchemaError('')
    setUploadingSchema(field)
    try {
      const path = `rapports/${eventId}_${field}_${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('joueurs').upload(path, file)
      if (uploadError) { setSchemaError('Erreur envoi photo : ' + uploadError.message); return }
      const { data: urlData } = supabase.storage.from('joueurs').getPublicUrl(path)
      setFormRapport(p => ({ ...p, [field]: urlData.publicUrl }))
    } finally {
      setUploadingSchema(null)
    }
  }

  // Croix de placement sur le terrain (supériorités de zone) — équivalent numérique des
  // croix bleu/adversaire notées à la main sur le carnet papier pendant le match.
  function addMark(x, y) {
    setFormRapport(p => ({ ...p, terrain_marks: [...(p.terrain_marks || []), { x, y, team: markTeam }] }))
  }
  function removeMark(idx) {
    setFormRapport(p => ({ ...p, terrain_marks: (p.terrain_marks || []).filter((_, i) => i !== idx) }))
  }
  function clearMarks() {
    if (!confirm('Effacer toutes les croix du terrain ?')) return
    setFormRapport(p => ({ ...p, terrain_marks: [] }))
  }

  // Chronologie horodatée (minute + événement) — équivalent des ronds annotés à droite
  // du carnet papier (but, carton, changement...). Les précisions (buteur/passeur/phase,
  // joueur carton, sortant/entrant) alimentent directement Collectif et Indiv. à
  // l'enregistrement (cf. recomputeFromChronologie), pour éviter de ressaisir deux fois
  // les mêmes faits de jeu.
  function addChronoEvent() {
    if (chronoForm.minute === '') return
    const entry = { minute: parseInt(chronoForm.minute) || 0, type: chronoForm.type, description: chronoForm.description }
    if (chronoForm.type === 'but_pour') {
      if (chronoForm.buteur_id) entry.buteur_id = chronoForm.buteur_id
      if (chronoForm.passeur_id) entry.passeur_id = chronoForm.passeur_id
      if (chronoForm.phase) entry.phase = chronoForm.phase
    }
    if (chronoForm.type === 'but_contre' && chronoForm.phase) entry.phase = chronoForm.phase
    if ((chronoForm.type === 'carton_jaune' || chronoForm.type === 'carton_rouge') && chronoForm.joueur_id) entry.joueur_id = chronoForm.joueur_id
    if (chronoForm.type === 'changement') {
      if (chronoForm.sortant_id) entry.sortant_id = chronoForm.sortant_id
      if (chronoForm.entrant_id) entry.entrant_id = chronoForm.entrant_id
    }
    setFormRapport(p => ({ ...p, chronologie: [...(p.chronologie || []), entry].sort((a, b) => a.minute - b.minute) }))
    setChronoForm({ minute: '', type: chronoForm.type, description: '', buteur_id: '', passeur_id: '', phase: '', joueur_id: '', sortant_id: '', entrant_id: '' })
  }
  function removeChronoEvent(idx) {
    setFormRapport(p => ({ ...p, chronologie: (p.chronologie || []).filter((_, i) => i !== idx) }))
  }

  async function shareRapportInApp() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: staff } = await supabase.from('staff').select('nom,prenom').eq('auth_id', user?.id).maybeSingle()
    // "Prénom Nom" — cohérent avec le nom affiché dans les notifications push.
    const auteurNom = staff ? `${staff.prenom} ${staff.nom}` : 'Coach'
    const r = resultat
    const contenu = `${event?.titre} — ${r === 'V' ? 'Victoire' : r === 'N' ? 'Nul' : 'Défaite'} ${formCollectif.buts_marques}-${formCollectif.buts_encaisses}\n` +
      (formRapport.points_forts_globaux ? `Points forts : ${formRapport.points_forts_globaux}\n` : '') +
      (formRapport.points_faibles_globaux ? `À améliorer : ${formRapport.points_faibles_globaux}` : '')
    const { error } = await supabase.from('messages').insert({
      expediteur_id: user?.id, expediteur_nom: auteurNom,
      expediteur_role: 'coach', groupe: true, canal: 'general', contenu
    })
    if (error) {
      alert('Erreur lors du partage : ' + error.message)
      return
    }
    // Comme pour un message normal (MessagesPage.jsx) : sans cet appel, personne n'est
    // notifié du résumé, il faut ouvrir la messagerie par hasard pour le découvrir.
    try {
      await fetch('/api/notif-message-groupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ contenu, canal: 'general' })
      })
    } catch (err) { console.error('Erreur notif groupe:', err) }
    alert('Résumé partagé dans le canal groupe !')
  }

  const currentFormation = FORMATIONS[formation]

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // L'événement a pu être supprimé entre le moment où le lien a été ouvert et le
  // chargement (ex: coach qui supprime l'événement pendant qu'un onglet est resté ouvert
  // dessus) — sans ce garde-fou la page continuait de s'afficher avec un événement vide.
  if (!event) return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <p style={{ fontSize: 15, fontWeight: 700 }}>Stats match</p>
      </div>
      <Card style={{ textAlign: 'center', padding: 24 }}>
        <AlertTriangle size={28} color={'var(--warning)'} style={{ marginBottom: 8 }} />
        <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Événement introuvable</p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Il a peut-être été supprimé depuis. Retourne au calendrier.</p>
      </Card>
    </div>
  )

  const tabs = [
    { key: 'individuel', icon: User, label: 'Indiv.' },
    { key: 'collectif',  icon: BarChart3, label: 'Collectif' },
    { key: 'compo',      icon: Swords, label: 'Compo' },
    { key: 'suivi',      icon: Target, label: 'Suivi live' },
    { key: 'rapport',    icon: FileText, label: 'Rapport' },
  ]

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => navigate('/calendrier')} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Stats match</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{event?.titre} · {event?.date_heure ? format(parseISO(event.date_heure), 'd MMM yyyy', { locale: fr }) : ''}</p>
        </div>
      </div>

      {queueCount > 0 && (
        <div style={{ background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 11, fontWeight: 600, padding: '6px 10px', borderRadius: 8, marginBottom: 10, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <WifiOff size={13} /> {queueCount} saisie(s) en attente de synchronisation
        </div>
      )}

      {saved && (
        savedOffline
          ? <div style={{ background: 'var(--warning-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}><WifiOff size={13} /> Pas de réseau — sera synchronisé automatiquement</div>
          : <div style={{ background: 'var(--success-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={13} /> Enregistré !</div>
      )}

      {/* Score + résultat */}
      {(formCollectif.buts_marques !== '' || formCollectif.buts_encaisses !== '') && (
        <div style={{ background: 'var(--gradient)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>FC PCL</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{formCollectif.buts_marques}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: resultatColors[resultat], background: 'rgba(255,255,255,.2)', borderRadius: 8, padding: '3px 10px' }}>
              {resultatLabels[resultat]}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{event?.titre?.replace('vs ', '') || 'Adv.'}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{formCollectif.buts_encaisses}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '5px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            border: '0.5px solid var(--border)',
            background: activeTab === t.key ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === t.key ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === t.key ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><t.icon size={12} /> {t.label}</button>
        ))}
      </div>

      {/* STATS INDIVIDUELLES */}
      {activeTab === 'individuel' && (
        <>
          <Card>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Joueur</label>
              <select value={selectedJoueur} onChange={e => {
                setSelectedJoueur(e.target.value)
                const ex = statsIndiv.find(s => s.joueur_id === e.target.value)
                if (ex) setFormJ({ note: ex.note || '', temps_jeu: ex.temps_jeu || '', buts: ex.buts || 0, passes_decisives: ex.passes_decisives || 0, titulaire: ex.titulaire !== false, carton_jaune: ex.carton_jaune || false, carton_rouge: ex.carton_rouge || false })
                else setFormJ({ note: '', temps_jeu: '', buts: 0, passes_decisives: 0, titulaire: true, carton_jaune: false, carton_rouge: false })
              }} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom} — {j.poste}</option>)}
              </select>
            </div>
            {/* La Note n'est plus saisie ici — elle est désormais calculée automatiquement
                depuis le RPE Coach (moyenne des 4 items, x2 pour rester sur /10), pour ne
                pas noter le joueur deux fois avec deux méthodes différentes. */}
            {selectedJoueur && (
              <div style={{ marginBottom: 10, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Note (calculée via RPE Coach)</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: formJ.note ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {formJ.note ? `${formJ.note}/10` : 'Pas encore évalué'}
                  </p>
                </div>
                <Button size="sm" onClick={() => navigate(`/rpe?event=${eventId}`)}>Évaluer</Button>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
              {[['Temps jeu (min)', 'temps_jeu', '1', hasChangementsLive], ['Buts', 'buts', '1', hasButPourLive], ['Passes déc.', 'passes_decisives', '1', hasButPourLive]].map(([label, field, step, driven]) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
                  <input type="number" step={step} value={formJ[field] || ''} disabled={driven}
                    onChange={e => setFormJ(p => ({...p, [field]: e.target.value}))}
                    style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: driven ? 'var(--bg-secondary)' : 'var(--bg-card)', color: driven ? 'var(--text-muted)' : 'inherit' }} />
                </div>
              ))}
            </div>
            {(hasButPourLive || hasChangementsLive) && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Calculé depuis Suivi live — modifie/supprime l'événement là-bas pour corriger.</p>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: hasChangementsLive ? 'default' : 'pointer', opacity: hasChangementsLive ? .6 : 1 }}>
                <input type="checkbox" checked={formJ.titulaire} disabled={hasChangementsLive} onChange={e => setFormJ(p => ({...p, titulaire: e.target.checked}))} /> Titulaire
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: hasCartonsLive ? 'default' : 'pointer', opacity: hasCartonsLive ? .6 : 1 }}>
                <input type="checkbox" checked={formJ.carton_jaune} disabled={hasCartonsLive} onChange={e => setFormJ(p => ({...p, carton_jaune: e.target.checked}))} />
                <span style={{ width: 9, height: 12, background: 'var(--warning)', borderRadius: 1, display: 'inline-block' }} /> Carton
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: hasCartonsLive ? 'default' : 'pointer', opacity: hasCartonsLive ? .6 : 1 }}>
                <input type="checkbox" checked={formJ.carton_rouge} disabled={hasCartonsLive} onChange={e => setFormJ(p => ({...p, carton_rouge: e.target.checked}))} />
                <span style={{ width: 9, height: 12, background: 'var(--danger)', borderRadius: 1, display: 'inline-block' }} /> Carton
              </label>
            </div>
            <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveStatsJoueur} disabled={saving}><Save size={13} /> Enregistrer</Button>
          </Card>

          {statsIndiv.length > 0 && (
            <Card>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Récap — {statsIndiv.length} joueur(s)</p>
              {statsIndiv.map(s => {
                const j = joueurs.find(j => j.id === s.joueur_id)
                return (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>{j?.nom} {j?.prenom}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {s.temps_jeu}min · {s.titulaire ? 'Titu.' : 'Rempl.'}
                        {s.carton_jaune && <span style={{ width: 8, height: 10, background: 'var(--warning)', borderRadius: 1, display: 'inline-block' }} />}
                        {s.carton_rouge && <span style={{ width: 8, height: 10, background: 'var(--danger)', borderRadius: 1, display: 'inline-block' }} />}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700 }}>{s.note || '—'}</div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Note</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{s.buts || 0}</div><div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Buts</div></div>
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

          {/* Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            {[['Score mi-temps', 'score_mi_temps', 'text'], ['Score final', 'score_final', 'text']].map(([label, field, type]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
                <input type={type} value={formCollectif[field] || ''} onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  placeholder="2-1"
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            {[['Buts marqués', 'buts_marques', hasButPourLive], ['Buts encaissés', 'buts_encaisses', hasButContreLive]].map(([label, field, driven]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
                <input type="number" value={formCollectif[field] || ''} disabled={driven}
                  onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: driven ? 'var(--bg-secondary)' : 'var(--bg-card)', color: driven ? 'var(--text-muted)' : 'inherit' }} />
              </div>
            ))}
          </div>
          {(hasButPourLive || hasButContreLive) && (
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Calculé depuis Suivi live — modifie/supprime l'événement là-bas pour corriger.</p>
          )}
          <Input label="Durée du match (min)" type="number" value={formCollectif.duree_match || ''}
            onChange={v => setFormCollectif(p => ({...p, duree_match: v}))} placeholder="90" />

          {/* Buts marqués par type */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Goal size={13} /> Buts marqués — par type</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
            {[['Att. placée', 'but_marque_attaque_placee'], ['Contre-att.', 'but_marque_contre_attaque'],
              ['Corner', 'but_marque_corner'], ['Pénalty', 'but_marque_penalty'], ['Coup-franc', 'but_marque_coup_franc']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2, textAlign: 'center' }}>{label}</label>
                <input type="number" min="0" value={formCollectif[field] || ''} disabled={hasButPourLive}
                  onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid var(--success)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'center', background: hasButPourLive ? 'var(--bg-secondary)' : 'var(--bg-card)', color: hasButPourLive ? 'var(--text-muted)' : 'inherit' }} />
              </div>
            ))}
          </div>

          {/* Buts encaissés par type */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Shield size={13} /> Buts encaissés — par type</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
            {[['Att. placée', 'but_enc_attaque_placee'], ['Contre-att.', 'but_enc_contre_attaque'],
              ['Corner', 'but_enc_corner'], ['Pénalty', 'but_enc_penalty'], ['Coup-franc', 'but_enc_coup_franc']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2, textAlign: 'center' }}>{label}</label>
                <input type="number" min="0" value={formCollectif[field] || ''} disabled={hasButContreLive}
                  onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 8px', border: '0.5px solid var(--danger)', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', textAlign: 'center', background: hasButContreLive ? 'var(--bg-secondary)' : 'var(--bg-card)', color: hasButContreLive ? 'var(--text-muted)' : 'inherit' }} />
              </div>
            ))}
          </div>

          {/* Buts marqués par période */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Goal size={13} /> Buts marqués — par période</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, marginBottom: 12 }}>
            {[['0-15', 'buts_0_15'], ['15-30', 'buts_15_30'], ['30-45', 'buts_30_45'], ['46-60', 'buts_45_60'], ['60-75', 'buts_60_75'], ['75-90', 'buts_75_90']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>{label}'</label>
                <input type="number" min="0" value={formCollectif[field] || ''} disabled={hasButPourLive}
                  onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 4px', border: '0.5px solid var(--success)', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', textAlign: 'center', background: hasButPourLive ? 'var(--bg-secondary)' : 'var(--bg-card)', color: hasButPourLive ? 'var(--text-muted)' : 'inherit' }} />
              </div>
            ))}
          </div>

          {/* Buts encaissés par période */}
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}><Shield size={13} /> Buts encaissés — par période</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4, marginBottom: 12 }}>
            {[['0-15', 'buts_enc_0_15'], ['15-30', 'buts_enc_15_30'], ['30-45', 'buts_enc_30_45'], ['46-60', 'buts_enc_45_60'], ['60-75', 'buts_enc_60_75'], ['75-90', 'buts_enc_75_90']].map(([label, field]) => (
              <div key={field}>
                <label style={{ display: 'block', fontSize: 9, color: 'var(--text-muted)', marginBottom: 2, textAlign: 'center' }}>{label}'</label>
                <input type="number" min="0" value={formCollectif[field] || ''} disabled={hasButContreLive}
                  onChange={e => setFormCollectif(p => ({...p, [field]: e.target.value}))}
                  style={{ width: '100%', padding: '6px 4px', border: '0.5px solid var(--danger)', borderRadius: 6, fontSize: 12, outline: 'none', boxSizing: 'border-box', textAlign: 'center', background: hasButContreLive ? 'var(--bg-secondary)' : 'var(--bg-card)', color: hasButContreLive ? 'var(--text-muted)' : 'inherit' }} />
              </div>
            ))}
          </div>

          <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveStatsCollectives} disabled={saving}><Save size={13} /> Enregistrer</Button>
        </Card>
      )}

      {/* COMPOSITION VISUELLE */}
      {activeTab === 'compo' && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Composition sur terrain</p>

          {/* Choix formation */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {Object.entries(FORMATIONS).map(([key, f]) => (
              <button key={key} onClick={() => setFormation(key)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                border: `1.5px solid ${formation === key ? 'var(--primary)' : 'var(--border)'}`,
                background: formation === key ? 'var(--primary-bg)' : 'transparent',
                color: formation === key ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: formation === key ? 700 : 400
              }}>{f.label}</button>
            ))}
          </div>

          {/* Terrain SVG */}
          <div style={{ position: 'relative', background: '#2d7a27', borderRadius: 12, overflow: 'hidden', marginBottom: 14 }}>
            <svg viewBox="0 0 100 150" style={{ width: '100%', aspectRatio: '2/3' }}>
              <defs>
                {currentFormation.positions.map(pos => {
                  const joueur = joueurs.find(j => j.id === compo[pos.id])
                  if (!joueur?.photo_url) return null
                  return (
                    <clipPath key={pos.id} id={`compo-clip-${pos.id}`}>
                      <circle cx={pos.x} cy={pos.y * 1.5} r="8.5" />
                    </clipPath>
                  )
                })}
              </defs>

              {/* Pelouse rayée */}
              {[0,1,2,3,4,5,6,7,8,9].map(i => (
                <rect key={i} x="0" y={i * 15} width="100" height="15" fill={i % 2 === 0 ? 'rgba(255,255,255,.03)' : 'transparent'} />
              ))}
              {/* Terrain */}
              <rect x="5" y="3" width="90" height="144" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" rx="1" />
              <line x1="5" y1="75" x2="95" y2="75" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <circle cx="50" cy="75" r="14" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <circle cx="50" cy="75" r=".8" fill="rgba(255,255,255,.5)" />
              {/* Surfaces de réparation */}
              <rect x="25" y="3" width="50" height="26" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <rect x="37" y="3" width="26" height="12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <rect x="25" y="121" width="50" height="26" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
              <rect x="37" y="135" width="26" height="12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />

              {/* Joueurs sur le terrain */}
              {currentFormation.positions.map((pos, i) => {
                const joueurId = compo[pos.id]
                const joueur = joueurs.find(j => j.id === joueurId)
                const cy = pos.y * 1.5
                return (
                  <g key={pos.id}>
                    {joueur?.photo_url ? (
                      <>
                        <circle cx={pos.x} cy={cy} r="9" fill="#fff" />
                        <image href={joueur.photo_url} x={pos.x - 8.5} y={cy - 8.5} width="17" height="17"
                          clipPath={`url(#compo-clip-${pos.id})`} preserveAspectRatio="xMidYMid slice" />
                        <circle cx={pos.x} cy={cy} r="8.5" fill="none" stroke="var(--primary)" strokeWidth=".7" />
                      </>
                    ) : (
                      <circle cx={pos.x} cy={cy} r="8.5"
                        fill={joueurId ? 'var(--primary)' : 'rgba(255,255,255,.15)'}
                        stroke="rgba(255,255,255,.6)" strokeWidth=".5" />
                    )}
                    {joueur ? (
                      <>
                        {!joueur.photo_url && (
                          <text x={pos.x} y={cy + 1.2} textAnchor="middle" dominantBaseline="middle"
                            fontSize="4.5" fill="#fff" fontWeight="700">
                            {joueur.numero || (i+1)}
                          </text>
                        )}
                        {/* Pastille numéro (toujours visible, même avec photo) */}
                        <circle cx={pos.x + 6.5} cy={cy + 6.5} r="3.2" fill="var(--primary)" stroke="#fff" strokeWidth=".5" />
                        <text x={pos.x + 6.5} y={cy + 7.4} textAnchor="middle" dominantBaseline="middle"
                          fontSize="3" fill="#fff" fontWeight="700">{joueur.numero || (i+1)}</text>
                        {/* Bandeau plus étroit que la version initiale (26 → 19) : les postes
                            voisins d'une même formation peuvent n'être espacés que de ~20
                            unités, un bandeau trop large faisait chevaucher les noms adjacents. */}
                        <rect x={pos.x - 9.5} y={cy + 10.5} width="19" height="5.2" rx="1.2" fill="rgba(0,0,0,.6)" />
                        <text x={pos.x} y={cy + 14.2} textAnchor="middle" fontSize="3.2" fill="#fff" fontWeight="600">
                          {joueur.nom?.slice(0,7)}
                        </text>
                      </>
                    ) : (
                      <text x={pos.x} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
                        fontSize="4" fill="rgba(255,255,255,.5)">{pos.label}</text>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Sélection joueurs par poste — le numéro affiché sur le terrain vient du profil
              du joueur (joueurs.numero) ; modifiable ici directement pour les joueurs qui
              n'en ont pas encore un renseigné, sans avoir à aller sur leur fiche. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {currentFormation.positions.map(pos => {
              const joueur = joueurs.find(j => j.id === compo[pos.id])
              return (
                <div key={pos.id}>
                  <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{pos.label}</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <select value={compo[pos.id] || ''} onChange={e => setCompo(p => ({...p, [pos.id]: e.target.value}))}
                      style={{ flex: 1, minWidth: 0, padding: '5px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 11, outline: 'none', boxSizing: 'border-box' }}>
                      <option value="">— Choisir —</option>
                      {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}{j.numero ? ` (${j.numero})` : ''}</option>)}
                    </select>
                    {joueur && (
                      <input type="number" placeholder="N°" value={joueur.numero ?? ''}
                        onChange={e => updateNumeroLocal(joueur.id, e.target.value)}
                        onBlur={e => persistNumero(joueur.id, e.target.value)}
                        style={{ width: 34, padding: '5px 4px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 11, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Remplaçants (12 à 16) — juste pour savoir qui est sur le banc, sans lien
              avec le calcul du temps de jeu (qui se fait via les changements de la
              chronologie dans Suivi live). */}
          <p style={{ fontSize: 12, fontWeight: 700, margin: '4px 0 8px' }}>Remplaçants</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
            {banc.map((joueurId, i) => (
              <div key={i}>
                <label style={{ display: 'block', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>N°{12 + i}</label>
                <select value={joueurId} onChange={e => setBanc(p => p.map((v, idx) => idx === i ? e.target.value : v))}
                  style={{ width: '100%', padding: '5px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 11, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">— Choisir —</option>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveRapport} disabled={saving}><Save size={13} /> Enregistrer</Button>
            <Button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={shareRapportInApp}><Share2 size={13} /> Partager</Button>
          </div>
        </Card>
      )}

      {/* SUIVI LIVE — remplace le carnet papier rempli en tribune pendant le match */}
      {activeTab === 'suivi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Disposition terrain</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Touche le terrain pour poser une croix — repère les zones où on est en supériorité.
            </p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button onClick={() => setMarkTeam('nous')} style={{
                flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${markTeam === 'nous' ? '#2563EB' : 'var(--border)'}`,
                background: markTeam === 'nous' ? '#2563EB20' : 'transparent',
                color: markTeam === 'nous' ? '#2563EB' : 'var(--text-secondary)', fontWeight: markTeam === 'nous' ? 700 : 400,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
              }}><X size={12} strokeWidth={3} /> Nous</button>
              <button onClick={() => setMarkTeam('adversaire')} style={{
                flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${markTeam === 'adversaire' ? '#EA580C' : 'var(--border)'}`,
                background: markTeam === 'adversaire' ? '#EA580C20' : 'transparent',
                color: markTeam === 'adversaire' ? '#EA580C' : 'var(--text-secondary)', fontWeight: markTeam === 'adversaire' ? 700 : 400,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
              }}><X size={12} strokeWidth={3} /> Adversaire</button>
            </div>

            <div style={{ position: 'relative', background: '#2d7a27', borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
              <svg viewBox="0 0 100 150" style={{ width: '100%', aspectRatio: '2/3', touchAction: 'manipulation' }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = ((e.clientX - rect.left) / rect.width) * 100
                  const y = ((e.clientY - rect.top) / rect.height) * 150
                  addMark(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
                }}>
                {[0,1,2,3,4,5,6,7,8,9].map(i => (
                  <rect key={i} x="0" y={i * 15} width="100" height="15" fill={i % 2 === 0 ? 'rgba(255,255,255,.03)' : 'transparent'} />
                ))}
                <rect x="5" y="3" width="90" height="144" fill="none" stroke="rgba(255,255,255,.4)" strokeWidth=".5" rx="1" />
                <line x1="5" y1="75" x2="95" y2="75" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
                <circle cx="50" cy="75" r="14" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
                <circle cx="50" cy="75" r=".8" fill="rgba(255,255,255,.5)" />
                <rect x="25" y="3" width="50" height="26" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
                <rect x="37" y="3" width="26" height="12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
                <rect x="25" y="121" width="50" height="26" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />
                <rect x="37" y="135" width="26" height="12" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth=".4" />

                {(formRapport.terrain_marks || []).map((m, i) => {
                  const color = m.team === 'nous' ? '#2563EB' : '#EA580C'
                  return (
                    <g key={i} onClick={e => { e.stopPropagation(); removeMark(i) }} style={{ cursor: 'pointer' }}>
                      <line x1={m.x - 2.5} y1={m.y - 2.5} x2={m.x + 2.5} y2={m.y + 2.5} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
                      <line x1={m.x - 2.5} y1={m.y + 2.5} x2={m.x + 2.5} y2={m.y - 2.5} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
                    </g>
                  )
                })}
              </svg>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                <span style={{ color: '#2563EB', fontWeight: 700 }}>{(formRapport.terrain_marks || []).filter(m => m.team === 'nous').length}</span> nous ·{' '}
                <span style={{ color: '#EA580C', fontWeight: 700 }}>{(formRapport.terrain_marks || []).filter(m => m.team === 'adversaire').length}</span> adversaire
                {' · '}touche une croix pour l'effacer
              </p>
              {(formRapport.terrain_marks || []).length > 0 && (
                <button onClick={clearMarks} style={{ border: 'none', background: 'none', color: 'var(--danger)', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Trash2 size={12} /> Tout effacer
                </button>
              )}
            </div>
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Chronologie</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input type="number" placeholder="Min." value={chronoForm.minute} onChange={e => setChronoForm(p => ({...p, minute: e.target.value}))}
                style={{ width: 50, padding: '7px 6px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
              <select value={chronoForm.type} onChange={e => setChronoForm(p => ({...p, type: e.target.value}))}
                style={{ flex: 1, minWidth: 0, padding: '7px 6px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                {Object.entries(CHRONO_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>

            {/* Précisions par type — alimentent directement Collectif/Indiv. à
                l'enregistrement, pas besoin de les ressaisir ailleurs. */}
            {chronoForm.type === 'but_pour' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                <select value={chronoForm.buteur_id} onChange={e => setChronoForm(p => ({...p, buteur_id: e.target.value}))}
                  style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--success)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Buteur...</option>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
                </select>
                <select value={chronoForm.passeur_id} onChange={e => setChronoForm(p => ({...p, passeur_id: e.target.value}))}
                  style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Passeur (facultatif)...</option>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
                </select>
                <select value={chronoForm.phase} onChange={e => setChronoForm(p => ({...p, phase: e.target.value}))}
                  style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Phase de jeu (facultatif)...</option>
                  {PHASES_BUT.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
            )}
            {chronoForm.type === 'but_contre' && (
              <select value={chronoForm.phase} onChange={e => setChronoForm(p => ({...p, phase: e.target.value}))}
                style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}>
                <option value="">Phase de jeu (facultatif)...</option>
                {PHASES_BUT.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            )}
            {(chronoForm.type === 'carton_jaune' || chronoForm.type === 'carton_rouge') && (
              <select value={chronoForm.joueur_id} onChange={e => setChronoForm(p => ({...p, joueur_id: e.target.value}))}
                style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}>
                <option value="">Joueur...</option>
                {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
              </select>
            )}
            {chronoForm.type === 'changement' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                <select value={chronoForm.sortant_id} onChange={e => setChronoForm(p => ({...p, sortant_id: e.target.value}))}
                  style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--danger)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Sortant...</option>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
                </select>
                <select value={chronoForm.entrant_id} onChange={e => setChronoForm(p => ({...p, entrant_id: e.target.value}))}
                  style={{ width: '100%', padding: '7px 8px', border: '0.5px solid var(--success)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">Entrant...</option>
                  {joueurs.map(j => <option key={j.id} value={j.id}>{j.nom} {j.prenom}</option>)}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input placeholder="Descriptif (facultatif)" value={chronoForm.description} onChange={e => setChronoForm(p => ({...p, description: e.target.value}))}
                style={{ flex: 1, minWidth: 0, padding: '7px 8px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={addChronoEvent} style={{ padding: '7px 10px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                <Plus size={13} /> Ajouter
              </button>
            </div>

            {(formRapport.chronologie || []).length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>Aucun événement noté pour l'instant.</p>
            ) : (
              <div>
                {formRapport.chronologie.map((ev2, i) => {
                  const t = CHRONO_TYPES[ev2.type] || CHRONO_TYPES.autre
                  const nom = id => { const j = joueurs.find(j => j.id === id); return j ? `${j.nom} ${j.prenom}` : null }
                  const details = []
                  if (ev2.buteur_id) details.push(nom(ev2.buteur_id))
                  if (ev2.passeur_id) details.push(`passe : ${nom(ev2.passeur_id)}`)
                  if (ev2.joueur_id) details.push(nom(ev2.joueur_id))
                  if (ev2.sortant_id || ev2.entrant_id) details.push(`${nom(ev2.sortant_id) || '?'} → ${nom(ev2.entrant_id) || '?'}`)
                  if (ev2.phase) details.push(PHASES_BUT.find(p => p.key === ev2.phase)?.label)
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, marginBottom: 4, background: t.bg }}>
                      <strong style={{ fontSize: 12, color: t.color, minWidth: 30 }}>{ev2.minute}'</strong>
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.color }}>{t.label}</span>
                      <span style={{ fontSize: 11, color: t.color, opacity: .85, flex: 1 }}>
                        {[...details, ev2.description].filter(Boolean).join(' · ')}
                      </span>
                      <button onClick={() => removeChronoEvent(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: t.color, opacity: .6, display: 'flex' }}><X size={13} /></button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Mi-temps</p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Récapitulatif 1ère mi-temps</label>
              <textarea value={formRapport.recap_mi_temps || ''} onChange={e => setFormRapport(p => ({...p, recap_mi_temps: e.target.value}))}
                rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Axes d'amélioration</label>
              <textarea value={formRapport.mt_axes_amelioration || ''} onChange={e => setFormRapport(p => ({...p, mt_axes_amelioration: e.target.value}))}
                rows={3} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Projection 2nde mi-temps</label>
              <textarea value={formRapport.mt_projection || ''} onChange={e => setFormRapport(p => ({...p, mt_projection: e.target.value}))}
                rows={3} placeholder="Consignes à faire passer, avec le timing si besoin..."
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <Input label="Consigne à l'adjoint" value={formRapport.mt_note_adjoint || ''} onChange={v => setFormRapport(p => ({...p, mt_note_adjoint: v}))} />
          </Card>

          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Notes en vrac</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>Pêle-mêle pendant le match, à retranscrire ensuite dans le rapport</p>
            <textarea value={formRapport.notes_libres || ''} onChange={e => setFormRapport(p => ({...p, notes_libres: e.target.value}))}
              rows={5} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
          </Card>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveRapport} disabled={saving}><Save size={13} /> Enregistrer</Button>
          </div>
        </div>
      )}

      {/* RAPPORT */}
      {activeTab === 'rapport' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Avant-match : ce qui est préparé/annoncé avant le coup d'envoi */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Avant-match</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Préparation et consignes annoncées avant le coup d'envoi</p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Causerie d'avant-match</label>
              <textarea value={formRapport.causerie || ''} onChange={e => setFormRapport(p => ({...p, causerie: e.target.value}))}
                rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            {[
              ['Animation offensive', 'animation_offensive', 'schema_animation_offensive'],
              ['Animation défensive', 'animation_defensive', 'schema_animation_defensive'],
            ].map(([label, field, schemaField]) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
                <textarea value={formRapport[field] || ''} onChange={e => setFormRapport(p => ({...p, [field]: e.target.value}))}
                  rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 6 }} />
                <SchemaField label="Schéma" value={formRapport[schemaField]} uploading={uploadingSchema === schemaField}
                  onUpload={f => uploadSchema(schemaField, f)} onRemove={() => setFormRapport(p => ({...p, [schemaField]: ''}))} />
              </div>
            ))}
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 2 }}>CPA</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>Combinaisons préparées, en schéma</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 10 }}>
              {[
                ['Corner pour', 'schema_cpa_corner_pour'],
                ['Corner contre', 'schema_cpa_corner_contre'],
                ['CPA à l\'intérieur', 'schema_cpa_interieur'],
              ].map(([label, schemaField]) => (
                <SchemaField key={schemaField} label={label} value={formRapport[schemaField]} uploading={uploadingSchema === schemaField}
                  onUpload={f => uploadSchema(schemaField, f)} onRemove={() => setFormRapport(p => ({...p, [schemaField]: ''}))} />
              ))}
            </div>
            {schemaError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{schemaError}</p>}
            <Input label="Arbitre" value={formRapport.arbitre || ''} onChange={v => setFormRapport(p => ({...p, arbitre: v}))} />
          </Card>

          {/* Après-match : débrief, adversaire d'abord puis notre propre analyse */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Après-match — débrief</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 12 }}>Analyse de l'adversaire puis de notre match</p>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Composition adversaire</label>
              <SchemaField label="Schéma" value={formRapport.schema_compo_adverse} uploading={uploadingSchema === 'schema_compo_adverse'}
                onUpload={f => uploadSchema('schema_compo_adverse', f)} onRemove={() => setFormRapport(p => ({...p, schema_compo_adverse: ''}))} />
              <textarea value={formRapport.compo_adversaire || ''} onChange={e => setFormRapport(p => ({...p, compo_adversaire: e.target.value}))}
                rows={2} placeholder="Noms, postes..."
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', marginBottom: 6 }} />
              <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Joueurs à surveiller</label>
              <textarea value={formRapport.joueurs_a_surveiller || ''} onChange={e => setFormRapport(p => ({...p, joueurs_a_surveiller: e.target.value}))}
                rows={2} placeholder="Numéro, nom, point fort..."
                style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            {[
              ['Points forts globaux (adversaire)', 'points_forts_globaux'],
              ['Points faibles globaux (adversaire)', 'points_faibles_globaux'],
              ['Points positifs offensifs', 'points_positifs_off'],
              ['Problèmes offensifs', 'problemes_off'],
              ['Points positifs défensifs', 'points_positifs_def'],
              ['Problèmes défensifs', 'problemes_def'],
            ].map(([label, field]) => (
              <div key={field} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</label>
                <textarea value={formRapport[field] || ''} onChange={e => setFormRapport(p => ({...p, [field]: e.target.value}))}
                  rows={2} style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            ))}
          </Card>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={saveRapport} disabled={saving}><Save size={13} /> Enregistrer</Button>
            <Button style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={shareRapportInApp}><Share2 size={13} /> Partager</Button>
          </div>
        </div>
      )}
    </div>
  )
}
