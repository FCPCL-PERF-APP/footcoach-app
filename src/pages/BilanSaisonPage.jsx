import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner, BarChart } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { Trophy, Award, Goal, Shield, Target, Heart, BarChart3, TrendingUp, CheckCircle2 } from 'lucide-react'

function StatBox({ label, value, sub, color = THEME.primary, big = false }) {
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
  const [bilan, setBilan] = useState(null)
  const [saisonYear, setSaisonYear] = useState(null)

  useEffect(() => { loadBilan() }, [])

  async function loadBilan() {
    setLoading(true)
    const { year, debut, fin } = bornesSaison()
    setSaisonYear(year)

    // Récupère d'abord les IDs des événements de la saison en cours, pour borner
    // toutes les stats qui en dépendent (sinon "bilan de saison" mélange plusieurs
    // saisons tant que l'archivage n'a pas eu lieu).
    const { data: eventsSaisonIds } = await supabase.from('evenements').select('id')
      .gte('date_heure', debut).lte('date_heure', fin)
    const idsSaison = (eventsSaisonIds || []).map(e => e.id)

    const [
      { data: matchStatsRaw },
      { data: rpeData },
      { data: footData },
      { data: statsIndivRaw },
      { data: presences },
      { data: eventsRaw },
    ] = await Promise.all([
      supabase.from('stats_collectives').select('*, evenements(titre,date_heure,match_type)').in('evenement_id', idsSaison).order('created_at', { ascending: true }),
      supabase.from('rpe').select('*, joueurs(nom,prenom)').in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('footbar').select('*, joueurs(nom,prenom)').in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('stats_match').select('*, joueurs(nom,prenom), evenements(match_type)').in('evenement_id', idsSaison).order('created_at', { ascending: false }),
      supabase.from('presences').select('*, joueurs(nom,prenom)').in('evenement_id', idsSaison),
      supabase.from('evenements').select('*').eq('type', 'match').gte('date_heure', debut).lte('date_heure', fin),
    ])

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

    // ===== MEILLEUR BUTEUR =====
    const butsParJoueur = {}
    for (const s of (statsIndiv || [])) {
      if (!s.joueurs || !s.buts) continue
      const nom = `${s.joueurs.nom} ${s.joueurs.prenom}`
      butsParJoueur[nom] = (butsParJoueur[nom] || 0) + s.buts
    }
    const meilleurButeur = Object.entries(butsParJoueur).sort((a,b) => b[1]-a[1])[0]

    // ===== MEILLEUR PASSEUR =====
    const passesParJoueur = {}
    for (const s of (statsIndiv || [])) {
      if (!s.joueurs || !s.passes_decisives) continue
      const nom = `${s.joueurs.nom} ${s.joueurs.prenom}`
      passesParJoueur[nom] = (passesParJoueur[nom] || 0) + s.passes_decisives
    }
    const meilleurPasseur = Object.entries(passesParJoueur).sort((a,b) => b[1]-a[1])[0]

    // ===== PRÉSENCE =====
    const presenceParJoueur = {}
    for (const p of (presences || [])) {
      if (!p.joueurs) continue
      const nom = `${p.joueurs.nom} ${p.joueurs.prenom}`
      if (!presenceParJoueur[nom]) presenceParJoueur[nom] = { total: 0, present: 0 }
      presenceParJoueur[nom].total++
      if (p.statut === 'present') presenceParJoueur[nom].present++
    }
    const topPresence = Object.entries(presenceParJoueur)
      .map(([nom, d]) => ({ nom, taux: d.total > 0 ? Math.round(d.present/d.total*100) : 0, present: d.present, total: d.total }))
      .sort((a,b) => b.taux - a.taux)[0]

    // ===== RPE MOYEN SAISON =====
    const rpeVals = (rpeData || []).map(r => {
      const vals = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v !== null && v !== undefined)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }).filter(v => v !== null)
    const rpeMoySaison = rpeVals.length ? (rpeVals.reduce((a,b) => a+b, 0) / rpeVals.length).toFixed(1) : '—'

    // ===== DISTANCE TOTALE FOOTBAR =====
    const distTotale = (footData || []).reduce((s, f) => s + (f.distance_km || 0), 0).toFixed(0)

    // ===== TOP BUTEURS CHART =====
    const topButeurs = Object.entries(butsParJoueur)
      .sort((a,b) => b[1]-a[1]).slice(0,6)
      .map(([nom, buts]) => ({ label: nom.split(' ')[0], value: buts, color: THEME.primary }))

    // ===== ÉVOLUTION RÉSULTATS =====
    const resultats = (matchStats || []).map((s, i) => ({
      label: `J${i+1}`,
      value: s.buts_marques - s.buts_encaisses,
      color: s.buts_marques > s.buts_encaisses ? '#3B6D11' : s.buts_marques === s.buts_encaisses ? '#BA7517' : '#A32D2D'
    }))

    setBilan({
      victoires, nuls, defaites, totalMatchs,
      totalButs, totalEncaisses,
      meilleurButeur, meilleurPasseur,
      topPresence, rpeMoySaison, distTotale,
      topButeurs, resultats
    })
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>
  if (!bilan) return null

  const ptsCalcules = bilan.victoires * 3 + bilan.nuls
  const diffButs = bilan.totalButs - bilan.totalEncaisses

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Trophy size={18} /> Bilan de saison</span>} />

      {/* Résultats globaux */}
      <div style={{ background: THEME.gradient, borderRadius: 16, padding: '16px 14px', marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginBottom: 10, textAlign: 'center' }}>
          Saison {saisonYear}/{saisonYear+1} · {bilan.totalMatchs} matchs disputés
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {[
            ['Pts', ptsCalcules, '#FFD700'],
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
            <div style={{ textAlign: 'center', marginBottom: 4 }}><Goal size={22} color={THEME.primary} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>Meilleur buteur</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 2 }}>{bilan.meilleurButeur[0].split(' ')[0]}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: THEME.primary, textAlign: 'center' }}>{bilan.meilleurButeur[1]} buts</div>
          </Card>
        )}
        {bilan.meilleurPasseur && (
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 4 }}><Target size={22} color={THEME.primary} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>Meilleur passeur</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 2 }}>{bilan.meilleurPasseur[0].split(' ')[0]}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: THEME.primary, textAlign: 'center' }}>{bilan.meilleurPasseur[1]} passes</div>
          </Card>
        )}
        {bilan.topPresence && (
          <Card>
            <div style={{ textAlign: 'center', marginBottom: 4 }}><CheckCircle2 size={22} color={THEME.success} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>Meilleure présence</div>
            <div style={{ fontSize: 13, fontWeight: 700, textAlign: 'center', marginTop: 2 }}>{bilan.topPresence.nom.split(' ')[0]}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: THEME.success, textAlign: 'center' }}>{bilan.topPresence.taux}%</div>
          </Card>
        )}
        <Card>
          <div style={{ textAlign: 'center', marginBottom: 4 }}><Heart size={22} color={CAT_COLORS.rose.color} /></div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>RPE moyen saison</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: THEME.primary, textAlign: 'center', marginTop: 6 }}>{bilan.rpeMoySaison}/5</div>
        </Card>
      </div>

      {/* Stats collectives */}
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <BarChart3 size={11} /> Stats collectives
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        <StatBox label="Buts marqués" value={bilan.totalButs} color="#3B6D11" />
        <StatBox label="Buts encaissés" value={bilan.totalEncaisses} color="#A32D2D" />
        <StatBox label="Dist. totale" value={`${bilan.distTotale}km`} color={THEME.primary} />
      </div>

      {/* Top buteurs */}
      {bilan.topButeurs.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Goal size={14} color={THEME.primary} /> Classement buteurs</p>
          <BarChart data={bilan.topButeurs} maxValue={Math.max(...bilan.topButeurs.map(b => b.value)) + 1} />
        </Card>
      )}

      {/* Évolution résultats */}
      {bilan.resultats.length > 0 && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={14} color={THEME.primary} /> Différence de buts par match</p>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60 }}>
            {bilan.resultats.map((r, i) => {
              const h = Math.abs(r.value) * 12 + 10
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ fontSize: 9, color: r.color, fontWeight: 600 }}>{r.value > 0 ? `+${r.value}` : r.value}</div>
                  <div style={{ width: '100%', height: h, background: r.color, borderRadius: 3, opacity: 0.85 }} />
                  <div style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{r.label}</div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
