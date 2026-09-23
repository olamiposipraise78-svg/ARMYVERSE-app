import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import Button from '../../components/ui/Button.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = (e) => {
    e.preventDefault()
    if (password.length < 8) {
      show("Password must be at least 8 characters.", 'error')
      return
    }
    if (password !== confirm) {
      show("Passwords don’t match.", 'error')
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      show("Password updated. You can log in now. (Demo — no backend yet.)", 'success')
      navigate('/auth/login')
    }, 1100)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Choose a new password for your account."
      footer={
        <p>
          <Link to="/auth/login" className="auth-link">Back to log in</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="auth-field">
          <span className="auth-field__label">New password</span>
          <input
            className="auth-input"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          <span className="auth-field__hint">At least 8 characters.</span>
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Confirm password</span>
          <input
            className="auth-input"
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        <Button type="submit" fullWidth loading={submitting} size="lg">
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  )
}
