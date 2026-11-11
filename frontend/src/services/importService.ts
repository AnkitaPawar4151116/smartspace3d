import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db } from '../db'
import type { MedicineInput } from '../types/medicine'
import type { StockInput } from '../types/stock'

// Firestore allows at most 500 writes per batch, so big imports are saved in groups of 400.
const CHUNK = 400

export interface ImportOutcome {
  saved: number
  failed: number
  error: unknown | null
}

async function saveInChunks<T>(items: T[], collectionName: string, toDoc: (item: T) => Record<string, unknown>, adminUid: string): Promise<ImportOutcome> {
  const ref = collection(db, collectionName)
  let saved = 0
  for (let start = 0; start < items.length; start += CHUNK) {
    const chunk = items.slice(start, start + CHUNK)
    const batch = writeBatch(db)
    for (const item of chunk) {
      batch.set(doc(ref), { ...toDoc(item), createdBy: adminUid, createdAt: serverTimestamp() })
    }
    try {
      await batch.commit() // a group is saved completely or not at all
      saved += chunk.length
    } catch (error) {
      return { saved, failed: items.length - saved, error }
    }
  }
  return { saved, failed: 0, error: null }
}

export function importMedicines(items: MedicineInput[], adminUid: string): Promise<ImportOutcome> {
  return saveInChunks(
    items,
    'medicines',
    (item) => ({
      name: item.name.trim(),
      unitsPerCarton: item.unitsPerCarton,
      cartonLengthCm: item.cartonLengthCm,
      cartonWidthCm: item.cartonWidthCm,
      cartonHeightCm: item.cartonHeightCm,
      cartonWeightKg: item.cartonWeightKg,
      maxStack: item.maxStack,
      fragile: item.fragile,
      thisSideUp: item.thisSideUp,
      reorderLevelCartons: item.reorderLevelCartons,
    }),
    adminUid,
  )
}

export function importStock(items: StockInput[], adminUid: string): Promise<ImportOutcome> {
  return saveInChunks(
    items,
    'stock',
    (item) => ({
      warehouseId: item.warehouseId,
      medicineId: item.medicineId,
      cartons: item.cartons,
      batchNo: item.batchNo.trim(),
      expiryDate: item.expiryDate,
    }),
    adminUid,
  )
}
