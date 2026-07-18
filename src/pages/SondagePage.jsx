import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ListChecks, Plus, X, Check, Circle, Lock } from 'lucide-react'

export default function SondagePage() {
  const { profile, isCoach, isJoueur } = useAuth()
  const [sondages, setSondages] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ question: '', options: ['', ''], expire_at: '' })
  const [saving, setSaving] = useState(false)
  const [votes, setVotes] = useState({})

  useEffect(() => { loadSondages() }, [])

  async function loadSondages() {
    setLoading(true)
    const { data } = await supabase.from('sondages')
      .select('*, sondage_votes(option_index, user_id)')
      .order('created_at', { ascending: false })
    setSondages(data || [])
    setLoading(false)
  }

  async function createSondage() {
    const opts = form.options.filter(o => o.trim())
    if (!form.question || opts.length < 2) return
    setSaving(true)
    await supabase.from('sondages').insert({
      question: form.question,
      options: opts,
      created_by: profile?.auth_id || profile?.id,
      expire_at: form.expire_at || null,
      actif: true
    })
    setSaving(false)
    setForm({ question: '', options: ['', ''], expire_at: '' })
    setShowCreate(false)
    loadSondages()
  }

  async function voter(sondageId, optionIndex) {
    const myId = profile?.auth_id || profile?.id
    const sondage = sondages.find(s => s.id === sondageId)
    const dejaVote = sondage?.sondage_votes?.find(v => v.user_id === myId)
    if (dejaVote) return

    await supabase.from('sondage_votes').insert({
      sondage_id: sondageId,
      user_id: myId,
      option_index: optionIndex
    })
    setVotes(p => ({ ...p, [sondageId]: optionIndex }))
    loadSondages()
  }

  async function clotureSondage(id) {
    await supabase.from('sondages').update({ actif: false }).eq('id', id)
    loadSondages()
  }

  const myId = profile?.auth_id || profile?.id

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}><ListChecks size={17} color={'var(--primary)'} /> Sondages</h1>
        {isCoach && (
          <button onClick={() => setShowCreate(!showCreate)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: 'var(--primary)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 5
          }}>{showCreate ? <><X size={12} /> Annuler</> : <><Plus size={12} /> Créer</>}</button>
        )}
      </div>

      {/* Formulaire création */}
      {showCreate && isCoach && (
        <Card>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Nouveau sondage</p>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Question</label>
            <input value={form.question} onChange={e => setForm(p => ({...p, question: e.target.value}))}
              placeholder="Quelle date pour le prochain entraînement ?"
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Options (min. 2)</label>
            {form.options.map((opt, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input value={opt} onChange={e => {
                  const newOpts = [...form.options]
                  newOpts[i] = e.target.value
                  setForm(p => ({...p, options: newOpts}))
                }} placeholder={`Option ${i+1}`}
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                {form.options.length > 2 && (
                  <button onClick={() => setForm(p => ({...p, options: p.options.filter((_,j) => j !== i)}))}
                    style={{ padding: '8px 10px', border: 'none', background: 'var(--danger-bg)', borderRadius: 10, cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><X size={13} /></button>
                )}
              </div>
            ))}
            {form.options.length < 5 && (
              <button onClick={() => setForm(p => ({...p, options: [...p.options, '']}))}
                style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                + Ajouter une option
              </button>
            )}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>Date d'expiration (optionnel)</label>
            <input type="datetime-local" value={form.expire_at} onChange={e => setForm(p => ({...p, expire_at: e.target.value}))}
              style={{ width: '100%', padding: '8px 10px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <Button variant="primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={createSondage} disabled={saving}>
            {saving ? 'Création...' : <><Check size={13} /> Envoyer le sondage</>}
          </Button>
        </Card>
      )}

      {loading ? <Spinner /> : (
        sondages.length === 0 ? (
          <Card>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
              Aucun sondage pour l'instant.{isCoach && ' Crée-en un !'}
            </p>
          </Card>
        ) : (
          sondages.map(s => {
            const totalVotes = s.sondage_votes?.length || 0
            const monVote = s.sondage_votes?.find(v => v.user_id === myId)
            const aVote = !!monVote || votes[s.id] !== undefined
            const monChoix = monVote?.option_index ?? votes[s.id]

            return (
              <Card key={s.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700 }}>{s.question}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      {totalVotes} vote(s){s.expire_at ? ` · Expire le ${format(parseISO(s.expire_at), 'd MMM', { locale: fr })}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    background: s.actif ? 'var(--success-bg)' : 'var(--bg-secondary)',
                    color: s.actif ? 'var(--success)' : 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {s.actif ? <><Circle size={7} fill={'var(--success)'} color={'var(--success)'} /> Ouvert</> : <><Lock size={9} /> Clôturé</>}
                  </span>
                </div>

                {(s.options || []).map((opt, i) => {
                  const nbVotes = s.sondage_votes?.filter(v => v.option_index === i).length || 0
                  const pct = totalVotes > 0 ? Math.round(nbVotes / totalVotes * 100) : 0
                  const isMyVote = monChoix === i
                  return (
                    <button key={i} onClick={() => s.actif && !aVote && voter(s.id, i)}
                      disabled={aVote || !s.actif}
                      style={{
                        width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 6,
                        border: `1.5px solid ${isMyVote ? 'var(--primary)' : 'var(--border)'}`,
                        background: aVote ? (isMyVote ? 'var(--primary-bg)' : 'var(--bg-secondary)') : '#fff',
                        cursor: s.actif && !aVote ? 'pointer' : 'default',
                        textAlign: 'left', position: 'relative', overflow: 'hidden'
                      }}>
                      {aVote && (
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, background: isMyVote ? 'rgba(24,95,165,.1)' : 'rgba(0,0,0,.03)', width: `${pct}%`, transition: 'width .5s' }} />
                      )}
                      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, fontWeight: isMyVote ? 700 : 400, color: isMyVote ? 'var(--primary)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isMyVote && <Check size={12} />}{opt}
                        </span>
                        {aVote && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{pct}%</span>}
                      </div>
                    </button>
                  )
                })}

                {isCoach && s.actif && (
                  <button onClick={() => clotureSondage(s.id)}
                    style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} /> Clôturer
                  </button>
                )}
              </Card>
            )
          })
        )
      )}
    </div>
  )
}
