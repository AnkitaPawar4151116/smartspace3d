import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { GoogleButton } from '../components/auth/GoogleButton'
import { PasswordInput } from '../components/auth/PasswordInput'
import { TextField } from '../components/auth/TextField'
import { getAuthErrorMessage, loginWithEmail, loginWithGoogle } from '../services/authService'
import { getSafeRedirect } from '../utils/redirect'
import { validateEmail } from '../utils/validation'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = getSafeRedirect(location.state)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // While any request is running, every button is locked (no duplicate submits).
  const busy = submitting || googleLoading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const emailMessage = validateEmail(email)
    const passwordMessage = password ? null : 'Enter your password.'
    setEmailError(emailMessage ?? '')
    setPasswordError(passwordMessage ?? '')
    setFormError('')
    if (emailMessage || passwordMessage) return

    setSubmitting(true)
    try {
      await loginWithEmail(email, password)
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(getAuthErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGoogle() {
    if (busy) return
    setFormError('')
    setGoogleLoading(true)
    try {
      await loginWithGoogle()
      navigate(redirectTo, { replace: true })
    } catch (error) {
      setFormError(getAuthErrorMessage(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage medicine stock across your warehouses."
      footer={
        <>
          Don’t have an account? <Link to="/register">Create one</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          error={emailError}
          disabled={busy}
        />

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={passwordError}
          disabled={busy}
        />

        <div className="form-row">
          <Link to="/forgot-password" className="link-small">
            Forgot password?
          </Link>
        </div>

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="divider">
        <span>or continue with</span>
      </div>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} disabled={busy} />
    </AuthLayout>
  )
}
