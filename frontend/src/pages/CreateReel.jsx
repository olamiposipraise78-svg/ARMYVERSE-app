import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadReelMedia, createReel } from '../utils/api.js'
import { useApp } from '../context/AppContext.jsx'
import Icon from '../components/ui/Icon.jsx'
import ImageCropper from '../components/media/ImageCropper.jsx'
import MediaFrame from '../components/media/MediaFrame.jsx'
import './reels.css'
import './reelupload.css'

const MAX_VIDEO_SIZE = 50 * 1024 * 1024
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export default function CreateReel({ onClose, onSuccess, embedded = false }) {
  const { currentUser: user } = useApp()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [mediaType, setMediaType] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [audioName, setAudioName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [showCrop, setShowCrop] = useState(false)
  const [crop, setCrop] = useState(null)

  if (!user) {
    return (
      <div className="reel-create-overlay" onClick={onClose}>
        <div className="reel-create-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Create Reel">
          <div className="reel-upload__auth-required">
            <Icon name="lock" size={40} />
            <p>Please log in to create a Reel.</p>
            <button className="btn btn--primary" onClick={() => navigate('/auth/login')}>
              Log In
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setError('')
    const isImage = IMAGE_TYPES.includes(selected.type)
    const isVideo = VIDEO_TYPES.includes(selected.type)
    if (!isImage && !isVideo) {
      setError('Unsupported file type. Please use MP4, WebM, MOV, JPG, PNG, or WEBP.')
      return
    }
    const limit = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (selected.size > limit) {
      setError(`File too large (${(selected.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${isVideo ? 50 : 10}MB.`)
      return
    }

    setFile(selected)
    setMediaType(isVideo ? 'video' : 'image')
    setCrop(null)
    const url = URL.createObjectURL(selected)
    setPreview(url)
    setShowCrop(true)
  }

  const handleCropApply = (c) => {
    setShowCrop(false)
    setCrop(c)
    setError('')
  }

  const handleCropCancel = () => {
    setShowCrop(false)
    setError('')
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      const syntheticEvent = { target: { files: [dropped] } }
      handleFileSelect(syntheticEvent)
    }
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    setProgress(10)
    setError('')

    try {
      setProgress(20)
      const media = await uploadReelMedia(file)
      setProgress(70)

      const tags = hashtags
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean)

      const reel = await createReel(media.url, {
        caption: caption.trim(),
        hashtags: tags,
        audio_name: audioName.trim(),
        duration: 0,
        crop,
      })
      setProgress(100)
      if (onSuccess) onSuccess(reel)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
    setCrop(null)
    setCaption('')
    setHashtags('')
    setAudioName('')
    setError('')
    setProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const authBlock = (
    <div className="reel-upload__auth-required">
      <Icon name="lock" size={40} />
      <p>Please log in to create a Reel.</p>
      <button className="btn btn--primary" onClick={() => navigate('/auth/login')}>
        Log In
      </button>
    </div>
  )

  const uploadEditor = (
    <div className="reel-upload">
      {!file ? (
        <div
          className="reel-upload__dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <Icon name="video" size={48} className="reel-upload__dropzone-icon" />
          <p className="reel-upload__dropzone-text">Drag &amp; drop a photo or video here</p>
          <p className="reel-upload__dropzone-sub">or click to browse</p>
          <p className="reel-upload__dropzone-hint">
            MP4, WebM, MOV (up to 50MB) · JPG, PNG, WEBP (up to 10MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="reel-upload__file-input"
          />
        </div>
      ) : (
        <div className="reel-upload__editor">
          <div className="reel-upload__preview">
            {crop ? (
              <MediaFrame
                src={preview}
                crop={crop}
                kind={mediaType}
                alt="Reel preview"
                className="reel-upload__preview-img"
                frameClass="media-frame--preview"
                frameStyle={{ maxHeight: 480 }}
              />
            ) : mediaType === 'image' ? (
              <img src={preview} alt="Reel preview" className="reel-upload__preview-img" />
            ) : (
              <video
                src={preview}
                controls
                muted
                playsInline
                className="reel-upload__preview-video"
              />
            )}
            <button
              className="reel-upload__remove-btn"
              onClick={handleRemove}
              aria-label="Remove media"
              disabled={uploading}
            >
              <Icon name="close" size={18} />
            </button>
            <button
              className="reel-upload__crop-btn"
              onClick={() => setShowCrop(true)}
              aria-label="Adjust crop"
              disabled={uploading}
            >
              <Icon name="image" size={15} />
              <span>Adjust</span>
            </button>
          </div>

          <div className="reel-upload__form">
            <div className="reel-upload__field">
              <label className="reel-upload__label">Caption</label>
              <textarea
                className="reel-upload__textarea"
                placeholder="Write a caption…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={1000}
                rows={3}
              />
            </div>

            <div className="reel-upload__field">
              <label className="reel-upload__label">Hashtags</label>
              <input
                className="reel-upload__input"
                placeholder="#BTS #ARMY (space or comma separated)"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
            </div>

            <div className="reel-upload__field">
              <label className="reel-upload__label">Audio name (optional)</label>
              <input
                className="reel-upload__input"
                placeholder="e.g. Dynamite — BTS"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                maxLength={200}
              />
            </div>

            {error && <p className="reel-upload__error">{error}</p>}

            {uploading && (
              <div className="reel-upload__progress">
                <div className="reel-upload__progress-bar" style={{ width: `${progress}%` }} />
                <span className="reel-upload__progress-text">{progress}%</span>
              </div>
            )}

            <div className="reel-upload__actions">
              <button
                className="btn btn--secondary"
                onClick={onClose}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSubmit}
                disabled={uploading || !file}
              >
                {uploading ? 'Posting…' : 'Post Reel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const header = (
    <>
      <h2 className="reel-create-title">Create Reel</h2>
      <button
        className="reel-create-close"
        onClick={onClose}
        disabled={uploading}
        aria-label="Close"
      >
        <Icon name="close" size={20} />
      </button>
    </>
  )

  if (embedded) {
    return (
      <section className="create-reel" role="region" aria-label="Create a Reel">
        <div className="reel-create-head create-reel__head">{header}</div>
        {!user ? authBlock : uploadEditor}
        <ImageCropper
          open={showCrop}
          src={preview}
          isVideo={mediaType === 'video'}
          fileName={file?.name}
          defaultAspect="9:16"
          initialCrop={crop}
          title="Adjust Reel media"
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      </section>
    )
  }

  return (
    <div
      className="reel-create-overlay"
      onClick={() => !uploading && onClose && onClose()}
    >
      <div
        className="reel-create-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create Reel"
      >
        <div className="reel-create-head">{header}</div>
        <ImageCropper
          open={showCrop}
          src={preview}
          isVideo={mediaType === 'video'}
          fileName={file?.name}
          defaultAspect="9:16"
          initialCrop={crop}
          title="Adjust Reel media"
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
        {!user ? authBlock : uploadEditor}
      </div>
    </div>
  )
}