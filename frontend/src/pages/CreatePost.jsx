import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { cn } from '../utils/helpers.js'
import { createPost, uploadPostMedia, uploadStoryMedia } from '../utils/api.js'
import MusicPicker from '../components/music/MusicPicker.jsx'
import MusicSticker from '../components/music/MusicSticker.jsx'
import ImageCropper from '../components/media/ImageCropper.jsx'
import MediaFrame from '../components/media/MediaFrame.jsx'
import CreateReel from './CreateReel.jsx'
import './create.css'

const MAX_IMAGES = 10

export default function CreatePost() {
  const { currentUser } = useApp()
  const { show } = useToast()
  const navigate = useNavigate()

  const fileInput = useRef(null)
  const idCounter = useRef(0)
  const [assets, setAssets] = useState([]) // [{ id, file, type, preview, crop }]
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [publishing, setPublishing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [music, setMusic] = useState(null)
  const [showMusicPicker, setShowMusicPicker] = useState(false)
  const [cropTargetId, setCropTargetId] = useState(null)
  const [mode, setMode] = useState('post')

  const nextId = () => (idCounter.current += 1)

  const updateAsset = (id, patch) =>
    setAssets((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  const removeAsset = (id) => {
    setAssets((list) => list.filter((a) => a.id !== id))
    setCropTargetId((target) => (target === id ? null : target))
  }

  const handleFiles = (fileList) => {
    const incoming = Array.from(fileList || [])
    if (incoming.length === 0) return

    const bad = incoming.filter((f) => !f.type.startsWith('image/') && !f.type.startsWith('video/'))
    if (bad.length > 0) {
      show('Please choose image or video files.', 'error')
      return
    }

    const videos = incoming.filter((f) => f.type.startsWith('video/'))
    const images = incoming.filter((f) => f.type.startsWith('image/'))
    const hasVideoAsset = assets.some((a) => a.type === 'video')

    if ((hasVideoAsset && incoming.length > 0) || (videos.length > 0 && images.length > 0) || videos.length > 1) {
      show("Videos can't be combined with photos — post one video per post.", 'error')
      return
    }

    const imageCount = assets.filter((a) => a.type === 'image').length + images.length
    if (images.length > 0 && imageCount > MAX_IMAGES) {
      show(`You can add up to ${MAX_IMAGES} photos per post.`, 'error')
      return
    }

    const all = [...images, ...videos]
    const loaded = []
    let done = 0
    const commit = () => {
      if (done !== all.length) return
      const existing = assets
      const next = [...existing, ...loaded]
      setAssets(next)
      // Preserve the existing single-file behaviour: auto-open the crop editor
      // only when the very first file added is alone.
      if (existing.length === 0 && next.length === 1) setCropTargetId(next[0].id)
    }
    for (const file of all) {
      const reader = new FileReader()
      reader.onload = () => {
        loaded.push({
          id: nextId(),
          file,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          preview: reader.result,
          crop: null,
        })
        done += 1
        commit()
      }
      reader.readAsDataURL(file)
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleCropApply = (c) => {
    if (cropTargetId != null) updateAsset(cropTargetId, { crop: c })
    setCropTargetId(null)
  }

  const cropTarget = assets.find((a) => a.id === cropTargetId) || null

  const handlePublish = async () => {
    if (assets.length === 0 && !caption.trim()) {
      show('Add a photo, video, or caption to publish.', 'error')
      return
    }
    const tags = hashtags
      .split(/\s+/)
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`))

    const payload = {
      caption: caption.trim() || ' ',
      hashtags: tags,
    }
    if (location.trim()) payload.location = location.trim()

    setPublishing(true)
    try {
      if (assets.length === 1) {
        const media = await uploadPostMedia(assets[0].file)
        payload.media = { type: media.type, src: media.url, mimeType: media.mimeType }
        if (assets[0].crop) payload.media.crop = assets[0].crop
      } else if (assets.length > 1) {
        const uploaded = await Promise.all(assets.map((a) => uploadPostMedia(a.file)))
        payload.media = {
          type: 'image',
          src: uploaded[0].url,
          mimeType: uploaded[0].mimeType,
          images: assets.map((a, i) => ({
            type: 'image',
            src: uploaded[i].url,
            mimeType: uploaded[i].mimeType,
            ...(a.crop ? { crop: a.crop } : {}),
          })),
        }
      }

      if (music?._file) {
        const audioMedia = await uploadStoryMedia(music._file)
        payload.music = {
          ...music,
          audioUrl: audioMedia.url,
          audio: audioMedia.url,
          previewUrl: audioMedia.url,
          _file: undefined,
        }
      } else if (music) {
        payload.music = music
      }

      await createPost(payload)
      show('Your post is live on ARMYVERSE! 💜', 'success')
      navigate('/')
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') {
        show('Please log in to share your post.', 'info')
        navigate('/auth/login')
        return
      }
      const msg =
        err.code === 'NETWORK'
          ? 'Could not reach the server. Is the backend running?'
          : err.message || 'Something went wrong publishing your post.'
      show(msg, 'error')
    } finally {
      setPublishing(false)
    }
  }

  const renderSinglePreview = (asset) => {
    if (asset.crop) {
      return (
        <MediaFrame
          src={asset.preview}
          crop={asset.crop}
          kind={asset.type}
          alt="Post preview"
          className="create-preview__media"
          frameClass="media-frame--preview"
          videoProps={asset.type === 'video' ? { controls: true, playsInline: true } : undefined}
        />
      )
    }
    if (asset.type === 'video') {
      return <video src={asset.preview} controls className="create-preview__media" />
    }
    return <img src={asset.preview} alt="Post preview" className="create-preview__media" />
  }

  const renderThumbnail = (asset, index) => (
    <div className="create-thumb" key={asset.id}>
      {asset.crop ? (
        <MediaFrame
          src={asset.preview}
          crop={asset.crop}
          kind="image"
          alt={`Photo ${index + 1}`}
          className="create-thumb__media"
          frameClass="create-thumb__frame"
        />
      ) : (
        <img className="create-thumb__media" src={asset.preview} alt={`Photo ${index + 1}`} />
      )}
      <span className="create-thumb__badge">{index + 1}</span>
      <button
        className="create-thumb__remove"
        onClick={() => removeAsset(asset.id)}
        aria-label={`Remove photo ${index + 1}`}
      >
        <Icon name="close" size={14} />
      </button>
      <button
        className="create-thumb__crop"
        onClick={() => setCropTargetId(asset.id)}
        aria-label={`Adjust photo ${index + 1}`}
      >
        <Icon name="image" size={12} />
        <span>Adjust</span>
      </button>
    </div>
  )

  return (
    <div className="page create">
      <div className="page-head">
        <div>
          <h1 className="page-title">{mode === 'reel' ? 'Create a Reel' : 'Create a post'}</h1>
          <p className="page-sub">Share a moment with ARMYs worldwide</p>
        </div>
      </div>

      <div className="create-tabs" role="tablist" aria-label="Choose what to create">
        <button
          role="tab"
          aria-selected={mode === 'post'}
          className={cn('create-tabs__btn', mode === 'post' && 'create-tabs__btn--active')}
          onClick={() => setMode('post')}
        >
          Post
        </button>
        <button
          role="tab"
          aria-selected={mode === 'reel'}
          className={cn('create-tabs__btn', mode === 'reel' && 'create-tabs__btn--active')}
          onClick={() => setMode('reel')}
        >
          Reel
        </button>
      </div>

      {mode === 'reel' ? (
        <CreateReel
          embedded
          onClose={() => setMode('post')}
          onSuccess={(reel) => {
            show('Your Reel is live! 🎬', 'success')
            navigate('/reels', { state: { newReel: reel } })
          }}
        />
      ) : (
        <div className="create-card">
        <div className="create-draft">
          <Avatar src={currentUser.avatarArt || currentUser.avatar} alt={currentUser.displayName} size={44} />
          <div className="create-draft__identity">
            <span className="create-draft__name">{currentUser.username}</span>
            <select
              className="create-draft__visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              aria-label="Post visibility"
            >
              <option value="public">🌐 Public</option>
              <option value="armys">💜 ARMYs only</option>
              <option value="private">🔒 Private</option>
            </select>
          </div>
        </div>

        <div
          className={cn('create-upload', dragOver && 'create-upload--over', assets.length === 0 && 'create-upload--empty')}
          onClick={() => assets.length === 0 && fileInput.current?.click()}
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
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          {assets.length === 0 && (
            <div className="create-upload__prompt">
              <span className="create-upload__icon">
                <Icon name="image" size={34} />
              </span>
              <p className="create-upload__title">Drag & drop or tap to add media</p>
              <p className="create-upload__hint">
                Multiple photos (up to {MAX_IMAGES}) or a single video · up to 100MB
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
          {assets.length > 0 && (
            <div className="create-preview">
              {assets.length === 1 ? (
                renderSinglePreview(assets[0])
              ) : (
                <div className="create-thumbs">
                  {assets.map(renderThumbnail)}
                  {assets.filter((a) => a.type === 'image').length < MAX_IMAGES && (
                    <button
                      type="button"
                      className="create-thumb create-thumb--add"
                      onClick={() => fileInput.current?.click()}
                      aria-label="Add more photos"
                    >
                      <Icon name="image" size={18} />
                      <span>Add photo</span>
                    </button>
                  )}
                </div>
              )}
              {assets.length === 1 && (
                <>
                  <button
                    className="create-preview__remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAsset(assets[0].id)
                    }}
                    aria-label="Remove media"
                  >
                    <Icon name="close" size={18} />
                  </button>
                  <button
                    className="create-preview__crop"
                    onClick={(e) => {
                      e.stopPropagation()
                      setCropTargetId(assets[0].id)
                    }}
                    aria-label="Adjust crop"
                  >
                    <Icon name="image" size={16} />
                    <span>Adjust</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="create-fields">
          <textarea
            className="create-textarea"
            placeholder="Write a caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          <div className="create-field-row">
            <Icon name="search" size={18} className="create-field-icon" />
            <input
              className="create-input"
              placeholder="Add hashtags (e.g. #BTS #ARMY)"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
          </div>
          <div className="create-field-row">
            <Icon name="globe" size={18} className="create-field-icon" />
            <input
              className="create-input"
              placeholder="Add location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          {music ? (
            <div className="create-music">
              <MusicSticker song={music} className="create-music__sticker" />
              <button
                className="create-music__remove"
                onClick={() => setMusic(null)}
                aria-label="Remove music"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="create-music-btn"
              onClick={() => setShowMusicPicker(true)}
            >
              <Icon name="note" size={18} className="create-field-icon" />
              <span>Add Music</span>
            </button>
          )}
        </div>

        <div className="create-foot">
          <span className="create-foot__note">
            {assets.length > 1 ? `${assets.length} photos · ` : ''}
            {caption.length}/1000
          </span>
          <Button
            variant="primary"
            onClick={handlePublish}
            loading={publishing}
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </div>
      )
      }

      <MusicPicker
        open={showMusicPicker}
        onClose={() => setShowMusicPicker(false)}
        onSelect={setMusic}
        onRemove={() => setMusic(null)}
        current={music}
      />

      <ImageCropper
        open={!!cropTargetId}
        src={cropTarget?.preview || null}
        isVideo={cropTarget?.type === 'video'}
        fileName={cropTarget?.file?.name}
        defaultAspect="4:5"
        initialCrop={cropTarget?.crop}
        title="Adjust media"
        onApply={handleCropApply}
        onCancel={() => setCropTargetId(null)}
      />
    </div>
  )
}