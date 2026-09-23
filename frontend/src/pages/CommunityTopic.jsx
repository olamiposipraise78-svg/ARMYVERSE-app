import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCommunityTopic } from '../utils/api.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import { getUserById } from '../data/index.js'
import Avatar from '../components/ui/Avatar.jsx'
import Icon from '../components/ui/Icon.jsx'
import { formatTime } from '../components/post/PostCard.jsx'
import Button from '../components/ui/Button.jsx'
import { useToast } from '../context/ToastContext.jsx'
import AlbumsShelf from '../components/album/AlbumsShelf.jsx'
import './community.css'

export default function CommunityTopic() {
  const { topic } = useParams()
  const navigate = useNavigate()
  const { show } = useToast()
  const [state, setState] = useState({ status: 'loading', topic: null, posts: [] })
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let active = true
    setState({ status: 'loading', topic: null, posts: [] })
    fetchCommunityTopic(topic)
      .then((res) =>
        active &&
        setState({ status: 'ok', topic: res.data.topic, posts: res.data.posts })
      )
      .catch(() => active && setState({ status: 'error', topic: null, posts: [] }))
    return () => {
      active = false
    }
  }, [topic])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    const newPost = {
      id: `ct-${Date.now()}`,
      user: 'u-me',
      createdAt: Date.now(),
      text,
      hashtags: [],
      replies: 0,
    }
    setState((s) => ({ ...s, posts: [newPost, ...s.posts] }))
    setDraft('')
    show('Your post was added, welcome to the discussion! 💜')
  }

  if (state.status === 'error') {
    return (
      <div className="page">
        <ErrorState message="This topic couldn’t be found." onRetry={() => navigate('/community')} />
      </div>
    )
  }

  return (
    <div className="page community">
      {state.status === 'loading' && <LoadingState label="Loading topic…" />}
      {state.status === 'ok' && state.topic && (
        <>
          <div className="community-topic-head">
            <button className="back-link" onClick={() => navigate('/community')}>
              <Icon name="arrowLeft" size={18} /> All topics
            </button>
            <div className="community-topic-title">
              <span className="topic-card__emoji" aria-hidden="true">
                {state.topic.icon}
              </span>
              <div>
                <h1 className="page-title">{state.topic.label}</h1>
                <p className="page-sub">{state.topic.blurb}</p>
              </div>
            </div>
          </div>

          <div className="topic-composer">
            <textarea
              className="topic-composer__input"
              placeholder={`Start a discussion in ${state.topic.label}…`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
            />
            <div className="topic-composer__bar">
              <span className="topic-composer__hint">
                Keep it kind — follow the community guidelines.
              </span>
              <Button variant="primary" size="sm" onClick={submit} disabled={!draft.trim()}>
                Post
              </Button>
            </div>
          </div>

          {state.topic.slug === 'albums' && (
            <section className="topic-albums" aria-label={`${state.topic.label} section`}>
              <h2 className="community-sec-title">BTS albums to explore</h2>
              <AlbumsShelf />
            </section>
          )}

          <div className="community-post-list">
            {state.posts.length === 0 ? (
              <EmptyState
                icon="💬"
                title="No discussions yet"
                message="Be the first to start a conversation in this topic."
              />
            ) : (
              state.posts.map((p) => {
                const author = getUserById(p.user)
                return (
                  <article className="community-post" key={p.id}>
                    <Avatar src={author.avatarArt || author.avatar} alt={author.displayName} size={42} />
                    <div className="community-post__body">
                      <div className="community-post__meta">
                        <span className="community-post__name">{author.username}</span>
                        <span className="community-post__time">{formatTime(p.createdAt)}</span>
                      </div>
                      <p className="community-post__text">{p.text}</p>
                      <div className="community-post__tags">
                        {p.hashtags.map((h) => (
                          <span key={h} className="tag">{h}</span>
                        ))}
                      </div>
                      <div className="community-post__actions">
                        <span className="community-post__replies">
                          <Icon name="reply" size={15} /> {p.replies} replies
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => show('Replies UI — coming next.', 'info')}>
                          Reply
                        </Button>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
