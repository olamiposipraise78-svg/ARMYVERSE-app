import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout.jsx'
import Button from '../../components/ui/Button.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useApp } from '../../context/AppContext.jsx'

export default function Login() {
  const navigate = useNavigate()
  const { show } = useToast()
  const { login } = useApp()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!form.identifier || !form.password) {
      show('Please enter your email and password.', 'error')
      return
    }
    setSubmitting(true)
    try {
      await login({ identifier: form.identifier, password: form.password })
      show('Welcome back, ARMY! 💜', 'success')
      navigate('/')
    } catch (err) {
      let msg = err.message || 'Invalid email, username, or password.'
      if (err.code === 'NETWORK') msg = 'Could not reach the server. Is the backend running?'
      show(msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see what ARMYs around the world are sharing."
      footer={
        <p>
          New here? <Link to="/auth/signup" className="auth-link">Create an account</Link>
        </p>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="auth-field">
          <span className="auth-field__label">Email or username</span>
          <input
            className="auth-input"
            type="text"
            autoComplete="username"
            required
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
          />
        </label>
        <label className="auth-field">
          <span className="auth-field__label">Password</span>
          <div className="auth-pass">
            <input
              className="auth-input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button type="button" className="auth-pass__toggle" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>
        <div className="auth-row">
          <Link to="/auth/forgot" className="auth-link">Forgot password?</Link>
        </div>
        <Button type="submit" fullWidth loading={submitting} size="lg">
          {submitting ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
