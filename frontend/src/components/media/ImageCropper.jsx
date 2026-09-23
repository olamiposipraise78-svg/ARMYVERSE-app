import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../utils/helpers.js'
import {
  CROP_ASPECTS,
  MIN_ZOOM,
  MAX_ZOOM,
  aspectRatioValue,
  clamp,
  cropMetrics,
  cropToStyle,
  exportCrop,
  normalizeCrop,
} from '../../utils/cropMath.js'
import './cropper.css'

// WhatsApp-style crop/edit tool.
//
// - Works on IMAGES and VIDEOS and is non-destructive: the original file is
//   never modified. `onApply(crop)` returns a normalized crop object
//   ({aspect, zoom, x, y}) that MediaFrame reproduces on every surface.
// - Default zoom = CONTAIN (the whole media is visible, nothing hidden), so
//   the original framing is always recoverable by zooming out / resetting.
// - Pan, zoom slider, − / + buttons, mouse-wheel zoom (desktop) and
//   pinch-to-zoom (touch) are supported.
// - `variant="export"` (e.g. avatar pictures) additionally rasterizes the
//   selected region with `exportCrop` and calls `onConfirm(file, previewUrl)`.

export default function ImageCropper({
  open,
  src,
  isVideo = false,
  defaultAspect = '4:5',
  initialCrop = null,
  fileName = 'image',
  title = 'Adjust media',
  variant = 'meta',
  onApply,
  onConfirm,
  onCancel,
}) {
  const stageRef = useRef(null)
  const dragRef = useRef(null)
  const pointers = useRef(new Map())

  const [media, setMedia] = useState(null)
  const [aspect, setAspect] = useState(defaultAspect)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [stage, setStage] = useState({ w: 1, h: 1 })

  const naturalW = media?.w || 1
  const naturalH = media?.h || 1

  const loadMedia = useCallback(() => {
    setMedia(null)
    if (isVideo) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.muted = true
      v.playsInline = true
      v.src = src
      v.onloadedmetadata = () => {
        if (v.videoWidth > 0 && v.videoHeight > 0) setMedia({ el: v, w: v.videoWidth, h: v.videoHeight })
      }
      v.onerror = () => setMedia(null)
    } else {
      const img = new Image()
      img.onload = () => setMedia({ el: img, w: img.naturalWidth, h: img.naturalHeight })
      img.src = src
    }
  }, [src, isVideo])

  useEffect(() => {
    if (!open) return
    const ic = normalizeCrop(initialCrop)
    setAspect(ic?.aspect || defaultAspect)
    setZoom(ic?.zoom ?? 1)
    setPos({ x: ic?.x ?? 0, y: ic?.y ?? 0 })
    loadMedia()
  }, [open, initialCrop, defaultAspect, loadMedia])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel && onCancel()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onCancel])

  useLayoutEffect(() => {
    if (!open || !stageRef.current) return
    const el = stageRef.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width && rect.height) setStage({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const onWheel = (e) => {
      if (!media) return
      e.preventDefault()
      setZoom((prev) => clamp(prev * Math.exp(-e.deltaY * 0.002), MIN_ZOOM, MAX_ZOOM))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      ro.disconnect()
      el.removeEventListener('wheel', onWheel)
    }
  }, [open, aspect, media])

  const ratio = aspectRatioValue(aspect, naturalW / naturalH)
  const crop = { aspect, zoom, x: pos.x, y: pos.y }
  const m = cropMetrics(crop, naturalW, naturalH)
  const style = media ? cropToStyle(crop, naturalW, naturalH) : null

  const resetView = useCallback(() => {
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }, [])

  const pickAspect = (key) => {
    if (key === aspect) return
    setAspect(key)
    setZoom(1)
    setPos({ x: 0, y: 0 })
  }

  const setZoomAt = (z) => {
    setZoom(clamp(z, MIN_ZOOM, MAX_ZOOM))
  }

  const handlePointerDown = (e) => {
    e.preventDefault()
    const el = stageRef.current
    if (!el) return
    el.setPointerCapture && el.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        ox: pos.x,
        oy: pos.y,
      }
    } else if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()]
      dragRef.current = {
        pinch: true,
        startDist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        startZoom: zoom,
      }
    }
  }

  const handlePointerMove = (e) => {
    const pt = pointers.current.get(e.pointerId)
    if (!pt) return
    const d = dragRef.current
    if (!d) return
    const el = stageRef.current
    if (d.pinch && pointers.current.size >= 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const [p1, p2] = [...pointers.current.values()]
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      if (d.startDist > 0) {
        const z = clamp((d.startZoom * dist) / d.startDist, MIN_ZOOM, MAX_ZOOM)
        setZoom(z)
      }
      return
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const { w } = (el && el.getBoundingClientRect()) || { w: stage.w }
    const slackX = m.slackX > 0 ? m.slackX : 0
    const slackY = m.slackY > 0 ? m.slackY : 0
    const dxPct = ((e.clientX - d.startX) / w) * 100
    const dyPct = ((e.clientY - d.startY) / w) * 100
    const baseX = 50 - (m.wFrac * 50)
    const baseY = 50 - (m.hFrac * 50)
    const leftPct = clamp(baseX + d.ox * slackX * 100 + dxPct, baseX - slackX * 100, baseX + slackX * 100)
    const topPct = clamp(baseY + d.oy * slackY * 100 + dyPct, baseY - slackY * 100, baseY + slackY * 100)
    const nx = slackX > 0 ? (leftPct - baseX) / (slackX * 100) : 0
    const ny = slackY > 0 ? (topPct - baseY) / (slackY * 100) : 0
    setPos({ x: clamp(nx, -1, 1), y: clamp(ny, -1, 1) })
  }

  const handlePointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    const el = stageRef.current
    el && el.releasePointerCapture && el.releasePointerCapture(e.pointerId)
    if (pointers.current.size < 2) dragRef.current = null
  }

  const handleConfirm = () => {
    if (!media) return
    const result = {
      aspect,
      zoom: Math.round(zoom * 100) / 100,
      x: Math.round(pos.x * 10000) / 10000,
      y: Math.round(pos.y * 10000) / 10000,
    }
    if (variant === 'export') {
      exportCrop(result, media.el, { fileName, max: 512 }).then((out) => {
        if (out && onConfirm) onConfirm(out.file, out.previewUrl)
      })
    } else if (onApply) {
      onApply(result)
    }
  }

  if (!open) return null

  const mediaEl =
    media && isVideo ? (
      <video
        className="crop-stage__media"
        src={src}
        muted
        loop
        autoPlay
        playsInline
        style={style}
      />
    ) : media ? (
      <img
        className="crop-stage__media"
        src={src}
        alt="Crop preview"
        draggable={false}
        style={style}
      />
    ) : null

  return (
    <div className="crop-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="crop-panel" onClick={(e) => e.stopPropagation()}>
        <div className="crop-head">
          <h3 className="crop-head__title">{title}</h3>
          <button className="crop-head__close" onClick={onCancel} aria-label="Cancel crop">
            ×
          </button>
        </div>

        <div className="crop-stage-wrap">
          <div
            className="crop-stage"
            ref={stageRef}
            style={{ aspectRatio: `${ratio} / 1` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {mediaEl ? (
              mediaEl
            ) : (
              <span className="crop-stage__loading">Loading…</span>
            )}
          </div>
        </div>

        <div className="crop-controls">
          <div className="crop-controls__row">
            <div className="crop-aspects" role="group" aria-label="Aspect ratio">
              {CROP_ASPECTS.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={cn('crop-chip', aspect === a.key && 'crop-chip--on')}
                  onClick={() => pickAspect(a.key)}
                  aria-pressed={aspect === a.key}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          <div className="crop-controls__row crop-zoom">
            <button
              type="button"
              className="crop-icon-btn"
              onClick={() => setZoomAt(zoom - 0.25)}
              aria-label="Zoom out"
            >
              −
            </button>
            <input
              type="range"
              className="crop-zoom__slider"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoomAt(Number(e.target.value))}
              aria-label="Zoom"
            />
            <button
              type="button"
              className="crop-icon-btn"
              onClick={() => setZoomAt(zoom + 0.25)}
              aria-label="Zoom in"
            >
              +
            </button>
            <button type="button" className="crop-icon-btn" onClick={resetView} aria-label="Reset position">
              ⟳
            </button>
          </div>

          <div className="crop-actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary btn--sm" onClick={handleConfirm}>
              {variant === 'export' ? 'Save photo' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}