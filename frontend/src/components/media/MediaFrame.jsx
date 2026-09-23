import { useEffect, useState } from 'react'
import { cn } from '../../utils/helpers.js'
import { aspectRatioValue, cropToStyle } from '../../utils/cropMath.js'
import './mediaframe.css'

// Renders a media element inside an aspect box using a stored, non-destructive
// crop ({aspect, zoom, x, y}). Used by the crop editor preview AND every
// published surface (feed, stories, reels) so the result always matches.
//
// When no crop is given, this component returns null — callers fall back to
// their existing media markup for legacy items.
export default function MediaFrame({
  src,
  crop,
  kind = 'image',
  alt = '',
  poster,
  loading = 'lazy',
  onError,
  frameClass,
  className,
  frameStyle,
  videoRef,
  videoProps,
}) {
  const [dims, setDims] = useState(null)

  useEffect(() => {
    setDims(null)
  }, [src, kind])

  if (!src || !crop) return null

  const isVideo = kind === 'video'
  const A = aspectRatioValue(crop.aspect ?? 'original', dims ? dims.w / dims.h : 1)
  const mediaStyle = dims ? cropToStyle(crop, dims.w, dims.h) : { opacity: 0 }

  return (
    <div
      className={cn('media-frame', frameClass)}
      style={{ aspectRatio: A, ...frameStyle }}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster || ''}
          className={cn('media-frame__media', className)}
          style={mediaStyle}
          preload="metadata"
          muted={false}
          playsInline
          onLoadedMetadata={(e) => {
            const { videoWidth: w, videoHeight: h } = e.currentTarget
            if (w > 0 && h > 0) setDims({ w, h })
          }}
          {...videoProps}
        />
      ) : (
        <img
          src={src}
          alt={alt || ''}
          className={cn('media-frame__media', className)}
          style={mediaStyle}
          draggable={false}
          loading={loading}
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget
            if (w > 0 && h > 0) setDims({ w, h })
          }}
          onError={onError}
        />
      )}
    </div>
  )
}