import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../db'
import type { OrderLine, OrderRecord, OrderStatus } from '../types/order'
import { checkLines } from '../utils/orders'
import { newHistory } from './historyService'
import type { Actor } from './historyService'

const ordersRef = collection(db, 'orders')

// A problem we explain to the person in plain words (not a Firestore error).
export class OrderProblem extends Error {}

function millis(value: unknown): number | null {
  const stamp = value as { toMillis?: () => number } | null
  return stamp && typeof stamp.toMillis === 'function' ? stamp.toMillis() : null
}

const STATUSES: OrderStatus[] = ['pending', 'approved', 'rejected', 'cancelled']

// Admins see every order. Users see only their own (Firestore rules enforce the same).
export function subscribeOrders(
  scope: { uid: string; admin: boolean },
  onData: (list: OrderRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const q = scope.admin ? query(ordersRef) : query(ordersRef, where('userId', '==', scope.uid))
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((item): OrderRecord => {
        const data = item.data()
        const status = STATUSES.includes(data.status) ? (data.status as OrderStatus) : 'pending'
        return {
          id: item.id,
          userId: String(data.userId ?? ''),
          userEmail: String(data.userEmail ?? ''),
          medicineId: String(data.medicineId ?? ''),
          medicineName: String(data.medicineName ?? ''),
          units: Number(data.units) || 0,
          cartons: Number(data.cartons) || 0,
          lat: Number(data.lat) || 0,
          lng: Number(data.lng) || 0,
          status,
          note: String(data.note ?? ''),
          reply: String(data.reply ?? ''),
          lines: Array.isArray(data.lines) ? (data.lines as OrderLine[]) : [],
          createdAtMs: millis(data.createdAt),
          decidedAtMs: millis(data.decidedAt),
        }
      })
      list.sort((a, b) => (b.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (a.createdAtMs ?? Number.MAX_SAFE_INTEGER))
      onData(list)
    },
    onError,
  )
}

export async function createOrder(
  input: { medicineId: string; medicineName: string; units: number; cartons: number; lat: number; lng: number; note: string },
  actor: Actor,
): Promise<void> {
  await addDoc(ordersRef, {
    userId: actor.uid,
    userEmail: actor.email,
    medicineId: input.medicineId,
    medicineName: input.medicineName,
    units: input.units,
    cartons: input.cartons,
    lat: input.lat,
    lng: input.lng,
    status: 'pending',
    note: input.note.trim().slice(0, 200),
    createdAt: serverTimestamp(),
  })
}

// The person who placed the order can cancel it while it is still pending.
export async function cancelOrder(id: string): Promise<void> {
  await updateDoc(doc(db, 'orders', id), { status: 'cancelled' })
}

export async function rejectOrder(order: OrderRecord, reply: string, actor: Actor): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'orders', order.id), {
    status: 'rejected',
    reply: reply.trim().slice(0, 200),
    decidedBy: actor.uid,
    decidedAt: serverTimestamp(),
  })
  const history = newHistory(actor, 'order_rejected', `Rejected order of ${order.units} units of ${order.medicineName} from ${order.userEmail}`)
  batch.set(history.ref, history.data)
  await batch.commit()
}

// Approves an order and takes the cartons out of stock in ONE transaction:
// either everything happens or nothing does, and stock can never go below zero.
export async function approveOrder(order: OrderRecord, lines: OrderLine[], actor: Actor): Promise<void> {
  await runTransaction(db, async (tx) => {
    const orderRef = doc(db, 'orders', order.id)
    const orderSnap = await tx.get(orderRef)
    if (!orderSnap.exists() || orderSnap.data().status !== 'pending') {
      throw new OrderProblem('This order is no longer pending.')
    }

    const ids = [...new Set(lines.map((line) => line.stockId))]
    const snaps = await Promise.all(ids.map((id) => tx.get(doc(db, 'stock', id))))
    const current = new Map<string, number>()
    snaps.forEach((snap, index) => {
      if (snap.exists()) current.set(ids[index], Number(snap.data().cartons) || 0)
    })

    const result = checkLines(current, lines)
    if (!result.ok) throw new OrderProblem(result.error)

    for (const change of result.changes) {
      const ref = doc(db, 'stock', change.stockId)
      if (change.after === 0) tx.delete(ref)
      else tx.update(ref, { cartons: change.after })
    }
    tx.update(orderRef, { status: 'approved', lines, decidedBy: actor.uid, decidedAt: serverTimestamp() })

    const history = newHistory(
      actor,
      'order_approved',
      `Approved order of ${order.units} units (${order.cartons} cartons) of ${order.medicineName} for ${order.userEmail}; stock reduced in ${ids.length} batch(es)`,
    )
    tx.set(history.ref, history.data)
  })
}
