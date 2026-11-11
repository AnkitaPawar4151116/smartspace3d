import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useOrderAlerts } from '../hooks/useOrderAlerts'
import { getAuthErrorMessage, logout } from '../services/authService'
import { Logo } from './auth/Logo'
import '../styles/app-pages.css'

// Header + page container used by every signed-in page.
export function AppShell({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  const { badge } = useOrderAlerts()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    if (signingOut) return
    setSignOutError('')
    setSigningOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      // Show the problem instead of pretending sign-out worked.
      setSignOutError(getAuthErrorMessage(error))
      setSigningOut(false)
    }
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-header-inner">
          <Link to="/dashboard" aria-label="SmartSpace 3D home" className="plain-link">
            <Logo />
          </Link>
          <nav className="app-nav" aria-label="Main">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Dashboard
            </NavLink>
            <NavLink to="/lookup" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Find Stock
            </NavLink>
            <NavLink to="/orders" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Orders
              {badge > 0 && <span className="nav-badge" aria-label={`${badge} ${role === 'admin' ? 'waiting' : 'new'}`}>{badge}</span>}
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Alerts
            </NavLink>
            <NavLink to="/packing" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              3D View
            </NavLink>
            <NavLink to="/stock" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Stock
            </NavLink>
            <NavLink to="/medicines" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Medicines
            </NavLink>
            <NavLink to="/warehouses" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              Warehouses
            </NavLink>
            <NavLink to="/impact" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              SDG Impact
            </NavLink>
            {role === 'admin' && (
              <NavLink to="/history" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                History
              </NavLink>
            )}
            {role === 'admin' && (
              <NavLink to="/import" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Import
              </NavLink>
            )}
          </nav>
          <div className="header-actions">
            {role && <span className={role === 'admin' ? 'badge badge-success' : 'badge'}>{role === 'admin' ? 'Admin' : 'User'}</span>}
            <button type="button" className="btn btn-outline" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? (
                <>
                  <span className="spinner spinner-dark" aria-hidden="true" />
                  Signing out…
                </>
              ) : (
                'Sign Out'
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="dash-main">
        {signOutError && (
          <div className="alert alert-error" role="alert">
            Could not sign out: {signOutError}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
