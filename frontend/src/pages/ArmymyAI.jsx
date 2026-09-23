import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { getAIStatus, sendAIMessage } from '../utils/api.js'
import ChatMessage from '../components/ai/ChatMessage.jsx'
import ChatInput from '../components/ai/ChatInput.jsx'
import TypingIndicator from '../components/ai/TypingIndicator.jsx'
import Icon from '../components/ui/Icon.jsx'
import '../styles/ai.css'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    "Hi there! I'm ARMY AI, your dedicated BTS companion on ARMYVERSE! I know everything about BTS members, songs, albums, eras, concerts, and ARMY culture. I can also help you navigate ARMYVERSE features. What would you like to talk about? Borahae! 💜",
}

const SUGGESTIONS = [
  'Tell me about BTS',
  'Who is Jung Kook?',
  'Recommend a BTS album',
  'Play the BTS Quiz',
]

export default function ArmymyAI() {
  const { isAuthenticated } = useApp()
  const { show } = useToast()
  const [messages, setMessages] = useState([WELCOME_MESSAGE])
  const [loading, setLoading] = useState(false)
  const [configured, setConfigured] = useState(null)
  const [lastFailedMsg, setLastFailedMsg] = useState(null)
  const [errorType, setErrorType] = useState(null)
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)

  // Check AI status on mount
  useEffect(() => {
    let active = true
    getAIStatus()
      .then((res) => {
        if (active) setConfigured(res.configured)
      })
      .catch(() => {
        if (active) setConfigured(false)
      })
    return () => {
      active = false
    }
  }, [])

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const handleSend = useCallback(async (text, isRetry = false) => {
    if (!text.trim()) return
    if (abortRef.current) abortRef.current.abort()

    const userMsg = { role: 'user', content: text }
    if (!isRetry) {
      setMessages((prev) => [...prev, userMsg])
    }
    setLastFailedMsg(null)
    setErrorType(null)
    setLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = [...(isRetry ? messages : [...messages, userMsg])].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await sendAIMessage(text, history)
      if (controller.signal.aborted) return
      setErrorType(null)
      if (res.success === false) {
        const errMsg = res.reply || 'Sorry, I had trouble responding. Please try again!'
        const toastMsg = res.error_type === 'rate_limit'
          ? errMsg
          : res.error_type === 'config'
            ? 'AI service needs configuration. Please contact the admin.'
            : 'Failed to get a response. Please try again.'
        show(toastMsg, 'error')
        setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }])
        setLastFailedMsg({ text, message: errMsg })
        setErrorType(res.error_type || null)
      } else if (res.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.reply }])
      }
      if (res.configured === false) setConfigured(false)
    } catch (err) {
      if (controller.signal.aborted) return
      show('Network error. Please check your connection and try again.', 'error')
      const failedMsg = 'Sorry, I had trouble reaching the server. Please check your connection and try again!'
      setMessages((prev) => [...prev, { role: 'assistant', content: failedMsg }])
      setLastFailedMsg({ text, message: failedMsg })
      setErrorType('network')
    } finally {
      setLoading(false)
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [messages, show])

  const handleNewChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([WELCOME_MESSAGE])
    setLoading(false)
    setLastFailedMsg(null)
    setErrorType(null)
  }, [])

  const handleRetry = useCallback(() => {
    if (lastFailedMsg) {
      setMessages((prev) => prev.slice(0, -1))
      setErrorType(null)
      handleSend(lastFailedMsg.text, true)
    }
  }, [lastFailedMsg, handleSend])

  // Loading state
  if (configured === null) {
    return (
      <div className="page ai-page">
        <div className="status status--page">
          <span className="spinner"><span className="spinner__ring" /></span>
          <p className="status__label">Connecting to ARMY AI...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="page ai-page">
        <div className="ai-config-msg">
          <div className="ai-config-msg__icon">🔐</div>
          <h3>Sign in to chat with ARMY AI</h3>
          <p>Create an account or sign in to start chatting with your BTS companion!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page ai-page">
      <div className="ai-header">
        <div className="ai-header__icon">💜</div>
        <div className="ai-header__info">
          <h2>ARMY AI</h2>
          <p>Your BTS companion</p>
        </div>
        <div className="ai-header__actions">
          <button
            className="ai-header__btn"
            onClick={handleNewChat}
            title="Start new chat"
            aria-label="New chat"
          >
            <Icon name="refresh" size={18} />
          </button>
          <div className="ai-header__status">
            <span className={`ai-header__dot ${configured ? '' : 'ai-header__dot--off'}`} />
            {configured ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {!configured && (
        <div className="ai-config-msg ai-config-msg--inline">
          <span className="ai-config-msg__icon">🤖</span>
          <p>
            AI responses are in demo mode. The admin can enable full AI by adding
            a <code>GEMINI_API_KEY</code> to the server.
          </p>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        {lastFailedMsg && !loading && (
          <div className="chat-retry">
            <button className="chat-retry__btn" onClick={handleRetry}>
              <Icon name="refresh" size={14} /> Retry
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {messages.length <= 1 && !loading && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chat-suggestion" onClick={() => handleSend(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  )
}
