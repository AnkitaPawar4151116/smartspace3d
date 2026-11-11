import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { GoogleButton } from '../components/auth/GoogleButton'
import { PasswordInput } from '../components/auth/PasswordInput'
import { TextField } from '../components/auth/TextField'
import { useAuth } from '../hooks/useAuth'
import { getAuthErrorMessage, loginWithGoogle, registerWithEmail } from '../services/authService'
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateNewPassword,
} from '../utils/validation'

interface FieldErrors {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

const noErrors: FieldErrors = { fullName: '', email: '', password: '', confirmPassword: '' }

export function Register() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>(noErrors)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const busy = submitting || googleLoading

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    const nextErrors: FieldErrors = {
      fullName: validateFullName(fullName) ?? '',
      email: validateEmail(email) ?? '',
      password: validateNewPassword(password) ?? '',
      confirmPassword: validateConfirmPassword(password, confirmPassword) ?? '',
    }
    setErrors(nextErrors)
    setFormError('')
    if (Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    try {
      await registerWithEmail(fullName, email, password)
      refreshUser() // so the dashboard shows the new display name
      navigate('/dashboard', { replace: true })
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
      navigate('/dashboard', { replace: true })
    } catch (error) {
      setFormError(getAuthErrorMessage(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track medicine stock and find the nearest warehouse in minutes."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
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
          id="fullName"
          label="Full name"
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          autoComplete="name"
          placeholder="Your full name"
          error={errors.fullName}
          disabled={busy}
        />

        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email}
          disabled={busy}
        />

        <PasswordInput
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password}
          disabled={busy}
        />

        <PasswordInput
          id="confirmPassword"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          error={errors.confirmPassword}
          disabled={busy}
        />

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Creating account…
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="divider">
        <span>or continue with</span>
      </div>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} disabled={busy} label="Sign up with Google" />
    </AuthLayout>
  )
}
