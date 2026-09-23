import { useEffect, useRef, useState } from 'react'
import {
  fetchConversations,
  fetchMessages,
} from '../utils/api.js'
import { getConversationUser } from '../data/index.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Icon from '../components/ui/Icon.jsx'
import { formatTime } from '../components/post/PostCard.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { cn } from '../utils/helpers.js'
import './messages.css'

export default function Messages() {
  const { show } = useToast()
  const [convos, setConvos] = useState({ status: 'loading', list: [] })
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState(null)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const [mobileView, setMobileView] = useState('list')
  const endRef = useRef(null)

  useEffect(() => {
    let active = true
    fetchConversations()
      .then((res) => active && setConvos({ status: 'ok', list: res.data }))
      .catch(() => active && setConvos({ status: 'error', list: [] }))
    return () => {
      active = false
    }
  }, [])

  const openConversation = (id) => {
    setSelected(id)
    setMessages({ status: 'loading', items: [] })
    setMobileView('chat')
    fetchMessages(id)
      .then((res) =>
        setMessages({ status: 'ok', items: res.data || [] })
      )
      .catch(() => setMessages({ status: 'error', items: [] }))
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    const newMsg = {
      id: `local-${Date.now()}`,
      from: 'me',
      text: trimmed,
      time: Date.now(),
      pending: true,
    }
    setMessages((m) =>
      m ? { ...m, items: [...m.items, newMsg] } : m
    )
    setText('')
    setTimeout(() => {
      setMessages((m) =>
        m
          ? {
              ...m,
              items: m.items.map((item) =>
                item.id === newMsg.id ? { ...item, pending: false } : item
              ),
            }
          : m
      )
    }, 600)
    show(
      "This message is displayed locally only — live messaging isn't connected to a backend yet.",
      'info'
    )
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredConvos =
    convos.list.filter((c) =>
      getConversationUser(c.id)?.username.toLowerCase().includes(search.toLowerCase())
    ) || []

  const activeUser = selected ? getConversationUser(selected) : null

  return (
    <div className="page messages">
      <div className={cn('messages-card', mobileView === 'chat' && 'messages-card--chat-active')}>
        {/* Conversation list pane */}
        <div className="convo-pane">
          <div className="convo-pane__head">
            <h1 className="page-title">Messages</h1>
          </div>
          <div className="convo-search">
            <Icon name="search" size={18} />
            <input
              className="convo-search__input"
              placeholder="Search conversations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search conversations"
            />
          </div>
          <div className="convo-list">
            {convos.status === 'loading' && <LoadingState label="Loading conversations…" />}
            {convos.status === 'error' && (
              <ErrorState message="Couldn’t load your conversations." />
            )}
            {convos.status === 'ok' && filteredConvos.length === 0 && (
              <EmptyState icon="💬" title="No conversations" message="Start a chat with an ARMY you follow." />
            )}
            {convos.status === 'ok' &&
              filteredConvos.map((c) => {
                const u = getConversationUser(c.id)
                const active = selected === c.id
                return (
                  <button
                    key={c.id}
                    className={cn('convo-row', active && 'convo-row--active')}
                    onClick={() => openConversation(c.id)}
                  >
                    <Avatar src={u.avatarArt || u.avatar} alt={u.displayName} size={48} online={u.online} />
                    <span className="convo-row__body">
                      <span className="convo-row__line">
                        <span className="convo-row__name">{u.username}</span>
                        <span className="convo-row__time">{formatTime(c.lastTime)}</span>
                      </span>
                      <span className={cn('convo-row__preview', c.unread > 0 && 'convo-row__preview--unread')}>
                        {c.lastMessage}
                      </span>
                    </span>
                    {c.unread > 0 && <span className="convo-row__badge">{c.unread}</span>}
                  </button>
                )
              })}
          </div>
        </div>

        {/* Chat pane */}
        <div className="chat-pane">
          {!activeUser ? (
            <EmptyState
              icon="💬"
              title="Select a conversation"
              message="Choose a chat on the left to view messages."
            />
          ) : (
            <>
              <header className="chat-head">
                <button
                  className="chat-head__back"
                  onClick={() => setMobileView('list')}
                  aria-label="Back to conversations"
                >
                  <Icon name="arrowLeft" size={20} />
                </button>
                <Avatar src={activeUser.avatarArt || activeUser.avatar} alt={activeUser.displayName} size={38} online={activeUser.online} />
                <div className="chat-head__info">
                  <span className="chat-head__name">{activeUser.username}</span>
                  <span className={cn('chat-head__status', !activeUser.online && 'chat-head__status--off')}>
                    {activeUser.online ? 'Active now' : 'Offline'}
                  </span>
                </div>
              </header>

              <div className="chat-body">
                {messages?.status === 'loading' && <LoadingState label="Loading messages…" />}
                {messages?.status === 'error' && (
                  <ErrorState message="Couldn’t load messages." />
                )}
                {messages?.status === 'ok' && (
                  <div className="chat-stream">
                    {messages.items.map((m) => (
                      <div key={m.id} className={cn('bubble', m.from === 'me' ? 'bubble--me' : 'bubble--them')}>
                        <p className="bubble__text">{m.text}</p>
                        <span className="bubble__time">
                          {formatTime(m.time)}
                          {m.pending && <span className="bubble__pending"> · sending…</span>}
                        </span>
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <footer className="chat-input-row">
                <button
                  className="chat-attach"
                  onClick={() => show('Image attachment UI ready — sending is not connected yet.', 'info')}
                  aria-label="Attach image"
                >
                  <Icon name="paperclip" size={22} />
                </button>
                <textarea
                  className="chat-input"
                  placeholder="Type a message…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  aria-label="Message text"
                />
                <button
                  className="chat-send"
                  onClick={sendMessage}
                  disabled={!text.trim()}
                  aria-label="Send message"
                >
                  <Icon name="send" size={20} />
                </button>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
