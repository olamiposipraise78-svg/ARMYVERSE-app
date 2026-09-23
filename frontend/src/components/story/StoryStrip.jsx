import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchStories } from '../../utils/api.js'
import Avatar from '../ui/Avatar.jsx'
import { cn } from '../../utils/helpers.js'
import { useApp } from '../../context/AppContext.jsx'
import StoriesViewer from './StoriesViewer.jsx'
import StoryCreator from './StoryCreator.jsx'
import './story.css'

export default function StoryStrip() {
  const { currentUser, isAuthenticated } = useApp()
  const [state, setState] = useState({ status: 'loading', stories: [] })
  const [activeStory, setActiveStory] = useState(null)
  const [showCreator, setShowCreator] = useState(false)
  const viewed = useRef(new Set())

  useEffect(() => {
    let active = true
    fetchStories()
      .then((res) => active && setState({ status: 'ok', stories: res.data || [] }))
      .catch(() => active && setState({ status: 'error', stories: [] }))
    return () => { active = false }
  }, [])

  const refresh = () => {
    return fetchStories()
      .then((res) => setState({ status: 'ok', stories: res.data || [] }))
      .catch(() => setState({ status: 'error', stories: [] }))
  }

  const handleCreated = () => {
    setShowCreator(false)
    refresh()
  }

  const open = (story) => {
    viewed.current.add(story.id)
    setActiveStory(story)
  }

  const handleStoryDeleted = (storyId) => {
    setState((s) => {
      const remaining = s.stories.filter((st) => st.id !== storyId)
      if (remaining.length === 0) setActiveStory(null)
      return { ...s, stories: remaining }
    })
  }

  const myStories = useMemo(() => {
    if (!currentUser) return []
    return state.stories.filter((s) => s.user === currentUser.id)
  }, [state.stories, currentUser])

  const otherStories = useMemo(() => {
    if (!currentUser) return state.stories
    return state.stories.filter((s) => s.user !== currentUser.id)
  }, [state.stories, currentUser])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const story of otherStories) {
      const authorId = story.user
      if (!map.has(authorId)) {
        map.set(authorId, {
          author: story.author,
          stories: [],
          latest: story,
        })
      }
      map.get(authorId).stories.push(story)
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt)
    )
  }, [otherStories])

  const hasMyStory = myStories.length > 0
  const myLatestStory = hasMyStory ? myStories[0] : null
  const myViewed = hasMyStory && myStories.every((s) => viewed.current.has(s.id))

  const handleYourStoryClick = () => {
    if (hasMyStory) {
      open(myLatestStory)
    } else {
      setShowCreator(true)
    }
  }

  return (
    <section className="stories" aria-label="Stories">
      {isAuthenticated && (
        <div className="story-cell story-cell--add-group">
          <button
            className={cn('story-cell', hasMyStory && !myViewed && 'story-cell--has-story')}
            aria-label={hasMyStory ? 'View your story' : 'Add a story'}
            onClick={handleYourStoryClick}
          >
            <span className="story-cell__ring">
              <Avatar
                src={currentUser.avatarArt || currentUser.avatar}
                alt="Your story"
                size={58}
                className="story-cell__avatar"
              />
              {!hasMyStory && (
                <span className="story-cell__plus" aria-hidden="true">+</span>
              )}
            </span>
            <span className="story-cell__name">Your story</span>
          </button>
          <button
            className="story-cell__add-btn"
            onClick={() => setShowCreator(true)}
            aria-label="Add new story"
            title="Add story"
          >
            +
          </button>
        </div>
      )}

      {state.status === 'loading' && (
        <div className="story-skeletons" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div className="story-skeleton" key={i}>
              <span className="skeleton skeleton--circle" />
              <span className="skeleton skeleton--line-sm" />
            </div>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="story-error">Couldn't load stories right now.</p>
      )}

      {state.status === 'ok' && grouped.length === 0 && !hasMyStory && (
        <p className="story-empty">No stories yet - share yours first!</p>
      )}

      {state.status === 'ok' && grouped.length > 0 && (
        <div className="stories__row">
          {grouped.map(({ author, stories, latest }) => {
            const allViewed = stories.every((s) => viewed.current.has(s.id))
            return (
              <button
                key={author.id}
                className={cn('story-cell', allViewed && 'story-cell--viewed')}
                onClick={() => open(latest)}
                aria-label={`Open ${author.displayName}'s story`}
              >
                <span className="story-cell__ring">
                  <Avatar
                    src={author.avatar}
                    alt={author.displayName}
                    size={58}
                    className="story-cell__avatar"
                  />
                </span>
                <span className="story-cell__name">
                  {author.username}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {activeStory && (
        <StoriesViewer
          startStory={activeStory}
          allStories={
            hasMyStory && activeStory.user === currentUser?.id
              ? myStories
              : (grouped.find((g) => g.author.id === activeStory.author?.id)?.stories || state.stories)
          }
          viewed={viewed.current}
          onClose={() => setActiveStory(null)}
          onStoryDeleted={handleStoryDeleted}
          onAddStory={() => {
            setActiveStory(null)
            setShowCreator(true)
          }}
        />
      )}

      {showCreator && isAuthenticated && (
        <StoryCreator onClose={() => setShowCreator(false)} onCreated={handleCreated} />
      )}
    </section>
  )
}
