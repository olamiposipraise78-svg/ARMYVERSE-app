import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import Button from '../../components/ui/Button.jsx'
import { useToast } from '../../context/ToastContext.jsx'

export default function ForgotPassword() {
  const { show } = useToast()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = (e) => {
    e.preventDefault()
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setSent(true)
      show("If an account exists, a reset link is on its way (demo).", 'info')
    }, 1000)
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we’ll help you reset it."
      footer={
        <p>
          Remembered it? <Link to="/auth/login" className="auth-link">Back to log in</Link>
        </p>
      }
    >
      {sent ? (
        <div className="auth-success">
          <span className="auth-success__icon" aria-hidden="true">📬</span>
          <p>Check your inbox for a reset link.</p>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <label className="auth-field">
            <span className="auth-field__label">Email</span>
            <input
              className="auth-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <Button type="submit" fullWidth loading={submitting} size="lg">
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
