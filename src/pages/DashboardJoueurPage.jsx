import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner, ListRow } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { subDays } from 'date-fns'
import {
  HelpCircle, FileText, AlertTriangle, Heart, Radio, CheckCircle2, Bandage, ArrowRight, Trophy
} from 'lucide-react'
import MaSemaineCard from '../components/MaSemaineCard'

export default function DashboardJoueurPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueur, setJoueur] = useState(null)
  const [blessures, setBlessures] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [nbRpeAFaire, setNbRpeAFaire] = useState(0)
  const [nbFootAFaire, setNbFootAFaire] = useState(0)
  const [nbPresenceAConfirmer, setNbPresenceAConfirmer] = useState(0)

  const joueurId = profile?.id

  // eslint-disable-next-line react-hooks/exhaustive-deps -- vérifié : recharge uniquement quand ces valeurs changent
  useEffect(() => { if (joueurId) loadAll() }, [joueurId])

  async function loadAll() {
    setLoading(true)
    const since = subDays(new Date(), 60).toISOString()

    const [
      { data: j },
      { data: pres },
      { data: bless },
      { data: evs },
      { data: rpesFaits },
      { data: footFaits },
      { data: eventsProchesJoueur },
      { data: presReponses },
      { data: convocsJoueur },
      { data: convocsAll },
    ] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', joueurId).single(),
      supabase.from('presences').select('evenement_id, statut')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(50),
      supabase.from('blessures').select('*')
        .eq('joueur_id', joueurId).order('date_debut', { ascending: false }).limit(3),
      supabase.from('evenements').select('*')
        .lte('date_heure', new Date().toISOString())
        .gte('date_heure', since)
        .order('date_heure', { ascending: false }),
      supabase.from('rpe').select('evenement_id').eq('joueur_id', joueurId),
      supabase.from('footbar').select('evenement_id').eq('joueur_id', joueurId),
      supabase.from('evenements').select('id,type')
        .gte('date_heure', new Date().toISOString())
        .lte('date_heure', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('presences').select('evenement_id').eq('joueur_id', joueurId),
      supabase.from('convocations').select('evenement_id').eq('joueur_id', joueurId).eq('convoque', true),
      supabase.from('convocations').select('evenement_id, convoque').eq('joueur_id', joueurId),
    ])

    setJoueur(j)
    setBlessures(bless || [])

    const rpeIds = new Set((rpesFaits || []).map(r => r.evenement_id))
    const footIds = new Set((footFaits || []).map(f => f.evenement_id))

    // Un événement où le joueur était absent/blessé, ou un match auquel il n'était pas
    // convoqué, ne compte pas comme "RPE en attente" — sinon ce badge annonçait des RPE
    // à faire que la page "Mon suivi" (qui applique déjà ce filtre) ne réclamait pas,
    // ce qui faisait dire au joueur "à jour" alors que le Dashboard affichait encore
    // un chiffre. Un RPE non rempli depuis plus d'une semaine n'est plus réclamé non
    // plus, même logique que "Mon suivi" (MonSuiviPage.jsx).
    const presStatutMap = {}
    for (const p of (pres || [])) presStatutMap[p.evenement_id] = p.statut
    const convocMap = {}
    for (const c of (convocsAll || [])) convocMap[c.evenement_id] = c.convoque
    const uneSemaine = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    function estEligibleRpe(e) {
      if (new Date(e.date_heure) < uneSemaine) return false
      if (presStatutMap[e.id] === 'absent' || presStatutMap[e.id] === 'blesse') return false
      if (e.type === 'match' && !convocMap[e.id]) return false
      return true
    }

    // Le Footbar est facultatif (capteur pas toujours dispo, club amateur) : seul le RPE
    // conditionne le badge "à faire".
    const aFaire = (evs || []).filter(e => estEligibleRpe(e) && !rpeIds.has(e.id))
    setEventsAFaire(aFaire)
    setNbRpeAFaire(aFaire.length)
    // Même filtre d'éligibilité que pour le RPE — un match non convoqué ou une séance
    // manquée ne doit pas non plus compter comme Footbar "à compléter".
    setNbFootAFaire((evs || []).filter(e => estEligibleRpe(e) && !footIds.has(e.id)).length)

    // Présence à confirmer : événements proches concernés (séances + matchs où convoqué)
    // et pour lesquels aucune réponse n'a encore été enregistrée.
    const presRepondues = new Set((presReponses || []).map(p => p.evenement_id))
    const convoqueIds = new Set((convocsJoueur || []).map(c => c.evenement_id))
    const eventsConcernes = (eventsProchesJoueur || []).filter(e => e.type !== 'match' || convoqueIds.has(e.id))
    setNbPresenceAConfirmer(eventsConcernes.filter(e => !presRepondues.has(e.id)).length)

    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  // ===== CALCULS =====

  const blessureActive = blessures.find(b => !b.date_retour_effective)

  return (
    <div style={{ padding: 12 }}>

      {/* HERO */}
      <div style={{ background: 'var(--gradient)', borderRadius: 16, padding: '16px 14px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {joueur?.photo_url
            ? <img src={joueur.photo_url} alt={joueur.nom} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,.4)' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                {joueur?.nom?.[0]}{joueur?.prenom?.[0]}
              </div>
          }
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#fff' }}>{joueur?.nom} {joueur?.prenom}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,.75)' }}>
              {joueur?.poste || '—'} {joueur?.numero ? `· N°${joueur.numero}` : ''} {joueur?.groupe ? `· Pôle ${joueur.groupe}` : ''}
            </p>
            {blessureActive && (
              <div style={{ marginTop: 4, background: 'rgba(193,59,59,.3)', borderRadius: 6, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Bandage size={11} color="#FCA5A5" /><span style={{ fontSize: 11, color: '#FCA5A5' }}>{blessureActive.zone}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ALERTES */}
      {(nbPresenceAConfirmer > 0 || eventsAFaire.length > 0 || blessureActive) && (
        <Card style={{ marginBottom: 14, background: 'var(--warning-bg)', border: '0.5px solid #F5C4B3' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--warning)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={13} /> À faire
          </p>
          {nbPresenceAConfirmer > 0 && (
            <ListRow icon={HelpCircle} label={`${nbPresenceAConfirmer} présence(s) à confirmer`}
              iconColor={CAT_COLORS.amber.color} iconBg={CAT_COLORS.amber.bg}
              onClick={() => navigate('/calendrier')} last={!(eventsAFaire.length > 0 || blessureActive)} />
          )}
          {eventsAFaire.length > 0 && (
            <ListRow icon={FileText} label={`${eventsAFaire.length} RPE à remplir`}
              iconColor={CAT_COLORS.rose.color} iconBg={CAT_COLORS.rose.bg}
              onClick={() => navigate('/mon-suivi')} last={!blessureActive} />
          )}
          {blessureActive && (
            <ListRow icon={Bandage} label={`Blessure en cours — ${blessureActive.zone}`}
              iconColor={'var(--danger)'} iconBg={'var(--danger-bg)'} last />
          )}
        </Card>
      )}

      {/* MA SEMAINE — bilan 7 jours + mot du coach */}
      <MaSemaineCard joueurId={joueurId} />

      {/* RACCOURCIS RPE + FOOTBAR */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div onClick={() => navigate('/mon-suivi')} style={{
          background: 'var(--gradient)', borderRadius: THEME.radiusLg, padding: '12px 14px',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Heart size={14} /> Mon RPE
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {nbRpeAFaire > 0 ? `${nbRpeAFaire} à compléter` : <>À jour <CheckCircle2 size={11} /></>}
            </p>
          </div>
          <ArrowRight size={16} color="#fff" />
        </div>
        <div onClick={() => navigate('/mon-suivi')} style={{
          background: 'var(--primary-dark)', borderRadius: THEME.radiusLg, padding: '12px 14px',
          cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Radio size={14} /> Footbar
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', display: 'flex', alignItems: 'center', gap: 3 }}>
              {nbFootAFaire > 0 ? `${nbFootAFaire} à compléter` : <>À jour <CheckCircle2 size={11} /></>}
            </p>
          </div>
          <ArrowRight size={16} color="#fff" />
        </div>
      </div>

      {/* Accès à la saison complète */}
      <div onClick={() => navigate('/mon-bilan')} style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        borderRadius: THEME.radiusMd, padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#FFD700', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Trophy size={15} /> Ma saison
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>Stats, RPE, présences, Footbar, objectifs et badges</p>
        </div>
        <ArrowRight size={18} color="#FFD700" />
      </div>
    </div>
  )
}
