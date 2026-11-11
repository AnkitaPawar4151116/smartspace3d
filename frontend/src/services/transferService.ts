import { collection, onSnapshot, query } from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../db'
import type { TransferRecord } from '../types/order'

export const transfersRef = collection(db, 'transfers')

export function subscribeTransfers(
  onData: (list: TransferRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(transfersRef),
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => {
          const data = item.data()
          const created = data.createdAt
          return {
            id: item.id,
            medicineName: String(data.medicineName ?? ''),
            cartons: Number(data.cartons) || 0,
            units: Number(data.units) || 0,
            daysLeft: Number(data.daysLeft) || 0,
            fromName: String(data.fromName ?? ''),
            toName: String(data.toName ?? ''),
            createdAtMs: created && typeof created.toMillis === 'function' ? created.toMillis() : null,
          }
        }),
      )
    },
    onError,
  )
}
