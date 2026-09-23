import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import Icon from '../ui/Icon.jsx'
import Avatar from '../ui/Avatar.jsx'

export default function TopBar() {
  const { currentUser } = useApp()
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand" aria-label="ARMYVERSE home">
        <span className="logo__mark logo__mark--sm" aria-hidden="true">
          <span className="logo__heart">💜</span>
        </span>
        <span className="topbar__word">ARMYVERSE</span>
      </Link>

      <Link to="/search" className="topbar__search" aria-label="Search ARMYVERSE">
        <Icon name="search" size={18} />
        <span>Search</span>
      </Link>

      <Link to="/messages" className="topbar__icon-link" aria-label="Messages">
        <Icon name="messages" size={22} />
      </Link>
      <Link to="/profile" className="topbar__avatar" aria-label="Your profile">
        <Avatar src={currentUser.avatarArt || currentUser.avatar} alt={currentUser.displayName} size={34} />
      </Link>
    </header>
  )
}
