import { useNavigate } from 'react-router-dom'
import Icon from '../ui/Icon.jsx'

export default function GameCard({ title, description, icon, to, badge }) {
  const navigate = useNavigate()
  return (
    <button className="game-card" onClick={() => navigate(to)}>
      {badge && <span className="game-card__badge">{badge}</span>}
      <span className="game-card__icon">{icon}</span>
      <span className="game-card__title">{title}</span>
      <span className="game-card__desc">{description}</span>
      <span className="game-card__arrow">
        <Icon name="arrowRight" size={18} />
      </span>
    </button>
  )
}
