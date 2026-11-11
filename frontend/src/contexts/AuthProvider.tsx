import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../firebase'
import { fetchUserRole } from '../services/roleService'
import { AuthContext } from './auth-context'
import type { Role } from './auth-context'

interface RoleInfo {
  uid: string // which user this role belongs to
  role: Role | null
  status: 'loading' | 'ready' | 'error'
}

// Wrap the whole app in this once (see main.tsx).
// It listens to Firebase ONE time and shares the result with every screen.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // Changing this number makes screens re-read the user after a profile update.
  const [profileVersion, setProfileVersion] = useState(0)
  const [roleInfo, setRoleInfo] = useState<RoleInfo | null>(null)
  const [roleAttempt, setRoleAttempt] = useState(0)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribe // stop listening when the provider unmounts
  }, [])

  const uid = user?.uid ?? null

  // Load the person's role whenever a different user signs in (or on retry).
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    fetchUserRole(uid)
      .then((role) => {
        if (!cancelled) setRoleInfo({ uid, role, status: 'ready' })
      })
      .catch(() => {
        if (!cancelled) setRoleInfo({ uid, role: null, status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [uid, roleAttempt])

  // Ignore a role that belongs to a previous user.
  const current = uid && roleInfo && roleInfo.uid === uid ? roleInfo : null
  const roleLoading = uid !== null && (current === null || current.status === 'loading')
  const roleError = current?.status === 'error'
  const role = current?.status === 'ready' ? current.role : null

  const value = useMemo(
    () => ({
      user,
      loading,
      profileVersion,
      refreshUser: () => setProfileVersion((version) => version + 1),
      role,
      roleLoading,
      roleError,
      reloadRole: () => {
        if (uid) setRoleInfo({ uid, role: null, status: 'loading' })
        setRoleAttempt((attempt) => attempt + 1)
      },
      setRole: (newRole: Role) => {
        if (uid) setRoleInfo({ uid, role: newRole, status: 'ready' })
      },
    }),
    [user, loading, profileVersion, role, roleLoading, roleError, uid],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
