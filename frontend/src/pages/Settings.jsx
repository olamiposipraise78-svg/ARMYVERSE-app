import { useRef, useState } from 'react'
import { users } from '../data/index.js'
import Button from '../components/ui/Button.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import FollowButton from '../components/ui/FollowButton.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { updateMyProfile, uploadAvatar } from '../utils/api.js'
import { cn } from '../utils/helpers.js'
import ImageCropper from '../components/media/ImageCropper.jsx'
import './settings.css'

const sections = [
  { key: 'account', label: 'Account', icon: 'profile' },
  { key: 'privacy', label: 'Privacy & safety', icon: 'lock' },
  { key: 'blocked', label: 'Blocked & muted', icon: 'ban' },
  { key: 'guidelines', label: 'Community guidelines', icon: 'shield' },
]

const otherUsers = users.filter((u) => !u.isCurrentUser)

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle-row">
      <div className="toggle-row__text">
        <span className="toggle-row__label">{label}</span>
        {hint && <span className="toggle-row__hint">{hint}</span>}
      </div>
      <input
        type="checkbox"
        className="toggle"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  )
}

export default function Settings() {
  const { show } = useToast()
  const { currentUser, patchCurrentUser, logout } = useApp()
  const [section, setSection] = useState('account')
  const avatarInputRef = useRef(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState(null)
  const [showAvatarCrop, setShowAvatarCrop] = useState(false)
  const [form, setForm] = useState({
    displayName: currentUser.displayName,
    bio: currentUser.bio || '',
    country: currentUser.country || '',
  })
  const [saving, setSaving] = useState(false)
  const [privates, setPrivates] = useState({
    private: false,
    likes: true,
    activity: true,
    discovery: true,
    messagesEveryone: false,
  })
  const [notices, setNotices] = useState(true)
  const [blocked, setBlocked] = useState(() => new Set())

  const setPriv = (k) => (v) => setPrivates((p) => ({ ...p, [k]: v }))

  const toggleBlocked = (id) => {
    setBlocked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const updated = await updateMyProfile({
        display_name: form.displayName,
        bio: form.bio,
        country: form.country,
      })
      patchCurrentUser(updated)
      show('Profile saved.', 'success')
    } catch (err) {
      show(err.code === 'NETWORK' ? 'Could not reach the server.' : err.message || 'Save failed.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarPick = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      show('Please choose an image file (PNG, JPG, or WEBP).', 'error')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      show('Image is too large. Maximum size is 10MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setAvatarSrc(reader.result)
      setShowAvatarCrop(true)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarCrop = async (croppedFile) => {
    setShowAvatarCrop(false)
    setAvatarSrc(null)
    setAvatarUploading(true)
    try {
      const updated = await uploadAvatar(croppedFile)
      patchCurrentUser(updated)
      show('Profile photo updated!', 'success')
    } catch (err) {
      show(err.code === 'UNAUTHORIZED' ? 'Please log in to change your photo.' : err.message || 'Upload failed.', 'error')
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    show('You have been logged out.', 'info')
  }

  return (
    <div className="page settings">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage your ARMYVERSE account and safety</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* Section nav */}
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map((s) => (
            <button
              key={s.key}
              className={cn('settings-nav__item', section === s.key && 'settings-nav__item--active')}
              onClick={() => setSection(s.key)}
              aria-current={section === s.key ? 'page' : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Section content */}
        <div className="settings-content">
          {section === 'account' && (
            <div className="setting-card">
              <h2 className="setting-card__title">Profile</h2>
              <div className="setting-field">
                <div className="setting-field__row">
                  <Avatar
                    src={currentUser.avatarArt || currentUser.avatar}
                    alt="Your avatar"
                    size={56}
                  />
                  <div>
                    <p className="setting-field__label">Profile picture</p>
                    <p className="setting-field__hint">PNG or JPG, at least 200×200.</p>
                  </div>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={handleAvatarPick}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={avatarUploading}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {avatarUploading ? 'Uploading…' : 'Change photo'}
                </Button>
              </div>
              <div className="setting-field">
                <label className="setting-field__label" htmlFor="username">Username</label>
                <input id="username" className="setting-input" value={currentUser.username} readOnly disabled />
              </div>
              <div className="setting-field">
                <label className="setting-field__label" htmlFor="display">Display name</label>
                <input
                  id="display"
                  className="setting-input"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
              <div className="setting-field">
                <label className="setting-field__label" htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  className="setting-input setting-input--area"
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
              <div className="setting-field">
                <label className="setting-field__label" htmlFor="country">Country</label>
                <input
                  id="country"
                  className="setting-input"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </div>
              <div className="setting-save">
                <Button variant="primary" onClick={saveProfile} loading={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button variant="ghost" onClick={() => show('Changed your mind — no changes made.', 'info')}>
                  Discard
                </Button>
                <Button variant="danger" onClick={handleLogout}>
                  Log out
                </Button>
              </div>
            </div>
          )}

          {section === 'privacy' && (
            <div className="setting-card">
              <h2 className="setting-card__title">Privacy</h2>
              <Toggle
                label="Private account"
                hint="Only ARMYs you approve can follow you and see your posts."
                checked={privates.private}
                onChange={setPriv('private')}
              />
              <Toggle
                label="Show like & comment activity"
                checked={privates.likes}
                onChange={setPriv('likes')}
              />
              <Toggle
                label="Activity status"
                hint="Let others see when you’re active."
                checked={privates.activity}
                onChange={setPriv('activity')}
              />
              <hr className="setting-divider" />
              <h2 className="setting-card__title">Safety</h2>
              <Toggle
                label="Let anyone message you"
                hint="If off, only ARMYs you follow can message you."
                checked={privates.messagesEveryone}
                onChange={setPriv('messagesEveryone')}
              />
              <Toggle
                label="Notifications"
                hint="Receive alerts for likes, comments, and messages."
                checked={notices}
                onChange={setNotices}
              />
            </div>
          )}

          {section === 'blocked' && (
            <div className="setting-card">
              <h2 className="setting-card__title">Blocked & muted users</h2>
              {otherUsers.map((u) => {
                const isBlocked = blocked.has(u.id)
                return (
                  <div className="blocked-row" key={u.id}>
                    <Avatar src={u.avatarArt || u.avatar} alt={u.displayName} size={40} />
                    <div className="blocked-row__info">
                      <span className="blocked-row__name">{u.username}</span>
                      <span className="blocked-row__sub">{u.country}</span>
                    </div>
                    <FollowButton userId={u.id} size="sm" />
                    <Button
                      variant={isBlocked ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => toggleBlocked(u.id)}
                    >
                      {isBlocked ? 'Unblock' : 'Block'}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          {section === 'guidelines' && (
            <div className="setting-card">
              <h2 className="setting-card__title">Community guidelines</h2>
              {[
                {
                  t: 'Be kind',
                  d: 'Treat every ARMY with respect, no matter where they’re from. We’re one global family.',
                },
                {
                  t: 'No harassment or bullying',
                  d: 'Hate speech, threats, and targeted abuse are never allowed and will be removed.',
                },
                {
                  t: 'Respect copyright',
                  d: 'Don’t share unauthorized paid content. Downloads are only available where explicitly permitted.',
                },
                {
                  t: 'No spam or impersonation',
                  d: 'Keep the feed authentic. Don’t impersonate others or post misleading links.',
                },
                {
                  t: 'Stay on topic',
                  d: 'This is an ARMY community — keep conversations focused on BTS and ARMY life.',
                },
              ].map((g, i) => (
                <div className="guideline" key={i}>
                  <h3 className="guideline__title">{g.t}</h3>
                  <p className="guideline__desc">{g.d}</p>
                </div>
              ))}
              <div className="setting-save">
                <Button
                  variant="secondary"
                  onClick={() => show('Couldn’t reach the full guidelines — backend coming soon.', 'info')}
                >
                  View full guidelines
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImageCropper
        open={showAvatarCrop}
        src={avatarSrc}
        isVideo={false}
        title="Adjust profile photo"
        defaultAspect="1:1"
        variant="export"
        onConfirm={handleAvatarCrop}
        onCancel={() => {
          setShowAvatarCrop(false)
          setAvatarSrc(null)
        }}
      />
    </div>
  )
}
