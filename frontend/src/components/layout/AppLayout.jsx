import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'
import BottomNav from './BottomNav.jsx'
import RightRail from './RightRail.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { PageLoader } from '../ui/Status.jsx'
import './layout.css'

export default function AppLayout() {
  const navigate = useNavigate()
  const { isAuthenticated, isBootstrapping } = useApp()
  const go = (to) => navigate(to)

  // Auth gating: wait for session restore before rendering the shell, and
  // redirect unauthenticated users to the login page.
  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/auth/login', { replace: true })
    }
  }, [isBootstrapping, isAuthenticated, navigate])

  if (isBootstrapping) {
    return (
      <div className="app-shell app-shell--boot">
        <PageLoader label="Loading ARMYVERSE…" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="app-shell">
      <div className="app-shell__sidebar">
        <Sidebar onNavigate={go} />
      </div>

      <div className="app-shell__top">
        <TopBar />
      </div>

      <main className="app-shell__main" id="main">
        <Outlet />
      </main>

      <div className="app-shell__rail">
        <RightRail />
      </div>

      <div className="app-shell__bottom">
        <BottomNav onNavigate={go} />
      </div>
    </div>
  )
}
