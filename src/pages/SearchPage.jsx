import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, Spinner } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Search, X, Users, Calendar, MessageCircle, ChevronRight, Swords, Footprints } from 'lucide-react'

export default function SearchPage() {
  const navigate = useNavigate()
  const { isCoach } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  async function search(q) {
    setQuery(q)
    if (q.length < 2) { setResults(null); return }
    setLoading(true)

    const [
      { data: joueurs },
      { data: events },
      { data: messages },
    ] = await Promise.all([
      supabase.from('joueurs').select('id, nom, prenom, poste, numero')
        .or(`nom.ilike.%${q}%,prenom.ilike.%${q}%`)
        .limit(5),
      supabase.from('evenements').select('id, titre, type, date_heure')
        .ilike('titre', `%${q}%`).order('date_heure', { ascending: false }).limit(5),
      isCoach ? supabase.from('messages').select('id, contenu, expediteur_nom, created_at')
        .ilike('contenu', `%${q}%`).eq('groupe', true).order('created_at', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] }),
    ])

    setResults({ joueurs: joueurs || [], events: events || [], messages: messages || [] })
    setLoading(false)
  }

  const total = results ? results.joueurs.length + results.events.length + results.messages.length : 0

  return (
    <div style={{ padding: 12 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Search size={18} color={'var(--primary)'} /> Recherche
      </h1>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <input
          value={query}
          onChange={e => search(e.target.value)}
          placeholder="Rechercher un joueur, événement, message..."
          autoFocus
          style={{
            width: '100%', padding: '12px 14px 12px 40px',
            border: '1.5px solid #E5E7EB', borderRadius: 12,
            fontSize: 14, outline: 'none', boxSizing: 'border-box',
            background: '#fff'
          }}
        />
        <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
        {query && (
          <button onClick={() => { setQuery(''); setResults(null) }}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex' }}>
            <X size={16} />
          </button>
        )}
      </div>

      {loading && <Spinner />}

      {results && !loading && (
        <>
          {total === 0 ? (
            <Card>
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>
                Aucun résultat pour "{query}"
              </p>
            </Card>
          ) : (
            <>
              {/* Joueurs */}
              {results.joueurs.length > 0 && (
                <Card>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
                    <Users size={12} style={{marginRight:5,verticalAlign:-2}} />Joueurs ({results.joueurs.length})
                  </p>
                  {results.joueurs.map(j => (
                    <div key={j.id} onClick={() => navigate(`/joueurs/${j.id}`)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{j.nom} {j.prenom}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF' }}>{j.poste}{j.numero ? ` · N°${j.numero}` : ''}</p>
                      </div>
                      <ChevronRight size={16} color={'var(--primary)'} />
                    </div>
                  ))}
                </Card>
              )}

              {/* Événements */}
              {results.events.length > 0 && (
                <Card>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
                    <Calendar size={12} style={{marginRight:5,verticalAlign:-2}} />Événements ({results.events.length})
                  </p>
                  {results.events.map(e => (
                    <div key={e.id} onClick={() => navigate('/calendrier')}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{e.titre}</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {e.type === 'match' ? <Swords size={10} /> : <Footprints size={10} />} {e.type === 'match' ? 'Match' : 'Séance'} · {e.date_heure ? format(parseISO(e.date_heure), 'd MMM yyyy', { locale: fr }) : ''}
                        </p>
                      </div>
                      <ChevronRight size={16} color={'var(--primary)'} />
                    </div>
                  ))}
                </Card>
              )}

              {/* Messages */}
              {results.messages.length > 0 && (
                <Card>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 8 }}>
                    <MessageCircle size={12} style={{marginRight:5,verticalAlign:-2}} />Messages ({results.messages.length})
                  </p>
                  {results.messages.map(m => (
                    <div key={m.id} onClick={() => navigate('/messages')}
                      style={{ padding: '8px 0', borderBottom: '0.5px solid #F3F4F6', cursor: 'pointer' }}>
                      <p style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 2 }}>{m.expediteur_nom}</p>
                      <p style={{ fontSize: 12, color: '#374151' }}>{m.contenu?.slice(0, 80)}{m.contenu?.length > 80 ? '...' : ''}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>{m.created_at ? format(parseISO(m.created_at), 'd MMM à HH:mm', { locale: fr }) : ''}</p>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}
        </>
      )}

      {!query && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Search size={40} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#9CA3AF' }}>Tape au moins 2 caractères pour lancer la recherche</p>
          <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 8 }}>Joueurs · Événements · Messages</p>
        </div>
      )}
    </div>
  )
}
