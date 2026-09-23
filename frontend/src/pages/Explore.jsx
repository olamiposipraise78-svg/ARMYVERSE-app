import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchExplore } from '../utils/api.js'
import { LoadingState, ErrorState, EmptyState } from '../components/ui/Status.jsx'
import { formatCount } from '../components/post/PostCard.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import Icon from '../components/ui/Icon.jsx'
import FollowButton from '../components/ui/FollowButton.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { users } from '../data/index.js'
import { makeErrorHandler } from '../utils/image.js'
import MediaFrame from '../components/media/MediaFrame.jsx'
import './explore.css'

export default function Explore() {
  const navigate = useNavigate()
  const { show } = useToast()
  const [state, setState] = useState({ status: 'loading', posts: [] })
  const [activeTag, setActiveTag] = useState('All')

  useEffect(() => {
    let active = true
    fetchExplore()
      .then((res) => active && setState({ status: 'ok', posts: res.posts || [] }))
      .catch(() => active && setState({ status: 'error', posts: [] }))
    return () => {
      active = false
    }
  }, [])

  const tagsFlat = ['All', '#BTS', '#Concert', '#FanArt', '#ARMY', '#Album', '#Dance']

  const tagImages = {
    All: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Bts_Dynamite_2.svg/960px-Bts_Dynamite_2.svg.png',
    '#BTS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/170529_BTS_at_a_press_conference_for_the_BBMAs_%282%29.png/960px-170529_BTS_at_a_press_conference_for_the_BBMAs_%282%29.png',
    '#Concert': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/BTS_in_concert_at_Wembley_Stadium%2C_2_June_2019_02.jpg/960px-BTS_in_concert_at_Wembley_Stadium%2C_2_June_2019_02.jpg',
    '#FanArt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Jin_and_Jungkook_of_BTS_at_Seoul_Music_Awards%2C_19_January_2017_02.png/960px-Jin_and_Jungkook_of_BTS_at_Seoul_Music_Awards%2C_19_January_2017_02.png',
    '#ARMY': 'https://upload.wikimedia.org/wikipedia/commons/d/d1/BTS_World_Tour_Love_Yourself_Speak_Yourself_in_Brazil%2C_May_2019_04.jpg',
    '#Album': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/BTS_-_Mic_Drop.jpg/960px-BTS_-_Mic_Drop.jpg',
    '#Dance': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/J-Hope_for_BTS_5th_anniversary_party_in_LA_photoshoot_by_Dispatch%2C_May_2018_01.jpg/960px-J-Hope_for_BTS_5th_anniversary_party_in_LA_photoshoot_by_Dispatch%2C_May_2018_01.jpg',
  }

  const looseMatch = (h, tag) =>
    h.replace(/^#/, '').toLowerCase().startsWith(tag.replace(/^#/, '').toLowerCase())

  const gridItems =
    activeTag === 'All'
      ? state.posts
      : state.posts.filter((p) => (p.hashtags || []).some((h) => looseMatch(h, activeTag)))

  return (
    <div className="page explore">
      <div className="page-head">
        <div>
          <h1 className="page-title">Explore</h1>
          <p className="page-sub">Discover ARMY content from around the world</p>
        </div>
      </div>

      <div className="explore-discover">
        <button className="explore-discover__card" onClick={() => navigate('/ai')}>
          <span className="explore-discover__icon">💜</span>
          <span className="explore-discover__info">
            <span className="explore-discover__title">ARMY AI</span>
            <span className="explore-discover__desc">Ask me anything about BTS!</span>
          </span>
          <Icon name="arrowRight" size={18} className="explore-discover__arrow" />
        </button>
        <button className="explore-discover__card" onClick={() => navigate('/games')}>
          <span className="explore-discover__icon">🎮</span>
          <span className="explore-discover__info">
            <span className="explore-discover__title">Game Centre</span>
            <span className="explore-discover__desc">Play BTS quizzes and games!</span>
          </span>
          <Icon name="arrowRight" size={18} className="explore-discover__arrow" />
        </button>
      </div>

      <div className="explore-tags" role="tablist">
        {tagsFlat.map((t) => (
          <button
            key={t}
            className={`explore-tag-tile ${activeTag === t ? 'explore-tag-tile--active' : ''}`}
            onClick={() => setActiveTag(t)}
            role="tab"
            aria-selected={activeTag === t}
            title={t}
          >
            <img
              className="explore-tag-tile__img"
              src={tagImages[t]}
              alt={t}
              loading="lazy"
              onError={makeErrorHandler('/images/fallback.svg')}
            />
            <span className="explore-tag-tile__label">{t}</span>
          </button>
        ))}
      </div>

      {state.status === 'loading' && <LoadingState label="Discovering content…" />}
      {state.status === 'error' && (
        <ErrorState message="Couldn’t load explore content." onRetry={() => navigate(0)} />
      )}
      {state.status === 'ok' && gridItems.length === 0 && (
        <EmptyState icon="🔍" title="Nothing to explore yet" message="Check back soon." />
      )}
      {state.status === 'ok' && gridItems.length > 0 && (
        <>
          <div className="explore-grid">
            {gridItems.map((post, i) => (
              <figure
                key={post.id}
                className={`explore-cell explore-cell--${(i % 3) + 1}`}
                onClick={() => show('Full post view — coming soon, find it on your Home feed! 💜', 'info')}
              >
                {post.media.crop ? (
                  <MediaFrame
                    src={post.media.src}
                    crop={post.media.crop}
                    kind={post.media.type === 'video' ? 'video' : 'image'}
                    alt={post.media.alt || 'Explore post'}
                    frameClass="media-frame--tile"
                    onError={makeErrorHandler(post.media.fallback)}
                  />
                ) : (
                  <img
                    className="explore-cell__img"
                    src={post.media.thumbnail || post.media.src}
                    alt={post.media.alt || 'Explore post'}
                    loading="lazy"
                    onError={makeErrorHandler(post.media.fallback)}
                  />
                )}
                <figcaption className="explore-cell__overlay">
                  <span className="explore-cell__stat">
                    <Icon name="heart" size={16} /> {formatCount(post.likeCount)}
                  </span>
                  <span className="explore-cell__stat">
                    <Icon name="comment" size={16} /> {formatCount(post.commentCount)}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>

          <section className="explore-sec">
            <h2 className="explore-sec__title">ARMY creators to follow</h2>
            <div className="creator-list">
              {users
                .filter((u) => !u.isCurrentUser)
                .slice(0, 6)
                .map((u) => (
                  <div className="creator-card" key={u.id}>
                    <button
                      onClick={() => navigate(`/u/${u.username}`)}
                      className="creator-card__top"
                    >
                      <Avatar src={u.avatarArt || u.avatar} alt={u.displayName} size={52} />
                      <span className="creator-card__info">
                        <span className="creator-card__name">{u.username}</span>
                        <span className="creator-card__sub">
                          {u.followers >= 1000
                            ? `${(u.followers / 1000).toFixed(1)}K followers`
                            : `${u.followers} followers`}
                        </span>
                        <span className="creator-card__loc">{u.country}</span>
                      </span>
                    </button>
                    <FollowButton userId={u.id} size="sm" />
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
