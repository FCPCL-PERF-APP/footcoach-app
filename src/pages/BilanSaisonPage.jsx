import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner, BarChart } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { Trophy, Award, Goal, Shield, Target, Heart, BarChart3, CheckCircle2 } from 'lucide-react'
import { computePresenceBreakdown } from '../lib/presenceStats'

// "E.Lucas" — initiale du prénom + nom, pour vraiment identifier le joueur (deux
// joueurs peuvent partager le même nom de famille, l'initiale seule du nom ne suffit
// pas à les distinguer).
function initName(nom, prenom) {
  return `${prenom?.[0] ? prenom[0] + '.' : ''}${nom || ''}`
}

function StatBox({ label, value, sub, color = 'var(--primary)', big = false }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: 12, padding: 12, textAlign: 'center' }}>
      <div style={{ fontSize: big ? 28 : 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

export default function BilanSaisonPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [bilan, setBilan] = useState(null)
  const [saisonYear, setSaisonYear] = useState(null)

  useEffect(() => { loadBilan() }, [])

  async function loadBilan() {
    setLoading(true)
    setLoadError(null)
    const { year, debut, fin } = bornesSaison()
    setSaisonYear(year)

    // Récupère d'abord les IDs des événements de la saison en cours, pour borner
    // toutes les stats qui en dépendent (sinon "bilan de saison" mélange plusieurs
    // saisons tant que l'archivage n'a pas eu lieu).
    const { data: eventsSaisonIds, error: e0 } = await supabase.from('evenements').select('id')
      .gte('date_heure', debut).lte('date_heure', fin)
    if (e0) { setLoadError(e0.message); setLoading(false); return }
    const idsSaison = (eventsSaisonIds || []).map(e => e.id)

    const [
      { data: matchStatsRaw, error: e1 },
      { data: rpeData, error: e2 },
      { data: footData, error: e3 },
      { data: statsIndivRaw, error: e4 },
      { data: presences, error: e5 },
      { data: eventsRaw, error: e6 },
    ] = await Promise.all([
      supabase.from('stats_collectives').select('*, evenements(titre,date_heure,match_type)').in('evenement_id', idsSaison).order('created_at', { ascending: true }),
      supabase.from('rpe').select('*, joueurs(nom,prenom)').in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      // Jointure evenements(type) pour ne garder que le Footbar pris en match — sinon la
      // distance moyenne se retrouve diluée par les séances d'entraînement (même
      // filtre que DashboardPage.jsx/ClassementButeursPage.jsx).
      supabase.from('footbar').select('*, joueurs(nom,prenom), evenements(type)').in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('stats_match').select('*, joueurs(nom,prenom), evenements(match_type)').in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('presences').select('*, joueurs(nom,prenom)').in('evenement_id', idsSaison),
      supabase.from('evenements').select('*').eq('type', 'match').gte('date_heure', debut).lte('date_heure', fin),
    ])
    const premiereErreur = e1 || e2 || e3 || e4 || e5 || e6
    if (premiereErreur) { setLoadError(premiereErreur.message); setLoading(false); return }

    // Ne garder que les matchs officiels (hors préparation), comme ClassementButeursPage/
    // DashboardStatsPage/BadgesJoueurPage
    const matchStats = (matchStatsRaw || []).filter(s => s.evenements?.match_type !== 'preparation')
    const statsIndiv = (statsIndivRaw || []).filter(s => s.evenements?.match_type !== 'preparation')
    const events = (eventsRaw || []).filter(e => e.match_type !== 'preparation')

    // ===== BILAN MATCHS =====
    const victoires = (matchStats || []).filter(s => s.buts_marques > s.buts_encaisses).length
    const nuls = (matchStats || []).filter(s => s.buts_marques === s.buts_encaisses).length
    const defaites = (matchStats || []).filter(s => s.buts_marques < s.buts_encaisses).length
    const totalMatchs = (events || []).length
    const totalButs = (matchStats || []).reduce((s, m) => s + (m.buts_marques || 0), 0)
    const totalEncaisses = (matchStats || []).reduce((s, m) => s + (m.buts_encaisses || 0), 0)

    // ===== MEILLEUR BUTEUR ===== — clé "nom|prénom" pour ne pas confondre deux joueurs
    // du même nom de famille ; libellé affiché "E.Lucas" (initiale prénom + nom).
    const butsParJoueur = {}
    for (const s of (statsIndiv || [])) {
      if (!s.joueurs || !s.buts) continue
      const key = `${s.joueurs.nom}|${s.joueurs.prenom}`
      if (!butsParJoueur[key]) butsParJoueur[key] = { nom: s.joueurs.nom, prenom: s.joueurs.prenom, valeur: 0 }
      butsParJoueur[key].valeur += s.buts
    }
    const meilleurButeur = Object.values(butsParJoueur).sort((a,b) => b.valeur - a.valeur)[0]

    // ===== MEILLEUR PASSEUR =====
    const passesParJoueur = {}
    for (const s of (statsIndiv || [])) {
      if (!s.joueurs || !s.passes_decisives) continue
      const key = `${s.joueurs.nom}|${s.joueurs.prenom}`
      if (!passesParJoueur[key]) passesParJoueur[key] = { nom: s.joueurs.nom, prenom: s.joueurs.prenom, valeur: 0 }
      passesParJoueur[key].valeur += s.passes_decisives
    }
    const meilleurPasseur = Object.values(passesParJoueur).sort((a,b) => b.valeur - a.valeur)[0]

    // ===== PRÉSENCE ===== — taux d'engagement (présent + extérieur, blessures exclues)
    const presenceParJoueur = {}
    for (const p of (presences || [])) {
      if (!p.joueurs) continue
      const key = `${p.joueurs.nom}|${p.joueurs.prenom}`
      if (!presenceParJoueur[key]) presenceParJoueur[key] = { nom: p.joueurs.nom, prenom: p.joueurs.prenom, rows: [] }
      presenceParJoueur[key].rows.push(p)
    }
    const topPresence = Object.values(presenceParJoueur)
      .map(({ nom, prenom, rows }) => ({ nom, prenom, ...computePresenceBreakdown(rows), taux: computePresenceBreakdown(rows).tauxEngagement ?? 0 }))
      .sort((a,b) => b.taux - a.taux)[0]

    // ===== RPE MOYEN SAISON =====
    const rpeVals = (rpeData || []).map(r => {
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }).filter(v => v !== null)
    const rpeMoySaison = rpeVals.length ? (rpeVals.reduce((a,b) => a+b, 0) / rpeVals.length).toFixed(1) : '—'

    // ===== DISTANCE MOYENNE PAR MATCH (Footbar pris en match uniquement) =====
    const distancesMatch = (footData || []).filter(f => f.evenements?.type === 'match').map(f => f.distance_km).filter(Boolean)
    const distMoyenne = distancesMatch.length ? (distancesMatch.reduce((a, b) => a + b, 0) / distancesMatch.length).toFixed(1) : '—'

    // ===== TOP BUTEURS / PASSEURS (graphiques) =====
    const topButeurs = Object.values(butsParJoueur)
      .sort((a,b) => b.valeur - a.valeur).slice(0,6)
      .map(({ nom, prenom, valeur }) => ({ label: initName(nom, prenom), value: valeur, color: 'var(--primary)' }))
    const topPasseurs = Object.values(passesParJoueur)
      .sort((a,b) => b.valeur - a.valeur).slice(0,6)
      .map(({ nom, prenom, valeur }) => ({ label: initName(nom, prenom), value: valeur, color: CAT_COLORS.violet.color }))

    // ===== POINTS ===== — n'ont de sens qu'en championnat (la coupe n'a pas de
    // classement) : calculés uniquement sur les matchs de championnat, et le tile
    // "Pts" est masqué tant qu'aucun n'a été disputé (ex. en plein sur une préparation
    // qui n'a joué que des matchs de coupe).
    const matchStatsChampionnat = (matchStats || []).filter(s => s.evenements?.match_type === 'championnat')
    const hasChampionnat = matchStatsChampionnat.length > 0
    const ptsCalcules = matchStatsChampionnat.filter(s => s.buts_marques > s.buts_encaisses).length * 3
      + matchStatsChampionnat.filter(s => s.buts_marques === s.buts_encaisses).length

    setBilan({
      victoires, nuls, defaites, totalMatchs,
      totalButs, totalEncaisses,
      meilleurButeur, meilleurPasseur,
      topPresence, rpeMoySaison, distMoyenne,
      topButeurs, topPasseurs, hasChampionnat, ptsCalcules
    })
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>
  if (loadError) return (
    <div style={{ padding: 12 }}>
      <Card style={{ background: 'var(--danger-bg)' }}>
        <p style={{ fontSize: 13, color: 'var(--danger)' }}>Erreur de chargement : {loadError}</p>
      </Card>
    </div>
  )
  if (!bilan) return null

  const diffButs = bilan.totalButs - bilan.totalEncaisses

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} /> Bilan de saison</span>} />

      {/* Résultats globaux */}
      <div style={{ background: 'var(--gradient)', borderRadius: 16, padding: '16px 14px', marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginBottom: 10, textAlign: 'center' }}>
          Saison {saisonYear}/{saisonYear+1} · {bilan.totalMatchs} matchs disputés
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: bilan.hasChampionnat ? 'repeat(4,1fr)' : 'repeat(3,1fr)', gap: 8 }}>
          {[
            // Les points n'ont de sens qu'en championnat (pas de classement en coupe) —
            // masqués tant qu'aucun match de championnat n'a été disputé.
            ...(bilan.hasChampionnat ? [['Pts', bilan.ptsCalcules, '#FFD700']] : []),
            ['V', bilan.victoires, '#4ADE80'],
            ['N', bilan.nuls, '#FCD34D'],
            ['D', bilan.defaites, '#F87171'],
          ].map(([lbl, val, color]) => (
            <div key={lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{lbl}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,.8)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Goal size={12} /> {bilan.totalButs} buts marqués</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Shield size={12} /> {bilan.totalEncaisses} encaissés</span>
          <span style={{ color: diffButs >= 0 ? '#4ADE80' : '#F87171' }}>
            {diffButs >= 0 ? '+' : ''}{diffButs} diff.
          </span>
        </div>
      </div>

      {/* Trophées */}
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Award size={11} /> Trophées individuels
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {bilan.meilleurButeur && (
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 4 }}><Goal size={22} color={'var(--primary)'} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>Meilleur buteur</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 2 }}>{initName(bilan.meilleurButeur.nom, bilan.meilleurButeur.prenom)}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', textAlign: 'center' }}>{bilan.meilleurButeur.valeur} buts</div>
          </Card>
        )}
        {bilan.meilleurPasseur && (
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 4 }}><Target size={22} color={'var(--primary)'} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>Meilleur passeur</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 2 }}>{initName(bilan.meilleurPasseur.nom, bilan.meilleurPasseur.prenom)}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', textAlign: 'center' }}>{bilan.meilleurPasseur.valeur} passes</div>
          </Card>
        )}
        {bilan.topPresence && (
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 4 }}><CheckCircle2 size={22} color={'var(--success)'} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>Meilleur engagement</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 2 }}>{initName(bilan.topPresence.nom, bilan.topPresence.prenom)}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)', textAlign: 'center' }}>{bilan.topPresence.taux}%</div>
          </Card>
        )}
        <Card>
          <div style={{ textAlign: 'center', marginBottom: 4 }}><Heart size={22} color={CAT_COLORS.rose.color} /></div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>RPE moyen saison</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)', textAlign: 'center', marginTop: 6 }}>{bilan.rpeMoySaison}/5</div>
        </Card>
      </div>

      {/* Stats collectives */}
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <BarChart3 size={11} /> Stats collectives
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        <StatBox label="Buts marqués" value={bilan.totalButs} color="var(--success)" />
        <StatBox label="Buts encaissés" value={bilan.totalEncaisses} color="var(--danger)" />
        <StatBox label="Dist. moy./match" value={bilan.distMoyenne !== '—' ? `${bilan.distMoyenne}km` : '—'} color={'var(--primary)'} />
      </div>

      {/* Top buteurs */}
      {bilan.topButeurs.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Goal size={14} color={'var(--primary)'} /> Classement buteurs</p>
          <BarChart data={bilan.topButeurs} maxValue={Math.max(...bilan.topButeurs.map(b => b.value)) + 1} />
        </Card>
      )}

      {/* Top passeurs — même présentation que le classement buteurs */}
      {bilan.topPasseurs.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Target size={14} color={CAT_COLORS.violet.color} /> Classement passeurs</p>
          <BarChart data={bilan.topPasseurs} maxValue={Math.max(...bilan.topPasseurs.map(b => b.value)) + 1} />
        </Card>
      )}
    </div>
  )
}
