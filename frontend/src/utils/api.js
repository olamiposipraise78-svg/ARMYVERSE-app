// API client for ARMYVERSE.
//
// Core features (auth, feed, posts, likes, saves, comments, follows,
// notifications, search, profile) call the FastAPI backend through the Vite
// `/api` proxy. Feature areas with no backend yet (albums, reels, community,
// messages) fall back to the mock data layer so the app keeps working.
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth.js'
import {
  albums,
  reels,
  notifications,
  conversations,
  messagesByConversation,
  communityTopics,
  communityByTopic,
  trending,
} from '../data/index.js'
import { stories } from '../data/index.js'
import { getUserById } from '../data/users.js'
import { delay } from './helpers.js'

const SHORT = 400
const MED = 800

async function request(path, options = {}) {
  const { method = 'GET', body, auth = true, params } = options

  const url = new URL(path, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    }
  }

  const headers = { Accept: 'application/json' }
  if (auth) {
    const token = getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
    })
  } catch (err) {
    const e = new Error('network')
    e.code = 'NETWORK'
    throw e
  }

  if (res.status === 401 && auth) {
    const refreshed = await tryRefresh()
    if (refreshed) return request(path, options)
    clearTokens()
    const e = new Error('Session expired. Please log in again.')
    e.code = 'UNAUTHORIZED'
    throw e
  }

  let data = null
  try {
    data = await res.json()
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    let message = detailOf(data) || `Request failed (${res.status})`
    if (res.status === 429) {
      message = "You're sending messages too quickly. Please wait a moment and try again."
    }
    const e = new Error(message)
    e.code = 'API'
    e.status = res.status
    e.data = data
    throw e
  }

  return data || {}
}

function detailOf(data) {
  if (!data) return null
  // ARMYVERSE backend returns errors as {success:false, message:"..."}.
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.detail === 'string') return data.detail
  return null
}

let refreshing = null
async function tryRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const res = await request('/api/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken },
        auth: false,
      })
      if (res.access_token) setTokens(res.access_token, res.refresh_token)
      return !!res.access_token
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function register(payload) {
  return request('/api/auth/register', { method: 'POST', body: payload, auth: false })
}

export async function login(payload) {
  return request('/api/auth/login', { method: 'POST', body: payload, auth: false })
}

export async function logout(refreshToken) {
  try {
    await request('/api/auth/logout', {
      method: 'POST',
      body: { refresh_token: refreshToken || '' },
      auth: false,
    })
  } catch {
    /* ignore network errors on logout */
  }
}

export async function fetchMe() {
  const data = await request('/api/auth/me')
  return data.user
}

// ---------------------------------------------------------------------------
// Feed / posts
// ---------------------------------------------------------------------------
export function fetchFeed(params) {
  return request('/api/feed', { params: { offset: params?.offset, page_size: params?.page_size } })
}

export function fetchExplore(params) {
  return request('/api/posts', { params: { offset: params?.offset, page_size: params?.page_size } })
}

export function fetchPost(postId) {
  return request(`/api/posts/${postId}`)
}

export function fetchUserPosts(username, params) {
  return request(`/api/users/${username}/posts`, {
    params: { offset: params?.offset, page_size: params?.page_size },
  }).catch(() => ({ success: false, posts: [] }))
}

export async function createPost(payload) {
  const data = await request('/api/posts', { method: 'POST', body: payload })
  return data.post
}

export async function deletePost(postId) {
  return request(`/api/posts/${postId}`, { method: 'DELETE' })
}

export async function updateMyPost(postId, payload) {
  const data = await request(`/api/posts/${postId}`, { method: 'PATCH', body: payload })
  return data.post
}

// ---------------------------------------------------------------------------
// Likes / saves / comments
// ---------------------------------------------------------------------------
export async function likePost(postId) {
  const data = await request(`/api/posts/${postId}/like`, { method: 'POST' })
  return data
}

export async function unlikePost(postId) {
  const data = await request(`/api/posts/${postId}/like`, { method: 'DELETE' })
  return data
}

export async function savePost(postId) {
  const data = await request(`/api/posts/${postId}/save`, { method: 'POST' })
  return data
}

export async function unsavePost(postId) {
  const data = await request(`/api/posts/${postId}/save`, { method: 'DELETE' })
  return data
}

export function fetchMySaved(params) {
  return request('/api/users/me/saved', {
    params: { offset: params?.offset, page_size: params?.page_size },
  })
}

export async function createComment(postId, text) {
  const data = await request(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: { text },
  })
  return data.comment
}

export function fetchComments(postId, params) {
  return request(`/api/posts/${postId}/comments`, {
    params: { offset: params?.offset, page_size: params?.page_size },
  })
}

export async function deleteComment(commentId) {
  return request(`/api/comments/${commentId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Follows / users
// ---------------------------------------------------------------------------
export function fetchUser(usernameOrId) {
  return request(`/api/users/${usernameOrId}`).then((d) => d.user)
}

export async function followUser(userId) {
  const data = await request(`/api/users/${userId}/follow`, { method: 'POST' })
  return data
}

export async function unfollowUser(userId) {
  const data = await request(`/api/users/${userId}/follow`, { method: 'DELETE' })
  return data
}

export function fetchFollowers(userId, params) {
  return request(`/api/users/${userId}/followers`, {
    params: { offset: params?.offset, page_size: params?.page_size },
  })
}

export function fetchFollowing(userId, params) {
  return request(`/api/users/${userId}/following`, {
    params: { offset: params?.offset, page_size: params?.page_size },
  })
}

export async function updateMyProfile(payload) {
  const data = await request('/api/users/me', { method: 'PATCH', body: payload })
  return data.user
}

export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  const data = await request('/api/users/me/avatar', {
    method: 'POST',
    body: form,
    auth: true,
  })
  return data.user
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export function fetchNotifications(params) {
  return request('/api/notifications', {
    params: { offset: params?.offset, page_size: params?.page_size },
  })
}

export async function markNotificationRead(id) {
  return request(`/api/notifications/${id}/read`, { method: 'PATCH' })
}

export async function markAllNotificationsRead() {
  return request('/api/notifications/read-all', { method: 'PATCH' })
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export async function searchAll(query, params) {
  if (!query || !query.trim()) {
    return { users: [], posts: [], hashtags: [], suggestions: [] }
  }
  const q = query.trim()
  const [userRes, postRes] = await Promise.all([
    request('/api/search/users', { auth: true, params: { q, page_size: 8 } }),
    request('/api/search/posts', { auth: true, params: { q, page_size: 8 } }),
  ])
  const hashtags = (q.match(/#[\w\u00C0-\uFFFF-]+/g) || []).map((h) => h.slice(1))
  const suggestions = (userRes.users || [])
    .slice(0, 8)
    .map((u) => u.username)
    .concat(postRes.posts || [].slice(0, 0))
  return {
    users: userRes.users || [],
    posts: postRes.posts || [],
    hashtags,
    suggestions: suggestions.slice(0, 8),
  }
}

// ---------------------------------------------------------------------------
// Mock-backed (no backend yet: albums, reels, community, messages)
// ---------------------------------------------------------------------------
async function ok(data, ms = SHORT) {
  await delay(ms)
  return { data: JSON.parse(JSON.stringify(data)) }
}

export async function fetchTrendingTags() {
  return ok(trending, 0)
}

export async function fetchSuggestedUsers() {
  return ok([], 0)
}

export async function fetchPopularARMYs() {
  return ok([], 0)
}

export async function fetchAlbums() {
  return ok(albums)
}

export async function fetchAlbumById(id) {
  await delay(SHORT)
  const album = albums.find((a) => a.id === id)
  if (!album) throw new Error('not_found')
  return ok(album)
}

export async function fetchAlbumsByArtist(artist) {
  await delay(SHORT)
  const q = artist.trim().toLowerCase()
  const matches = albums.filter(
    (a) => a.artist.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  )
  return ok(matches)
}

export async function fetchAlbumArtists() {
  return ok([...new Set(albums.map((a) => a.artist))].sort())
}

export async function fetchReels(params) {
  return request('/api/reels', { params: { offset: params?.offset, page_size: params?.page_size } })
}

export async function fetchReel(reelId) {
  return request(`/api/reels/${reelId}`)
}

export async function createReel(mediaUrl, payload) {
  const data = await request('/api/reels', {
    method: 'POST',
    params: { media_url: mediaUrl },
    body: payload,
  })
  return data.reel
}

export async function deleteReel(reelId) {
  return request(`/api/reels/${reelId}`, { method: 'DELETE' })
}

export async function likeReel(reelId) {
  return request(`/api/reels/${reelId}/like`, { method: 'POST' })
}

export async function unlikeReel(reelId) {
  return request(`/api/reels/${reelId}/like`, { method: 'DELETE' })
}

export async function saveReel(reelId) {
  return request(`/api/reels/${reelId}/save`, { method: 'POST' })
}

export async function unsaveReel(reelId) {
  return request(`/api/reels/${reelId}/save`, { method: 'DELETE' })
}

export async function viewReel(reelId) {
  return request(`/api/reels/${reelId}/view`, { method: 'POST' })
}

export async function shareReel(reelId) {
  return request(`/api/reels/${reelId}/share`, { method: 'POST' })
}

export async function commentOnReel(reelId, text) {
  const data = await request(`/api/reels/${reelId}/comments`, {
    method: 'POST',
    body: { text },
  })
  return data.comment
}

export function fetchReelComments(reelId, params) {
  return request(`/api/reels/${reelId}/comments`, {
    params: { offset: params?.offset, page_size: params?.page_size },
  })
}

export async function uploadReelMedia(file) {
  const form = new FormData()
  form.append('file', file)
  const data = await request('/api/reels/upload', {
    method: 'POST',
    body: form,
    auth: true,
  })
  return data.media
}

export async function uploadPostMedia(file) {
  const form = new FormData()
  form.append('file', file)
  const data = await request('/api/posts/upload', {
    method: 'POST',
    body: form,
    auth: true,
  })
  return data.media
}

export async function fetchStories() {
  const res = await request('/api/stories')
  const stories = res.stories || []
  return { data: stories.map((story) => ({ ...story, ifExpired: false })) }
}

function resolveMockStories() {
  const resolved = stories.map((story) => {
    const author = getUserById(story.user)
    return {
      ...story,
      ifExpired: false,
      author: {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatar: author.avatarArt || author.avatar,
        verified: author.verified,
      },
    }
  })
  return resolved
}

export async function createStory(payload) {
  const data = await request('/api/stories', { method: 'POST', body: payload })
  return data.story
}

export async function uploadStoryMedia(file) {
  const form = new FormData()
  form.append('file', file)
  const data = await request('/api/stories/upload', {
    method: 'POST',
    body: form,
    auth: true,
  })
  return data.media
}

export async function deleteStory(storyId) {
  return request(`/api/stories/${storyId}`, { method: 'DELETE' })
}

export async function viewStory(storyId) {
  return request(`/api/stories/${storyId}/view`, { method: 'POST' })
}

export async function fetchNotificationsMock() {
  return ok(notifications)
}

export async function fetchConversations() {
  return ok(conversations)
}

export async function fetchMessages(conversationId) {
  await delay(SHORT)
  const messages = messagesByConversation[conversationId] || []
  return ok(messages)
}

export async function fetchCommunityTopics() {
  return ok(communityTopics)
}

export async function fetchCommunityTopic(slug) {
  await delay(SHORT)
  const topic = communityTopics.find((t) => t.slug === slug)
  const topicPosts = communityByTopic[slug] || []
  return ok({ topic, posts: topicPosts })
}

// ---- AI ----
export async function getAIStatus() {
  return request('/api/ai/status', { auth: false })
}

export async function sendAIMessage(message, history = []) {
  return request('/api/ai/chat', {
    method: 'POST',
    body: { message, history },
    auth: true,
  })
}

// ---- Games ----
export async function getQuizQuestions(difficulty = 'easy', category = null) {
  const params = { difficulty }
  if (category) params.category = category
  return request('/api/games/quiz/questions', { params, auth: false })
}

export async function submitQuizResult(payload) {
  return request('/api/games/quiz/submit', {
    method: 'POST',
    body: payload,
    auth: true,
  })
}

export async function getGameProgress() {
  return request('/api/games/progress', { auth: true })
}

export async function getGameCategories() {
  return request('/api/games/categories', { auth: false })
}

export async function fetchSongPreviews(deezerIds) {
  return request('/api/games/songs/previews', {
    method: 'POST',
    body: { deezerIds },
    auth: false,
  })
}
