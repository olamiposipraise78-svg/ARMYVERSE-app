import { useEffect, useRef, useState } from 'react'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import Avatar from '../ui/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { cn } from '../../utils/helpers.js'
import { createStory, uploadStoryMedia } from '../../utils/api.js'
import DeezerSongPicker from '../music/DeezerSongPicker.jsx'
import MusicSticker from '../music/MusicSticker.jsx'
import ImageCropper from '../media/ImageCropper.jsx'
import MediaFrame from '../media/MediaFrame.jsx'
import './story.css'

const COLORS = ['#2b1a4a', '#3a1d55', '#4a1838', '#24365e', '#3d2a50', '#123a4a']

const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const MAX_VIDEO_SIZE = 50 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function StoryCreator({ onClose, onCreated }) {
  const { currentUser, isAuthenticated } = useApp()
  const { show } = useToast()

  const fileInput = useRef(null)
  const [mediaType, setMediaType] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploadedMedia, setUploadedMedia] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [caption, setCaption] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [music, setMusic] = useState(null)
  const [showMusicPicker, setShowMusicPicker] = useState(false)
  const [error, setError] = useState(null)
  const [videoDuration, setVideoDuration] = useState(null)
  const [file, setFile] = useState(null)
  const [showCrop, setShowCrop] = useState(false)
  const [crop, setCrop] = useState(null)

  const storyDuration =
    mediaType === 'video'
      ? Math.min(30, videoDuration || 15)
      : 15

  useEffect(() => {
    if (!isAuthenticated) {
      show('Please sign in to share a story.', 'error')
      onClose()
    }
  }, [isAuthenticated, onClose, show])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showMusicPicker) {
          setShowMusicPicker(false)
        } else if (!showCrop) {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose, showMusicPicker, showCrop])

  if (!isAuthenticated) return null

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      show('This file type isn\'t supported. Use JPG, PNG, WEBP, MP4, or WEBM.', 'error')
      return false
    }
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
    const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > limit) {
      show(`File is too large (${formatFileSize(file.size)}). Maximum is ${isVideo ? '50MB' : '10MB'}.`, 'error')
      return false
    }
    return true
  }

  const doUpload = async (fileToUpload) => {
    setError(null)
    setUploading(true)
    setUploadProgress('Uploading...')
    try {
      const media = await uploadStoryMedia(fileToUpload)
      setUploadedMedia(media)
      setUploadProgress('')
      return true
    } catch (err) {
      const msg = err.message || 'Upload failed. Please try again.'
      setError(msg)
      show(msg, 'error')
      setPreview(null)
      setMediaType(null)
      setFile(null)
      setUploadedMedia(null)
      return false
    } finally {
      setUploading(false)
    }
  }

  const handleFile = async (file) => {
    if (!file || !validateFile(file)) return

    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
    setFile(file)
    setCrop(null)

    // Show local preview immediately, then open the crop/edit tool for
    // images AND videos. The original file is uploaded untouched after the
    // edit; the chosen framing rides along as a `crop` meta object.
    const reader = new FileReader()
    reader.onload = () => {
      setMediaType(isVideo ? 'video' : 'image')
      setPreview(reader.result)
      setShowCrop(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropApply = async (c) => {
    setShowCrop(false)
    setCrop(c)
    if (file && !uploadedMedia) await doUpload(file)
  }

  const handleCropCancel = () => {
    setShowCrop(false)
    setCrop(null)
    // Keep the original selection (full framing) when the user cancels.
    if (!uploadedMedia && file) {
      doUpload(file)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const removeMedia = () => {
    setPreview(null)
    setMediaType(null)
    setUploadedMedia(null)
    setUploadProgress('')
    setError(null)
    setVideoDuration(null)
    setFile(null)
    setCrop(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const handleShare = async () => {
    if (!preview && !caption.trim()) {
      show('Add a photo, video, or caption to share.', 'error')
      return
    }
    if (preview && !uploadedMedia && !error) {
      show('Please wait for the upload to finish.', 'error')
      return
    }
    if (error) {
      show('Please remove the failed upload and try again.', 'error')
      return
    }

    const payload = {
      caption: caption.trim(),
    }
    if (uploadedMedia) {
      payload.media = uploadedMedia
      if (crop) payload.media.crop = crop
    } else if (preview) {
      // Fallback for base64 (text-only stories with color)
      payload.media = { type: mediaType, src: preview }
    }
    if (color) payload.color = color
    if (music) payload.music = music

    setSubmitting(true)
    try {
      const story = await createStory(payload)
      onCreated(story)
      show('Your story is live!', 'success')
    } catch (err) {
      const msg =
        err.code === 'NETWORK'
          ? 'Could not reach the server. Is the backend running?'
          : err.code === 'UNAUTHORIZED'
          ? 'Please sign in to share a story.'
          : err.message || 'Something went wrong sharing your story.'
      show(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = (preview && uploadedMedia && !uploading && !error) || (!preview && caption.trim())
  const isUploading = uploading

  return (
    <div className="story-creator" role="dialog" aria-modal="true" aria-label="Create a story">
      <div className="story-creator__card">
        <div
          className="story-creator__background"
          style={{ background: color || 'var(--c-surface-2)' }}
        >
          <div className="story-creator__head">
            <Avatar
              src={currentUser.avatarArt || currentUser.avatar}
              alt={currentUser.displayName}
              size={34}
            />
            <span className="story-creator__user">@{currentUser.username}</span>
            <button className="story-viewer__close" onClick={onClose} aria-label="Close">
              <Icon name="close" size={24} />
            </button>
          </div>

          <div
            className={cn(
              'story-creator__upload',
              dragOver && 'story-creator__upload--over',
              !preview && 'story-creator__upload--empty'
            )}
            onClick={() => !preview && fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {!preview && (
              <div className="story-creator__prompt">
                <span className="story-creator__prompt-icon">
                  <Icon name="image" size={34} />
                </span>
                <p className="story-creator__prompt-title">Add a photo or video</p>
                <p className="story-creator__prompt-hint">
                  JPG, PNG, WEBP, MP4, WEBM
                  <br />
                  Max 10MB (images) / 50MB (videos)
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInput.current?.click()
                  }}
                >
                  Choose file
                </Button>
              </div>
            )}
            {preview && (
              <div className="story-creator__preview">
                {crop ? (
                  <MediaFrame
                    src={preview}
                    crop={crop}
                    kind={mediaType}
                    alt="Story preview"
                    className="story-creator__preview-media"
                    frameClass="media-frame--preview"
                    frameStyle={{ maxHeight: 380 }}
                  />
                ) : mediaType === 'video' ? (
                  <video
                    src={preview}
                    className="story-creator__preview-media"
                    muted
                    playsInline
                    onLoadedMetadata={(e) => setVideoDuration(e.target.duration || null)}
                  />
                ) : (
                  <img src={preview} alt="Story preview" className="story-creator__preview-media" />
                )}
                {isUploading && (
                  <div className="story-creator__upload-overlay">
                    <div className="story-creator__spinner" />
                    <span>{uploadProgress}</span>
                  </div>
                )}
                {error && (
                  <div className="story-creator__upload-overlay story-creator__upload-overlay--error">
                    <Icon name="ban" size={24} />
                    <span>{error}</span>
                  </div>
                )}
                <button
                  className="story-creator__preview-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeMedia()
                  }}
                  aria-label="Remove media"
                >
                  <Icon name="close" size={18} />
                </button>
                {!isUploading && !error && (
                  <button
                    className="story-creator__preview-crop"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowCrop(true)
                    }}
                    aria-label="Adjust crop"
                  >
                    <Icon name="image" size={14} />
                    <span>Adjust</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="story-creator__body">
            <textarea
              className="story-creator__caption"
              placeholder="Write something..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={300}
            />

            <div className="story-creator__colors" role="radiogroup" aria-label="Background color">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn('story-creator__color', color === c && 'story-creator__color--on')}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Choose color ${c}`}
                  aria-checked={color === c}
                  role="radio"
                />
              ))}
            </div>

            {music ? (
              <div className="story-creator__music">
                <MusicSticker song={music} />
                {music.era && <span className="story-creator__music-era">{music.era}</span>}
                <button
                  className="story-creator__music-remove"
                  onClick={() => setMusic(null)}
                  aria-label="Remove music"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
            ) : (
              <button
                className="story-creator__music-add"
                onClick={() => setShowMusicPicker(true)}
              >
                <Icon name="note" size={18} />
                <span>Add Music</span>
              </button>
            )}
          </div>

          <div className="story-creator__foot">
            <span className="story-creator__count">
              {preview ? (mediaType === 'video' ? 'Video' : 'Photo') : 'Text only'} ·{' '}
              {caption.length}/300
            </span>
            <Button
              variant="primary"
              onClick={handleShare}
              loading={submitting || isUploading}
              disabled={!canSubmit && !submitting}
            >
              {submitting ? 'Sharing...' : isUploading ? 'Uploading...' : 'Share'}
            </Button>
          </div>
        </div>
      </div>

      <DeezerSongPicker
        open={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={setMusic}
        onRemove={() => setMusic(null)}
        current={music}
        storyDuration={storyDuration}
      />

      <ImageCropper
        open={showCrop}
        src={preview}
        isVideo={mediaType === 'video'}
        fileName={file?.name}
        defaultAspect="9:16"
        initialCrop={crop}
        title="Adjust story media"
        onApply={handleCropApply}
        onCancel={handleCropCancel}
      />
    </div>
  )
}
