import { useLocation } from 'react-router-dom'
import { cn } from '../../utils/helpers.js'
import Icon from '../ui/Icon.jsx'

const items = [
  { to: '/', label: 'Home', icon: 'home', active: 'home' },
  { to: '/explore', label: 'Explore', icon: 'explore', active: 'explore' },
  { to: '/reels', label: 'Reels', icon: 'video', active: 'reels' },
  { to: '/create', label: 'Create', icon: 'create', active: 'create' },
  { to: '/messages', label: 'Messages', icon: 'messages', active: 'messages' },
  { to: '/notifications', label: 'Notifications', icon: 'bell', active: 'notifications' },
  { to: '/community', label: 'Community', icon: 'users', active: 'community' },
  { to: '/search', label: 'Search', icon: 'search', active: 'search' },
  { to: '/profile', label: 'Profile', icon: 'profile', active: 'profile' },
  { to: '/settings', label: 'Settings', icon: 'settings', active: 'settings' },
]

function isActive(path, group) {
  if (group === 'home') return path === '/'
  return path.startsWith('/' + group)
}

export default function Sidebar({ onNavigate }) {
  const { pathname } = useLocation()
  return (
    <nav className="sidebar" aria-label="Primary">
      <button className="logo" onClick={() => onNavigate('/')}>
        <span className="logo__mark" aria-hidden="true">
          <span className="logo__heart">💜</span>
        </span>
        <span className="logo__word">ARMYVERSE</span>
      </button>

      <div className="sidebar__nav">
        {items.map((item) => {
          const active = isActive(pathname, item.active)
          return (
            <button
              key={item.id || item.to}
              className={cn('nav-link', active && 'nav-link--active')}
              onClick={() => onNavigate(item.to)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-link__icon">
                <Icon name={active ? item.icon + 'Fill' : item.icon} size={24} />
              </span>
              <span className="nav-link__label">{item.label}</span>
            </button>
          )
        })}
      </div>

      <div className="sidebar__foot">
        <div className="sidebar__tagline">Where ARMYs around the world connect.</div>
        <div className="sidebar__dim">© {new Date().getFullYear()} ARMYVERSE</div>
      </div>
    </nav>
  )
}
