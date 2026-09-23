import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PostCard from '../components/post/PostCard.jsx'
import { fetchFeed } from '../utils/api.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import { useApp } from '../context/AppContext.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Icon from '../components/ui/Icon.jsx'
import AlbumsShelf from '../components/album/AlbumsShelf.jsx'
import StoryStrip from '../components/story/StoryStrip.jsx'
import './pages.css'

export default function Home() {
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const [state, setState] = useState({ status: 'loading', posts: [] })

  useEffect(() => {
    let active = true
    setState({ status: 'loading', posts: [] })
    fetchFeed()
      .then((res) => active && setState({ status: 'ok', posts: res.posts || [] }))
      .catch(() => active && setState({ status: 'error', posts: [] }))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="page page--home">
      <div className="compose">
        <Avatar src={currentUser.avatarArt || currentUser.avatar} alt={currentUser.displayName} size={44} />
        <button
          className="compose__fake"
          onClick={() => navigate('/create')}
          aria-label="Create a post"
        >
          <span className="compose__placeholder">
            Share something with ARMYs worldwide…
          </span>
          <span className="compose__icon-btn" aria-hidden="true">
            <Icon name="image" size={22} />
          </span>
        </button>
      </div>

      <StoryStrip />

      <section className="albums-shelf" aria-label="BTS discography">
        <div className="albums-shelf__head">
          <h2 className="albums-shelf__title">BTS albums &amp; discography</h2>
          <span className="albums-shelf__hint">A few of our favorites 💜</span>
        </div>
        <AlbumsShelf limit={6} />
      </section>

      {state.status === 'loading' && (
        <div className="feed-loading">
          {[1, 2, 3].map((i) => (
            <div className="skeleton-card" key={i}>
              <div className="skeleton skeleton--avatar" />
              <div className="skeleton-lines">
                <div className="skeleton skeleton--line" />
                <div className="skeleton skeleton--line-sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="feed-status">
          <ErrorState
            message="We couldn’t load your feed right now."
            onRetry={() => navigate(0)}
          />
        </div>
      )}

      {state.status === 'ok' && state.posts.length === 0 && (
        <div className="feed-status">
          <EmptyState
            icon="💜"
            title="Your feed is quiet"
            message="Follow more ARMYs to see their posts here."
          />
        </div>
      )}

      {state.status === 'ok' && state.posts.length > 0 && (
        <div className="feed">
          {state.posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={(id) => setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }))} />
          ))}
        </div>
      )}
    </div>
  )
}
