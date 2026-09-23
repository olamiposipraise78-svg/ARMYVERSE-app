export default function TypingIndicator() {
  return (
    <div className="chat-msg chat-msg--ai">
      <span className="chat-msg__avatar" aria-hidden="true">
        💜
      </span>
      <div className="chat-msg__bubble chat-msg__bubble--ai chat-msg__bubble--typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}
