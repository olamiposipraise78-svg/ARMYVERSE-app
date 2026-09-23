import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTrendingTags, fetchPopularARMYs } from '../../utils/api.js'
import { LoadingState, ErrorState } from '../ui/Status.jsx'
import Avatar from '../ui/Avatar.jsx'
import FollowButton from '../ui/FollowButton.jsx'

function Trending() {
  const [state, setState] = useState({ status: 'loading', data: [] })
  useEffect(() => {
    let active = true
    fetchTrendingTags()
      .then((res) => active && setState({ status: 'ok', data: res.data }))
      .catch(() => active && setState({ status: 'error', data: [] }))
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') return <LoadingState label="Loading trends…" />
  if (state.status === 'error')
    return <ErrorState message="Couldn’t load trends." />
  return (
    <div className="rail-sec">
      <h3 className="rail-sec__title">Trending for ARMYs</h3>
      <ul className="trend-list">
        {state.data.map((t) => (
          <li key={t.tag} className="trend-item">
            <span className="trend-item__tag">{t.tag}</span>
            <span className="trend-item__count">{t.count} posts</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Popular() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', data: [] })
  useEffect(() => {
    let active = true
    fetchPopularARMYs()
      .then((res) => active && setState({ status: 'ok', data: res.data }))
      .catch(() => active && setState({ status: 'error', data: [] }))
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') return <LoadingState label="Loading…" />
  if (state.status === 'error')
    return <ErrorState message="Couldn’t load popular ARMYs." />
  const featured = state.data
  return (
    <div className="rail-sec">
      <h3 className="rail-sec__title">Popular ARMYs</h3>
      <ul className="suggest-list">
        {featured.map((u) => (
          <li key={u.id} className="suggest-row">
            <button
              className="suggest-row__user"
              onClick={() => navigate(`/u/${u.username}`)}
            >
              <Avatar src={u.avatarArt || u.avatar} alt={u.displayName} size={40} />
              <span className="suggest-row__info">
                <span className="suggest-row__name">{u.username}</span>
                <span className="suggest-row__sub">{u.country}</span>
              </span>
            </button>
            <FollowButton userId={u.id} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Activity() {
  return (
    <div className="rail-sec rail-sec--glow">
      <h3 className="rail-sec__title">Worldwide ARMY activity</h3>
      <div className="activity">
        <div className="activity__stat">
          <span className="activity__value">148K</span>
          <span className="activity__label">ARMYs online now</span>
        </div>
        <div className="activity__stat">
          <span className="activity__value">32</span>
          <span className="activity__label">Countries active</span>
        </div>
        <div className="activity__line">
          <span className="activity__live-dot" aria-hidden="true" /> Livestream trending in Seoul
        </div>
      </div>
    </div>
  )
}

export default function RightRail() {
  return (
    <aside className="rail" aria-label="Discover and community">
      <Trending />
      <Activity />
      <Popular />
    </aside>
  )
}
