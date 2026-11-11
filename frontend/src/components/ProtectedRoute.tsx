import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LoadingScreen } from './LoadingScreen'

interface ProtectedRouteProps {
  children: ReactNode
  // true only for the "choose your role" page itself
  allowWithoutRole?: boolean
}

// Lets through only signed-in users who have chosen a role.
//  - not signed in   -> /login
//  - no role yet     -> /select-role
export function ProtectedRoute({ children, allowWithoutRole = false }: ProtectedRouteProps) {
  const { user, loading, role, roleLoading, roleError, reloadRole } = useAuth()
  const location = useLocation()

  // Wait for Firebase first, so protected content never flashes on screen.
  if (loading || (user && roleLoading)) return <LoadingScreen />

  if (!user) {
    // Remember where the visitor wanted to go.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roleError) {
    return (
      <div className="loading-screen" role="alert">
        <p>We could not load your account details. Check your connection and try again.</p>
        <button type="button" className="btn btn-primary btn-inline" onClick={reloadRole}>
          Try again
        </button>
      </div>
    )
  }

  if (!role && !allowWithoutRole) {
    return <Navigate to="/select-role" replace />
  }

  return <>{children}</>
}
