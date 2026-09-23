import { cn } from '../../utils/helpers.js'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('chat-msg', isUser ? 'chat-msg--user' : 'chat-msg--ai')}>
      {!isUser && (
        <span className="chat-msg__avatar" aria-hidden="true">
          💜
        </span>
      )}
      <div className={cn('chat-msg__bubble', isUser ? 'chat-msg__bubble--user' : 'chat-msg__bubble--ai')}>
        <p className="chat-msg__text">{message.content}</p>
      </div>
    </div>
  )
}
