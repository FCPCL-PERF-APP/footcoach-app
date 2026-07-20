import { useState, useEffect, useRef } from 'react'
import { supabase, authHeaders } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Card, PageHeader, Spinner, Avatar, Button } from '../components/UI'
import { THEME, CAT_COLORS } from '../theme'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Mail, Users, MessageCircle, Search, ArrowLeft, ArrowRight, ChevronRight, Trash2, Send, Shield, Eye, X, CheckCircle2, Circle } from 'lucide-react'

// Canal 'general' = tout le monde (joueurs + staff), canal 'staff' = staff uniquement
// (réservé côté base via RLS, pas seulement caché dans l'UI — cf.
// supabase-canal-staff-lectures.sql).
const CANAUX = { general: { label: 'Groupe', icon: Users }, staff: { label: 'Staff', icon: Shield } }

const AVATAR_COLORS = [
  { bg: '#B5D4F4', color: '#0C447C' },
  { bg: '#9FE1CB', color: '#085041' },
  { bg: '#F5C4B3', color: '#712B13' },
  { bg: '#CECBF6', color: '#3C3489' },
  { bg: '#FAC775', color: '#633806' },
]

export default function MessagesPage() {
  const { profile, isCoach, isStaff } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
  const [canalMessages, setCanalMessages] = useState({ general: [], staff: [] })
  const [showLecteurs, setShowLecteurs] = useState(false)
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
  const myAuthId = profile?.auth_id || profile?.id

  useEffect(() => {
    loadCanalMessages('general').then(() => setLoading(false))
    loadContacts()
  }, [])

  useEffect(() => {
    if ((activeTab === 'general' || activeTab === 'staff') && canalMessages[activeTab].length === 0) {
      loadCanalMessages(activeTab)
    }
  }, [activeTab])

  // Abonnement temps réel : re-souscrit à chaque changement de conversation ouverte
  // pour que le filtre "message privé pertinent" reste à jour (fermeture/réouverture
  // légère du channel, sans conséquence pour l'usage réel de la messagerie). Les
  // messages du canal staff ne sont de toute façon reçus ici que si l'utilisateur est
  // staff — Supabase Realtime applique les mêmes policies RLS que les requêtes normales.
  useEffect(() => {
    const sub = supabase.channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (msg.groupe && (msg.canal === 'general' || msg.canal === 'staff')) {
          setCanalMessages(p => ({ ...p, [msg.canal]: [...p[msg.canal], msg] }))
        } else if (
          activeConv &&
          ((msg.expediteur_id === myAuthId && msg.destinataire_id === activeConv.auth_id) ||
           (msg.expediteur_id === activeConv.auth_id && msg.destinataire_id === myAuthId))
        ) {
          setConvMessages(p => [...p, msg])
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setCanalMessages(p => ({
          general: p.general.filter(m => m.id !== payload.old.id),
          staff: p.staff.filter(m => m.id !== payload.old.id),
        }))
        setConvMessages(p => p.filter(m => m.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [activeConv, profile])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [canalMessages, convMessages])

  // Marque le canal courant comme lu jusqu'au dernier message affiché — lu par
  // BottomNav.jsx pour la pastille "non lu", et enregistré côté serveur
  // (message_lectures) pour que le coach puisse voir qui a vu les messages.
  useEffect(() => {
    if ((activeTab !== 'general' && activeTab !== 'staff') || !myAuthId) return
    const messages = canalMessages[activeTab]
    if (messages.length === 0) return
    const lastCreatedAt = messages[messages.length - 1].created_at
    localStorage.setItem(`fc-${activeTab}-messages-last-read`, lastCreatedAt)
    supabase.from('message_lectures')
      .upsert({ user_id: myAuthId, canal: activeTab, derniere_lecture: new Date().toISOString() }, { onConflict: 'user_id,canal' })
      .then(({ error }) => { if (error) console.error('Erreur enregistrement lecture:', error) })
  }, [activeTab, canalMessages, myAuthId])

  async function loadCanalMessages(canal) {
    const { data } = await supabase.from('messages').select('*')
      .eq('groupe', true).eq('canal', canal).order('created_at', { ascending: true }).limit(300)
    setCanalMessages(p => ({ ...p, [canal]: data || [] }))
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

  async function sendMessage(groupe = false, canal = 'general') {
    if (!input.trim()) return
    const msg = {
      expediteur_id: myAuthId,
      expediteur_nom: `${profile?.nom} ${profile?.prenom || ''}`.trim(),
      expediteur_role: profile?.role || 'joueur',
      destinataire_id: groupe ? null : activeConv?.auth_id,
      groupe,
      canal: groupe ? canal : 'general',
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

    if (groupe) {
      try {
        await fetch('/api/notif-message-groupe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ contenu: input, canal })
        })
      } catch (err) { console.error('Erreur notif groupe:', err) }
    }

    setInput('')
    if (groupe) loadCanalMessages(canal)
    else openConv(activeConv)
  }

  async function reactToMessage(msgId, emoji) {
    const canal = activeTab === 'staff' ? 'staff' : 'general'
    const msg = canalMessages[canal].find(m => m.id === msgId)
    if (!msg) return
    const reactions = msg.reactions || {}
    // Toggle : si même emoji déjà mis, on l'enlève
    if (reactions[myAuthId] === emoji) {
      delete reactions[myAuthId]
    } else {
      reactions[myAuthId] = emoji
    }
    await supabase.from('messages').update({ reactions }).eq('id', msgId)
    setCanalMessages(p => ({ ...p, [canal]: p[canal].map(m => m.id === msgId ? { ...m, reactions } : m) }))
  }

  async function deleteMessage(msgId) {
    if (!window.confirm('Supprimer ce message ?')) return
    const canal = activeTab === 'staff' ? 'staff' : 'general'
    await supabase.from('messages').delete().eq('id', msgId)
    setCanalMessages(p => ({ ...p, [canal]: p[canal].filter(m => m.id !== msgId) }))
    setDeletingId(null)
  }

  function formatTime(ts) {
    if (!ts) return ''
    try { return format(parseISO(ts), 'd MMM HH:mm', { locale: fr }) } catch { return '' }
  }

  const isMe = (msg) => msg.expediteur_id === myAuthId

  const filteredContacts = contacts.filter(c =>
    `${c.nom} ${c.prenom}`.toLowerCase().includes(searchContact.toLowerCase())
  )

  const currentCanal = activeTab === 'staff' ? 'staff' : 'general'
  const currentCanalMessages = canalMessages[currentCanal] || []
  const filteredGroupMessages = search
    ? currentCanalMessages.filter(m => m.contenu?.toLowerCase().includes(search.toLowerCase()))
    : currentCanalMessages

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
        {[['general', Users, 'Groupe'], ...(isStaff ? [['staff', Shield, 'Staff']] : []), ['prives', MessageCircle, 'Privés']].map(([tab, Icon, lbl]) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setActiveConv(null); setShowNewMsg(false) }} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
            border: '0.5px solid var(--border)',
            background: activeTab === tab ? 'var(--primary-bg)' : 'transparent',
            color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === tab ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 5
          }}><Icon size={12} /> {lbl}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* GROUPE / STAFF */}
          {(activeTab === 'general' || activeTab === 'staff') && (
            <Card style={{ display: 'flex', flexDirection: 'column', height: '68vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid var(--bg-secondary)' }}>
                <p style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {activeTab === 'staff'
                    ? <><Shield size={13} color={CAT_COLORS.slate.color} /> Canal staff</>
                    : <><Users size={13} color={CAT_COLORS.violet.color} /> Canal groupe</>}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isCoach && (
                    <button onClick={() => setShowLecteurs(true)} title="Qui a vu les messages"
                      style={{ border: 'none', background: 'var(--primary-bg)', borderRadius: 8, padding: '4px 6px', cursor: 'pointer', display: 'flex' }}>
                      <Eye size={13} color="var(--primary)" />
                    </button>
                  )}
                  <div style={{ position: 'relative' }}>
                    <Search size={11} color="var(--text-muted)" style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher..."
                      style={{ padding: '4px 8px 4px 24px', border: '0.5px solid var(--border)', borderRadius: 8, fontSize: 11, outline: 'none', width: 110 }} />
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                {filteredGroupMessages.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>
                    {search ? `Aucun message pour "${search}"` : 'Aucun message pour l\'instant.'}
                  </p>
                )}
                {filteredGroupMessages.map(msg => (
                  <MsgBubble key={msg.id} msg={msg} isMe={isMe(msg)} formatTime={formatTime}
                    canDelete={isMe(msg) || isCoach}
                    onDelete={() => { if (window.confirm('Supprimer ce message ?')) deleteMessage(msg.id) }}
                    onReact={reactToMessage}
                    myId={myAuthId} />
                ))}
                <div ref={bottomRef} />
              </div>
              <MsgInput value={input} onChange={setInput} onSend={() => sendMessage(true, currentCanal)} />
            </Card>
          )}

          {showLecteurs && (
            <LecteursPanel canal={currentCanal} lastMessage={currentCanalMessages[currentCanalMessages.length - 1]}
              onClose={() => setShowLecteurs(false)} />
          )}

          {/* PRIVÉS */}
          {activeTab === 'prives' && (
            <>
              {showNewMsg && (
                <Card>
                  <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Choisir un destinataire</p>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                    <input value={searchContact} onChange={e => setSearchContact(e.target.value)}
                      placeholder="Rechercher..."
                      style={{ width: '100%', padding: '8px 12px 8px 32px', border: '0.5px solid var(--border)', borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {filteredContacts.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Aucun contact trouvé.</p>
                    ) : (
                      filteredContacts.map((c, i) => {
                        const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                        return (
                          <div key={c.id} onClick={() => openConv(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                            <Avatar initials={`${c.nom?.[0]}${c.prenom?.[0]}`} bg={col.bg} color={col.color} size={36} />
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500 }}>{c.nom} {c.prenom}</p>
                              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.type === 'joueur' ? c.poste : c.role}</p>
                            </div>
                            <span style={{ marginLeft: 'auto', color: 'var(--primary)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3 }}>Écrire <ArrowRight size={11} /></span>
                          </div>
                        )
                      })
                    )}
                  </div>
                </Card>
              )}

              {activeConv ? (
                <Card style={{ display: 'flex', flexDirection: 'column', height: '65vh' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <button onClick={() => setActiveConv(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><ArrowLeft size={20} color={'var(--primary)'} /></button>
                    <Avatar initials={`${activeConv.nom?.[0]}${activeConv.prenom?.[0]}`} bg={AVATAR_COLORS[0].bg} color={AVATAR_COLORS[0].color} size={32} />
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>{activeConv.nom} {activeConv.prenom}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{activeConv.type === 'joueur' ? activeConv.poste : activeConv.role}</p>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10 }}>
                    {convMessages.length === 0 && (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 20 }}>Début de la conversation.</p>
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
                  <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{contacts.length} contact(s)</p>
                  </div>
                  {contacts.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
                      Les contacts apparaîtront ici une fois que les joueurs auront un compte.
                    </p>
                  ) : (
                    contacts.slice(0, 10).map((c, i) => {
                      const col = AVATAR_COLORS[i % AVATAR_COLORS.length]
                      return (
                        <div key={c.id} onClick={() => openConv(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer', borderBottom: '0.5px solid var(--bg-secondary)' }}>
                          <Avatar initials={`${c.nom?.[0]}${c.prenom?.[0]}`} bg={col.bg} color={col.color} size={38} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 500 }}>{c.nom} {c.prenom}</p>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.type === 'joueur' ? c.poste : c.role}</p>
                          </div>
                          <ChevronRight size={18} color="var(--border)" />
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
          background: isMe ? 'var(--gradient)' : 'var(--bg-secondary)',
          color: isMe ? '#fff' : 'var(--text-primary)',
          cursor: 'pointer'
        }} onClick={() => setShowActions(!showActions)}>
          {!isMe && msg.expediteur_nom && (
            <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 3, color: 'var(--primary)' }}>{msg.expediteur_nom}</p>
          )}
          <p style={{ fontSize: 13, lineHeight: 1.4 }}>{msg.contenu}</p>
          <p style={{ fontSize: 9, opacity: .6, marginTop: 3, textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
        </div>

        {/* Réactions affichées */}
        {(nbUp > 0 || nbDown > 0) && (
          <div style={{ display: 'flex', gap: 4, marginTop: 3, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
            {nbUp > 0 && <span style={{ fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 20, padding: '1px 6px' }}>👍 {nbUp}</span>}
            {nbDown > 0 && <span style={{ fontSize: 11, background: 'var(--bg-secondary)', borderRadius: 20, padding: '1px 6px' }}>👎 {nbDown}</span>}
          </div>
        )}

        {/* Actions au clic */}
        {showActions && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
            {/* Réagir */}
            {['👍', '👎'].map(emoji => (
              <button key={emoji} onClick={(e) => { e.stopPropagation(); onReact(msg.id, emoji); setShowActions(false) }}
                style={{
                  fontSize: 16, padding: '3px 8px', border: `1.5px solid ${myReaction === emoji ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 20, background: myReaction === emoji ? 'var(--primary-bg)' : '#fff', cursor: 'pointer'
                }}>
                {emoji}
              </button>
            ))}
            {/* Supprimer */}
            {canDelete && (
              <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowActions(false) }}
                style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-bg)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={11} /> Supprimer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Visible coach uniquement (le bouton qui ouvre ce panneau n'est rendu que pour
// isCoach) : qui, dans l'audience du canal, a ouvert la messagerie après le dernier
// message. Basé sur message_lectures (une ligne par utilisateur/canal, mise à jour à
// chaque consultation), pas un accusé de lecture par message individuel — un
// indicateur "à jour / pas encore vu le dernier message / jamais ouvert" suffit pour
// répondre au besoin sans exploser le volume de données à suivre.
function LecteursPanel({ canal, lastMessage, onClose }) {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])

  useEffect(() => { loadLecteurs() }, [canal])

  async function loadLecteurs() {
    setLoading(true)
    const [{ data: staff }, { data: joueurs }, { data: lectures }] = await Promise.all([
      supabase.from('staff').select('nom, prenom, auth_id').not('auth_id', 'is', null),
      canal === 'general'
        ? supabase.from('joueurs').select('nom, prenom, auth_id').not('auth_id', 'is', null)
        : Promise.resolve({ data: [] }),
      supabase.from('message_lectures').select('user_id, derniere_lecture').eq('canal', canal),
    ])
    const lectureMap = {}
    for (const l of (lectures || [])) lectureMap[l.user_id] = l.derniere_lecture
    const audience = [...(staff || []), ...(joueurs || [])]
      .map(p => ({ nom: `${p.nom} ${p.prenom}`, derniereLecture: lectureMap[p.auth_id] || null }))
      .sort((a, b) => a.nom.localeCompare(b.nom))
    setRows(audience)
    setLoading(false)
  }

  const lastMessageAt = lastMessage?.created_at ? new Date(lastMessage.created_at) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '18px 18px 0 0', padding: 16, width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><Eye size={14} color="var(--primary)" /> Qui a vu les messages</p>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} color="var(--text-secondary)" /></button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>Visible uniquement par le coach — pas affiché aux autres membres.</p>
        {loading ? <Spinner /> : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>Personne n'a encore de compte actif ici.</p>
        ) : rows.map(r => {
          const aVu = lastMessageAt && r.derniereLecture && new Date(r.derniereLecture) >= lastMessageAt
          return (
            <div key={r.nom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--bg-secondary)' }}>
              <span style={{ fontSize: 13 }}>{r.nom}</span>
              {aVu ? (
                <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> À jour</span>
              ) : r.derniereLecture ? (
                <span style={{ fontSize: 11, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Circle size={9} fill="currentColor" /> Vu le {format(parseISO(r.derniereLecture), 'd MMM HH:mm', { locale: fr })}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Jamais ouvert</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MsgInput({ value, onChange, onSend }) {
  // Zone de texte multi-lignes (plutôt qu'un <input> mono-ligne) : "Entrée" insère
  // un retour à la ligne comme dans n'importe quelle appli de messagerie, y compris
  // au clavier mobile (pas de touche Maj pour distinguer "envoyer" de "nouvelle
  // ligne" sur téléphone). L'envoi se fait uniquement via le bouton dédié.
  const rows = Math.min(6, Math.max(1, (value.match(/\n/g)?.length || 0) + 1))
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', borderTop: '0.5px solid var(--bg-secondary)', paddingTop: 10 }}>
      <textarea value={value} onChange={e => onChange(e.target.value)}
        placeholder="Écrire un message..."
        rows={rows}
        style={{ flex: 1, padding: '9px 12px', border: '0.5px solid var(--border)', borderRadius: 16, fontSize: 13, outline: 'none', background: 'var(--bg-secondary)', resize: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 120, overflowY: 'auto', boxSizing: 'border-box' }} />
      <button onClick={onSend} style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gradient)', border: 'none', cursor: 'pointer', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={16} /></button>
    </div>
  )
}
