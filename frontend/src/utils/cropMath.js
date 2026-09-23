// Shared, non-destructive crop math for ARMYVERSE media.
//
// A crop is stored as a tiny normalized object:
//   crop = { aspect: "original"|"1:1"|"4:5"|"9:16"|"16:9", zoom: 1..10, x: -1..1, y: -1..1 }
//
// Interpretation:
//   - `zoom` is relative to CONTAIN (1 = the whole media is visible, nothing
//     hidden, like the "zoom fully out" state). Zooming in moves to cover.
//   - `x`/`y` pan the visible center from the centered contain position.
//   - The same `cropToStyle`/`visibleRegion` helpers are used by the crop
//     editor AND every published surface, so the preview always equals the
//     final result. The original file is never modified.

export const CROP_ASPECTS = [
  { key: 'original', label: 'Original' },
  { key: '1:1', label: '1:1' },
  { key: '4:5', label: '4:5' },
  { key: '9:16', label: '9:16' },
  { key: '16:9', label: '16:9' },
]

export const MIN_ZOOM = 1
export const MAX_ZOOM = 10

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

export function aspectRatioValue(aspectKey, mediaAspect = 1) {
  switch (aspectKey) {
    case '1:1':
      return 1
    case '4:5':
      return 4 / 5
    case '9:16':
      return 9 / 16
    case '16:9':
      return 16 / 9
    default:
      return Number.isFinite(mediaAspect) && mediaAspect > 0 ? mediaAspect : 1
  }
}

export function normalizeCrop(crop) {
  if (!crop) return null
  const aspect = CROP_ASPECTS.some((a) => a.key === crop.aspect) ? crop.aspect : 'original'
  return {
    aspect,
    zoom: clamp(Number.isFinite(crop.zoom) ? crop.zoom : 1, MIN_ZOOM, MAX_ZOOM),
    x: clamp(Number.isFinite(crop.x) ? crop.x : 0, -1, 1),
    y: clamp(Number.isFinite(crop.y) ? crop.y : 0, -1, 1),
  }
}

// Returns normalized geometry of the crop given intrinsic media dimensions.
// Box = the output box (frame) with aspect `A`. wFrac/hFrac are the fraction
// of the box covered by the (zoomed) media element; slack[i] is the max pan on
// that axis; left/top are the element's offset inside the box (0..1 each).
export function cropMetrics(crop, mediaW, mediaH) {
  const c = normalizeCrop(crop)
  const mw = Number(mediaW) || 1
  const mh = Number(mediaH) || 1
  const mediaAspect = mw / mh
  const A = aspectRatioValue(c.aspect, mediaAspect)
  const F = Math.min(1 / mediaAspect, 1 / A)
  const wFrac = mediaAspect * F * c.zoom
  const hFrac = F * c.zoom * A
  const slackX = Math.max(0, (wFrac - 1) / 2)
  const slackY = Math.max(0, (hFrac - 1) / 2)
  const left = (1 - wFrac) / 2 + c.x * slackX
  const top = (1 - hFrac) / 2 + c.y * slackY
  return { A, wFrac, hFrac, slackX, slackY, left, top }
}

// CSS for the media element, in % of the frame box. Used by the editor stage
// AND the published MediaFrame — guaranteeing preview == published result.
export function cropToStyle(crop, mediaW, mediaH) {
  const { wFrac, hFrac, left, top } = cropMetrics(crop, mediaW, mediaH)
  return {
    width: `${wFrac * 100}%`,
    height: `${hFrac * 100}%`,
    left: `${left * 100}%`,
    top: `${top * 100}%`,
  }
}

// The region of the ORIGINAL media that is visible, in pixels. Used for the
// optional canvas export variant (e.g. avatar pictures).
export function visibleRegion(crop, mediaW, mediaH) {
  const { wFrac, hFrac, left, top } = cropMetrics(crop, mediaW, mediaH)
  const mw = Number(mediaW) || 1
  const mh = Number(mediaH) || 1
  // When the media does not fill the box on an axis (contain), the whole
  // media is visible there — never more than 100%.
  const vw = Math.min(1, 1 / wFrac)
  const vh = Math.min(1, 1 / hFrac)
  const boxCx = (0.5 - left) / wFrac
  const boxCy = (0.5 - top) / hFrac
  let sx = (boxCx - vw / 2) * mw
  let sy = (boxCy - vh / 2) * mh
  let sw = vw * mw
  let sh = vh * mh
  sx = clamp(sx, 0, Math.max(0, mw - sw))
  sy = clamp(sy, 0, Math.max(0, mh - sh))
  return { sx, sy, sw, sh }
}

// Render the visible region to a canvas and return the resulting file +
// preview data URL. Non-destructive: the source media element is not changed.
export function exportCrop(crop, mediaEl, options = {}) {
  const {
    max = 1280,
    mime = 'image/jpeg',
    quality = 0.92,
    fileName = 'image',
  } = options
  const mw = mediaEl?.videoWidth || mediaEl?.naturalWidth || 0
  const mh = mediaEl?.videoHeight || mediaEl?.naturalHeight || 0
  if (!mw || !mh) return Promise.resolve(null)
  const { sx, sy, sw, sh } = visibleRegion(crop, mw, mh)
  const k = Math.min(1, max / Math.max(sw, sh))
  const outW = Math.max(1, Math.round(sw * k))
  const outH = Math.max(1, Math.round(sh * k))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(mediaEl, sx, sy, sw, sh, 0, 0, outW, outH)

  const previewUrl = canvas.toDataURL(mime, quality)
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null)
        const base = String(fileName || 'image').replace(/\.[^.]+$/, '')
        const ext = mime === 'image/png' ? 'png' : 'jpg'
        const file = new File([blob], `${base}-cropped.${ext}`, { type: mime })
        resolve({ file, previewUrl })
      },
      mime,
      quality
    )
  })
}