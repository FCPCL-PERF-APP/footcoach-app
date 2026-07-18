import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { bornesSaison } from '../lib/saison'
import { Card, PageHeader, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { Archive, CheckCircle2, AlertTriangle, XCircle, Check, Hourglass, X } from 'lucide-react'

export default function ArchiveSaisonPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [archiving, setArchiving] = useState(false)
  const [archived, setArchived] = useState(false)
  const [step, setStep] = useState(0) // 0=aperçu, 1=confirmation, 2=terminé
  const [error, setError] = useState(null)
  const [saisonLabel, setSaisonLabel] = useState('')

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    setLoading(true)
    const { year, debut, fin } = bornesSaison()
    setSaisonLabel(`${year}/${year+1}`)

    const [
      { count: nbMatchs },
      { count: nbSeances },
      { count: nbJoueurs },
      { data: eventsSaison },
    ] = await Promise.all([
      supabase.from('evenements').select('*', { count: 'exact', head: true }).eq('type', 'match').gte('date_heure', debut).lte('date_heure', fin),
      supabase.from('evenements').select('*', { count: 'exact', head: true }).eq('type', 'seance').gte('date_heure', debut).lte('date_heure', fin),
      supabase.from('joueurs').select('*', { count: 'exact', head: true }),
      supabase.from('evenements').select('id').gte('date_heure', debut).lte('date_heure', fin),
    ])

    const eventIds = (eventsSaison || []).map(e => e.id)
    const [{ count: nbRpe }, { count: nbFootbar }, { data: statsData }] = eventIds.length
      ? await Promise.all([
          supabase.from('rpe').select('*', { count: 'exact', head: true }).in('evenement_id', eventIds),
          supabase.from('footbar').select('*', { count: 'exact', head: true }).in('evenement_id', eventIds),
          supabase.from('stats_collectives').select('buts_marques, buts_encaisses').in('evenement_id', eventIds),
        ])
      : [{ count: 0 }, { count: 0 }, { data: [] }]

    const totalButs = (statsData || []).reduce((s, r) => s + (r.buts_marques || 0), 0)
    const totalEnc = (statsData || []).reduce((s, r) => s + (r.buts_encaisses || 0), 0)
    const victoires = (statsData || []).filter(s => (s.buts_marques||0) > (s.buts_encaisses||0)).length
    const nuls = (statsData || []).filter(s => (s.buts_marques||0) === (s.buts_encaisses||0) && s.buts_marques !== null).length
    const defaites = (statsData || []).filter(s => (s.buts_marques||0) < (s.buts_encaisses||0)).length

    setStats({ nbMatchs: nbMatchs||0, nbSeances: nbSeances||0, nbJoueurs: nbJoueurs||0, nbRpe: nbRpe||0, nbFootbar: nbFootbar||0, totalButs, totalEnc, victoires, nuls, defaites })
    setLoading(false)
  }

  async function archiverSaison() {
    setArchiving(true)
    setError(null)

    try {
      // 1. Sauvegarder le résumé dans archives_saisons
      const { error: archErr } = await supabase.from('archives_saisons').insert({
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
      if (archErr) throw new Error('Erreur sauvegarde archive : ' + archErr.message)

      // 2. Ne cibler que les événements de la saison archivée (pas tout l'historique)
      const { debut, fin } = bornesSaison()
      const { data: eventsSaison } = await supabase.from('evenements').select('id')
        .gte('date_heure', debut).lte('date_heure', fin)
      const eventIds = (eventsSaison || []).map(e => e.id)

      if (eventIds.length) {
        const tablesParEvenement = ['rpe', 'footbar', 'stats_match', 'stats_collectives', 'presences', 'convocations', 'rapports_match']
        for (const table of tablesParEvenement) {
          const { error: delErr } = await supabase.from(table).delete().in('evenement_id', eventIds)
          if (delErr) console.warn(`Erreur suppression ${table}:`, delErr.message)
        }
      }

      // 3. Sondages de la saison (rattachés par date de création, pas par événement)
      const { data: sondagesSaison } = await supabase.from('sondages').select('id')
        .gte('created_at', debut).lte('created_at', fin)
      const sondageIds = (sondagesSaison || []).map(s => s.id)
      if (sondageIds.length) {
        const { error: votesErr } = await supabase.from('sondage_votes').delete().in('sondage_id', sondageIds)
        if (votesErr) console.warn('Erreur suppression votes sondages:', votesErr.message)
        const { error: sondagesErr } = await supabase.from('sondages').delete().in('id', sondageIds)
        if (sondagesErr) console.warn('Erreur suppression sondages:', sondagesErr.message)
      }

      // 4. Supprimer les événements de la saison (et seulement ceux-là)
      if (eventIds.length) {
        const { error: evErr } = await supabase.from('evenements').delete().in('id', eventIds)
        if (evErr) console.warn('Erreur suppression événements:', evErr.message)
      }

      // 5. Blessures : on garde tout, elles ont leur propre historique indépendant

      setStep(2)
    } catch (err) {
      setError(err.message)
    }
    setArchiving(false)
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title={<span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Archive size={18} /> Archiver la saison</span>} />

      {step === 2 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: 20 }}>
            <CheckCircle2 size={44} color={'var(--success)'} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>
              Saison {saisonLabel} archivée !
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Les données ont été sauvegardées et l'app est prête pour la nouvelle saison.
            </p>
            <div style={{ background: 'var(--success-bg)', borderRadius: 10, padding: 12, textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><CheckCircle2 size={12} /> Ce qui a été fait :</p>
              <p style={{ fontSize: 11, color: 'var(--success)' }}>• Résumé de la saison sauvegardé</p>
              <p style={{ fontSize: 11, color: 'var(--success)' }}>• RPE, Footbar, Stats, Présences effacés</p>
              <p style={{ fontSize: 11, color: 'var(--success)' }}>• Événements passés supprimés</p>
              <p style={{ fontSize: 11, color: 'var(--success)' }}>• Joueurs et fiches conservés</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Résumé saison */}
          <div style={{ background: 'var(--gradient)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Archive size={14} /> Bilan saison {saisonLabel}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                ['Matchs', stats.nbMatchs],
                ['Séances', stats.nbSeances],
                ['Joueurs', stats.nbJoueurs],
                ['Victoires', stats.victoires],
                ['Nuls', stats.nuls],
                ['Défaites', stats.defaites],
                ['Buts', stats.totalButs],
                ['Encaissés', stats.totalEnc],
                ['RPE', stats.nbRpe],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 4px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Avertissement */}
          <Card style={{ background: '#FDFAEE', border: '0.5px solid #F5C4B3', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#854F0B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Action irréversible</p>
            <p style={{ fontSize: 12, color: '#854F0B', marginBottom: 6 }}>Cette action va :</p>
            {[
              { ok: true, text: 'Sauvegarder le résumé de la saison' },
              { ok: true, text: 'Conserver les fiches joueurs et leur historique' },
              { ok: false, text: 'Effacer tous les RPE, Footbar, Stats, Présences' },
              { ok: false, text: 'Supprimer les événements passés' },
              { ok: false, text: 'Remettre les sondages à zéro' },
            ].map(item => (
              <p key={item.text} style={{ fontSize: 11, color: item.ok ? 'var(--success)' : 'var(--danger)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                {item.ok ? <Check size={11} /> : <X size={11} />} {item.text}
              </p>
            ))}
          </Card>

          {error && (
            <Card style={{ background: 'var(--danger-bg)', marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 5 }}><XCircle size={12} /> {error}</p>
            </Card>
          )}

          {step === 0 && (
            <button onClick={() => setStep(1)} style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: '#854F0B', color: '#fff',
              border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <Archive size={14} /> Archiver la saison {saisonLabel}
            </button>
          )}

          {step === 1 && (
            <Card style={{ background: 'var(--danger-bg)', border: `1px solid ${'var(--danger)'}` }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)', marginBottom: 8, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <AlertTriangle size={14} /> Confirmer l'archivage ?
              </p>
              <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 14, textAlign: 'center' }}>
                Cette action est définitive. Es-tu sûr de vouloir archiver la saison {saisonLabel} ?
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setStep(0)} style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  border: '0.5px solid var(--border)', background: '#fff',
                  fontSize: 13, cursor: 'pointer'
                }}>Annuler</button>
                <button onClick={archiverSaison} disabled={archiving} style={{
                  flex: 1, padding: 12, borderRadius: 10,
                  background: 'var(--danger)', color: '#fff',
                  border: 'none', fontSize: 13, fontWeight: 700, cursor: archiving ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  {archiving ? <><Hourglass size={13} /> Archivage...</> : <><Check size={13} /> Confirmer</>}
                </button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
