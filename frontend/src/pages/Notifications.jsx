import { useEffect, useState } from 'react'
import { fetchNotifications, markAllNotificationsRead } from '../utils/api.js'
import { getUserFromNotification } from '../data/index.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Icon from '../components/ui/Icon.jsx'
import { formatTime } from '../components/post/PostCard.jsx'
import Button from '../components/ui/Button.jsx'
import { cn } from '../utils/helpers.js'
import './notifications.css'

const filters = [
  { key: 'all', label: 'All' },
  { key: 'like', label: 'Likes' },
  { key: 'comment', label: 'Comments' },
  { key: 'follow', label: 'Follows' },
  { key: 'save', label: 'Saves' },
  { key: 'mention', label: 'Mentions' },
  { key: 'message', label: 'Messages' },
]

const typeIcon = {
  like: 'heartFill',
  comment: 'comment',
  follow: 'users',
  save: 'bookmarkFill',
  mention: 'reply',
  message: 'messages',
}

export default function Notifications() {
  const [state, setState] = useState({ status: 'loading', list: [] })
  const [filter, setFilter] = useState('all')
  const [readIds, setReadIds] = useState(() => new Set())

  useEffect(() => {
    let active = true
    fetchNotifications()
      .then((res) => active && setState({ status: 'ok', list: res.notifications || [] }))
      .catch(() => active && setState({ status: 'error', list: [] }))
    return () => {
      active = false
    }
  }, [])

  const markAllRead = async () => {
    const ids = new Set(state.list.map((n) => n.id))
    setReadIds(ids)
    try {
      await markAllNotificationsRead()
    } catch {
      /* keep local optimistic state */
    }
  }

  const markRead = (id) => {
    setReadIds((prev) => new Set(prev).add(id))
  }

  const isUnread = (n) => !n.read && !readIds.has(n.id)
  const unreadCount = state.list.filter(isUnread).length

  const visible = state.list.filter((n) => filter === 'all' || n.type === filter)

  const textFor = (n) => {
    const u = getUserFromNotification(n)
    if (n.type === 'like') return 'liked your post'
    if (n.type === 'comment') return `commented: "${n.text || n.caption || ''}"`
    if (n.type === 'follow') return 'started following you'
    if (n.type === 'save') return 'saved your post'
    if (n.type === 'mention') return 'mentioned you in a post'
    if (n.type === 'message') return n.text || 'sent you a message'
    return n.textKey || n.text || ''
  }

  return (
    <div className="page notifications">
      <div className="page-head">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">
            {state.status === 'ok' && unreadCount > 0
              ? `${unreadCount} unread`
              : 'You’re all caught up'}
          </p>
        </div>
        {state.status === 'ok' && unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <div className="notif-tabs" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            className={cn('notif-tab', filter === f.key && 'notif-tab--active')}
            onClick={() => setFilter(f.key)}
            role="tab"
            aria-selected={filter === f.key}
          >
            {f.label}
          </button>
        ))}
      </div>

      {state.status === 'loading' && <LoadingState label="Loading notifications…" />}
      {state.status === 'error' && (
        <ErrorState message="Couldn’t load your notifications." />
      )}
      {state.status === 'ok' && visible.length === 0 && (
        <EmptyState
          icon="🔔"
          title="No notifications"
          message="When ARMYs like, comment, or follow you, it will show up here."
        />
      )}
      {state.status === 'ok' && visible.length > 0 && (
        <div className="notif-list">
          {visible.map((n) => {
            const u = getUserFromNotification(n)
            const unread = isUnread(n)
            return (
              <div
                key={n.id}
                className={cn('notif-row', unread && 'notif-row--unread')}
                onClick={() => markRead(n.id)}
              >
                <div className="notif-row__avatar">
                  <Avatar src={u.avatarArt || u.avatar} alt={u.displayName} size={46} />
                  <span className={cn('notif-row__icon', `notif-row__icon--${n.type}`)}>
                    <Icon name={typeIcon[n.type]} size={14} />
                  </span>
                </div>
                <div className="notif-row__body">
                  <p className="notif-row__text">
                    <span className="notif-row__name">{u.username}</span>{' '}
                    {textFor(n)}
                  </p>
                  {n.caption && <p className="notif-row__caption">“{n.caption}”</p>}
                  <span className="notif-row__time">{formatTime(n.createdAt)}</span>
                </div>
                {unread && <span className="notif-row__dot" aria-label="Unread" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
