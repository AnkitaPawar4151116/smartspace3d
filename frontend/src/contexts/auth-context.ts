import { createContext } from 'react'
import type { User } from 'firebase/auth'

export type Role = 'admin' | 'user'

export interface AuthContextValue {
  user: User | null
  // true while Firebase is still checking if someone is already signed in
  loading: boolean
  // increases after refreshUser(); lets screens re-render with the new name
  profileVersion: number
  // call after updateProfile so screens re-read the new display name
  refreshUser: () => void

  // The role the person chose ("admin" or "user"); null until they choose one
  role: Role | null
  // true while the role is being loaded from Firestore
  roleLoading: boolean
  // true if loading the role failed (network or permissions)
  roleError: boolean
  // try loading the role again
  reloadRole: () => void
  // remember a role right after it was saved
  setRole: (role: Role) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
