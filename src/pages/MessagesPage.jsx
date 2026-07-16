import { useState, useEffect, useRef } from 'react'
import { supabase, authHeaders } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner, Avatar, Button } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Mail, Users, MessageCircle, Search, ArrowLeft, ArrowRight, ChevronRight, Trash2, Send } from 'lucide-react'

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

export default function MessagesPage() {
  const { profile, isCoach } = useAuth()
  const [activeTab, setActiveTab] = useState('groupe')
  const [groupMessages, setGroupMessages] = useState([])
  const [contacts, setContacts] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [convMessages, setConvMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [searchContact, setSearchContact] = useState('')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadGroupMessages()
    loadContacts()
  }, [])

  // Abonnement temps réel : re-souscrit à chaque changement de conversation ouverte
  // pour que le filtre "message privé pertinent" reste à jour (fermeture/réouverture
  // légère du channel, sans conséquence pour l'usage réel de la messagerie).
  useEffect(() => {
    const myAuthId = profile?.auth_id || profile?.id
    const sub = supabase.channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (msg.groupe) {
          setGroupMessages(p => [...p, msg])
        } else if (
          activeConv &&
          ((msg.expediteur_id === myAuthId && msg.destinataire_id === activeConv.auth_id) ||
           (msg.expediteur_id === activeConv.auth_id && msg.destinataire_id === myAuthId))
        ) {
          setConvMessages(p => [...p, msg])
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setGroupMessages(p => p.filter(m => m.id !== payload.old.id))
        setConvMessages(p => p.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeConv, profile])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [groupMessages, convMessages])

  async function loadGroupMessages() {
    const { data } = await supabase.from('messages').select('*')
      .eq('groupe', true).order('created_at', { ascending: true }).limit(300)
    setGroupMessages(data || [])
    setLoading(false)
  }

  async function loadContacts() {
    const myAuthId = profile?.auth_id || profile?.id
    const [{ data: joueurs }, { data: staff }] = await Promise.all([
      supabase.from('joueurs').select('id, nom, prenom, poste, auth_id').order('nom'),
      supabase.from('staff').select('id, nom, prenom, role, auth_id').order('nom')
    ])
    const all = [
      ...(joueurs || []).filter(j => j.auth_id && j.auth_id !== myAuthId).map(j => ({ ...j, type: 'joueur' })),
      ...(staff || []).filter(s => s.auth_id && s.auth_id !== myAuthId).map(s => ({ ...s, type: 'staff' }))
    ]
    setContacts(all)
  }

  async function openConv(contact) {
    setActiveConv(contact)
    setShowNewMsg(false)
    const myAuthId = profile?.auth_id || profile?.id
    const theirAuthId = contact.auth_id
    const { data } = await supabase.from('messages').select('*')
      .eq('groupe', false)
      .or(`and(expediteur_id.eq.${myAuthId},destinataire_id.eq.${theirAuthId}),and(expediteur_id.eq.${theirAuthId},destinataire_id.eq.${myAuthId})`)
      .order('created_at', { ascending: true })
      .limit(200)
    setConvMessages(data || [])
    await supabase.from('messages').update({ lu: true })
      .eq('destinataire_id', myAuthId).eq('expediteur_id', theirAuthId)
  }

  async function sendMessage(groupe = false) {
    if (!input.trim()) return
    const myAuthId = profile?.auth_id || profile?.id
    const msg = {
      expediteur_id: myAuthId,
      expediteur_nom: `${profile?.nom} ${profile?.prenom || ''}`.trim(),
      expediteur_role: profile?.role || 'joueur',
      destinataire_id: groupe ? null : activeConv?.auth_id,
      groupe,
      contenu: input
    }
    const { error } = await supabase.from('messages').insert(msg)
    if (error) {
      alert('Erreur lors de l\'envoi du message : ' + error.message)
      return
    }

    if (!groupe && activeConv?.auth_id) {
      try {
        await fetch('/api/notif-message-prive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({
            destinataireId: activeConv.auth_id,
            contenu: input
          })
        })
      } catch (err) { console.error('Erreur notif:', err) }
    }

    setInput('')
    if (groupe) loadGroupMessages()
    else openConv(activeConv)
  }

  async function reactToMessage(msgId, emoji) {
    const myAuthId = profile?.auth_id || profile?.id
    // Récupérer le message
    const msg = groupMessages.find(m => m.id === msgId)
    if (!msg) return
    const reactions = msg.reactions || {}
    // Toggle : si même emoji déjà mis, on l'enlève
    if (reactions[myAuthId] === emoji) {
      delete reactions[myAuthId]
    } else {
      reactions[myAuthId] = emoji
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
    setGroupMessages(p => p.map(m => m.id === msgId ? { ...m, reactions } : m))
  }

  async function deleteMessage(msgId) {
    if (!window.confirm('Supprimer ce message ?')) return
    await supabase.from('messages').delete().eq('id', msgId)
    setGroupMessages(p => p.filter(m => m.id !== msgId))
    setDeletingId(null)
  }

  function formatTime(ts) {
    if (!ts) return ''
    try { return format(parseISO(ts), 'd MMM HH:mm', { locale: fr }) } catch { return '' }
  }

  const myAuthId = profile?.auth_id || profile?.id
  const isMe = (msg) => msg.expediteur_id === myAuthId

  const filteredContacts = contacts.filter(c =>
    `${c.nom} ${c.prenom}`.toLowerCase().includes(searchContact.toLowerCase())
  )

  const filteredGroupMessages = search
    ? groupMessages.filter(m => m.contenu?.toLowerCase().includes(search.toLowerCase()))
    : groupMessages

  return (
    <div style={{ padding: 12 }}>
      <PageHeader
        title="Messages"
        action={
          <Button variant="primary" size="sm" onClick={() => { setShowNewMsg(!showNewMsg); setActiveTab('prives'); setActiveConv(null) }}>
            <Mail size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Nouveau
          </Button>
        }
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['groupe', Users, 'Groupe'],['prives', MessageCircle, 'Privés']].map(([tab, Icon, lbl]) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setActiveConv(null); setShowNewMsg(false) }} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid #D1D5DB',
            background: activeTab === tab ? THEME.primaryBg : 'transparent',
            color: activeTab === tab ? THEME.primary : '#6B7280',
            fontWeight: activeTab === tab ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* GROUPE */}
          {activeTab === 'groupe' && (
            <Card style={{ display: 'flex', flexDirection: 'column', height: '68vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #F3F4F6' }}>
                <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={13} color={CAT_COLORS.violet.color} /> Canal groupe
                </p>
                <div style={{ position: 'relative' }}>
                  <Search size={11} color="#9CA3AF" style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)' }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher..."
                    style={{ padding: '4px 8px 4px 24px', border: '0.5px solid #D1D5DB', borderRadius: 8, fontSize: 11, outline: 'none', width: 120 }} />
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                {filteredGroupMessages.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 20 }}>
                    {search ? `Aucun message pour "${search}"` : 'Aucun message pour l\'instant.'}
                  </p>
                )}
                {filteredGroupMessages.map(msg => (
                  <MsgBubble key={msg.id} msg={msg} isMe={isMe(msg)} formatTime={formatTime}
                    canDelete={isMe(msg) || isCoach}
                    onDelete={() => { if (window.confirm('Supprimer ce message ?')) deleteMessage(msg.id) }}
                    onReact={reactToMessage}
                    myId={profile?.auth_id || profile?.id} />
                ))}
                <div ref={bottomRef} />
              </div>
              <MsgInput value={input} onChange={setInput} onSend={() => sendMessage(true)} />
            </Card>
          )}

          {/* PRIVÉS */}
          {activeTab === 'prives' && (
            <>
              {showNewMsg && (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Choisir un destinataire</p>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={13} color="#9CA3AF" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={searchContact} onChange={e => setSearchContact(e.target.value)}
                      placeholder="Rechercher..."
                      style={{ width: '100%', padding: '8px 12px 8px 32px', border: '0.5px solid #D1D5DB', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {filteredContacts.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 16 }}>Aucun contact trouvé.</p>
                    ) : (
                      filteredContacts.map((c, i) => {
                        const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                        return (
                          <div key={c.id} onClick={() => openConv(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: '0.5px solid #F3F4F6' }}>
                            <Avatar initials={`${c.nom?.[0]}${c.prenom?.[0]}`} bg={col.bg} color={col.color} size={36} />
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500 }}>{c.nom} {c.prenom}</p>
                              <p style={{ fontSize: 11, color: '#9CA3AF' }}>{c.type === 'joueur' ? c.poste : c.role}</p>
                            </div>
                            <span style={{ marginLeft: 'auto', color: THEME.primary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>Écrire <ArrowRight size={11} /></span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </Card>
              )}

              {activeConv ? (
                <Card style={{ display: 'flex', flexDirection: 'column', height: '65vh' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid #F3F4F6' }}>
                    <button onClick={() => setActiveConv(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={THEME.primary} /></button>
                    <Avatar initials={`${activeConv.nom?.[0]}${activeConv.prenom?.[0]}`} bg={AVATAR_COLORS[0].bg} color={AVATAR_COLORS[0].color} size={32} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{activeConv.nom} {activeConv.prenom}</p>
                      <p style={{ fontSize: 10, color: '#9CA3AF' }}>{activeConv.type === 'joueur' ? activeConv.poste : activeConv.role}</p>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                    {convMessages.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 20 }}>Début de la conversation.</p>
                    )}
                    {convMessages.map(msg => (
                      <MsgBubble key={msg.id} msg={msg} isMe={isMe(msg)} formatTime={formatTime}
                        canDelete={isMe(msg)} onDelete={async () => {
                          await supabase.from('messages').delete().eq('id', msg.id)
                          openConv(activeConv)
                        }}
                    onReact={async (msgId, emoji) => {
                          const msg = convMessages.find(m => m.id === msgId)
                          if (!msg) return
                          const reactions = msg.reactions || {}
                          const myAuthId = profile?.auth_id || profile?.id
                          if (reactions[myAuthId] === emoji) delete reactions[myAuthId]
                          else reactions[myAuthId] = emoji
                          await supabase.from('messages').update({ reactions }).eq('id', msgId)
                          openConv(activeConv)
                        }}
                    myId={profile?.auth_id || profile?.id} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                  <MsgInput value={input} onChange={setInput} onSend={() => sendMessage(false)} />
                </Card>
              ) : !showNewMsg && (
                <Card style={{ padding: 0 }}>
                  <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #F3F4F6' }}>
                    <p style={{ fontSize: 12, color: '#9CA3AF' }}>{contacts.length} contact(s)</p>
                  </div>
                  {contacts.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                      Les contacts apparaîtront ici une fois que les joueurs auront un compte.
                    </p>
                  ) : (
                    contacts.slice(0, 10).map((c, i) => {
                      const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                      return (
                        <div key={c.id} onClick={() => openConv(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', borderBottom: '0.5px solid #F3F4F6' }}>
                          <Avatar initials={`${c.nom?.[0]}${c.prenom?.[0]}`} bg={col.bg} color={col.color} size={38} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>{c.nom} {c.prenom}</p>
                            <p style={{ fontSize: 11, color: '#9CA3AF' }}>{c.type === 'joueur' ? c.poste : c.role}</p>
                          </div>
                          <ChevronRight size={18} color="#D1D5DB" />
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

function MsgBubble({ msg, isMe, formatTime, canDelete, onDelete, onReact, myId }) {
  const [showActions, setShowActions] = useState(false)
  const reactions = msg.reactions || {}
  const nbUp = Object.values(reactions).filter(r => r === '👍').length
  const nbDown = Object.values(reactions).filter(r => r === '👎').length
  const myReaction = reactions[myId]

  return (
    <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
      <div style={{ maxWidth: '82%' }}>
        <div style={{
          padding: '8px 12px',
          borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
          background: isMe ? THEME.gradient : '#F3F4F6',
          color: isMe ? '#fff' : '#111',
          cursor: 'pointer'
        }} onClick={() => setShowActions(!showActions)}>
          {!isMe && msg.expediteur_nom && (
            <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: THEME.primary }}>{msg.expediteur_nom}</p>
          )}
          <p style={{ fontSize: 13, lineHeight: 1.4 }}>{msg.contenu}</p>
          <p style={{ fontSize: 9, opacity: .6, marginTop: 3, textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
        </div>

        {/* Réactions affichées */}
        {(nbUp > 0 || nbDown > 0) && (
          <div style={{ display: 'flex', gap: 4, marginTop: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
            {nbUp > 0 && <span style={{ fontSize: 11, background: '#F3F4F6', borderRadius: 20, padding: '1px 6px' }}>👍 {nbUp}</span>}
            {nbDown > 0 && <span style={{ fontSize: 11, background: '#F3F4F6', borderRadius: 20, padding: '1px 6px' }}>👎 {nbDown}</span>}
          </div>
        )}

        {/* Actions au clic */}
        {showActions && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
            {/* Réagir */}
            {['👍', '👎'].map(emoji => (
              <button key={emoji} onClick={(e) => { e.stopPropagation(); onReact(msg.id, emoji); setShowActions(false) }}
                style={{
                  fontSize: 16, padding: '3px 8px', border: `1.5px solid ${myReaction === emoji ? '#185FA5' : '#E5E7EB'}`,
                  borderRadius: 20, background: myReaction === emoji ? '#E6F1FB' : '#fff', cursor: 'pointer'
                }}>
                {emoji}
              </button>
            ))}
            {/* Supprimer */}
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowActions(false) }}
                style={{ fontSize: 11, color: THEME.danger, background: THEME.dangerBg, border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={11} /> Supprimer
              </button>
            )}
          </div>
        )}
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
      <button onClick={onSend} style={{ width: 38, height: 38, borderRadius: '50%', background: THEME.gradient, border: 'none', cursor: 'pointer', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={16} /></button>
    </div>
  )
}
