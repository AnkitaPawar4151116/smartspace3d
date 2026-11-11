import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Logo } from '../components/auth/Logo'
import { PasswordInput } from '../components/auth/PasswordInput'
import type { Role } from '../contexts/auth-context'
import { useAuth } from '../hooks/useAuth'
import { getRoleErrorMessage, saveUserRole } from '../services/roleService'
import '../styles/app-pages.css'

export function SelectRole() {
  const { user, role: savedRole, setRole } = useAuth()

  const [choice, setChoice] = useState<Role | null>(null)
  const [adminCode, setAdminCode] = useState('')
  const [choiceError, setChoiceError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // Already has a role: nothing to choose here.
  if (savedRole) return <Navigate to="/dashboard" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !user) return

    setFormError('')
    if (!choice) {
      setChoiceError('Choose how you will use SmartSpace.')
      return
    }
    setChoiceError('')

    const code = adminCode.trim()
    if (choice === 'admin' && !code) {
      setCodeError('Enter the admin access code.')
      return
    }
    setCodeError('')

    setSaving(true)
    try {
      await saveUserRole(user.uid, choice, code)
      setRole(choice) // this also moves the person on to the dashboard
    } catch (error) {
      setFormError(getRoleErrorMessage(error, choice))
      setSaving(false)
    }
  }

  return (
    <div className="role-page">
      <div className="role-wrap">
        <Logo />
        <h1>How will you use SmartSpace?</h1>
        <p className="role-sub">
          Choose your role. This is saved to your account and cannot be changed later.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div className="alert alert-error" role="alert">
              {formError}
            </div>
          )}

          <fieldset className="role-options" disabled={saving} aria-describedby={choiceError ? 'role-error' : undefined}>
            <legend className="sr-only">Role</legend>

            <label className={choice === 'user' ? 'role-card selected' : 'role-card'}>
              <input
                type="radio"
                name="role"
                value="user"
                checked={choice === 'user'}
                onChange={() => setChoice('user')}
              />
              <span className="role-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
              </span>
              <span className="role-title">User</span>
              <span className="role-text">
                Search for medicines, see which warehouse has stock and which one is nearest.
              </span>
            </label>

            <label className={choice === 'admin' ? 'role-card selected' : 'role-card'}>
              <input
                type="radio"
                name="role"
                value="admin"
                checked={choice === 'admin'}
                onChange={() => setChoice('admin')}
              />
              <span className="role-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <span className="role-title">Admin</span>
              <span className="role-text">
                Manage warehouses, medicines and stock. Needs an admin access code.
              </span>
            </label>
          </fieldset>

          {choiceError && (
            <p id="role-error" className="field-error" role="alert">
              {choiceError}
            </p>
          )}

          {choice === 'admin' && (
            <div className="role-code">
              <PasswordInput
                id="adminCode"
                label="Admin access code"
                value={adminCode}
                onChange={setAdminCode}
                autoComplete="current-password"
                error={codeError}
                hint="Ask the project owner for this code."
                disabled={saving}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
