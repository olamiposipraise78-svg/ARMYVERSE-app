import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import { PageLoader } from './components/ui/Status.jsx'

const Home = lazy(() => import('./pages/Home.jsx'))
const Explore = lazy(() => import('./pages/Explore.jsx'))
const Reels = lazy(() => import('./pages/Reels.jsx'))
const CreatePost = lazy(() => import('./pages/CreatePost.jsx'))
const Messages = lazy(() => import('./pages/Messages.jsx'))
const Notifications = lazy(() => import('./pages/Notifications.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))
const Community = lazy(() => import('./pages/Community.jsx'))
const CommunityTopic = lazy(() => import('./pages/CommunityTopic.jsx'))
const Search = lazy(() => import('./pages/Search.jsx'))
const ArmymyAI = lazy(() => import('./pages/ArmymyAI.jsx'))
const GameCentre = lazy(() => import('./pages/GameCentre.jsx'))
const BTSQuiz = lazy(() => import('./pages/BTSQuiz.jsx'))
const GuessSong = lazy(() => import('./pages/GuessSong.jsx'))
const GuessMember = lazy(() => import('./pages/GuessMember.jsx'))
const MemoryGame = lazy(() => import('./pages/MemoryGame.jsx'))
const Login = lazy(() => import('./pages/auth/Login.jsx'))
const Signup = lazy(() => import('./pages/auth/Signup.jsx'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword.jsx'))
const NotFound = lazy(() => import('./pages/NotFound.jsx'))

const routeFallback = (
  <div className="page-fallback">
    <PageLoader label="Loading…" />
  </div>
)

export default function App() {
  return (
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route path="/auth/login" element={<Login />} />
        <Route path="/auth/signup" element={<Signup />} />
        <Route path="/auth/forgot" element={<ForgotPassword />} />
        <Route path="/auth/reset" element={<ResetPassword />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/reels" element={<Reels />} />
          <Route path="/create" element={<CreatePost />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:topic" element={<CommunityTopic />} />
          <Route path="/search" element={<Search />} />
          <Route path="/ai" element={<ArmymyAI />} />
          <Route path="/games" element={<GameCentre />} />
          <Route path="/games/quiz" element={<BTSQuiz />} />
          <Route path="/games/guess-song" element={<GuessSong />} />
          <Route path="/games/guess-member" element={<GuessMember />} />
          <Route path="/games/memory" element={<MemoryGame />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
