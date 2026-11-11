import { Link } from 'react-router-dom'
import { Logo } from '../components/auth/Logo'

export function NotFound() {
  return (
    <div className="not-found">
      <Logo />
      <h1>Page not found</h1>
      <p>The page you’re looking for doesn’t exist.</p>
      <Link to="/dashboard" className="btn btn-primary btn-inline">
        Go to dashboard
      </Link>
    </div>
  )
}
