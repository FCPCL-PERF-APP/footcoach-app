import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'

export default function ClassementButeursPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [classement, setClassement] = useState([])
  const [classementPD, setClassementPD] = useState([])
  const [activeTab, setActiveTab] = useState('buteurs')

  useEffect(() => { loadClassement() }, [])

  async function loadClassement() {
    setLoading(true)
    const { data } = await supabase
      .from('stats_match')
      .select('joueur_id, buts, passes_decisives, joueurs(nom, prenom, poste, photo_url)')
      .order('created_at', { ascending: false })

    // Classement buteurs
    const butsMap = {}
    const passesMap = {}
    for (const s of (data || [])) {
      if (!s.joueurs) continue
      const nom = `${s.joueurs.nom} ${s.joueurs.prenom}`
      if (!butsMap[nom]) butsMap[nom] = { nom, poste: s.joueurs.poste, photo_url: s.joueurs.photo_url, buts: 0, matchs: 0, joueur_id: s.joueur_id }
      butsMap[nom].buts += (s.buts || 0)
      butsMap[nom].matchs++
      if (!passesMap[nom]) passesMap[nom] = { nom, poste: s.joueurs.poste, photo_url: s.joueurs.photo_url, passes: 0, matchs: 0 }
      passesMap[nom].passes += (s.passes_decisives || 0)
      passesMap[nom].matchs++
    }

    const buteurs = Object.values(butsMap)
      .filter(j => j.buts > 0)
      .sort((a, b) => b.buts - a.buts)

    const passeurs = Object.values(passesMap)
      .filter(j => j.passes > 0)
      .sort((a, b) => b.passes - a.passes)

    setClassement(buteurs)
    setClassementPD(passeurs)
    setLoading(false)
  }

  function Medal({ rank }) {
    if (rank === 1) return <span style={{ fontSize: 20 }}>🥇</span>
    if (rank === 2) return <span style={{ fontSize: 20 }}>🥈</span>
    if (rank === 3) return <span style={{ fontSize: 20 }}>🥉</span>
    return <span style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', width: 24, textAlign: 'center', display: 'inline-block' }}>{rank}</span>
  }

  const displayed = activeTab === 'buteurs' ? classement : classementPD
  const maxVal = displayed.length > 0 ? (activeTab === 'buteurs' ? displayed[0].buts : displayed[0].passes) : 1

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="🏆 Classement saison" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[['buteurs','⚽ Buteurs'],['passeurs','🅰️ Passeurs']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400
          }}>{lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Podium top 3 */}
          {displayed.length >= 3 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
              {/* 2ème */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 14, fontWeight: 700, color: '#6B7280', overflow: 'hidden' }}>
                  {displayed[1].photo_url ? <img src={displayed[1].photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayed[1].nom[0]}
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{displayed[1].nom.split(' ')[0]}</p>
                <div style={{ background: '#9CA3AF', borderRadius: '6px 6px 0 0', padding: '8px 4px', marginTop: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{activeTab === 'buteurs' ? displayed[1].buts : displayed[1].passes}</span>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.8)' }}>{activeTab === 'buteurs' ? 'buts' : 'passes'}</div>
                </div>
                <div style={{ background: '#6B7280', height: 4 }} />
                <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>🥈</p>
              </div>
              {/* 1er */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#FEF3C7', border: '2px solid #F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 18, fontWeight: 700, color: '#854F0B', overflow: 'hidden' }}>
                  {displayed[0].photo_url ? <img src={displayed[0].photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayed[0].nom[0]}
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{displayed[0].nom.split(' ')[0]}</p>
                <div style={{ background: THEME.primary, borderRadius: '6px 6px 0 0', padding: '12px 4px', marginTop: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{activeTab === 'buteurs' ? displayed[0].buts : displayed[0].passes}</span>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.8)' }}>{activeTab === 'buteurs' ? 'buts' : 'passes'}</div>
                </div>
                <div style={{ background: THEME.primaryDark, height: 4 }} />
                <p style={{ fontSize: 10, color: '#F59E0B', marginTop: 2 }}>🥇</p>
              </div>
              {/* 3ème */}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 13, fontWeight: 700, color: '#854F0B', overflow: 'hidden' }}>
                  {displayed[2].photo_url ? <img src={displayed[2].photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayed[2].nom[0]}
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{displayed[2].nom.split(' ')[0]}</p>
                <div style={{ background: '#CD7F32', borderRadius: '6px 6px 0 0', padding: '6px 4px', marginTop: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{activeTab === 'buteurs' ? displayed[2].buts : displayed[2].passes}</span>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,.8)' }}>{activeTab === 'buteurs' ? 'buts' : 'passes'}</div>
                </div>
                <div style={{ background: '#A0522D', height: 4 }} />
                <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>🥉</p>
              </div>
            </div>
          )}

          {/* Liste complète */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
              {activeTab === 'buteurs' ? '⚽ Classement des buteurs' : '🅰️ Classement des passeurs'} — {displayed.length} joueur(s)
            </p>
            {displayed.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>
                Aucune donnée pour l'instant. Les statistiques s'alimentent depuis les fiches de match.
              </p>
            ) : (
              displayed.map((j, i) => {
                const val = activeTab === 'buteurs' ? j.buts : j.passes
                const pct = Math.round((val / maxVal) * 100)
                return (
                  <div key={j.nom} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <Medal rank={i + 1} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: 13, fontWeight: i < 3 ? 700 : 500 }}>{j.nom}</p>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: i === 0 ? THEME.primary : '#374151' }}>{val}</span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>{activeTab === 'buteurs' ? 'buts' : 'passes'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, background: i === 0 ? THEME.primary : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7F32' : '#D1D5DB', width: `${pct}%`, transition: 'width .5s' }} />
                          </div>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{j.matchs} matchs</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </Card>
        </>
      )}
    </div>
  )
}
