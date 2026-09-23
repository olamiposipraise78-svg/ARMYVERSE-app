import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/helpers.js'
import Icon from '../ui/Icon.jsx'
import Avatar from '../ui/Avatar.jsx'
import Button from '../ui/Button.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { deleteStory, fetchSongPreviews, viewStory } from '../../utils/api.js'
import MediaFrame from '../media/MediaFrame.jsx'
import './story.css'

const IMAGE_DURATION = 15000

function getAudioSrc(music) {
  if (!music) return null
  return music.audioUrl || music.audio || music.previewUrl || null
}

export default function StoriesViewer({ startStory, allStories, viewed, onClose, onStoryDeleted, onAddStory }) {
  const { currentUser } = useApp()
  const { show } = useToast()
  const [index, setIndex] = useState(() => {
    const idx = allStories.findIndex((s) => s.id === startStory.id)
    return idx === -1 ? 0 : idx
  })
  const [muted, setMuted] = useState(false)
  const [musicMuted, setMusicMuted] = useState(false)
  const [musicPlaying, setMusicPlaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const [audioSrc, setAudioSrc] = useState(null)
  const [deezerStatus, setDeezerStatus] = useState('idle') // idle | loading | ok | missing
  const pausedRef = useRef(false)
  const timerRef = useRef(null)
  const videoRef = useRef(null)
  const audioRef = useRef(null)
  const previewCacheRef = useRef(new Map())
  const audioSrcRef = useRef(null)
  const touchStartRef = useRef(null)
  const durationRef = useRef(IMAGE_DURATION)
  const musicPlayingRef = useRef(false)
  const musicMutedRef = useRef(false)
  const storyRef = useRef(null)
  const viewedOnServerRef = useRef(new Set())

  const story = allStories[index]
  storyRef.current = story
  const isVideo = story?.mediaType === 'video' || story?.media?.type === 'video'
  const hasMusic = !!story?.music
  const isDeezerMusic = !!story?.music?.deezerId || story?.music?.provider === 'deezer'
  const rawSrc = getAudioSrc(story?.music)
  const canPlay = isDeezerMusic ? deezerStatus === 'ok' && !!audioSrc : !!rawSrc
  const unavailable = isDeezerMusic && deezerStatus === 'missing'
  audioSrcRef.current = isDeezerMusic ? audioSrc : rawSrc
  musicMutedRef.current = musicMuted
  const isOwn = story?.author?.id === currentUser?.id

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const stopAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.muted = false
      audio.load()
    }
    musicPlayingRef.current = false
    musicMutedRef.current = false
    setMusicPlaying(false)
    setMusicMuted(false)
  }, [])

  const startAudio = useCallback(() => {
    const audio = audioRef.current
    const current = storyRef.current
    const src = audioSrcRef.current
    if (!audio || !current?.music || !src) return

    audio.src = src
    audio.muted = musicMutedRef.current || false
    audio.currentTime = current.music.startAt || 0
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          musicPlayingRef.current = true
          setMusicPlaying(true)
        })
        .catch(() => {
          musicPlayingRef.current = false
          setMusicPlaying(false)
        })
    }
  }, [])

  const toggleMusicMute = useCallback(() => {
    const audio = audioRef.current
    const current = storyRef.current
    const src = audioSrcRef.current
    if (!audio || !current?.music || !src) return

    if (!musicPlayingRef.current) {
      startAudio()
      return
    }

    const nextMuted = !musicMutedRef.current
    audio.muted = nextMuted
    musicMutedRef.current = nextMuted
    setMusicMuted(nextMuted)
  }, [startAudio])

  const goTo = useCallback(
    (nextIndex) => {
      clearTimer()
      stopAudio()
      if (nextIndex < 0 || nextIndex >= allStories.length) {
        onClose()
        return
      }
      viewed.add(allStories[nextIndex].id)
      setIndex(nextIndex)
      setProgressKey((k) => k + 1)
    },
    [allStories, viewed, onClose, stopAudio]
  )

  const next = useCallback(() => goTo(index + 1), [goTo, index])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])

  // Adjust index when stories are deleted externally
  useEffect(() => {
    if (allStories.length === 0) {
      onClose()
      return
    }
    if (index >= allStories.length) {
      setIndex(allStories.length - 1)
      setProgressKey((k) => k + 1)
    }
  }, [allStories.length, index, onClose])

  const handleDelete = async () => {
    try {
      await deleteStory(story.id)
      onStoryDeleted(story.id)
      setConfirmDelete(false)
    } catch {
      show('Failed to delete story.', 'error')
      setConfirmDelete(false)
    }
  }

  // Resolve a fresh Deezer preview for the active story. Deezer preview URLs
  // are time-limited signed links, so we re-fetch them when a story is opened
  // and remember the result for this session.
  useEffect(() => {
    const current = storyRef.current
    stopAudio()
    setMusicPlaying(false)
    const music = current?.music
    if (!music) {
      setDeezerStatus('idle')
      setAudioSrc(null)
      return
    }
    const isDeezer = music.provider === 'deezer' || !!music.deezerId
    if (!isDeezer) {
      setDeezerStatus('ok')
      setAudioSrc(getAudioSrc(music))
      return
    }
    if (previewCacheRef.current.has(current.id)) {
      const cached = previewCacheRef.current.get(current.id) || null
      setDeezerStatus(cached ? 'ok' : 'missing')
      setAudioSrc(cached)
      return
    }
    setDeezerStatus('loading')
    setAudioSrc(null)
    fetchSongPreviews([music.deezerId])
      .then((data) => {
        const url = data.previews?.[music.deezerId] || null
        previewCacheRef.current.set(current.id, url)
        if (storyRef.current?.id === current.id) {
          setDeezerStatus(url ? 'ok' : 'missing')
          setAudioSrc(url || null)
        }
      })
      .catch(() => {
        previewCacheRef.current.set(current.id, null)
        if (storyRef.current?.id === current.id) {
          setDeezerStatus('missing')
          setAudioSrc(null)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, stopAudio])

  // Auto-play music once the active story's audio source is resolved
  // (Deezer previews resolve asynchronously; other providers resolve sync).
  useEffect(() => {
    if (canPlay && audioSrc !== null) {
      startAudio()
    } else {
      stopAudio()
    }
  }, [index, canPlay, audioSrc, startAudio, stopAudio])

  // Set up endAt listener after music starts playing — stop the audio at the
  // story's music clip boundary without forcing the story to advance.
  useEffect(() => {
    const audio = audioRef.current
    const current = storyRef.current
    if (!audio || !musicPlaying || !current?.music) return

    if (current.music.endAt && current.music.endAt > (current.music.startAt || 0)) {
      const stopAt = current.music.endAt
      const onTimeUpdate = () => {
        if (audio.currentTime >= stopAt) {
          audio.pause()
          audio.removeEventListener('timeupdate', onTimeUpdate)
          musicPlayingRef.current = false
          setMusicPlaying(false)
        }
      }
      audio.addEventListener('timeupdate', onTimeUpdate)
      return () => audio.removeEventListener('timeupdate', onTimeUpdate)
    }
  }, [musicPlaying])

  // Register a server-side view for the active story (once per story, not for own)
  useEffect(() => {
    const current = storyRef.current
    if (!current?.id || viewedOnServerRef.current.has(current.id)) return
    viewedOnServerRef.current.add(current.id)
    if (current.author?.id === currentUser?.id) return
    viewStory(current.id).catch(() => {})
  }, [index, currentUser])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, next, prev])

  // Touch/swipe navigation
  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }

  const handleTouchEnd = (e) => {
    if (!touchStartRef.current) return
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y
    touchStartRef.current = null

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) next()
      else prev()
    }
  }

  // When music is playing, use the music clip duration so the story advances
  // when the music ends (or the media ends, whichever comes first).
  const musicClipMs = (() => {
    if (!musicPlaying || !story?.music) return Infinity
    const s = story.music.startAt || 0
    const e = story.music.endAt
    if (e && e > s) return (e - s) * 1000
    return Infinity
  })()
  const effectiveDuration = Math.min(durationRef.current, musicClipMs)

  useEffect(() => {
    clearTimer()
    pausedRef.current = false

    const advance = () => {
      if (!pausedRef.current) {
        next()
      }
    }

    timerRef.current = setTimeout(advance, effectiveDuration)
    return clearTimer
  }, [index, next, effectiveDuration])

  // Handle video metadata for duration
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isVideo) {
      durationRef.current = IMAGE_DURATION
      return
    }

    const onLoaded = () => {
      durationRef.current = video.duration * 1000 || IMAGE_DURATION
      clearTimer()
      if (!pausedRef.current) {
        timerRef.current = setTimeout(() => {
          if (!pausedRef.current) next()
        }, durationRef.current)
      }
    }

    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [index, isVideo, next])

  // Sync video play/pause with timer
  useEffect(() => {
    const video = videoRef.current
    if (!video || !isVideo) return

    const onPlay = () => { pausedRef.current = false }
    const onPause = () => { pausedRef.current = true }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
    }
  }, [index, isVideo])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
      stopAudio()
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.removeAttribute('src')
      }
    }
  }, [stopAudio])

  // Guard empty list
  if (!story) return null

  return (
    <div
      className="story-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={story.author.displayName + "'s story"}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <audio ref={audioRef} preload="none" onError={() => {
        musicPlayingRef.current = false
        setMusicPlaying(false)
      }} onEnded={() => {
        musicPlayingRef.current = false
        setMusicPlaying(false)
      }} />
      <div className="story-viewer__card">
        <div className="story-viewer__progress">
          {allStories.map((s, i) => {
            const active = i === index
            const done = i < index
            return (
              <span
                key={s.id}
                className={cn('story-viewer__bar', (active || done) && 'story-viewer__bar--on')}
              >
                {active && (
                  <span
                    className="story-viewer__bar-fill"
                    key={progressKey}
                    style={{ animationDuration: `${durationRef.current}ms` }}
                  />
                )}
                {done && <span className="story-viewer__bar-fill story-viewer__bar-fill--done" />}
              </span>
            )
          })}
        </div>

        <div className="story-viewer__head">
          <Avatar src={story.author.avatar} alt={story.author.displayName} size={34} />
          <div className="story-viewer__who">
            <span className="story-viewer__username">
              @{story.author.username}
              {story.author.verified && <Icon name="check" size={14} className="story-viewer__verify" />}
            </span>
          </div>
          <span className="story-viewer__views">{story.viewers.toLocaleString()} views</span>
          {isOwn && (
            <button className="story-viewer__delete" onClick={() => setConfirmDelete(true)} aria-label="Delete story" title="Delete story">
              <Icon name="ban" size={22} />
            </button>
          )}
          {isOwn && onAddStory && (
            <button className="story-viewer__add-story" onClick={onAddStory} aria-label="Add another story" title="Add story">
              <Icon name="create" size={20} />
            </button>
          )}
          <button className="story-viewer__close" onClick={onClose} aria-label="Close stories">
            <Icon name="close" size={24} />
          </button>
        </div>

        <div className="story-viewer__media" style={{ background: story.color }}>
          {story.media?.crop ? (
            <MediaFrame
              src={story.src || story.media?.url}
              crop={story.media.crop}
              kind={isVideo ? 'video' : 'image'}
              alt={story.caption || 'Story'}
              frameClass="media-frame--story"
              videoRef={videoRef}
              videoProps={{
                muted: muted || hasMusic,
                autoPlay: true,
                loop: false,
                controls: false,
              }}
            />
          ) : isVideo ? (
            <video
              ref={videoRef}
              className="story-viewer__video"
              src={story.src || story.media?.url}
              autoPlay
              muted={muted || hasMusic}
              loop={false}
              playsInline
              controls={false}
            />
          ) : (
            <img src={story.src || story.media?.url} alt={story.caption || 'Story'} />
          )}
          {isVideo && !hasMusic && (
            <button
              className="story-viewer__mute"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              <Icon name={muted ? 'mute' : 'volume'} size={20} />
            </button>
          )}
          {hasMusic && (
            <button
              className={cn(
                'story-viewer__music',
                !musicPlaying && 'story-viewer__music--idle',
                musicPlaying && musicMuted && 'story-viewer__music--muted'
              )}
              onClick={canPlay ? toggleMusicMute : undefined}
              aria-label={canPlay ? (musicPlaying ? (musicMuted ? 'Unmute music' : 'Mute music') : 'Play music') : 'Music attached'}
              style={!canPlay ? { cursor: 'default' } : undefined}
              aria-hidden={!canPlay}
            >
              <span className="story-viewer__music-wave" aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'story-viewer__music-bar',
                      musicPlaying && !musicMuted && 'story-viewer__music-bar--on'
                    )}
                    style={{ '--bar-i': i }}
                  />
                ))}
              </span>
              <Icon
                name={musicMuted || !canPlay ? 'mute' : 'volume'}
                size={16}
                className="story-viewer__music-icon"
              />
            </button>
          )}
        </div>

        {story.caption && <p className="story-viewer__caption">{story.caption}</p>}

        <button
          className="story-viewer__tap story-viewer__tap--left"
          onClick={prev}
          aria-label="Previous story"
        />
        <button
          className="story-viewer__tap story-viewer__tap--right"
          onClick={next}
          aria-label="Next story"
        />
      </div>

      {confirmDelete && (
        <div className="modal-backdrop" onMouseDown={() => setConfirmDelete(false)}>
          <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal__head">
              <h2 className="modal__title">Delete story?</h2>
              <button className="icon-btn" onClick={() => setConfirmDelete(false)} aria-label="Close">
                <Icon name="close" size={20} />
              </button>
            </header>
            <div className="modal__body">
              <p>This story will be permanently deleted.</p>
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
    </div>
  )
}
