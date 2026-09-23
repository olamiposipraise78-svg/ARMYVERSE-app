import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchAll, fetchTrendingTags } from '../utils/api.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Icon from '../components/ui/Icon.jsx'
import FollowButton from '../components/ui/FollowButton.jsx'
import { cn } from '../utils/helpers.js'
import { makeErrorHandler } from '../utils/image.js'
import MediaFrame from '../components/media/MediaFrame.jsx'
import './search.css'

export default function Search() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const [input, setInput] = useState(q)
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('av-recent') || '[]')
    } catch {
      return []
    }
  })
  const [state, setState] = useState({ status: q ? 'loading' : 'idle', data: null })
  const [suggestions, setSuggestions] = useState([])
  const [trending, setTrending] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    fetchTrendingTags()
      .then((res) => setTrending(res.data))
      .catch(() => {})
  }, [])

  const addRecent = (term) => {
    setRecent((prev) => {
      const next = [term, ...prev.filter((r) => r !== term)].slice(0, 6)
      localStorage.setItem('av-recent', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    if (!q) {
      setState({ status: 'idle', data: null })
      return
    }
    let active = true
    setState({ status: 'loading', data: null })
    searchAll(q)
      .then((res) => {
        if (!active) return
        setState({ status: 'ok', data: res })
        setSuggestions(res.suggestions)
      })
      .catch(() => active && setState({ status: 'error', data: null }))
    return () => {
      active = false
    }
  }, [q])

  const runSearch = (term) => {
    const t = term.trim()
    if (!t) return
    if (t !== q) setParams({ q: t })
    addRecent(t)
  }

  const onSubmit = (e) => {
    e.preventDefault()
    runSearch(input)
  }

  const pickSuggestion = (s) => {
    setInput(s)
    runSearch(s)
  }

  const clearRecent = () => {
    setRecent([])
    localStorage.removeItem('av-recent')
  }

  const hasResults =
    state.data &&
    (state.data.users.length > 0 ||
      state.data.posts.length > 0 ||
      state.data.hashtags.length > 0)

  return (
    <div className="page search">
      <form className="search-bar" onSubmit={onSubmit}>
        <Icon name="search" size={20} />
        <input
          ref={inputRef}
          className="search-bar__input"
          placeholder="Search users, posts, hashtags, topics…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Search ARMYVERSE"
        />
        {input && (
          <button
            type="button"
            className="search-bar__clear"
            onClick={() => {
              setInput('')
              setParams({})
            }}
            aria-label="Clear search"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </form>

      {state.status === 'loading' && <LoadingState label="Searching…" />}
      {state.status === 'error' && <ErrorState message="Search is unavailable right now." />}

      {state.status === 'idle' && (
        <div className="search-idle">
          {recent.length > 0 && (
            <section className="search-sec">
              <div className="search-sec__head">
                <h2 className="search-sec__title">Recent searches</h2>
                <button className="search-sec__clear" onClick={clearRecent}>
                  Clear all
                </button>
              </div>
              <ul className="recent-list">
                {recent.map((r) => (
                  <li key={r}>
                    <button className="recent-item" onClick={() => pickSuggestion(r)}>
                      <Icon name="search" size={16} />
                      <span>{r}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {suggestions.length > 0 && (
            <section className="search-sec">
              <h2 className="search-sec__title">Suggestions</h2>
              <ul className="suggest-chips">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button className="suggest-chip" onClick={() => pickSuggestion(s)}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="search-sec">
            <h2 className="search-sec__title">Trending on ARMYVERSE</h2>
            <ul className="trend-tags-list">
              {trending.map((t) => (
                <li key={t.tag}>
                  <button className="trend-tag" onClick={() => pickSuggestion(t.tag)}>
                    <span className="trend-tag__name">{t.tag}</span>
                    <span className="trend-tag__count">{t.count} posts</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {state.status === 'ok' && !hasResults && (
        <EmptyState
          icon="🔍"
          title={`No results for “${q}”`}
          message="Try a different keyword, or search a hashtag."
        />
      )}

      {state.status === 'ok' && hasResults && (
        <div className="search-results">
          {state.data.users.length > 0 && (
            <section className="search-sec">
              <h2 className="search-sec__title">ARMYs</h2>
              <ul className="user-results">
                {state.data.users.map((u) => (
                  <li key={u.id} className="user-result">
                    <button
                      className="user-result__main"
                      onClick={() => navigate(`/u/${u.username}`)}
                    >
                      <Avatar src={u.avatarArt || u.avatar} alt={u.displayName} size={44} />
                      <div className="user-result__info">
                        <span className="user-result__name">{u.username}</span>
                        <span className="user-result__loc">
                          {u.displayName} · {u.country}
                        </span>
                      </div>
                    </button>
                    <FollowButton userId={u.id} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.data.hashtags.length > 0 && (
            <section className="search-sec">
              <h2 className="search-sec__title">Hashtags</h2>
              <div className="hashtag-results">
                {state.data.hashtags.map((h) => (
                  <button key={h} className="hashtag-chip" onClick={() => pickSuggestion(h)}>
                    {h}
                  </button>
                ))}
              </div>
            </section>
          )}

          {state.data.posts.length > 0 && (
            <section className="search-sec">
              <h2 className="search-sec__title">Posts</h2>
              <div className="post-results">
                {state.data.posts.map((p) => (
                  <button
                    key={p.id}
                    className={cn('post-result', !p.media && 'post-result--text')}
                    onClick={() => navigate('/')}
                  >
                    {p.media && (
                      p.media.crop ? (
                        <MediaFrame
                          src={p.media.src}
                          crop={p.media.crop}
                          kind={p.media.type === 'video' ? 'video' : 'image'}
                          alt=""
                          frameClass="media-frame--thumb"
                          onError={makeErrorHandler(p.media.fallback)}
                        />
                      ) : (
                        <img
                          className="post-result__img"
                          src={p.media.thumbnail || p.media.src}
                          alt=""
                          onError={makeErrorHandler(p.media.fallback)}
                        />
                      )
                    )}
                    <span className="post-result__text">{p.text}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
