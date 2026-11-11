import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout'
import { TextField } from '../components/auth/TextField'
import { getAuthErrorMessage, sendResetEmail } from '../services/authService'
import { validateEmail } from '../utils/validation'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [formError, setFormError] = useState('')
  const [sentTo, setSentTo] = useState('') // set ONLY after Firebase says the request worked
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const message = validateEmail(email)
    setEmailError(message ?? '')
    setFormError('')
    setSentTo('')
    if (message) return

    setSubmitting(true)
    try {
      await sendResetEmail(email)
      setSentTo(email.trim())
    } catch (error) {
      setFormError(getAuthErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we’ll send you a link to choose a new password."
      footer={<Link to="/login">← Back to sign in</Link>}
    >
      {sentTo && (
        <div className="alert alert-success" role="status">
          If an account exists for <strong>{sentTo}</strong>, a password reset link is on its way. Check your
          inbox and spam folder.
        </div>
      )}

      {formError && (
        <div className="alert alert-error" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          error={emailError}
          disabled={submitting}
        />

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
