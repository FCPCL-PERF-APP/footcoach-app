import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner, AlertCard } from '../components/UI'
import { computePresenceBreakdown } from '../lib/presenceStats'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, RefreshCw, XCircle, Bandage, Circle } from 'lucide-react'

// Un seul badge coloré par statut, réutilisé dans la grille (vue Hebdo) — cohérent avec
// les couleurs déjà utilisées ailleurs pour présent/extérieur/blessé/absent.
const STATUT_STYLE = {
  present:   { icon: CheckCircle2, color: 'var(--success)', bg: 'var(--success-bg)' },
  exterieur: { icon: RefreshCw,    color: 'var(--primary)', bg: 'var(--primary-bg)' },
  blesse:    { icon: Bandage,      color: 'var(--warning)', bg: 'var(--warning-bg)' },
  absent:    { icon: XCircle,      color: 'var(--danger)',  bg: 'var(--danger-bg)' },
}

export default function PresencesRecapPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [vue, setVue] = useState('hebdo')
  const [joueurs, setJoueurs] = useState([])
  const [seances, setSeances] = useState([])
  const [presences, setPresences] = useState([])
  // Décalage en semaines/mois par rapport à la période courante — 0 = semaine/mois en
  // cours, -1 = précédent(e), etc. Navigable pour retracer toute la préparation.
  const [decalage, setDecalage] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    const { debut } = bornesSaison()
    const [{ data: jrs, error: e1 }, { data: evs, error: e2 }] = await Promise.all([
      supabase.from('joueurs').select('id,nom,prenom').order('nom'),
      // Uniquement les séances d'entraînement collectif — les matchs ne répondent pas à
      // la question "qui a suivi la préparation à l'entraînement".
      supabase.from('evenements').select('id,date_heure').eq('type', 'seance')
        .gte('date_heure', debut).lte('date_heure', new Date().toISOString())
        .order('date_heure', { ascending: true }),
    ])
    if (e1 || e2) { setLoadError((e1 || e2).message); setLoading(false); return }
    setJoueurs(jrs || [])
    setSeances(evs || [])

    const idsSeances = (evs || []).map(e => e.id)
    if (idsSeances.length) {
      const { data: pres, error: e3 } = await supabase.from('presences')
        .select('joueur_id, evenement_id, statut').in('evenement_id', idsSeances)
      if (e3) { setLoadError(e3.message); setLoading(false); return }
      setPresences(pres || [])
    } else {
      setPresences([])
    }
    setLoading(false)
  }

  // Bornes de la période affichée selon la vue (hebdo/mensuel) et le décalage choisi.
  const now = new Date()
  const refDate = vue === 'hebdo' ? addWeeks(now, decalage) : addMonths(now, decalage)
  const periodeDebut = vue === 'hebdo' ? startOfWeek(refDate, { weekStartsOn: 1 }) : startOfMonth(refDate)
  const periodeFin = vue === 'hebdo' ? endOfWeek(refDate, { weekStartsOn: 1 }) : endOfMonth(refDate)
  const periodeLabel = vue === 'hebdo'
    ? `Semaine du ${format(periodeDebut, 'd MMM', { locale: fr })} au ${format(periodeFin, 'd MMM yyyy', { locale: fr })}`
    : format(refDate, 'MMMM yyyy', { locale: fr })

  // Double filtre sur "passé" : la requête initiale (loadData) borne déjà aux séances
  // dont la date est passée au moment du chargement, mais on revérifie ici avec `now`
  // recalculé à chaque rendu — une séance du jour même, prévue plus tard dans la
  // journée, ne doit jamais apparaître avant d'avoir réellement eu lieu.
  const seancesPeriode = seances.filter(e => {
    const d = parseISO(e.date_heure)
    return d >= periodeDebut && d <= periodeFin && d <= now
  })

  function presencesJoueur(joueurId, evenementIds) {
    return presences.filter(p => p.joueur_id === joueurId && evenementIds.includes(p.evenement_id))
  }

  const recap = joueurs.map(j => {
    const rows = presencesJoueur(j.id, seancesPeriode.map(e => e.id))
    const breakdown = computePresenceBreakdown(rows)
    // Taux collectif strict (présent seul, sans mélanger avec l'extérieur) — c'est
    // précisément ce que le coach veut distinguer : qui a suivi le collectif, par
    // opposition à qui a compensé par du travail extérieur.
    const denom = breakdown.total - breakdown.blesse
    const tauxCollectif = denom > 0 ? Math.round(breakdown.present / denom * 100) : null
    return { joueur: j, ...breakdown, tauxCollectif }
  }).sort((a, b) => (a.tauxCollectif ?? 999) - (b.tauxCollectif ?? 999))

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CalendarDays size={18} /> Présences entraînements</span>} />

      {loadError && (
        <div style={{ marginBottom: 12 }}>
          <AlertCard type="red" title="Erreur de chargement" message={loadError} />
        </div>
      )}

      {/* Vue Hebdo / Mensuel */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['hebdo', 'Hebdo'], ['mensuel', 'Mensuel']].map(([v, lbl]) => (
          <button key={v} onClick={() => { setVue(v); setDecalage(0) }} style={{
            flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
            border: '0.5px solid var(--border)',
            background: vue === v ? 'var(--primary-bg)' : 'transparent',
            color: vue === v ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: vue === v ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {/* Navigation période */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => setDecalage(p => p - 1)} style={{ border: 'none', background: 'var(--bg-secondary)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={16} /></button>
        <p style={{ fontSize: 13, fontWeight: 600, textTransform: vue === 'mensuel' ? 'capitalize' : 'none' }}>{periodeLabel}</p>
        <button onClick={() => setDecalage(p => Math.min(0, p + 1))} disabled={decalage >= 0} style={{ border: 'none', background: 'var(--bg-secondary)', borderRadius: 8, padding: '6px 8px', cursor: decalage >= 0 ? 'default' : 'pointer', opacity: decalage >= 0 ? .4 : 1, display: 'flex' }}><ChevronRight size={16} /></button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {seancesPeriode.length === 0 ? (
            <Card><p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Aucune séance sur cette période.</p></Card>
          ) : (
            <>
              {/* Légende */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10, fontSize: 10, color: 'var(--text-secondary)' }}>
                {Object.entries(STATUT_STYLE).map(([k, s]) => (
                  <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <s.icon size={11} color={s.color} /> {{ present: 'Présent', exterieur: 'Extérieur', blesse: 'Blessé', absent: 'Absent' }[k]}
                  </span>
                ))}
              </div>

              {/* Grille détaillée par séance — seulement en vue Hebdo, une vue Mensuel
                  aurait trop de colonnes pour tenir sur un écran de téléphone. */}
              {vue === 'hebdo' && (
                <Card style={{ marginBottom: 12, overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 6px', position: 'sticky', left: 0, background: 'var(--bg-card)' }}>Joueur</th>
                        {seancesPeriode.map(e => (
                          <th key={e.id} style={{ padding: '4px 6px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {format(parseISO(e.date_heure), 'EEE d', { locale: fr })}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recap.map(r => (
                        <tr key={r.joueur.id} style={{ borderTop: '0.5px solid var(--bg-secondary)' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--bg-card)' }}>{r.joueur.nom} {r.joueur.prenom?.[0]}.</td>
                          {seancesPeriode.map(e => {
                            const p = presences.find(p => p.joueur_id === r.joueur.id && p.evenement_id === e.id)
                            const s = p ? STATUT_STYLE[p.statut] : null
                            return (
                              <td key={e.id} style={{ textAlign: 'center', padding: '4px 6px' }}>
                                {s ? <s.icon size={13} color={s.color} /> : <Circle size={7} color="var(--border)" fill="var(--border)" />}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}

              {/* Récap chiffré — dans les deux vues, trié du taux collectif le plus
                  faible au plus élevé pour repérer d'un coup d'œil qui n'est pas encore
                  prêt. */}
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Récap — {seancesPeriode.length} séance(s) proposée(s)</p>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 10 }}>Trié du taux de présence collective le plus faible au plus élevé</p>
                {recap.map(r => (
                  <div key={r.joueur.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.joueur.nom} {r.joueur.prenom}</p>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--success)' }}>{r.present} présent</span>
                        <span style={{ color: 'var(--primary)' }}>{r.exterieur} ext.</span>
                        <span style={{ color: 'var(--warning)' }}>{r.blesse} blessé</span>
                        <span style={{ color: 'var(--danger)' }}>{r.absent} absent</span>
                      </div>
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 700, minWidth: 42, textAlign: 'right',
                      color: r.tauxCollectif === null ? 'var(--text-muted)' : r.tauxCollectif >= 80 ? 'var(--success)' : r.tauxCollectif >= 50 ? 'var(--warning)' : 'var(--danger)'
                    }}>
                      {r.tauxCollectif === null ? '—' : `${r.tauxCollectif}%`}
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
