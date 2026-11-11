import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getSafeRedirect } from '../utils/redirect'
import { LoadingScreen } from './LoadingScreen'

// For login / register / forgot-password.
// Already signed-in users are sent on to the dashboard.
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (user) {
    return <Navigate to={getSafeRedirect(location.state)} replace />
  }

  return <>{children}</>
}
