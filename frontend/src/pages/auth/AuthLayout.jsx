import { useNavigate, Link } from 'react-router-dom'
import './auth.css'

export default function AuthLayout({ children, title, subtitle, footer }) {
  const navigate = useNavigate()
  return (
    <div className="auth-page">
      <div className="auth-card">
        <button className="auth-brand" onClick={() => navigate('/')} aria-label="ARMYVERSE home">
          <span className="logo__mark" aria-hidden="true">
            <span className="logo__heart">💜</span>
          </span>
          <span className="auth-brand__word">ARMYVERSE</span>
        </button>
        <p className="auth-brand__tag">Where ARMYs around the world connect.</p>

        <header className="auth-head">
          <h1 className="auth-head__title">{title}</h1>
          {subtitle && <p className="auth-head__sub">{subtitle}</p>}
        </header>

        {children}

        {footer && <div className="auth-alt">{footer}</div>}
      </div>
    </div>
  )
}
