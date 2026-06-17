import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function DashboardStatsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [matchs, setMatchs] = useState([])

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    const { data } = await supabase
      .from('stats_collectives')
      .select('*, evenements(titre, date_heure)')
      .order('created_at', { ascending: false })

    setMatchs(data || [])

    if (data?.length) {
      const nbMatchs = data.length
      const victoires = data.filter(s => (s.buts_marques || 0) > (s.buts_encaisses || 0)).length
      const nuls = data.filter(s => (s.buts_marques || 0) === (s.buts_encaisses || 0)).length
      const defaites = data.filter(s => (s.buts_marques || 0) < (s.buts_encaisses || 0)).length
      const totalButs = data.reduce((s,r) => s+(r.buts_marques||0), 0)
      const totalEnc = data.reduce((s,r) => s+(r.buts_encaisses||0), 0)
      const pts = victoires * 3 + nuls

      // Buts marqués par type
      const butMarqueAP = data.reduce((s,r) => s+(r.but_marque_attaque_placee||0), 0)
      const butMarqueCA = data.reduce((s,r) => s+(r.but_marque_contre_attaque||0), 0)
      const butMarqueCorner = data.reduce((s,r) => s+(r.but_marque_corner||0), 0)
      const butMarquePen = data.reduce((s,r) => s+(r.but_marque_penalty||0), 0)
      const butMarqueCF = data.reduce((s,r) => s+(r.but_marque_coup_franc||0), 0)

      // Buts encaissés par type
      const butEncAP = data.reduce((s,r) => s+(r.but_enc_attaque_placee||0), 0)
      const butEncCA = data.reduce((s,r) => s+(r.but_enc_contre_attaque||0), 0)
      const butEncCorner = data.reduce((s,r) => s+(r.but_enc_corner||0), 0)
      const butEncPen = data.reduce((s,r) => s+(r.but_enc_penalty||0), 0)
      const butEncCF = data.reduce((s,r) => s+(r.but_enc_coup_franc||0), 0)

      // Buts par période (marqués)
      const periodes = ['0_15','15_30','30_45','45_60','60_75','75_90']
      const butsParPeriode = periodes.map(p => data.reduce((s,r) => s+(r[`buts_${p}`]||0), 0))
      const butsEncParPeriode = periodes.map(p => data.reduce((s,r) => s+(r[`buts_enc_${p}`]||0), 0))

      setStats({
        nbMatchs, victoires, nuls, defaites, pts, totalButs, totalEnc,
        butMarqueAP, butMarqueCA, butMarqueCorner, butMarquePen, butMarqueCF,
        butEncAP, butEncCA, butEncCorner, butEncPen, butEncCF,
        butsParPeriode, butsEncParPeriode
      })
    }
    setLoading(false)
  }

  const periodeLabels = ['0-15\'', '15-30\'', '30-45\'', '45-60\'', '60-75\'', '75-90\'']

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="📊 Bilan des matchs" />

      {loading ? <Spinner /> : !stats ? (
        <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucune stat de match enregistrée.</p></Card>
      ) : (
        <>
          {/* Résultats globaux */}
          <div style={{ background: THEME.gradient, borderRadius: 16, padding: '14px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', textAlign: 'center', marginBottom: 10 }}>
              {stats.nbMatchs} matchs disputés
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                ['Pts', stats.pts, '#FFD700'],
                ['V', stats.victoires, '#4ADE80'],
                ['N', stats.nuls, '#FCD34D'],
                ['D', stats.defaites, '#F87171'],
              ].map(([lbl, val, color]) => (
                <div key={lbl} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{lbl}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, fontSize: 12 }}>
              <span style={{ color: '#4ADE80' }}>⚽ {stats.totalButs} buts marqués</span>
              <span style={{ color: '#F87171' }}>🥅 {stats.totalEnc} encaissés</span>
            </div>
          </div>

          {/* Buts marqués par type */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#3B6D11', marginBottom: 10 }}>⚽ Buts marqués par type</p>
            {[
              ['Attaque placée', stats.butMarqueAP],
              ['Contre-attaque', stats.butMarqueCA],
              ['Corner', stats.butMarqueCorner],
              ['Pénalty', stats.butMarquePen],
              ['Coup-franc', stats.butMarqueCF],
            ].map(([label, val]) => {
              const pct = stats.totalButs > 0 ? Math.round(val/stats.totalButs*100) : 0
              return (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 600, color: '#3B6D11' }}>{val} but(s) ({pct}%)</span>
                  </div>
                  <div style={{ height: 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: '#3B6D11', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </Card>

          {/* Buts encaissés par type */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D', marginBottom: 10 }}>🥅 Buts encaissés par type</p>
            {[
              ['Attaque placée', stats.butEncAP],
              ['Contre-attaque', stats.butEncCA],
              ['Corner', stats.butEncCorner],
              ['Pénalty', stats.butEncPen],
              ['Coup-franc', stats.butEncCF],
            ].map(([label, val]) => {
              const pct = stats.totalEnc > 0 ? Math.round(val/stats.totalEnc*100) : 0
              return (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 600, color: '#A32D2D' }}>{val} but(s) ({pct}%)</span>
                  </div>
                  <div style={{ height: 7, background: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: '#A32D2D', width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </Card>

          {/* Buts par période */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>⏱️ Buts par période</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 4 }}>
              {periodeLabels.map((label, i) => {
                const marques = stats.butsParPeriode[i]
                const enc = stats.butsEncParPeriode[i]
                const maxVal = Math.max(1, ...stats.butsParPeriode, ...stats.butsEncParPeriode)
                return (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: '#9CA3AF', marginBottom: 4 }}>{label}</div>
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end', height: 50 }}>
                      <div style={{ width: 8, background: '#3B6D11', borderRadius: 2, height: `${marques/maxVal*100}%`, minHeight: marques > 0 ? 4 : 0 }} />
                      <div style={{ width: 8, background: '#A32D2D', borderRadius: 2, height: `${enc/maxVal*100}%`, minHeight: enc > 0 ? 4 : 0 }} />
                    </div>
                    <div style={{ fontSize: 9, color: '#3B6D11', marginTop: 2 }}>{marques}</div>
                    <div style={{ fontSize: 9, color: '#A32D2D' }}>{enc}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, fontSize: 10 }}>
              <span>🟩 Marqués</span><span>🟥 Encaissés</span>
            </div>
          </Card>

          {/* Liste matchs */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Résultats détaillés</p>
            {matchs.map(m => {
              const v = (m.buts_marques||0) > (m.buts_encaisses||0)
              const n = (m.buts_marques||0) === (m.buts_encaisses||0)
              return (
                <div key={m.id} onClick={() => navigate(`/stats/${m.evenement_id}`)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600 }}>{m.evenements?.titre}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF' }}>{m.evenements?.date_heure ? format(parseISO(m.evenements.date_heure), 'd MMM yyyy', { locale: fr }) : ''}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{m.buts_marques}-{m.buts_encaisses}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: v ? '#EAF3DE' : n ? '#FAEEDA' : '#FCEBEB',
                      color: v ? '#3B6D11' : n ? '#854F0B' : '#A32D2D' }}>
                      {v ? 'V' : n ? 'N' : 'D'}
                    </span>
                  </div>
                </div>
              )
            })}
          </Card>
        </>
      )}
    </div>
  )
}
