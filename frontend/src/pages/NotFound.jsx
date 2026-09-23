import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import './pages.css'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="notfound">
      <div className="notfound-card">
        <span className="notfound__emoji" aria-hidden="true">💜</span>
        <h1 className="notfound__code">404</h1>
        <p className="notfound__text">
          This page wandered off like a BTS lyric we can’t quite remember.
        </p>
        <div className="notfound__actions">
          <Button variant="primary" onClick={() => navigate('/')}>
            <Icon name="home" size={18} /> Go home
          </Button>
          <Button variant="secondary" onClick={() => navigate('/explore')}>
            Explore ARMYVERSE
          </Button>
        </div>
      </div>
    </div>
  )
}
