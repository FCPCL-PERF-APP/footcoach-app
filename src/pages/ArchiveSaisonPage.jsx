import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'

export default function ArchiveSaisonPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [archived, setArchived] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [saisonLabel, setSaisonLabel] = useState('')

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    const year = new Date().getFullYear()
    setSaisonLabel(`${year-1}/${year}`)

    const [
      { count: nbMatchs },
      { count: nbSeances },
      { count: nbJoueurs },
      { count: nbRpe },
      { count: nbFootbar },
      { data: statsData }
    ] = await Promise.all([
      supabase.from('evenements').select('*', { count: 'exact', head: true }).eq('type', 'match'),
      supabase.from('evenements').select('*', { count: 'exact', head: true }).eq('type', 'seance'),
      supabase.from('joueurs').select('*', { count: 'exact', head: true }),
      supabase.from('rpe').select('*', { count: 'exact', head: true }),
      supabase.from('footbar').select('*', { count: 'exact', head: true }),
      supabase.from('stats_collectives').select('buts_marques, buts_encaisses'),
    ])

    const totalButs = (statsData || []).reduce((s, r) => s + (r.buts_marques || 0), 0)
    const totalEnc = (statsData || []).reduce((s, r) => s + (r.buts_encaisses || 0), 0)
    const victoires = (statsData || []).filter(s => s.buts_marques > s.buts_encaisses).length
    const nuls = (statsData || []).filter(s => s.buts_marques === s.buts_encaisses).length
    const defaites = (statsData || []).filter(s => s.buts_marques < s.buts_encaisses).length

    setStats({ nbMatchs, nbSeances, nbJoueurs, nbRpe, nbFootbar, totalButs, totalEnc, victoires, nuls, defaites })
    setLoading(false)
  }

  async function archiverSaison() {
    if (!confirmed) { setConfirmed(true); return }
    setArchiving(true)

    try {
      // 1. Sauvegarde les stats dans une table archives
      await supabase.from('archives_saisons').insert({
        saison: saisonLabel,
        nb_matchs: stats.nbMatchs,
        nb_seances: stats.nbSeances,
        nb_joueurs: stats.nbJoueurs,
        victoires: stats.victoires,
        nuls: stats.nuls,
        defaites: stats.defaites,
        buts_marques: stats.totalButs,
        buts_encaisses: stats.totalEnc,
        nb_rpe: stats.nbRpe,
        archived_at: new Date().toISOString()
      })

      // 2. Supprime les événements passés
      const debutSaison = `${new Date().getFullYear()-1}-07-01`
      await supabase.from('evenements').delete().lte('date_heure', new Date().toISOString()).gte('date_heure', debutSaison)

      // 3. Réinitialise les données de la saison (RPE, Footbar, stats, présences)
      await supabase.from('rpe').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('footbar').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('stats_match').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('stats_collectives').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('presences').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('convocations').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('objectifs').delete().neq('id', '00000000-0000-0000-0000-000000000000')

      setArchived(true)
    } catch (err) {
      alert('Erreur lors de l\'archivage : ' + err.message)
    }
    setArchiving(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="📦 Archiver la saison" />

      {archived ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#3B6D11' }}>Saison {saisonLabel} archivée !</p>
            <p style={{ fontSize: 13, color: '#9CA3AF', marginTop: 8 }}>
              L'app est prête pour la nouvelle saison. Les joueurs et leurs fiches sont conservés.
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* Résumé saison */}
          <Card>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>📊 Bilan saison {saisonLabel}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                ['Matchs', stats?.nbMatchs],
                ['Séances', stats?.nbSeances],
                ['Joueurs', stats?.nbJoueurs],
                ['V', stats?.victoires, '#3B6D11'],
                ['N', stats?.nuls, '#BA7517'],
                ['D', stats?.defaites, '#A32D2D'],
                ['Buts +', stats?.totalButs, '#3B6D11'],
                ['Buts -', stats?.totalEnc, '#A32D2D'],
                ['RPE saisis', stats?.nbRpe],
              ].map(([lbl, val, color]) => (
                <div key={lbl} style={{ background: '#F9FAFB', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: color || THEME.primary }}>{val ?? '—'}</div>
                  <div style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Ce qui sera conservé / supprimé */}
          <Card>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Que se passe-t-il lors de l'archivage ?</p>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#3B6D11', marginBottom: 4 }}>✅ Conservé</p>
              {['Fiches joueurs (nom, poste, contacts...)', 'Photos joueurs', 'Historique blessures', 'Données archivées de cette saison'].map(item => (
                <p key={item} style={{ fontSize: 12, color: '#6B7280', paddingLeft: 8, marginBottom: 2 }}>· {item}</p>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#A32D2D', marginBottom: 4 }}>🗑️ Réinitialisé</p>
              {['Calendrier des événements', 'Données RPE', 'Données Footbar', 'Stats de matchs', 'Présences et convocations', 'Objectifs individuels'].map(item => (
                <p key={item} style={{ fontSize: 12, color: '#6B7280', paddingLeft: 8, marginBottom: 2 }}>· {item}</p>
              ))}
            </div>
          </Card>

          {/* Confirmation */}
          {confirmed && (
            <div style={{ background: '#FCEBEB', border: '0.5px solid #FCA5A5', borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#A32D2D', marginBottom: 6 }}>⚠️ Dernière confirmation</p>
              <p style={{ fontSize: 12, color: '#6B7280' }}>
                Cette action est <strong>irréversible</strong>. Toutes les données de la saison seront supprimées. Les fiches joueurs sont conservées.
              </p>
            </div>
          )}

          <Button
            onClick={archiverSaison}
            disabled={archiving}
            style={{
              width: '100%', padding: 14,
              background: confirmed ? '#A32D2D' : THEME.gradient,
              color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}>
            {archiving ? 'Archivage en cours...' :
             confirmed ? '🗑️ Confirmer et archiver définitivement' :
             '📦 Archiver la saison ' + saisonLabel}
          </Button>

          {confirmed && (
            <button onClick={() => setConfirmed(false)}
              style={{ width: '100%', padding: 10, marginTop: 8, background: 'transparent', border: '0.5px solid #D1D5DB', borderRadius: 12, fontSize: 13, color: '#6B7280', cursor: 'pointer' }}>
              Annuler
            </button>
          )}
        </>
      )}
    </div>
  )
}
