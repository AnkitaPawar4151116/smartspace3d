import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { sampleRoomSizesCm, warehouses as sampleWarehouses } from '../data/demoInventory'
import { db } from '../db'
import type { WarehouseInput, WarehouseRecord } from '../types/warehouse'

const warehousesRef = collection(db, 'warehouses')

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Live list: the callback runs now and again whenever a warehouse is added, edited or removed.
export function subscribeWarehouses(
  onData: (list: WarehouseRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(warehousesRef, orderBy('name')),
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            name: String(data.name ?? ''),
            city: String(data.city ?? ''),
            lat: Number(data.lat),
            lng: Number(data.lng),
            lengthCm: numberOrNull(data.lengthCm),
            widthCm: numberOrNull(data.widthCm),
            heightCm: numberOrNull(data.heightCm),
            shelfLevels: numberOrNull(data.shelfLevels) ?? 1,
            rackDepthCm: numberOrNull(data.rackDepthCm) ?? 100,
            aisleCm: numberOrNull(data.aisleCm) ?? 150,
          }
        }),
      )
    },
    onError,
  )
}

export async function addWarehouse(input: WarehouseInput, adminUid: string): Promise<void> {
  await addDoc(warehousesRef, {
    name: input.name.trim(),
    city: input.city.trim(),
    lat: input.lat,
    lng: input.lng,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    shelfLevels: input.shelfLevels,
    rackDepthCm: input.rackDepthCm,
    aisleCm: input.aisleCm,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  })
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<void> {
  await updateDoc(doc(db, 'warehouses', id), {
    name: input.name.trim(),
    city: input.city.trim(),
    lat: input.lat,
    lng: input.lng,
    lengthCm: input.lengthCm,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    shelfLevels: input.shelfLevels,
    rackDepthCm: input.rackDepthCm,
    aisleCm: input.aisleCm,
  })
}

export async function removeWarehouse(id: string): Promise<void> {
  await deleteDoc(doc(db, 'warehouses', id))
}

// Adds the 5 sample warehouses (with made-up room sizes), handy for a demo.
export async function addSampleWarehouses(adminUid: string): Promise<void> {
  const batch = writeBatch(db)
  for (const item of sampleWarehouses) {
    const size = sampleRoomSizesCm[item.id]
    batch.set(doc(warehousesRef), {
      name: item.name,
      city: item.city,
      lat: item.lat,
      lng: item.lng,
      lengthCm: size.lengthCm,
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      shelfLevels: 1,
      rackDepthCm: 100,
      aisleCm: 150,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}
