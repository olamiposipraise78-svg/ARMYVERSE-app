import { useState } from 'react'
import Icon from '../ui/Icon.jsx'

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <input
        className="chat-input__field"
        type="text"
        placeholder="Ask me about BTS..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        maxLength={1000}
        autoFocus
      />
      <button
        className="chat-input__send"
        type="submit"
        disabled={!text.trim() || disabled}
        aria-label="Send message"
      >
        <Icon name="send" size={20} />
      </button>
    </form>
  )
}
