import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import * as api from '../utils/api.js'
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isLoggedIn,
} from '../utils/auth.js'
import { users } from '../data/users.js'

const AppContext = createContext(null)

const mockUser = users[0]

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isBootstrapping, setIsBootstrapping] = useState(() => isLoggedIn())
  const [likes, setLikes] = useState({})
  const [saves, setSaves] = useState({})
  const [following, setFollowing] = useState(() => new Set())

  // Restore a session on first load if we already have a token.
  useEffect(() => {
    let active = true
    if (!isLoggedIn()) {
      setCurrentUser(mockUser)
      setIsBootstrapping(false)
      return () => {
        active = false
      }
    }
    api
      .fetchMe()
      .then((user) => {
        if (!active) return
        setCurrentUser(user)
        setIsAuthenticated(true)
        setIsBootstrapping(false)
      })
      .catch(() => {
        if (!active) return
        clearTokens()
        setCurrentUser(mockUser)
        setIsAuthenticated(false)
        setIsBootstrapping(false)
      })
    return () => {
      active = false
    }
  }, [])

  // DeepMerge for feeds already carrying author + current-user flags.
  const registerAuth = useCallback(({ access_token, refresh_token, user }) => {
    setTokens(access_token, refresh_token)
    setCurrentUser(user)
    setIsAuthenticated(true)
    setIsBootstrapping(false)
  }, [])

  const login = useCallback(
    async (credentials) => {
      const data = await api.login(credentials)
      if (!data.access_token) {
        const e = new Error('Login failed.')
        e.status = 401
        throw e
      }
      registerAuth(data)
      return data
    },
    [registerAuth]
  )

  const register = useCallback(
    async (payload) => {
      const data = await api.register(payload)
      registerAuth(data)
      return data
    },
    [registerAuth]
  )

  const logout = useCallback(async () => {
    try {
      await api.logout(getRefreshToken())
    } catch {
      /* ignore */
    } finally {
      clearTokens()
      setCurrentUser(mockUser)
      setIsAuthenticated(false)
      setIsBootstrapping(false)
      setLikes({})
      setSaves({})
      setFollowing(new Set())
    }
  }, [])

  const userHasLiked = useCallback((postId) => !!likes[postId], [likes])

  const toggleLike = useCallback(
    async (postId, shouldLike) => {
      setLikes((prev) => ({ ...prev, [postId]: shouldLike }))
      if (shouldLike) return api.likePost(postId)
      return api.unlikePost(postId)
    },
    []
  )

  const userHasSaved = useCallback((postId) => !!saves[postId], [saves])

  const toggleSave = useCallback(
    async (postId, shouldSave) => {
      setSaves((prev) => ({ ...prev, [postId]: shouldSave }))
      if (shouldSave) return api.savePost(postId)
      return api.unsavePost(postId)
    },
    []
  )

  const isFollowing = useCallback((userId) => following.has(userId), [following])

  const toggleFollow = useCallback(
    async (userId) => {
      const willFollow = !following.has(userId)
      setFollowing((prev) => {
        const next = new Set(prev)
        if (willFollow) next.add(userId)
        else next.delete(userId)
        return next
      })
      if (willFollow) await api.followUser(userId)
      else await api.unfollowUser(userId)
    },
    [following]
  )

  const patchCurrentUser = useCallback((patch) => {
    setCurrentUser((prev) => ({ ...(prev || mockUser), ...patch }))
  }, [])

  const value = useMemo(
    () => ({
      currentUser: currentUser || mockUser,
      isAuthenticated,
      isBootstrapping,
      login,
      register,
      logout,
      refreshAuth: login,
      patchCurrentUser,
      userHasLiked,
      toggleLike,
      userHasSaved,
      toggleSave,
      isFollowing,
      toggleFollow,
    }),
    [
      currentUser,
      isAuthenticated,
      isBootstrapping,
      login,
      register,
      logout,
      patchCurrentUser,
      likes,
      saves,
      following,
      userHasLiked,
      toggleLike,
      userHasSaved,
      toggleSave,
      isFollowing,
      toggleFollow,
    ]
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
