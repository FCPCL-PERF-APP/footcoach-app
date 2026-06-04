import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Button, Spinner, Avatar } from '../components/UI'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

export default function MessagesPage({ setUnreadCount }) {
  const { profile, isJoueur } = useAuth()
  const [activeTab, setActiveTab] = useState('groupe')
  const [threads, setThreads] = useState([])
  const [groupMessages, setGroupMessages] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [threadMessages, setThreadMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadGroupMessages()
    loadThreads()
    // Abonnement temps réel messages groupe
    const sub = supabase
      .channel('group-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'groupe=eq.true' },
        payload => setGroupMessages(p => [...p, payload.new]))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [groupMessages, threadMessages])

  async function loadGroupMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('groupe', true)
      .order('created_at', { ascending: true })
      .limit(100)
    setGroupMessages(data || [])
    setLoading(false)
  }

  async function loadThreads() {
    // Récupère les conversations privées impliquant cet utilisateur
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('groupe', false)
      .or(`expediteur_id.eq.${profile?.id},destinataire_id.eq.${profile?.id}`)
      .order('created_at', { ascending: false })

    // Groupe par interlocuteur
    const seen = new Set()
    const threadMap = []
    for (const msg of (data || [])) {
      const otherId = msg.expediteur_id === profile?.id ? msg.destinataire_id : msg.expediteur_id
      if (!seen.has(otherId)) {
        seen.add(otherId)
        threadMap.push({ otherId, lastMsg: msg })
      }
    }
    setThreads(threadMap)

    // Compte non lus
    const unread = (data || []).filter(m => m.destinataire_id === profile?.id && !m.lu).length
    setUnreadCount?.(unread)
  }

  async function loadThread(otherId, otherName) {
    setActiveThread({ id: otherId, name: otherName })
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('groupe', false)
      .or(
        `and(expediteur_id.eq.${profile?.id},destinataire_id.eq.${otherId}),and(expediteur_id.eq.${otherId},destinataire_id.eq.${profile?.id})`
      )
      .order('created_at', { ascending: true })
    setThreadMessages(data || [])
    // Marque comme lus
    await supabase.from('messages').update({ lu: true })
      .eq('destinataire_id', profile?.id)
      .eq('expediteur_id', otherId)
  }

  async function sendMessage(groupe = false) {
    if (!input.trim()) return
    await supabase.from('messages').insert({
      expediteur_id: profile?.id,
      expediteur_role: profile?.role || 'joueur',
      destinataire_id: groupe ? null : activeThread?.id,
      groupe,
      contenu: input
    })
    setInput('')
    if (groupe) loadGroupMessages()
    else loadThread(activeThread.id, activeThread.name)
  }

  function getInitials(nom = '') {
    return nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  function formatTime(ts) {
    if (!ts) return ''
    try { return format(parseISO(ts), 'd MMM HH:mm', { locale: fr }) } catch { return '' }
  }

  const isMe = (msg) => msg.expediteur_id === profile?.id

  return (
    <div style={{ padding: 12 }}>
      <PageHeader title="Messages" />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['groupe','👥 Groupe'],['prives','💬 Privés']].map(([tab, lbl]) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setActiveThread(null) }} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? '#E6F1FB' : 'transparent',
            color: activeTab === tab ? '#185FA5' : '#6B7280',
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
                {groupMessages.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} isMe={isMe(msg)} profile={profile} formatTime={formatTime} />
                ))}
                <div ref={bottomRef} />
              </div>
              <MessageInput value={input} onChange={setInput} onSend={() => sendMessage(true)} />
            </Card>
          )}

          {/* PRIVÉS */}
          {activeTab === 'prives' && (
            <>
              {activeThread ? (
                <Card style={{ display: 'flex', flexDirection: 'column', height: '68vh' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #F3F4F6' }}>
                    <button onClick={() => setActiveThread(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#6B7280' }}>←</button>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{activeThread.name}</p>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                    {threadMessages.map(msg => (
                      <MessageBubble key={msg.id} msg={msg} isMe={isMe(msg)} profile={profile} formatTime={formatTime} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  <MessageInput value={input} onChange={setInput} onSend={() => sendMessage(false)} />
                </Card>
              ) : (
                <>
                  {threads.length === 0 ? (
                    <Card><p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>Aucune conversation privée.</p></Card>
                  ) : (
                    <Card style={{ padding: 0 }}>
                      {threads.map((t, i) => (
                        <div key={t.otherId} onClick={() => loadThread(t.otherId, t.lastMsg.expediteur_nom || 'Joueur')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '12px 14px', cursor: 'pointer',
                            borderBottom: i < threads.length - 1 ? '0.5px solid #F3F4F6' : 'none'
                          }}>
                          <Avatar initials={getInitials(t.lastMsg.expediteur_nom || '')} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>{t.lastMsg.expediteur_nom || 'Utilisateur'}</p>
                            <p style={{ fontSize: 11, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {t.lastMsg.contenu}
                            </p>
                          </div>
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{formatTime(t.lastMsg.created_at)}</span>
                        </div>
                      ))}
                    </Card>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function MessageBubble({ msg, isMe, formatTime }) {
  const roleColors = { coach: '#185FA5', adjoint: '#3B6D11', gardien: '#854F0B' }
  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{
        maxWidth: '82%', padding: '8px 12px', borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        background: isMe ? '#185FA5' : '#F3F4F6',
        color: isMe ? '#fff' : '#111'
      }}>
        {!isMe && msg.expediteur_role && (
          <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: roleColors[msg.expediteur_role] || '#6B7280' }}>
            {msg.expediteur_nom || msg.expediteur_role}
          </p>
        )}
        <p style={{ fontSize: 13, lineHeight: 1.4 }}>{msg.contenu}</p>
        <p style={{ fontSize: 9, opacity: .6, marginTop: 3, textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
      </div>
    </div>
  )
}

function MessageInput({ value, onChange, onSend }) {
  return (
    <div style={{ display: 'flex', gap: 6, borderTop: '0.5px solid #F3F4F6', paddingTop: 10 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && onSend()}
        placeholder="Écrire un message..."
        style={{
          flex: 1, padding: '9px 12px',
          border: '0.5px solid #D1D5DB', borderRadius: 20,
          fontSize: 13, outline: 'none', background: '#F9FAFB'
        }}
      />
      <button onClick={onSend} style={{
        width: 38, height: 38, borderRadius: '50%',
        background: '#185FA5', border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: '#fff', flexShrink: 0
      }}>→</button>
    </div>
  )
}
