import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import { allPreviewableSongs, searchCatalogue } from '../../data/btsCatalogue.js'
import { fetchSongPreviews } from '../../utils/api.js'
import { cn } from '../../utils/helpers.js'
import './music.css'

const WAVE_BARS = 28

function formatTime(sec) {
  if (!sec || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

let audioCtxRef = null
function getAudioContext() {
  if (!audioCtxRef) {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (Ctor) audioCtxRef = new Ctor()
  }
  return audioCtxRef
}

async function analyzePreview(url) {
  const ctx = getAudioContext()
  if (!ctx) return null
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not load preview for analysis.')
  const buffer = await res.arrayBuffer()
  const audioBuffer = await ctx.decodeAudioData(buffer)
  const channel = audioBuffer.getChannelData(0)
  const block = Math.floor(channel.length / WAVE_BARS)
  if (block <= 0) return null
  const heights = []
  for (let i = 0; i < WAVE_BARS; i++) {
    let peak = 0
    const start = i * block
    for (let j = 0; j < block; j += 2) {
      const v = Math.abs(channel[start + j])
      if (v > peak) peak = v
    }
    heights.push(peak)
  }
  const max = Math.max(...heights, 0.0001)
  return heights.map((h) => Math.max(10, Math.round((h / max) * 92)))
}

export default function DeezerSongPicker({ open, onClose, onSelect, current, storyDuration = 15 }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [resolving, setResolving] = useState(false)
  const [resolvedUrl, setResolvedUrl] = useState(null)
  const [clipDuration, setClipDuration] = useState(0)
  const [waveBars, setWaveBars] = useState(null) // null = analysing, [] = unavailable
  const [previewing, setPreviewing] = useState(false)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState(null)

  const audioRef = useRef(null)
  const positionTimerRef = useRef(null)
  const loadIdRef = useRef(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelected(null)
    setResolvedUrl(null)
    setResolving(false)
    setClipDuration(0)
    setWaveBars(null)
    setPreviewing(false)
    setPosition(0)
    setError(null)
    stopPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    return () => {
      stopPreview()
      if (audioCtxRef) {
        audioCtxRef.close && audioCtxRef.close().catch(() => {})
        audioCtxRef = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopPreview = () => {
    setPreviewing(false)
    setPosition(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
      audioRef.current.load()
    }
    if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current)
      positionTimerRef.current = null
    }
  }

  const selectTrack = async (track) => {
    if (selected && selected.deezerId === track.deezerId && resolvedUrl) return
    stopPreview()
    const loadId = ++loadIdRef.current
    setSelected(track)
    setResolving(true)
    setResolvedUrl(null)
    setClipDuration(0)
    setWaveBars(null)
    setError(null)
    try {
      const data = await fetchSongPreviews([track.deezerId])
      const url = data.previews?.[track.deezerId] || null
      if (loadId !== loadIdRef.current) return
      setResolving(false)
      if (!url) {
        setWaveBars([])
        setError('Preview unavailable for this track. Pick another song.')
        return
      }
      setResolvedUrl(url)
      // Real waveform from the actual preview audio.
      try {
        const bars = await analyzePreview(url)
        if (loadId !== loadIdRef.current) return
        setWaveBars(bars || [])
      } catch {
        if (loadId !== loadIdRef.current) return
        setWaveBars([])
      }
      if (audioRef.current) {
        audioRef.current.src = url
        const onLoaded = () => {
          if (audioRef.current && audioRef.current.duration) {
            setClipDuration(audioRef.current.duration)
          }
          audioRef.current.removeEventListener('loadedmetadata', onLoaded)
        }
        audioRef.current.addEventListener('loadedmetadata', onLoaded)
        audioRef.current.load()
      }
    } catch {
      if (loadId !== loadIdRef.current) return
      setResolving(false)
      setWaveBars([])
      setError('Could not load the preview. Check your connection and try again.')
    }
  }

  const togglePreview = () => {
    const audio = audioRef.current
    if (!audio || !resolvedUrl) return

    if (previewing) {
      stopPreview()
      return
    }

    audio.src = resolvedUrl
    audio.currentTime = 0
    const playPromise = audio.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setPreviewing(true)
          if (positionTimerRef.current) clearInterval(positionTimerRef.current)
          positionTimerRef.current = setInterval(() => {
            if (audio && !audio.paused) setPosition(audio.currentTime)
          }, 50)
        })
        .catch(() => {
          setError('Could not play preview. Tap again to retry.')
        })
    }
  }

  const statusText = resolving
    ? 'Preparing preview…'
    : resolvedUrl
      ? 'Preview'
      : waveBars === null
        ? 'Loading…'
        : error || 'Preview unavailable'

  const confirmPick = () => {
    if (!selected || !resolvedUrl || resolving) return
    stopPreview()
    onSelect({
      id: `deezer-${selected.deezerId}`,
      deezerId: selected.deezerId,
      provider: 'deezer',
      providerTrackId: selected.deezerId,
      title: selected.title,
      artist: selected.artist || 'BTS',
      album: selected.album || '',
      artworkUrl: selected.imageUrl || '',
      cover: selected.imageUrl || '',
      duration: clipDuration || 30,
      previewUrl: resolvedUrl,
      canPlay: true,
      startAt: 0,
      endAt: Math.min(storyDuration || 15, clipDuration || 15),
    })
    onClose()
  }

  const tracks = useMemo(() => {
    const q = query.trim()
    const pool = allPreviewableSongs
    if (!q) return pool.slice(0, 80)
    return searchCatalogue(q).filter((s) => s.previewAvailable)
  }, [query])

  const positionPct = clipDuration > 0 ? Math.min(100, (position / clipDuration) * 100) : 0

  return (
    <Modal
      open={open}
      onClose={() => { stopPreview(); onClose() }}
      title="Choose Music"
      size="md"
      footer={
        <div className="music-picker__foot">
          {selected ? (
            <>
              {onSelect && (
                <Button variant="ghost" onClick={() => { stopPreview(); onSelect(null); onClose() }}>
                  Remove
                </Button>
              )}
              <Button
                variant="primary"
                onClick={confirmPick}
                disabled={!resolvedUrl || resolving}
              >
                {resolving ? 'Loading…' : resolvedUrl ? 'Add Music' : 'Unavailable'}
              </Button>
            </>
          ) : (
            <>
              {current && (
                <Button variant="ghost" onClick={onClose}>
                  Keep Current
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="song-picker">
        <label className="song-picker__search">
          <Icon name="search" size={16} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search BTS songs"
            autoFocus
          />
          {query && (
            <button
              type="button"
              className="song-picker__search-clear"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </label>

        {selected && (
          <div className="song-picker__preview">
            <div className="music-trim__preview">
              {selected.imageUrl ? (
                <img className="music-trim__art" src={selected.imageUrl} alt="" />
              ) : (
                <span className="music-trim__art music-trim__art--placeholder">
                  <Icon name="note" size={24} />
                </span>
              )}
              <div className="music-trim__info">
                <span className="music-trim__title">{selected.title}</span>
                <span className="music-trim__artist">{selected.artist || 'BTS'}</span>
                <span className="music-trim__meta">
                  <span className="music-trim__duration">{formatTime(clipDuration)}</span>
                  <span className="music-trim__duration">{statusText}</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              className="song-picker__change"
              onClick={() => { stopPreview(); setSelected(null); setResolvedUrl(null); setWaveBars(null); setError(null) }}
            >
              <Icon name="refresh" size={16} />
              <span>Change song</span>
            </button>

            <div className="music-trim__timeline">
              <div className="music-trim__track">
                {resolving ? (
                  <div className="song-picker__analysing">
                    <span className="song-picker__spinner" />
                    <span>Preparing preview...</span>
                  </div>
                ) : waveBars && waveBars.length > 0 ? (
                  <div className="music-trim__waveform">
                    {waveBars.map((h, i) => (
                      <span
                        key={i}
                        className="music-trim__wave-bar"
                        style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.5 }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="song-picker__analysing">
                    <span>{waveBars ? 'Preview unavailable' : 'Loading track…'}</span>
                  </div>
                )}
                {previewing && clipDuration > 0 && (
                  <div className="music-trim__position" style={{ left: `${positionPct}%` }} />
                )}
              </div>
              <div className="music-trim__labels">
                <span className="music-trim__time">{previewing ? formatTime(position) : '0:00'}</span>
                <span className="music-trim__clip-info">{statusText}</span>
                <span className="music-trim__time">{formatTime(clipDuration)}</span>
              </div>
            </div>

            {resolvedUrl && (
              <div className="music-trim__controls">
                <button
                  type="button"
                  className={cn('music-trim__preview-btn', previewing && 'music-trim__preview-btn--active')}
                  onClick={togglePreview}
                  aria-label={previewing ? 'Stop preview' : 'Preview song'}
                >
                  <Icon name={previewing ? 'mute' : 'volume'} size={18} />
                  <span>{previewing ? 'Stop' : 'Preview'}</span>
                </button>
                <span className="song-picker__preview-note">Starts at the beginning of the song clip</span>
              </div>
            )}

            {error && (
              <div className="music-picker__empty" style={{ color: 'var(--c-error)' }}>{error}</div>
            )}
          </div>
        )}

        <div className="song-picker__list">
          {tracks.length === 0 ? (
            <div className="music-picker__empty">No songs found.</div>
          ) : (
            tracks.map((s) => {
              const isCurrent = current?.deezerId === s.deezerId
              const isSelected = selected?.deezerId === s.deezerId
              return (
                <button
                  key={s.deezerId}
                  type="button"
                  className={cn('song-picker__row', isSelected && 'song-picker__row--on')}
                  onClick={() => selectTrack(s)}
                >
                  {s.imageUrl ? (
                    <img className="song-picker__art" src={s.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="song-picker__art song-picker__art--placeholder">
                      <Icon name="note" size={16} />
                    </span>
                  )}
                  <span className="song-picker__info">
                    <span className="song-picker__name">{s.title}</span>
                    <span className="song-picker__album">{s.album}</span>
                  </span>
                  {isCurrent && <span className="song-picker__current-tag">Attached</span>}
                  {isSelected && <Icon name="check" size={18} className="song-picker__check" />}
                </button>
              )
            })
          )}
        </div>

        <audio ref={audioRef} preload="none" onEnded={stopPreview} />
      </div>
    </Modal>
  )
}