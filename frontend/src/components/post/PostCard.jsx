import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { getUserById } from '../../data/users.js'
import Icon from '../ui/Icon.jsx'
import Avatar from '../ui/Avatar.jsx'
import Button from '../ui/Button.jsx'
import { cn } from '../../utils/helpers.js'
import { makeErrorHandler, FALLBACK_IMG } from '../../utils/image.js'
import { deletePost } from '../../utils/api.js'
import MusicSticker from '../music/MusicSticker.jsx'
import MediaFrame from '../media/MediaFrame.jsx'
import './postcard.css'

export function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function formatTime(ts) {
  const t = typeof ts === 'string' ? Date.parse(ts) : ts
  const time = Number.isFinite(t) ? t : Date.now()
  const diff = (Date.now() - time) / 1000
  if (diff < 0) return 'now'
  const mins = Math.max(1, Math.round(diff / 60))
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d`
  return new Date(time).toLocaleDateString()
}

// Resolve the video MIME type for a media item. Prefers the stored mimeType
// (returned by the upload API), then derives it from the file extension so
// legacy posts still render with the correct <source> hint.
export function videoMimeType(media) {
  if (media?.mimeType) return media.mimeType
  const src = (media?.src || '').split('?')[0].toLowerCase()
  if (src.endsWith('.webm')) return 'video/webm'
  if (src.endsWith('.mov') || src.endsWith('.quicktime')) return 'video/quicktime'
  if (src.endsWith('.ogg')) return 'video/ogg'
  if (src.endsWith('.m4v') || src.endsWith('.mp4')) return 'video/mp4'
  return undefined
}

const defaultComments = [
  { id: 'dc1', user: 'u4', text: 'So good, saving this 💜', time: '1h' },
  { id: 'dc2', user: 'u2', text: 'Love this! Borahae!!', time: '40m' },
]

export default function PostCard({ post, onDelete }) {
  const { currentUser, toggleLike, toggleSave } = useApp()
  const { show } = useToast()
  const author = post.author || getUserById(post.user)
  const isOwn = currentUser?.id === post.author?.id || currentUser?.id === post.user
  const [liked, setLiked] = useState(!!post.liked)
  const [saved, setSaved] = useState(!!post.saved)
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0)
  const [showComments, setShowComments] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [downloaded, setDownloaded] = useState(false)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const audioRef = useRef(null)
  const musicTimerRef = useRef(null)

  const images = post.media?.images || (post.media?.src ? [post.media] : [])
  const [activeIdx, setActiveIdx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

  const goTo = (i) => setActiveIdx(Math.max(0, Math.min(images.length - 1, i)))

  const onPointerDown = (e) => {
    if (images.length < 2) return
    setDragging(true)
    setDragStart(e.clientX)
    setDragOffset(0)
  }

  const onPointerMove = (e) => {
    if (dragStart == null) return
    setDragOffset(e.clientX - dragStart)
  }

  const onPointerUp = () => {
    setDragging(false)
    if (dragStart == null) return
    if (dragOffset < -48) goTo(activeIdx + 1)
    else if (dragOffset > 48) goTo(activeIdx - 1)
    setDragStart(null)
    setDragOffset(0)
  }

  const handleLike = async () => {
    const prevLiked = liked
    const nextLiked = !prevLiked
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)))
    setLiked(nextLiked)
    try {
      const res = nextLiked
        ? await toggleLike(post.id, true)
        : await toggleLike(post.id, false)
      if (res && typeof res.likeCount === 'number') setLikeCount(res.likeCount)
    } catch {
      setLikeCount((c) => Math.max(0, c + (prevLiked ? 1 : -1)))
      setLiked(prevLiked)
    }
  }

  const handleSave = async () => {
    const prevSaved = saved
    const nextSaved = !prevSaved
    setSaved(nextSaved)
    try {
      if (nextSaved) await toggleSave(post.id, true)
      else await toggleSave(post.id, false)
    } catch {
      setSaved(prevSaved)
    }
  }

  const handleDownload = () => {
    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2400)
  }

  const handleDelete = async () => {
    try {
      await deletePost(post.id)
      setConfirmDelete(false)
      if (onDelete) onDelete(post.id)
    } catch {
      show('Failed to delete post.', 'error')
      setConfirmDelete(false)
    }
  }

  const toggleMusic = () => {
    const audio = audioRef.current
    if (!audio || !post.music) return

    if (musicPlaying) {
      audio.pause()
      audio.removeAttribute('src')
      setMusicPlaying(false)
      if (musicTimerRef.current) {
        clearTimeout(musicTimerRef.current)
        musicTimerRef.current = null
      }
      return
    }

    const src = post.music.audioUrl || post.music.audio || post.music.previewUrl
    if (!src) return

    audio.src = src
    audio.currentTime = post.music.startAt || 0
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => setMusicPlaying(true))
        .catch(() => setMusicPlaying(false))
    }

    if (post.music.endAt && post.music.endAt > (post.music.startAt || 0)) {
      const duration = (post.music.endAt - (post.music.startAt || 0)) * 1000
      musicTimerRef.current = setTimeout(() => {
        audio.pause()
        audio.removeAttribute('src')
        setMusicPlaying(false)
        musicTimerRef.current = null
      }, duration)
    }
  }

  const renderMedia = () => {
    if (!post.media) return null
    if (post.media.type === 'video') {
      if (post.media.crop) {
        return (
          <figure className="post__media post__media--video">
            <MediaFrame
              src={post.media.src}
              crop={post.media.crop}
              kind="video"
              alt={post.media.alt || 'Post video'}
              poster={post.media.thumbnail}
              className="post__media-video-inner"
              frameClass="media-frame--post"
              videoProps={{ controls: true, playsInline: true, preload: 'metadata' }}
            />
          </figure>
        )
      }
      const mime = videoMimeType(post.media)
      return (
        <div className="post__media post__media--video">
          <video
            controls
            preload="metadata"
            poster={post.media.thumbnail}
            src={post.media.src}
            aria-label={post.media.alt || 'Post video'}
          >
            {mime && <source src={post.media.src} type={mime} />}
          </video>
        </div>
      )
    }
    if (images.length > 1) {
      const active = images[activeIdx]
      return (
        <div
          className="post__carousel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className={cn('post__carousel-track', dragging && 'post__carousel-track--dragging')}
            style={{
              transform: `translateX(calc(${(dragOffset / 2)}px - ${activeIdx * 100}%))`,
            }}
          >
            {images.map((img, i) => (
              <div className="post__carousel-slide" key={i}>
                {img.crop ? (
                  <MediaFrame
                    src={img.src}
                    crop={img.crop}
                    kind="image"
                    alt={img.alt || active.alt || 'Post'}
                    className="post__img"
                    frameClass="media-frame--post"
                    onError={makeErrorHandler(img.fallback || FALLBACK_IMG)}
                  />
                ) : (
                  <img
                    className="post__img"
                    src={img.src}
                    alt={img.alt || active.alt || 'Post'}
                    draggable={false}
                    loading="lazy"
                    onError={makeErrorHandler(img.fallback || FALLBACK_IMG)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="post__carousel-nav">
            {images.map((_, i) => (
              <button
                key={i}
                className={cn('carousel-dot', i === activeIdx && 'carousel-dot--active')}
                onClick={() => goTo(i)}
                aria-label={`Image ${i + 1} of ${images.length}`}
              />
            ))}
          </div>
        </div>
      )
    }
    if (post.media.crop) {
      return (
        <figure className="post__media">
          <MediaFrame
            src={post.media.src}
            crop={post.media.crop}
            kind="image"
            alt={post.media.alt || 'Post'}
            className="post__img"
            frameClass="media-frame--post"
            onError={makeErrorHandler(post.media.fallback || FALLBACK_IMG)}
          />
        </figure>
      )
    }
    return (
      <figure className="post__media">
        <img className="post__img" src={post.media.src} alt={post.media.alt || 'Post'} loading="lazy" onError={makeErrorHandler(post.media.fallback || FALLBACK_IMG)} />
      </figure>
    )
  }

  return (
    <article className="post-card">
      <header className="post__head">
        <div className="post__author">
          <Avatar src={author.avatarArt || author.avatar} alt={author.displayName} size={42} />
          <div className="post__author-info">
            <div className="post__author-line">
              <span className="post__username">{author.username}</span>
              {author.verified && (
                <span className="badge-verified" title="Verified ARMY" aria-label="Verified">
                  <Icon name="check" size={14} strokeWidth={3} />
                </span>
              )}
            </div>
            <div className="post__meta">
              <span>{author.country} {author.flag && <span aria-hidden="true">{author.flag}</span>}</span>
              <span className="dot-sep">·</span>
              <span>{formatTime(post.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="post__menu-wrap">
          <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="More options">
            <Icon name="more" size={20} />
          </button>
          {menuOpen && (
            <div className="post__menu">
              {isOwn && (
                <button
                  className="menu-item menu-item--danger"
                  onClick={() => {
                    setMenuOpen(false)
                    setConfirmDelete(true)
                  }}
                >
                  <Icon name="ban" size={18} /> Delete post
                </button>
              )}
              <button
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false)
                  setReportOpen(true)
                }}
              >
                <Icon name="flag" size={18} /> Report post
              </button>
              {!isOwn && (
                <>
                  <button className="menu-item" onClick={() => setMenuOpen(false)}>
                    <Icon name="ban" size={18} /> Block {author.username}
                  </button>
                  <button className="menu-item" onClick={() => setMenuOpen(false)}>
                    <Icon name="mute" size={18} /> Mute {author.username}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {renderMedia()}

      <div className="post__body">
        <div className="post__actions">
          <button
            className={cn('action-btn', liked && 'action-btn--liked')}
            onClick={handleLike}
            aria-pressed={liked}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            {liked ? <Icon name="heartFill" size={26} /> : <Icon name="heart" size={26} />}
          </button>
          <button
            className="action-btn"
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
            aria-label="Comments"
          >
            <Icon name="comment" size={24} />
          </button>
          <button className="action-btn" aria-label="Share">
            <Icon name="share" size={24} />
          </button>
          <span className="post__actions-right">
            {post.media && post.downloadable === true && (
              <button className="action-btn" onClick={handleDownload} aria-label="Download media">
                {downloaded ? (
                  <span className="dl-check"><Icon name="check" size={20} strokeWidth={3} /></span>
                ) : (
                  <Icon name="download" size={24} />
                )}
              </button>
            )}
            <button
              className={cn('action-btn', saved && 'action-btn--saved')}
              onClick={handleSave}
              aria-pressed={saved}
              aria-label={saved ? 'Remove from saved' : 'Save'}
            >
              {saved ? <Icon name="bookmarkFill" size={24} /> : <Icon name="bookmark" size={24} />}
            </button>
          </span>
        </div>

        <p className="post__likes">
          <strong>{formatCount(likeCount)}</strong> likes
          {post.viewCount > 0 && (
            <span className="post__views"> · {formatCount(post.viewCount)} views</span>
          )}
        </p>

        <div className="post__caption">
          <span className="post__username">{author.username}</span>
          <span>{post.text}</span>
        </div>

        {post.location && (
          <p className="post__location">
            <Icon name="globe" size={14} /> {post.location}
          </p>
        )}

        {post.music && (
          <div className="post__music">
            <audio ref={audioRef} preload="none" onError={() => setMusicPlaying(false)} />
            <MusicSticker
              song={post.music}
              playing={musicPlaying}
              className="post__music-card"
              onToggle={toggleMusic}
            />
          </div>
        )}

        {post.hashtags?.length > 0 && (
          <div className="post__tags">
            {post.hashtags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}

        <button
          className="post__view-comments"
          onClick={() => setShowComments((v) => !v)}
        >
          View all {formatCount(post.commentCount)} comments
        </button>

        {showComments && (
          <div className="post__comments">
            {(post.comments?.length ? post.comments : defaultComments).map((c) => {
              const cu = c.author || getUserById(c.user)
              return (
                <div className="comment" key={c.id}>
                  <Avatar src={cu.avatarArt || cu.avatar} alt={cu.displayName} size={28} />
                  <div className="comment__content">
                    <p className="comment__text">
                      <span className="post__username">{cu.username}</span> {c.text}
                    </p>
                    <div className="comment__meta">
                      <span>{Number.isFinite(Date.parse(c.time)) ? formatTime(c.time) : c.time}</span>
                      <button>Reply</button>
                    </div>
                  </div>
                  <button className="comment__like" aria-label="Like comment">
                    <Icon name="heart" size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {reportOpen && (
        <div className="modal-backdrop" onMouseDown={() => setReportOpen(false)}>
          <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2 className="modal__title">Report this post</h2>
              <button className="icon-btn" onClick={() => setReportOpen(false)} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="modal__body">
              <p className="report-intro">
                Let our team know why this post may violate the community guidelines.
              </p>
              <div className="report-reasons">
                <label className="radio-row">
                  <input type="radio" name="reason" defaultChecked /> Spam or misleading
                </label>
                <label className="radio-row">
                  <input type="radio" name="reason" /> Harassment or bullying
                </label>
                <label className="radio-row">
                  <input type="radio" name="reason" /> Hate speech
                </label>
                <label className="radio-row">
                  <input type="radio" name="reason" /> Copyright / impersonation
                </label>
                <label className="radio-row">
                  <input type="radio" name="reason" /> Something else
                </label>
              </div>
            </div>
            <footer className="modal__foot">
              <Button variant="ghost" onClick={() => setReportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="solid-danger"
                onClick={() => {
                  setReportOpen(false)
                }}
              >
                Submit report
              </Button>
            </footer>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmDelete(false)}>
          <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2 className="modal__title">Delete post?</h2>
              <button className="icon-btn" onClick={() => setConfirmDelete(false)} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="modal__body">
              <p>This action cannot be undone. The post will be permanently removed.</p>
            </div>
            <footer className="modal__foot">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button variant="solid-danger" onClick={handleDelete}>
                Delete
              </Button>
            </footer>
          </div>
        </div>
      )}
    </article>
  )
}
