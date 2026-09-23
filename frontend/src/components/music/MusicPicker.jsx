import { useEffect, useRef, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import './music.css'

const TRIM_WINDOW = 15
const ALLOWED_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac']
const MAX_AUDIO_SIZE = 10 * 1024 * 1024

function formatTime(sec) {
  if (!sec || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function MusicPicker({ open, onClose, onSelect, onRemove, current }) {
  const [file, setFile] = useState(null)
  const [objectUrl, setObjectUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [startAt, setStartAt] = useState(0)
  const [previewing, setPreviewing] = useState(false)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState(null)
  const audioRef = useRef(null)
  const positionTimerRef = useRef(null)
  const previewTimerRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setObjectUrl(null)
    setDuration(0)
    setStartAt(0)
    setPreviewing(false)
    setPosition(0)
    setError(null)
  }, [open])

  useEffect(() => {
    return () => {
      stopPreview()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const stopPreview = () => {
    setPreviewing(false)
    setPosition(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.removeAttribute('src')
    }
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current)
      previewTimerRef.current = null
    }
    if (positionTimerRef.current) {
      clearInterval(positionTimerRef.current)
      positionTimerRef.current = null
    }
  }

  const handleFile = (f) => {
    if (!f) return
    if (!ALLOWED_AUDIO.includes(f.type)) {
      setError('Unsupported format. Use MP3, M4A, OGG, WAV, or AAC.')
      return
    }
    if (f.size > MAX_AUDIO_SIZE) {
      setError(`File is too large (${formatFileSize(f.size)}). Max 10MB.`)
      return
    }
    setError(null)
    stopPreview()
    if (objectUrl) URL.revokeObjectURL(objectUrl)

    const url = URL.createObjectURL(f)
    setObjectUrl(url)
    setFile(f)
    setStartAt(0)

    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = url
    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 0)
    }
  }

  const handleStartChange = (val) => {
    const v = Number(val)
    setStartAt(Math.min(v, Math.max(0, duration - 1)))
  }

  const togglePreview = () => {
    const audio = audioRef.current
    if (!audio || !objectUrl) return

    if (previewing) {
      stopPreview()
      return
    }

    audio.src = objectUrl
    audio.currentTime = startAt
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

  const confirmPick = () => {
    stopPreview()
    onSelect({
      id: `device-${Date.now()}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: 'My Device',
      album: '',
      artworkUrl: '',
      cover: '',
      duration,
      audioUrl: objectUrl,
      audio: objectUrl,
      previewUrl: objectUrl,
      canPlay: true,
      provider: 'device',
      startAt,
      endAt: duration,
      _file: file,
    })
    onClose()
  }

  const endPct = duration > 0 ? (startAt / duration) * 100 : 0
  const positionPct = duration > 0 ? ((position - startAt) / (duration - startAt || 1)) * 100 : 0

  return (
    <Modal
      open={open}
      onClose={() => { stopPreview(); onClose() }}
      title={file ? file.name.replace(/\.[^.]+$/, '') : 'Add Music'}
      size="md"
      footer={
        <div className="music-picker__foot">
          {file ? (
            <>
              <Button variant="ghost" onClick={() => { stopPreview(); setFile(null); setObjectUrl(null); setError(null) }}>
                Change File
              </Button>
              {onRemove && (
                <Button variant="ghost" onClick={() => { stopPreview(); onRemove(); onClose() }}>
                  Remove
                </Button>
              )}
              <Button variant="primary" onClick={confirmPick}>
                Add Music
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
        </div>
      }
    >
      {file ? (
        <div className="music-trim">
          <audio ref={audioRef} preload="none" onEnded={() => { setPreviewing(false); setPosition(0) }} />

          <div className="music-trim__preview">
            <div className="music-trim__art music-trim__art--placeholder">
              <Icon name="note" size={24} />
            </div>
            <div className="music-trim__info">
              <span className="music-trim__title">{file.name}</span>
              <span className="music-trim__artist">My Device</span>
              <div className="music-trim__meta">
                <span className="music-trim__duration">{formatTime(duration)}</span>
                <span className="music-trim__duration">{formatFileSize(file.size)}</span>
              </div>
            </div>
          </div>

          <div className="music-trim__timeline">
            <div className="music-trim__track">
              <div className="music-trim__waveform">
                {Array.from({ length: 40 }, (_, i) => (
                  <span
                    key={i}
                    className="music-trim__wave-bar"
                    style={{ height: `${20 + Math.sin(i * 0.7) * 15 + Math.cos(i * 1.3) * 10}%` }}
                  />
                ))}
              </div>
              <div
                className="music-trim__selection"
                style={{ left: 0, width: `${endPct}%` }}
              />
              {previewing && (
                <div
                  className="music-trim__position"
                  style={{ left: `${endPct + (positionPct / 100) * (100 - endPct)}%` }}
                />
              )}
              <input
                type="range"
                className="music-trim__range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={startAt}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div className="music-trim__labels">
              <span className="music-trim__time">{formatTime(startAt)}</span>
              <span className="music-trim__clip-info">Start position</span>
              <span className="music-trim__time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="music-trim__controls">
            <button
              className={`music-trim__preview-btn ${previewing ? 'music-trim__preview-btn--active' : ''}`}
              onClick={togglePreview}
              aria-label={previewing ? 'Stop preview' : 'Preview from start position'}
            >
              <Icon name={previewing ? 'mute' : 'volume'} size={18} />
              <span>{previewing ? 'Stop' : 'Preview'}</span>
            </button>
          </div>

          {error && <div className="music-picker__empty" style={{ color: 'var(--c-error)' }}>{error}</div>}
        </div>
      ) : (
        <div className="music-picker">
          <div
            className="music-picker__dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('music-picker__dropzone--over') }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('music-picker__dropzone--over') }}
            onDrop={(e) => {
              e.preventDefault()
              e.currentTarget.classList.remove('music-picker__dropzone--over')
              handleFile(e.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <span className="music-picker__dropzone-icon">
              <Icon name="note" size={36} />
            </span>
            <p className="music-picker__dropzone-title">Choose Audio File</p>
            <p className="music-picker__dropzone-hint">
              MP3, M4A, OGG, WAV, AAC · Max 10MB
            </p>
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
              Browse files
            </Button>
          </div>

          {current && (
            <div className="music-picker__current">
              <span className="music-picker__section-title">Currently attached</span>
              <div className="music-picker__current-info">
                <Icon name="note" size={16} />
                <span>{current.title}</span>
                {onRemove && (
                  <button className="music-picker__current-remove" onClick={onRemove} aria-label="Remove music">
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {error && <div className="music-picker__empty" style={{ color: 'var(--c-error)' }}>{error}</div>}
        </div>
      )}
    </Modal>
  )
}
