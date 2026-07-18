import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner, ListRow } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Award, HelpCircle, FileText, AlertTriangle, Heart, Radio, Calendar, User,
  MessageCircle, TrendingUp, CheckCircle2, XCircle, Bandage, Target, ArrowRight, RefreshCw
} from 'lucide-react'
import { computePresenceBreakdown } from '../lib/presenceStats'

function rpeColor(v) {
  if (!v) return 'var(--text-muted)'
  if (v >= 4.5) return 'var(--danger)'
  if (v >= 4) return '#D85A30'
  if (v >= 3) return 'var(--warning)'
  return 'var(--success)'
}

export default function DashboardJoueurPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [joueur, setJoueur] = useState(null)
  const [rpeHistory, setRpeHistory] = useState([])
  const [footHistory, setFootHistory] = useState([])
  const [presences, setPresences] = useState([])
  const [statsHistory, setStatsHistory] = useState([])
  const [objectifs, setObjectifs] = useState([])
  const [blessures, setBlessures] = useState([])
  const [eventsAFaire, setEventsAFaire] = useState([])
  const [nbRpeAFaire, setNbRpeAFaire] = useState(0)
  const [nbFootAFaire, setNbFootAFaire] = useState(0)
  const [nbPresenceAConfirmer, setNbPresenceAConfirmer] = useState(0)

  const joueurId = profile?.id

  useEffect(() => { if (joueurId) loadAll() }, [joueurId])

  async function loadAll() {
    setLoading(true)
    const since = subDays(new Date(), 60).toISOString()

    const [
      { data: j },
      { data: rpe },
      { data: foot },
      { data: pres },
      { data: stats },
      { data: obj },
      { data: bless },
      { data: evs },
      { data: rpesFaits },
      { data: footFaits },
      { data: eventsProchesJoueur },
      { data: presReponses },
      { data: convocsJoueur },
    ] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', joueurId).single(),
      supabase.from('rpe').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(20),
      supabase.from('footbar').select('*, evenements(titre,type,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(20),
      supabase.from('presences').select('*, evenements(titre,date_heure,type)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(50),
      supabase.from('stats_match').select('*, evenements(titre,date_heure)')
        .eq('joueur_id', joueurId).order('created_at', { ascending: false }).limit(15),
      supabase.from('objectifs').select('*')
        .eq('joueur_id', joueurId).eq('statut', 'en_cours').order('date_echeance', { ascending: true }),
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
    ])

    setJoueur(j)
    setRpeHistory(rpe || [])
    setFootHistory(foot || [])
    setPresences(pres || [])
    setStatsHistory(stats || [])
    setObjectifs(obj || [])
    setBlessures(bless || [])

    const rpeIds = new Set((rpesFaits || []).map(r => r.evenement_id))
    const footIds = new Set((footFaits || []).map(f => f.evenement_id))
    // Le Footbar est facultatif (capteur pas toujours dispo, club amateur) : seul le RPE
    // conditionne le badge "à faire".
    const aFaire = (evs || []).filter(e => !rpeIds.has(e.id))
    setEventsAFaire(aFaire)
    setNbRpeAFaire((evs || []).filter(e => new Date(e.date_heure) < new Date() && !rpeIds.has(e.id)).length)
    setNbFootAFaire((evs || []).filter(e => new Date(e.date_heure) < new Date() && !footIds.has(e.id)).length)

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

  // RPE moyen saison
  const rpeVals = rpeHistory.map(r => {
    const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    return items.length ? items.reduce((a,b) => a+b,0)/items.length : null
  }).filter(v => v !== null)
  const rpeMoySaison = rpeVals.length ? (rpeVals.reduce((a,b) => a+b,0)/rpeVals.length).toFixed(1) : '—'

  // Stats match
  const totalMatchs = statsHistory.length
  const totalButs = statsHistory.reduce((s,r) => s+(r.buts||0), 0)
  const totalPD = statsHistory.reduce((s,r) => s+(r.passes_decisives||0), 0)

  // Temps de jeu moyen (matchs uniquement)
  const tempsJeuVals = statsHistory.map(s => s.temps_jeu).filter(v => v != null && v > 0)
  const tempsJeuMoy = tempsJeuVals.length ? Math.round(tempsJeuVals.reduce((a,b) => a+b,0)/tempsJeuVals.length) : '—'

  // Présences sur ENTRAÎNEMENTS uniquement — taux d'engagement = présent + extérieur,
  // blessures exclues du calcul (cf. src/lib/presenceStats.js)
  const presencesEntrainement = presences.filter(p => p.evenements?.type === 'seance')
  const presEntrainementBreakdown = computePresenceBreakdown(presencesEntrainement)
  const tauxPresenceEntrainement = presEntrainementBreakdown.tauxEngagement ?? '—'

  // Distance moyenne entraînement vs match
  const footEntrainement = footHistory.filter(f => f.evenements?.type === 'seance')
  const footMatch = footHistory.filter(f => f.evenements?.type === 'match')
  const distMoyEntrainement = footEntrainement.length
    ? (footEntrainement.reduce((s,f) => s+(f.distance_km||0), 0)/footEntrainement.length).toFixed(1)
    : '—'
  const distMoyMatch = footMatch.length
    ? (footMatch.reduce((s,f) => s+(f.distance_km||0), 0)/footMatch.length).toFixed(1)
    : '—'

  // Courbe RPE 6 dernières sessions
  const rpeParSession = rpeHistory.slice(0,6).reverse().map(r => {
    const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
    const avg = items.length ? items.reduce((a,b) => a+b,0)/items.length : 0
    return {
      value: parseFloat(avg.toFixed(1)),
      label: r.evenements?.date_heure ? format(parseISO(r.evenements.date_heure), 'd/M', { locale: fr }) : '',
      type: r.evenements?.type
    }
  })

  const W = 280, H = 80, PAD = 16
  function xPos(i, total) { return PAD + (i/Math.max(total-1,1))*(W-PAD*2) }
  function yPos(v) { return H - PAD - ((v/5)*(H-PAD*2)) }

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

      {/* BADGES */}
      <div onClick={() => navigate('/mes-badges')} style={{
        background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)',
        borderRadius: THEME.radiusMd, padding: '10px 14px', marginBottom: 14,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
      }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#FFD700', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Award size={15} /> Mes badges
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,.6)' }}>Voir mes récompenses et défis</p>
        </div>
        <ArrowRight size={18} color="#FFD700" />
      </div>

      {/* ALERTES */}
      {(nbPresenceAConfirmer > 0 || eventsAFaire.length > 0 || blessureActive) && (
        <Card style={{ marginBottom: 14, background: 'var(--warning-bg)', border: '0.5px solid #F5C4B3' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#854F0B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
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

      {/* STATS RAPIDES — sans RPE moyen, avec temps de jeu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
        {[
          { label: 'Matchs', value: totalMatchs, color: 'var(--primary)' },
          { label: 'Buts', value: totalButs, color: 'var(--success)' },
          { label: 'Tps jeu moy.', value: tempsJeuMoy !== '—' ? `${tempsJeuMoy}'` : '—', color: 'var(--primary)' },
          { label: 'Engagement entr.', value: tauxPresenceEntrainement !== '—' ? `${tauxPresenceEntrainement}%` : '—', color: tauxPresenceEntrainement >= 80 ? 'var(--success)' : '#D85A30' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: `0.5px solid ${'var(--border)'}`, borderRadius: THEME.radiusMd, padding: '10px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>

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

      {/* COURBE RPE */}
      {rpeParSession.length >= 2 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} color={'var(--primary)'} /> Mon RPE — évolution
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80 }}>
            <line x1={PAD} y1={yPos(2.5)} x2={W-PAD} y2={yPos(2.5)} stroke="var(--bg-secondary)" strokeWidth="1" strokeDasharray="4,4" />
            <polyline
              points={rpeParSession.map((d,i) => `${xPos(i,rpeParSession.length)},${yPos(d.value)}`).join(' ')}
              fill="none" stroke={rpeColor(parseFloat(rpeMoySaison))} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {rpeParSession.map((d,i) => (
              <g key={i}>
                <circle cx={xPos(i,rpeParSession.length)} cy={yPos(d.value)} r="4"
                  fill={d.type === 'match' ? 'var(--primary-dark)' : rpeColor(d.value)} />
                <text x={xPos(i,rpeParSession.length)} y={yPos(d.value)-8} textAnchor="middle" fontSize="9" fill="var(--text-secondary)">{d.value}</text>
              </g>
            ))}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
            {rpeParSession.map((d,i) => <span key={i}>{d.label}</span>)}
          </div>
        </Card>
      )}

      {/* FOOTBAR — km moyen entraînement vs match */}
      {footHistory.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Radio size={14} color={'var(--primary)'} /> Distance parcourue
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'var(--success-bg)', borderRadius: THEME.radiusMd, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--success)' }}>{distMoyEntrainement} <span style={{ fontSize: 12 }}>km</span></div>
              <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2 }}>Moy. entraînement</div>
            </div>
            <div style={{ background: 'var(--primary-bg)', borderRadius: THEME.radiusMd, padding: '12px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{distMoyMatch} <span style={{ fontSize: 12 }}>km</span></div>
              <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 2 }}>Moy. match</div>
            </div>
          </div>
        </Card>
      )}

      {/* PRÉSENCES ENTRAÎNEMENTS */}
      {presencesEntrainement.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} color={'var(--primary)'} /> Présences entraînements
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {presencesEntrainement.slice(0,10).map((p,i) => {
              const style = p.statut === 'present' ? { bg: 'var(--success-bg)', color: 'var(--success)', Icon: CheckCircle2 }
                : p.statut === 'exterieur' ? { bg: 'var(--primary-bg)', color: 'var(--primary)', Icon: RefreshCw }
                : p.statut === 'blesse' ? { bg: 'var(--warning-bg)', color: '#854F0B', Icon: Bandage }
                : { bg: 'var(--danger-bg)', color: 'var(--danger)', Icon: XCircle }
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: style.bg
                  }}>
                    <style.Icon size={15} color={style.color} />
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
                    {p.evenements?.date_heure ? format(parseISO(p.evenements.date_heure), 'd/M', { locale: fr }) : ''}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, borderTop: `0.5px solid ${'var(--border)'}`, paddingTop: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--success)' }}>{presEntrainementBreakdown.present} présent(s)</span>
            <span style={{ color: 'var(--primary)' }}>{presEntrainementBreakdown.exterieur} extérieur</span>
            <span style={{ color: '#854F0B' }}>{presEntrainementBreakdown.blesse} blessé(s)</span>
            <span style={{ color: 'var(--danger)' }}>{presEntrainementBreakdown.absent} absent(s)</span>
            <span style={{ color: 'var(--text-muted)' }}>· {tauxPresenceEntrainement}% d'engagement</span>
          </div>
        </Card>
      )}

      {/* OBJECTIFS */}
      {objectifs.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={14} color={'var(--primary)'} /> Mes objectifs
          </p>
          {objectifs.slice(0,3).map(o => {
            const progress = o.valeur_cible && o.valeur_actuelle
              ? Math.min(100, Math.round(o.valeur_actuelle/o.valeur_cible*100))
              : null
            return (
              <div key={o.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: `0.5px solid ${'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{o.titre}</p>
                  {progress !== null && <span style={{ fontSize: 11, fontWeight: 700, color: progress >= 100 ? 'var(--success)' : 'var(--primary)' }}>{progress}%</span>}
                </div>
                {progress !== null && (
                  <div style={{ height: 6, background: 'var(--surface-muted)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: progress >= 100 ? 'var(--success)' : 'var(--primary)', width: `${progress}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {/* Navigation rapide */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
        {[
          { icon: Calendar, label: 'Agenda', path: '/calendrier', cat: 'blue' },
          { icon: User, label: 'Ma fiche', path: '/ma-fiche', cat: 'violet' },
          { icon: MessageCircle, label: 'Messages', path: '/messages', cat: 'teal' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)} style={{
            padding: 10, background: 'var(--bg-card)', border: `0.5px solid ${'var(--border)'}`,
            borderRadius: THEME.radiusMd, fontSize: 12, color: CAT_COLORS[item.cat].color,
            fontWeight: 500, cursor: 'pointer', textAlign: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5
          }}><item.icon size={14} /> {item.label}</button>
        ))}
      </div>
    </div>
  )
}
