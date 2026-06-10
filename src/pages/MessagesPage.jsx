import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner, Avatar } from '../components/UI'
import { THEME } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

export default function MessagesPage({ setUnreadCount }) {
  const { profile, isJoueur } = useAuth()
  const [activeTab, setActiveTab] = useState('groupe')
  const [groupMessages, setGroupMessages] = useState([])
  const [contacts, setContacts] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [convMessages, setConvMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadGroupMessages()
    loadContacts()
    const sub = supabase.channel('group-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'groupe=eq.true' },
        payload => setGroupMessages(p => [...p, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [groupMessages, convMessages])

  async function loadGroupMessages() {
    const { data } = await supabase.from('messages').select('*').eq('groupe', true)
      .order('created_at', { ascending: true }).limit(100)
    setGroupMessages(data || [])
    setLoading(false)
  }

  async function loadContacts() {
    // Charge tous les joueurs et staff comme contacts potentiels
    const [{ data: joueurs }, { data: staff }] = await Promise.all([
      supabase.from('joueurs').select('id, nom, prenom, poste, auth_id').order('nom'),
      supabase.from('staff').select('id, nom, prenom, role, auth_id').order('nom')
    ])
    const allContacts = [
      ...(joueurs || []).filter(j => j.auth_id && j.auth_id !== profile?.id).map(j => ({ ...j, type: 'joueur' })),
      ...(staff || []).filter(s => s.auth_id && s.auth_id !== profile?.id).map(s => ({ ...s, type: 'staff' }))
    ]
    setContacts(allContacts)
  }

  async function openConv(contact) {
    setActiveConv(contact)
    const myAuthId = profile?.auth_id || profile?.id
    const theirAuthId = contact.auth_id

    const { data } = await supabase.from('messages').select('*')
      .eq('groupe', false)
      .or(`and(expediteur_id.eq.${myAuthId},destinataire_id.eq.${theirAuthId}),and(expediteur_id.eq.${theirAuthId},destinataire_id.eq.${myAuthId})`)
      .order('created_at', { ascending: true })
    setConvMessages(data || [])

    // Marque comme lus
    await supabase.from('messages').update({ lu: true })
      .eq('destinataire_id', myAuthId).eq('expediteur_id', theirAuthId)
  }

  async function sendMessage(groupe = false) {
    if (!input.trim()) return
    const myAuthId = profile?.auth_id || profile?.id
    await supabase.from('messages').insert({
      expediteur_id: myAuthId,
      expediteur_nom: `${profile?.nom} ${profile?.prenom || ''}`.trim(),
      expediteur_role: profile?.role || 'joueur',
      destinataire_id: groupe ? null : activeConv?.auth_id,
      groupe,
      contenu: input
    })
    setInput('')
    if (groupe) loadGroupMessages()
    else openConv(activeConv)
  }

  function formatTime(ts) {
    if (!ts) return ''
    try { return format(parseISO(ts), 'd MMM HH:mm', { locale: fr }) } catch { return '' }
  }

  const myAuthId = profile?.auth_id || profile?.id
  const isMe = (msg) => msg.expediteur_id === myAuthId

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Messages" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['groupe','👥 Groupe'],['prives','💬 Privés']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setActiveConv(null) }} style={{
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
          {/* GROUPE */}
          {activeTab === 'groupe' && (
            <Card style={{ display: 'flex', flexDirection: 'column', height: '68vh' }}>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #F3F4F6' }}>
                👥 Équipe A — Canal groupe
              </p>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                {groupMessages.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 20 }}>Aucun message pour l'instant.</p>
                )}
                {groupMessages.map(msg => (
                  <MsgBubble key={msg.id} msg={msg} isMe={isMe(msg)} formatTime={formatTime} />
                ))}
                <div ref={bottomRef} />
              </div>
              <MsgInput value={input} onChange={setInput} onSend={() => sendMessage(true)} />
            </Card>
          )}

          {/* PRIVÉS */}
          {activeTab === 'prives' && (
            <>
              {activeConv ? (
                <Card style={{ display: 'flex', flexDirection: 'column', height: '68vh' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #F3F4F6' }}>
                    <button onClick={() => setActiveConv(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>←</button>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{activeConv.nom} {activeConv.prenom}</p>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                    {convMessages.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 20 }}>Début de la conversation.</p>
                    )}
                    {convMessages.map(msg => (
                      <MsgBubble key={msg.id} msg={msg} isMe={isMe(msg)} formatTime={formatTime} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  <MsgInput value={input} onChange={setInput} onSend={() => sendMessage(false)} />
                </Card>
              ) : (
                <Card style={{ padding: 0 }}>
                  <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <p style={{ fontSize: 12, color: '#9CA3AF' }}>{contacts.length} contact(s) disponible(s)</p>
                  </div>
                  {contacts.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                      Aucun contact disponible pour l'instant.
                    </p>
                  ) : (
                    contacts.map((c, i) => {
                      const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                      const initials = `${c.nom?.[0] || ''}${c.prenom?.[0] || ''}`
                      return (
                        <div key={c.id} onClick={() => openConv(c)} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '12px 14px', cursor: 'pointer',
                          borderBottom: '0.5px solid #F3F4F6'
                        }}>
                          <Avatar initials={initials} bg={col.bg} color={col.color} size={38} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>{c.nom} {c.prenom}</p>
                            <p style={{ fontSize: 11, color: '#9CA3AF' }}>{c.type === 'joueur' ? c.poste : c.role}</p>
                          </div>
                          <span style={{ color: '#D1D5DB', fontSize: 18 }}>›</span>
                        </div>
                      )
                    })
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function MsgBubble({ msg, isMe, formatTime }) {
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '82%', padding: '8px 12px',
        borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isMe ? THEME.gradient : '#F3F4F6',
        color: isMe ? '#fff' : '#111'
      }}>
        {!isMe && msg.expediteur_nom && (
          <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: THEME.primary }}>{msg.expediteur_nom}</p>
        )}
        <p style={{ fontSize: 13, lineHeight: 1.4 }}>{msg.contenu}</p>
        <p style={{ fontSize: 9, opacity: .6, marginTop: 3, textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
      </div>
    </div>
  )
}

function MsgInput({ value, onChange, onSend }) {
  return (
    <div style={{ display: 'flex', gap: 6, borderTop: '0.5px solid #F3F4F6', paddingTop: 10 }}>
      <input value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
        placeholder="Écrire un message..."
        style={{ flex: 1, padding: '9px 12px', border: '0.5px solid #D1D5DB', borderRadius: 20, fontSize: 13, outline: 'none', background: '#F9FAFB' }} />
      <button onClick={onSend} style={{
        width: 38, height: 38, borderRadius: '50%',
        background: THEME.gradient, border: 'none', cursor: 'pointer',
        fontSize: 16, color: '#fff', flexShrink: 0
      }}>→</button>
    </div>
  )
}
