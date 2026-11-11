import { FirebaseError } from 'firebase/app'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../db'
import type { Role } from '../contexts/auth-context'
import { getDataErrorMessage } from './dataErrors'

// Reads the saved role of a user. Returns null when they have not chosen one yet.
export async function fetchUserRole(uid: string): Promise<Role | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null
  const role = snapshot.data().role
  return role === 'admin' || role === 'user' ? role : null
}

// Saves the chosen role ONCE. For "admin" the access code is sent along and
// the Firestore rules compare it with the secret code stored in config/admin.
export async function saveUserRole(uid: string, role: Role, adminCode?: string): Promise<void> {
  const data =
    role === 'admin'
      ? { role, adminCode: adminCode ?? '', createdAt: serverTimestamp() }
      : { role, createdAt: serverTimestamp() }
  await setDoc(doc(db, 'users', uid), data)
}

export function getRoleErrorMessage(error: unknown, role: Role): string {
  if (error instanceof FirebaseError && error.code === 'permission-denied') {
    return role === 'admin'
      ? 'That admin access code is not correct (or admin setup is not finished in Firebase).'
      : 'Your role could not be saved. You may already have one: refresh the page.'
  }
  return getDataErrorMessage(error)
}
