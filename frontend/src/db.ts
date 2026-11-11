import { getFirestore } from 'firebase/firestore'
import app from './firebase'

// One Firestore instance for the whole app (re-uses the Firebase app from firebase.ts).
export const db = getFirestore(app)
