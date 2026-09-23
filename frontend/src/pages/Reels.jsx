import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  fetchReels,
  likeReel,
  unlikeReel,
  saveReel,
  unsaveReel,
  viewReel,
  shareReel,
  commentOnReel,
  fetchReelComments,
  deleteReel,
} from '../utils/api.js'
import { useApp } from '../context/AppContext.jsx'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import Icon from '../components/ui/Icon.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { isImageUrl } from '../utils/helpers.js'
import CreateReel from './CreateReel.jsx'
import MediaFrame from '../components/media/MediaFrame.jsx'
import './reels.css'

function formatFull(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function CommentPanel({ reelId, onClose }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    let active = true
    fetchReelComments(reelId)
      .then((res) => {
        if (active) {
          setComments(res.comments || [])
          setLoading(false)
        }
      })
      .catch(() => active && setLoading(false))
    return () => { active = false }
  }, [reelId])

  const submit = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const comment = await commentOnReel(reelId, text.trim())
      setComments((prev) => [comment, ...prev])
      setText('')
    } catch {
      /* ignore */
    }
    setSending(false)
  }

  return (
    <div className="reel__comments-panel">
      <div className="reel__comments-header">
        <span>Comments</span>
        <button className="reel__icon-btn reel__comments-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="reel__comments-list">
        {loading && <LoadingState label="Loading comments…" />}
        {!loading && comments.length === 0 && (
          <p className="reel__comments-empty">No comments yet. Be the first!</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="reel__comment">
            <Avatar
              src={c.author?.avatarArt || c.author?.avatar}
              alt={c.author?.displayName}
              size={28}
            />
            <div className="reel__comment-body">
              <span className="reel__comment-user">{c.author?.username}</span>
              <span className="reel__comment-text">{c.text}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="reel__comment-input-row">
        <input
          ref={inputRef}
          className="reel__comment-input"
          placeholder="Add a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          maxLength={500}
        />
        <button
          className="reel__comment-send"
          onClick={submit}
          disabled={!text.trim() || sending}
          aria-label="Send"
        >
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  )
}

function ReelCard({ reel, isActive, currentUser, onDelete }) {
  const videoRef = useRef(null)
  const viewCountedRef = useRef(false)
  const userPausedRef = useRef(false)
  const [muted, setMuted] = useState(true)
  const [showPoster, setShowPoster] = useState(true)
  const [liked, setLiked] = useState(reel.liked || false)
  const [saved, setSaved] = useState(reel.saved || false)
  const [likeCount, setLikeCount] = useState(reel.likeCount || 0)
  const [commentCount, setCommentCount] = useState(reel.commentCount || 0)
  const [showComments, setShowComments] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showPauseOverlay, setShowPauseOverlay] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isImage = isImageUrl(reel.src)

  useEffect(() => {
    if (isImage) {
      if (isActive && currentUser && !viewCountedRef.current) {
        viewCountedRef.current = true
        viewReel(reel.id).catch(() => {})
      }
      return
    }
    const video = videoRef.current
    if (!video) return
    if (isActive) {
      if (!userPausedRef.current) {
        video.play().catch(() => {})
        setPaused(false)
      }
      if (!viewCountedRef.current && currentUser) {
        viewCountedRef.current = true
        viewReel(reel.id).catch(() => {})
      }
    } else {
      video.pause()
      userPausedRef.current = false
      setPaused(false)
    }
  }, [isActive, reel.id, currentUser, isImage])

  const handleTapVideo = () => {
    if (isImage) return
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
      userPausedRef.current = false
      setPaused(false)
    } else {
      video.pause()
      userPausedRef.current = true
      setPaused(true)
      setShowPauseOverlay(true)
      setTimeout(() => setShowPauseOverlay(false), 800)
    }
  }

  const handleLike = async () => {
    if (!currentUser) return
    const prev = liked
    const prevCount = likeCount
    setLiked(!prev)
    setLikeCount((c) => (prev ? c - 1 : c + 1))
    try {
      if (prev) {
        await unlikeReel(reel.id)
      } else {
        await likeReel(reel.id)
      }
    } catch {
      setLiked(prev)
      setLikeCount(prevCount)
    }
  }

  const handleSave = async () => {
    if (!currentUser) return
    const prev = saved
    setSaved(!prev)
    try {
      if (prev) {
        await unsaveReel(reel.id)
      } else {
        await saveReel(reel.id)
      }
    } catch {
      setSaved(prev)
    }
  }

  const handleShare = async () => {
    try {
      await shareReel(reel.id)
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${window.location.origin}/reels?id=${reel.id}`)
      }
    } catch {
      /* ignore */
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteReel(reel.id)
      if (onDelete) onDelete(reel.id)
    } catch {
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const isOwner = currentUser && reel.user === currentUser.id

  return (
    <div className="reel__media">
      {isImage ? (
        reel.crop ? (
          <MediaFrame
            src={reel.src}
            crop={reel.crop}
            kind="image"
            alt={reel.alt || 'BTS/ARMY photo'}
            className="reel__img"
            frameClass="media-frame--reel"
          />
        ) : (
          <img
            className="reel__img"
            src={reel.src}
            alt={reel.alt || 'BTS/ARMY photo'}
          />
        )
      ) : reel.crop ? (
        <MediaFrame
          src={reel.src}
          crop={reel.crop}
          kind="video"
          poster={reel.poster || ''}
          alt={reel.alt || 'BTS/ARMY video'}
          className="reel__video"
          frameClass="media-frame--reel"
          videoRef={videoRef}
          videoProps={{
            muted,
            autoPlay: false,
            loop: true,
            onLoadedData: () => setShowPoster(false),
            onError: () => setShowPoster(true),
          }}
        />
      ) : (
        <video
          ref={videoRef}
          className="reel__video"
          poster={reel.poster || ''}
          preload="metadata"
          muted={muted}
          autoPlay={false}
          playsInline
          loop
          onLoadedData={() => setShowPoster(false)}
          onError={() => setShowPoster(true)}
          aria-label={reel.alt || 'BTS/ARMY video'}
        >
          <source src={reel.src} type="video/mp4" />
        </video>
      )}

      <div className="reel__tap-zone" onClick={handleTapVideo} aria-label={isImage ? 'Photo' : paused ? 'Play' : 'Pause'} />

      {!isImage && showPauseOverlay && (
        <div className="reel__pause-overlay">
          <div className="reel__pause-icon">
            <Icon name={paused ? 'pause' : 'play'} size={28} />
          </div>
        </div>
      )}

      {!isImage && showPoster && (
        <div className="reel__poster-fallback">
          {reel.poster ? (
            <img className="reel__poster-img" src={reel.poster} alt={reel.alt || ''} />
          ) : (
            <Icon name="video" size={40} className="reel__poster-icon" />
          )}
        </div>
      )}

      {!isImage && (
        <button
          className="reel__icon-btn reel__sound-btn"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <Icon name="mute" size={24} /> : <Icon name="volume" size={24} />}
        </button>
      )}

      <div className="reel__actions">
        <div className="reel__action">
          <button
            className={`reel__icon-btn ${liked ? 'reel__icon-btn--active' : ''}`}
            onClick={handleLike}
            aria-label="Like"
          >
            <Icon name="heart" size={28} className={liked ? 'icon--liked' : ''} />
          </button>
          <span className="reel__action-label">{formatFull(likeCount)}</span>
        </div>
        <div className="reel__action">
          <button
            className="reel__icon-btn"
            onClick={() => setShowComments((s) => !s)}
            aria-label="Comment"
          >
            <Icon name="comment" size={26} />
          </button>
          <span className="reel__action-label">{formatFull(commentCount)}</span>
        </div>
        <div className="reel__action">
          <button className="reel__icon-btn" onClick={handleShare} aria-label="Share">
            <Icon name="share" size={26} />
          </button>
          <span className="reel__action-label">{formatFull(reel.shareCount || 0)}</span>
        </div>
        <div className="reel__action">
          <button
            className={`reel__icon-btn ${saved ? 'reel__icon-btn--active' : ''}`}
            onClick={handleSave}
            aria-label="Save"
          >
            <Icon name="bookmark" size={26} className={saved ? 'icon--saved' : ''} />
          </button>
          <span className="reel__action-label">{formatFull(reel.saveCount || 0)}</span>
        </div>
        {isOwner && (
          <div className="reel__action reel__action--delete">
            <button
              className="reel__icon-btn"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete Reel"
            >
              <Icon name="trash" size={24} />
            </button>
          </div>
        )}
      </div>

      <div className="reel__meta">
        <div className="reel__author">
          <Avatar
            src={reel.author?.avatarArt || reel.author?.avatar}
            alt={reel.author?.displayName}
            size={34}
          />
          <span className="reel__username">@{reel.author?.username}</span>
        </div>
        <p className="reel__caption">
          <span className="reel__caption-user">{reel.author?.username}</span> {reel.caption}
        </p>
        {reel.hashtags && reel.hashtags.length > 0 && (
          <div className="reel__tags">
            {reel.hashtags.map((h) => (
              <span key={h} className="reel__tag">{h}</span>
            ))}
          </div>
        )}
        {reel.audio && (
          <div className="reel__audio">
            <Icon name="note" size={15} />
            <span>♪ {reel.audio}</span>
          </div>
        )}
        {reel.viewCount > 0 && (
          <div className="reel__views">{formatFull(reel.viewCount)} views</div>
        )}
      </div>

      {showComments && (
        <CommentPanel reelId={reel.id} onClose={() => setShowComments(false)} />
      )}

      {showDeleteConfirm && (
        <div className="reel__delete-confirm" onClick={() => !deleting && setShowDeleteConfirm(false)}>
          <div className="reel__delete-card" onClick={(e) => e.stopPropagation()}>
            <p className="reel__delete-title">Delete Reel?</p>
            <p className="reel__delete-msg">This action cannot be undone. The Reel will be permanently removed.</p>
            <div className="reel__delete-actions">
              <button
                className="reel__delete-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="reel__delete-confirm-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Reels() {
  const containerRef = useRef(null)
  const [state, setState] = useState({ status: 'loading', reels: [] })
  const [activeIndex, setActiveIndex] = useState(0)
  const [creating, setCreating] = useState(false)
  const localReelsRef = useRef([])
  const { currentUser } = useApp()
  const location = useLocation()

  const prependReel = useCallback((reel) => {
    localReelsRef.current = [
      reel,
      ...localReelsRef.current.filter((r) => r.id !== reel.id),
    ]
    setState((prev) => ({
      status: 'ok',
      reels: [reel, ...prev.reels.filter((r) => r.id !== reel.id)],
    }))
  }, [])

  const handleReelCreated = useCallback(
    (reel) => {
      setCreating(false)
      prependReel(reel)
    },
    [prependReel]
  )

  const load = useCallback(() => {
    setState({ status: 'loading', reels: [] })
    fetchReels()
      .then((res) => {
        const remote = res.reels || []
        const merged = [
          ...localReelsRef.current,
          ...remote.filter((r) => !localReelsRef.current.some((l) => l.id === r.id)),
        ]
        setState({ status: 'ok', reels: merged })
      })
      .catch(() => setState({ status: 'error', reels: [] }))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const newReel = location.state?.newReel
    if (newReel) {
      prependReel(newReel)
      window.history.replaceState({}, '')
    }
  }, [location.state, prependReel])

  const reels = state.reels

  const handleDeleteReel = useCallback((reelId) => {
    localReelsRef.current = localReelsRef.current.filter((r) => r.id !== reelId)
    setState((prev) => ({
      ...prev,
      reels: prev.reels.filter((r) => r.id !== reelId),
    }))
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || reels.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'))
            if (!isNaN(idx)) setActiveIndex(idx)
          }
        })
      },
      { root: container, threshold: 0.55 }
    )

    const targets = container.querySelectorAll('.reel')
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [reels])

  return (
    <div className="page page--reels">
      <div className="reels-head">
        <h1 className="page-title">Reels</h1>
        {currentUser && (
          <button
            className="btn btn--primary btn--sm"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" size={16} /> New Reel
          </button>
        )}
      </div>
      {state.status === 'loading' && <LoadingState label="Loading Reels…" />}
      {state.status === 'error' && (
        <ErrorState message="Couldn't load Reels right now." onRetry={load} />
      )}
      {state.status === 'ok' && reels.length === 0 && (
        <EmptyState
          icon="🎬"
          title="No Reels yet"
          message="When ARMYs share short videos and photos, they'll show up here."
          action={
            currentUser && (
              <button
                className="btn btn--primary"
                onClick={() => setCreating(true)}
              >
                Create your first Reel
              </button>
            )
          }
        />
      )}
      {state.status === 'ok' && reels.length > 0 && (
        <div className="reels-scroll" ref={containerRef}>
          {reels.map((reel, i) => (
            <article
              className="reel"
              data-index={i}
              data-id={reel.id}
              key={reel.id}
              aria-label={`Reel by ${reel.author?.username || 'unknown'}`}
            >
              <ReelCard
                reel={reel}
                isActive={i === activeIndex}
                currentUser={currentUser}
                onDelete={handleDeleteReel}
              />
            </article>
          ))}
        </div>
      )}
      {currentUser && (
        <button
          className="reel__fab"
          onClick={() => setCreating(true)}
          aria-label="Create new Reel"
        >
          <Icon name="plus" size={24} />
        </button>
      )}

      {creating && (
        <CreateReel
          onClose={() => setCreating(false)}
          onSuccess={handleReelCreated}
        />
      )}
    </div>
  )
}
