import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchUser, fetchExplore, fetchMySaved, deletePost } from '../utils/api.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import FollowButton from '../components/ui/FollowButton.jsx'
import { formatCount } from '../components/post/PostCard.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { cn } from '../utils/helpers.js'
import { makeErrorHandler } from '../utils/image.js'
import MediaFrame from '../components/media/MediaFrame.jsx'
import './profile.css'

export default function Profile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useApp()
  const isOwn = !username || username === currentUser.username
  const targetName = isOwn ? currentUser.username : username

  const [user, setUser] = useState({ status: 'loading', data: null })
  const [posts, setPosts] = useState({ status: 'loading', data: [] })
  const [saved, setSaved] = useState({ status: 'loading', data: [] })
  const [tab, setTab] = useState('posts')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { show } = useToast()

  useEffect(() => {
    let active = true
    setUser({ status: 'loading', data: null })
    if (isOwn) {
      setUser({ status: 'ok', data: currentUser })
    } else {
      fetchUser(targetName)
        .then((res) => active && setUser({ status: 'ok', data: res }))
        .catch(() => active && setUser({ status: 'error', data: null }))
    }
    return () => {
      active = false
    }
  }, [targetName, isOwn, currentUser])

  useEffect(() => {
    let active = true
    setPosts({ status: 'loading', data: [] })
    fetchExplore({ page_size: 50 })
      .then((res) => {
        if (!active) return
        const all = res.posts || []
        const mine = isOwn
          ? all.filter((p) => p.author?.id === currentUser.id || p.user === currentUser.id)
          : all.filter((p) => p.author?.id === user?.data?.id || p.user === user?.data?.id)
        setPosts({ status: 'ok', data: mine })
      })
      .catch(() => active && setPosts({ status: 'ok', data: [] }))
    return () => {
      active = false
    }
  }, [isOwn, currentUser.id, user?.data?.id, targetName])

  useEffect(() => {
    if (!isOwn) return
    let active = true
    setSaved({ status: 'loading', data: [] })
    fetchMySaved({ page_size: 50 })
      .then((res) => active && setSaved({ status: 'ok', data: res.saved || [] }))
      .catch(() => active && setSaved({ status: 'ok', data: [] }))
    return () => {
      active = false
    }
  }, [isOwn])

  const userPosts = posts.data
  const savedPosts = saved.data
  const grid = tab === 'posts' ? userPosts : savedPosts

  const showMessage = (u) => {
    navigate('/messages')
  }

  const handleDeletePost = async () => {
    if (!confirmDelete) return
    try {
      await deletePost(confirmDelete.id)
      setPosts((s) => ({ ...s, data: s.data.filter((p) => p.id !== confirmDelete.id) }))
      setSaved((s) => ({ ...s, data: s.data.filter((p) => p.id !== confirmDelete.id) }))
      show('Post deleted.', 'success')
    } catch {
      show('Failed to delete post.', 'error')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="page profile">
      {user.status === 'loading' && <LoadingState label="Loading profile…" />}
      {user.status === 'error' && (
        <ErrorState
          message="We couldn’t find this ARMY."
          onRetry={() => navigate(0)}
        />
      )}
      {user.status === 'ok' && user.data && (
        <>
          <div className="profile-head">
            <Avatar src={user.data.avatarArt || user.data.avatar} alt={user.data.displayName} size={96} />
            <div className="profile-head__main">
              <div className="profile-head__row">
                <h1 className="profile-head__name">{user.data.username}</h1>
                {user.data.verified && (
                  <span className="badge-verified" aria-label="Verified ARMY">
                    <Icon name="check" size={14} strokeWidth={3} />
                  </span>
                )}
              </div>
              <div className="profile-head__display">{user.data.displayName}</div>
              <div className="profile-head__loc">
                {user.data.flag} {user.data.country}
              </div>
            </div>
          </div>

          <div className="profile-stats">
            <div className="profile-stat">
              <span className="profile-stat__value">{formatCount(user.data.posts || 0)}</span>
              <span className="profile-stat__label">Posts</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{formatCount(user.data.followers)}</span>
              <span className="profile-stat__label">Followers</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat__value">{formatCount(user.data.following)}</span>
              <span className="profile-stat__label">Following</span>
            </div>
          </div>

          {user.data.bio && <p className="profile-bio">{user.data.bio}</p>}

          <div className="profile-actions">
            {isOwn ? (
              <Button variant="secondary" onClick={() => navigate('/settings')}>
                Edit profile
              </Button>
            ) : (
              <>
                <FollowButton userId={user.data.id} size="md" />
                <Button variant="secondary" onClick={() => showMessage(user.data)}>
                  <Icon name="messages" size={18} /> Message
                </Button>
              </>
            )}
          </div>

          <div className="profile-tabs" role="tablist">
            <button
              className={cn('profile-tab', tab === 'posts' && 'profile-tab--active')}
              onClick={() => setTab('posts')}
              role="tab"
              aria-selected={tab === 'posts'}
            >
              <Icon name="grid" size={20} /> Posts
            </button>
            {isOwn && (
              <button
                className={cn('profile-tab', tab === 'saved' && 'profile-tab--active')}
                onClick={() => setTab('saved')}
                role="tab"
                aria-selected={tab === 'saved'}
              >
                <Icon name="bookmarkTab" size={20} /> Saved
              </button>
            )}
          </div>

          {grid.length === 0 ? (
            <EmptyState
              icon={tab === 'posts' ? '📷' : '🔖'}
              title={tab === 'posts' ? 'No posts yet' : 'No saved posts'}
              message={
                tab === 'posts'
                  ? 'This ARMY hasn’t shared anything yet.'
                  : 'Tap the bookmark on any post to save it here.'
              }
            />
          ) : (
            <div className="profile-grid">
              {grid.map((p) => {
                const isOwnPost = p.author?.id === currentUser.id || p.user === currentUser.id
                return (
                  <figure className="profile-cell" key={p.id}>
                    {p.media?.crop ? (
                      <MediaFrame
                        src={p.media.src}
                        crop={p.media.crop}
                        kind={p.media.type === 'video' ? 'video' : 'image'}
                        alt={p.media?.alt || 'Post'}
                        frameClass="media-frame--tile"
                        onError={makeErrorHandler(p.media?.fallback)}
                      />
                    ) : (
                      <img
                        className="profile-cell__img"
                        src={p.media?.thumbnail || p.media?.src}
                        alt={p.media?.alt || 'Post'}
                        loading="lazy"
                        onError={makeErrorHandler(p.media?.fallback)}
                      />
                    )}
                    <figcaption className="profile-cell__overlay">
                      <span>
                        <Icon name="heart" size={15} /> {formatCount(p.likeCount)}
                      </span>
                      <span>
                        <Icon name="comment" size={15} /> {formatCount(p.commentCount)}
                      </span>
                    </figcaption>
                    {isOwnPost && (
                      <button
                        className="profile-cell__delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDelete(p)
                        }}
                        aria-label="Delete post"
                      >
                        <Icon name="ban" size={16} />
                      </button>
                    )}
                  </figure>
                )
              })}
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmDelete(null)}>
          <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2 className="modal__title">Delete post?</h2>
              <button className="icon-btn" onClick={() => setConfirmDelete(null)} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="modal__body">
              <p>This action cannot be undone. The post will be permanently removed.</p>
            </div>
            <footer className="modal__foot">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button variant="solid-danger" onClick={handleDeletePost}>
                Delete
              </Button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
