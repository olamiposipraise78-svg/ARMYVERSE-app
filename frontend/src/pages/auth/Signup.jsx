import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import Button from '../../components/ui/Button.jsx'
import ImageCropper from '../../components/media/ImageCropper.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useApp } from '../../context/AppContext.jsx'

export default function Signup() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { register } = useApp()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    country: '',
    bio: '',
    displayName: '',
  })
  const [avatar, setAvatar] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showAvatarCrop, setShowAvatarCrop] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState(null)

  const setField = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const pickAvatar = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => {
        setAvatarSrc(reader.result)
        setShowAvatarCrop(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAvatarCrop = (croppedFile, previewUrl) => {
    setShowAvatarCrop(false)
    setAvatarSrc(null)
    setAvatar(previewUrl || croppedFile)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      show('Password must be at least 8 characters.', 'error')
      return
    }
    if (form.username.length < 3) {
      show('Username must be at least 3 characters.', 'error')
      return
    }
    if (!/^[\p{L}\p{N}_.]+$/u.test(form.username)) {
      show('Username can only contain letters, numbers, underscores, or dots.', 'error')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      show('Please enter a valid email address.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        country: form.country,
        bio: form.bio,
        display_name: form.displayName || form.username,
      })
      show('Account created! Welcome to ARMYVERSE 💜', 'success')
      navigate('/')
    } catch (err) {
      let msg = err.message || 'Could not create your account.'
      if (err.code === 'NETWORK') msg = 'Could not reach the server. Is the backend running?'
      show(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Join ARMYVERSE"
      subtitle="Create your profile and connect with ARMYs worldwide."
      footer={
        <p>
          Already have an account? <Link to="/auth/login" className="auth-link">Log in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="auth-avatar">
          <label className="avatar-upload" title="Choose profile picture">
            {avatar ? (
              <img className="avatar-upload__img" src={avatar} alt="Your profile" />
            ) : (
              <span className="avatar-upload__placeholder" aria-hidden="true">💜</span>
            )}
            <span className="avatar-upload__edit">+</span>
            <input type="file" accept="image/*" hidden onChange={pickAvatar} />
          </label>
          <span className="auth-avatar__hint">Profile picture (optional)</span>
        </div>

        <label className="auth-field">
          <span className="auth-field__label">Username</span>
          <input className="auth-input" required value={form.username} onChange={setField('username')} autoComplete="username" />
          <span className="auth-field__hint">Letters, numbers, underscores, or dots.</span>
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Display name</span>
          <input className="auth-input" value={form.displayName} onChange={setField('displayName')} autoComplete="name" />
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Email</span>
          <input className="auth-input" type="email" required value={form.email} onChange={setField('email')} autoComplete="email" />
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Password</span>
          <div className="auth-pass">
            <input className="auth-input" type={showPassword ? 'text' : 'password'} required value={form.password} onChange={setField('password')} autoComplete="new-password" />
            <button type="button" className="auth-pass__toggle" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <span className="auth-field__hint">At least 8 characters.</span>
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Country</span>
          <input className="auth-input" value={form.country} onChange={setField('country')} placeholder="Where are you from?" />
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Bio</span>
          <textarea className="auth-input auth-input--area" rows={2} value={form.bio} onChange={setField('bio')} placeholder="Tell ARMYs a little about yourself…" />
        </label>

        <Button type="submit" fullWidth loading={submitting} size="lg">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="auth-terms">
          By signing up you agree to the <span className="auth-link">Community Guidelines</span>.
        </p>
      </form>

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
    </AuthLayout>
  )
}
