import { useLocation } from 'react-router-dom'
import { cn } from '../../utils/helpers.js'
import Icon from '../ui/Icon.jsx'

const items = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/reels', label: 'Reels', icon: 'video' },
  { to: '/explore', label: 'Explore', icon: 'explore' },
  { to: '/create', label: 'Create', icon: 'create' },
  { to: '/messages', label: 'Messages', icon: 'messages' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
]

function isActive(path, to) {
  if (to === '/') return path === '/'
  return path.startsWith(to)
}

export default function BottomNav({ onNavigate }) {
  const { pathname } = useLocation()
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const active = isActive(pathname, item.to)
        return (
          <button
            key={item.to}
            className={cn('bottom-nav__item', active && 'bottom-nav__item--active')}
            onClick={() => onNavigate(item.to)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
          >
            <Icon name={active ? item.icon + 'Fill' : item.icon} size={25} />
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
