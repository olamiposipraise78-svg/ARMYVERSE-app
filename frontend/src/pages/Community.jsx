import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCommunityTopics } from '../utils/api.js'
import { LoadingState, ErrorState } from '../components/ui/Status.jsx'
import Icon from '../components/ui/Icon.jsx'
import { makeErrorHandler } from '../utils/image.js'
import './community.css'

export default function Community() {
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading', topics: [] })

  useEffect(() => {
    let active = true
    fetchCommunityTopics()
      .then((res) => active && setState({ status: 'ok', topics: res.data }))
      .catch(() => active && setState({ status: 'error', topics: [] }))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="page community">
      <section className="community-hero">
        <span className="community-hero__emoji" aria-hidden="true">
          💜
        </span>
        <h1 className="community-hero__title">ARMYVERSE Community</h1>
        <p className="community-hero__sub">
          Connect over everything BTS — from music and albums to concert memories and ARMY life.
        </p>
      </section>

      <div className="community-head">
        <h2 className="page-title">Explore topics</h2>
        <p className="page-sub">Pick a topic and join the conversation.</p>
      </div>

      {state.status === 'loading' && <LoadingState label="Loading community topics…" />}
      {state.status === 'error' && (
        <ErrorState message="Couldn’t load community topics." />
      )}
      {state.status === 'ok' && (
        <div className="topic-grid">
          {state.topics.map((t) => (
            <button
              key={t.slug}
              className="topic-card"
              onClick={() => navigate(`/community/${t.slug}`)}
            >
              <span className="topic-card__thumb" aria-hidden="true">
                <img
                  className="topic-card__img"
                  src={t.art}
                  alt=""
                  loading="lazy"
                  onError={makeErrorHandler(t.fallback)}
                />
                <span className="topic-card__emoji">{t.icon}</span>
              </span>
              <span className="topic-card__info">
                <span className="topic-card__label">{t.label}</span>
                <span className="topic-card__blurb">{t.blurb}</span>
                <span className="topic-card__count">
                  <Icon name="comment" size={13} /> {t.posts.toLocaleString()} posts
                </span>
              </span>
              <Icon name="arrowRight" size={18} className="topic-card__arrow" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
