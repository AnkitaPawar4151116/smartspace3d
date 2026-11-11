import { FirebaseError } from 'firebase/app'

// Friendly messages for Firestore errors (never shows raw error text).
export function getDataErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to do that.'
      case 'unavailable':
      case 'deadline-exceeded':
        return 'Cannot reach the database. Check your internet connection and try again.'
      case 'unauthenticated':
        return 'Please sign in again.'
      case 'failed-precondition':
        return 'The database is not fully set up yet.'
      default:
        return 'Something went wrong while talking to the database.'
    }
  }
  return 'Something went wrong. Please try again.'
}
