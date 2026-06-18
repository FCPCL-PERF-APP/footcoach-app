import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function ExportFicheJoueurPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const printRef = useRef(null)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const [
      { data: joueur },
      { data: stats },
      { data: rpe },
      { data: blessures },
      { data: objJoueur },
      { data: presences },
    ] = await Promise.all([
      supabase.from('joueurs').select('*').eq('id', id).single(),
      supabase.from('stats_match').select('*, evenements(match_type)').eq('joueur_id', id),
      supabase.from('rpe').select('*').eq('joueur_id', id).order('created_at', { ascending: false }).limit(20),
      supabase.from('blessures').select('*').eq('joueur_id', id).order('date_debut', { ascending: false }),
      supabase.from('objectifs_joueur').select('*').eq('joueur_id', id).maybeSingle(),
      supabase.from('presences').select('statut, evenements(type)').eq('joueur_id', id),
    ])

    // Calculs stats
    const officiels = (stats || []).filter(s => s.evenements?.match_type !== 'preparation')
    const totalButs = officiels.reduce((s,r) => s+(r.buts||0), 0)
    const totalPD = officiels.reduce((s,r) => s+(r.passes_decisives||0), 0)
    const titularisations = officiels.filter(s => s.titulaire).length
    const tempsVals = officiels.map(s => s.temps_jeu).filter(v => v > 0)
    const tempsMoy = tempsVals.length ? Math.round(tempsVals.reduce((a,b) => a+b,0)/tempsVals.length) : 0
    const notes = officiels.map(s => s.note).filter(v => v > 0)
    const noteMoy = notes.length ? (notes.reduce((a,b) => a+b,0)/notes.length).toFixed(1) : '—'

    // RPE moyen
    const rpeVals = (rpe || []).map(r => {
      const items = [r.difficulte, r.fatigue, r.implication, r.motivation, r.perf_individuelle, r.perf_collective].filter(v => v != null)
      return items.length ? items.reduce((a,b) => a+b,0)/items.length : null
    }).filter(v => v !== null)
    const rpeMoy = rpeVals.length ? (rpeVals.reduce((a,b) => a+b,0)/rpeVals.length).toFixed(1) : '—'

    // Présences entraînements
    const presSeances = (presences || []).filter(p => p.evenements?.type === 'seance')
    const presOk = presSeances.filter(p => p.statut === 'present' || p.statut === 'exterieur').length
    const tauxPres = presSeances.length ? Math.round(presOk/presSeances.length*100) : 0

    setData({ joueur, officiels, totalButs, totalPD, titularisations, tempsMoy, noteMoy, rpeMoy, tauxPres, blessures: blessures||[], objJoueur, nbRpe: (rpe||[]).length })
    setLoading(false)
  }

  function handlePrint() {
    window.print()
  }

  if (loading) return <div style={{ padding: 12 }}><Spinner /></div>
  if (!data) return null

  const { joueur, officiels, totalButs, totalPD, titularisations, tempsMoy, noteMoy, rpeMoy, tauxPres, blessures, objJoueur, nbRpe } = data

  return (
    <>
      {/* Boutons non imprimés */}
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, background: '#F9FAFB', borderBottom: '0.5px solid #E5E7EB' }} className="no-print">
        <button onClick={() => navigate(-1)} style={{ padding: '7px 14px', borderRadius: 8, border: '0.5px solid #D1D5DB', background: '#fff', cursor: 'pointer', fontSize: 12 }}>← Retour</button>
        <button onClick={handlePrint} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: THEME.gradient, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>🖨️ Imprimer / PDF</button>
        <p style={{ fontSize: 11, color: '#9CA3AF', alignSelf: 'center' }}>Sur iPhone : Partager → "Enregistrer en PDF"</p>
      </div>

      {/* Fiche imprimable */}
      <div ref={printRef} style={{ padding: '20px 24px', maxWidth: 680, margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #1A3A6B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {joueur.photo_url
              ? <img src={joueur.photo_url} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #1A3A6B' }} />
              : <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1A3A6B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff' }}>
                  {joueur.nom?.[0]}{joueur.prenom?.[0]}
                </div>
            }
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A3A6B', margin: 0 }}>{joueur.nom} {joueur.prenom}</h1>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '4px 0' }}>{joueur.poste}{joueur.numero ? ` · N°${joueur.numero}` : ''}{joueur.groupe ? ` · Pôle ${joueur.groupe}` : ''}</p>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>{joueur.date_naissance ? `Né le ${format(parseISO(joueur.date_naissance), 'd MMMM yyyy', { locale: fr })}` : ''}</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3A6B' }}>FC PCL</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>Saison 2026/2027</p>
            <p style={{ fontSize: 11, color: '#9CA3AF' }}>{format(new Date(), 'd MMMM yyyy', { locale: fr })}</p>
          </div>
        </div>

        {/* Stats saison */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A3A6B', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' }}>⚽ Statistiques saison</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              ['Matchs joués', officiels.length],
              ['Titularisations', titularisations],
              ['Buts', totalButs],
              ['Passes déc.', totalPD],
              ['Tps jeu moy.', tempsMoy ? `${tempsMoy}'` : '—'],
              ['Note moyenne', noteMoy],
              ['RPE moyen', `${rpeMoy}/5`],
              ['Présence entr.', `${tauxPres}%`],
            ].map(([label, val]) => (
              <div key={label} style={{ background: '#F9FAFB', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: '0.5px solid #E5E7EB' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#1A3A6B' }}>{val}</div>
                <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Objectifs */}
        {objJoueur && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A3A6B', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' }}>🎯 Objectifs & développement</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Points forts */}
              {objJoueur.points_forts && Object.values(objJoueur.points_forts).some(v => v) && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#3B6D11', marginBottom: 8 }}>✅ Points forts</p>
                  {[['💪', 'athletique', 'Athlétique'], ['🧠', 'tactique', 'Tactique'], ['⚽', 'technique', 'Technique'], ['🎯', 'mental', 'Mental']].map(([icon, key, label]) =>
                    objJoueur.points_forts[key] ? (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>{icon} {label} : </span>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>{objJoueur.points_forts[key]}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {/* Axes amélioration */}
              {objJoueur.axes_amelioration && Object.values(objJoueur.axes_amelioration).some(v => v) && (
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#854F0B', marginBottom: 8 }}>⚠️ Axes d'amélioration</p>
                  {[['💪', 'athletique', 'Athlétique'], ['🧠', 'tactique', 'Tactique'], ['⚽', 'technique', 'Technique'], ['🎯', 'mental', 'Mental']].map(([icon, key, label]) =>
                    objJoueur.axes_amelioration[key] ? (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>{icon} {label} : </span>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>{objJoueur.axes_amelioration[key]}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>

            {/* Objectifs perso */}
            {(objJoueur.obj_perso_1 || objJoueur.obj_perso_2 || objJoueur.obj_perso_3) && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>🏆 Objectifs personnels saison</p>
                {[objJoueur.obj_perso_1, objJoueur.obj_perso_2, objJoueur.obj_perso_3].filter(Boolean).map((obj, i) => (
                  <p key={i} style={{ fontSize: 11, margin: '3px 0', paddingLeft: 12 }}>• {obj}</p>
                ))}
              </div>
            )}

            {/* Bilan */}
            {(objJoueur.bilan_obj_perso_atteints !== null || objJoueur.bilan_commentaire) && (
              <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, border: '0.5px solid #E5E7EB' }}>
                <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>📋 Bilan de saison</p>
                {objJoueur.bilan_obj_perso_atteints !== null && (
                  <p style={{ fontSize: 11, marginBottom: 4 }}>
                    Objectifs personnels atteints : <strong>{objJoueur.bilan_obj_perso_atteints ? '✅ Oui' : '❌ Non'}</strong>
                  </p>
                )}
                {objJoueur.bilan_obj_collectifs_atteints !== null && (
                  <p style={{ fontSize: 11, marginBottom: 4 }}>
                    Objectifs collectifs atteints : <strong>{objJoueur.bilan_obj_collectifs_atteints ? '✅ Oui' : '❌ Non'}</strong>
                  </p>
                )}
                {objJoueur.bilan_axes_saison_prochaine && (
                  <p style={{ fontSize: 11, marginBottom: 4 }}>Axes saison prochaine : {objJoueur.bilan_axes_saison_prochaine}</p>
                )}
                {objJoueur.bilan_commentaire && (
                  <p style={{ fontSize: 11, fontStyle: 'italic', color: '#6B7280', marginTop: 6 }}>"{objJoueur.bilan_commentaire}"</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Blessures */}
        {blessures.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1A3A6B', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #E5E7EB' }}>🤕 Historique blessures</h2>
            {blessures.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6', fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{b.zone || b.type}</span>
                  <span style={{ color: '#6B7280', marginLeft: 8 }}>{b.gravite}</span>
                </div>
                <div style={{ color: '#9CA3AF' }}>
                  {b.date_debut ? format(parseISO(b.date_debut), 'd MMM yyyy', { locale: fr }) : '—'}
                  {b.date_retour_effective ? ` → ${format(parseISO(b.date_retour_effective), 'd MMM yyyy', { locale: fr })}` : ' → En cours'}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Signature */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 24 }}>Signature du joueur</p>
            <div style={{ width: 180, borderBottom: '1px solid #000' }} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 24 }}>Signature du coach</p>
            <div style={{ width: 180, borderBottom: '1px solid #000' }} />
          </div>
        </div>
        <p style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 16 }}>FC PCL · Plouagat Châtelaudren Lanrodec · Saison 2026/2027</p>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
      `}</style>
    </>
  )
}
