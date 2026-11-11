import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../db'
import type { HistoryRecord } from '../types/order'

export interface Actor {
  uid: string
  email: string
}

const historyRef = collection(db, 'history')

// A new history document reference and its data, to be written together with the change itself.
export function newHistory(actor: Actor, action: string, summary: string) {
  return {
    ref: doc(historyRef),
    data: {
      action,
      summary: summary.slice(0, 300),
      actorUid: actor.uid,
      actorEmail: actor.email.slice(0, 120),
      createdAt: serverTimestamp(),
    },
  }
}

// The latest 150 changes (admin only; Firestore rules enforce this).
export function subscribeHistory(
  onData: (list: HistoryRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(historyRef, orderBy('createdAt', 'desc'), limit(150)),
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => {
          const data = item.data()
          const created = data.createdAt
          return {
            id: item.id,
            action: String(data.action ?? ''),
            summary: String(data.summary ?? ''),
            actorEmail: String(data.actorEmail ?? ''),
            createdAtMs: created && typeof created.toMillis === 'function' ? created.toMillis() : null,
          }
        }),
      )
    },
    onError,
  )
}
