import { FirebaseError } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../firebase'

// Turns a Firebase error into a message a normal user can understand.
// Raw error text is never shown, so nothing internal leaks to the screen.
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-email':
        return 'That email address is not valid.'
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password.'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.'
      case 'auth/weak-password':
        return 'That password is too weak. Use at least 8 characters.'
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'The Google sign-in window was closed before finishing.'
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in popup. Allow popups for this site and try again.'
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled for the project yet.'
      case 'auth/unauthorized-domain':
        return 'This website address is not authorized for sign-in in the Firebase Console.'
      case 'auth/user-disabled':
        return 'This account has been disabled.'
      case 'auth/network-request-failed':
        return 'Network error. Check your internet connection and try again.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.'
      default:
        return 'Something went wrong. Please try again.'
    }
  }
  return 'Something went wrong. Please try again.'
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password)
  return credential.user
}

export async function registerWithEmail(
  fullName: string,
  email: string,
  password: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password)
  // Save the name on the Firebase user profile.
  await updateProfile(credential.user, { displayName: fullName.trim() })
  return credential.user
}

export async function loginWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider()
  const credential = await signInWithPopup(auth, provider)
  return credential.user
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim())
}

export async function logout(): Promise<void> {
  await signOut(auth)
}
