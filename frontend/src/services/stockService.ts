import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { db } from '../db'
import type { MedicineRecord } from '../types/medicine'
import type { StockInput, StockRecord } from '../types/stock'
import type { WarehouseRecord } from '../types/warehouse'
import { dateInDays, daysUntil } from '../utils/expiry'
import { findMergeTarget } from '../utils/transfer'
import { newHistory } from './historyService'
import type { Actor } from './historyService'

const stockRef = collection(db, 'stock')

// Live list of all stock batches (sorted in the browser, so no extra Firestore index is needed).
export function subscribeStock(
  onData: (list: StockRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(stockRef),
    (snapshot) => {
      const list = snapshot.docs.map((item) => {
        const data = item.data()
        return {
          id: item.id,
          warehouseId: String(data.warehouseId ?? ''),
          medicineId: String(data.medicineId ?? ''),
          cartons: Number(data.cartons) || 0,
          batchNo: String(data.batchNo ?? ''),
          expiryDate: String(data.expiryDate ?? ''),
        }
      })
      list.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
      onData(list)
    },
    onError,
  )
}

// `label` describes the batch for the history log, e.g. "Paracetamol 500 mg at Pune Store".
export async function addStock(input: StockInput, actor: Actor, label: string): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(stockRef), {
    warehouseId: input.warehouseId,
    medicineId: input.medicineId,
    cartons: input.cartons,
    batchNo: input.batchNo.trim(),
    expiryDate: input.expiryDate,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
  })
  const history = newHistory(actor, 'stock_added', `Added batch ${input.batchNo.trim()}: ${input.cartons} cartons, expiry ${input.expiryDate} (${label})`)
  batch.set(history.ref, history.data)
  await batch.commit()
}

// Edit the quantity, batch number or expiry of a batch (the medicine and warehouse stay the same).
export async function updateStock(
  before: StockRecord,
  next: { cartons: number; batchNo: string; expiryDate: string },
  actor: Actor,
  label: string,
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'stock', before.id), {
    cartons: next.cartons,
    batchNo: next.batchNo.trim(),
    expiryDate: next.expiryDate,
  })
  const history = newHistory(
    actor,
    'stock_edited',
    `Edited batch ${before.batchNo} (${label}): cartons ${before.cartons} to ${next.cartons}, batch ${before.batchNo} to ${next.batchNo.trim()}, expiry ${before.expiryDate} to ${next.expiryDate}`,
  )
  batch.set(history.ref, history.data)
  await batch.commit()
}

export async function removeStock(before: StockRecord, actor: Actor, label: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'stock', before.id))
  const history = newHistory(actor, 'stock_removed', `Removed batch ${before.batchNo} with ${before.cartons} cartons (${label})`)
  batch.set(history.ref, history.data)
  await batch.commit()
}

// A problem to show to the person in plain words.
export class TransferProblem extends Error {}

// Moves a whole batch to another warehouse in one transaction. If the target already holds the
// same batch (same medicine, batch number and expiry), the cartons are added to it.
export async function transferBatch(
  item: StockRecord,
  targetWarehouseId: string,
  allStock: StockRecord[],
  actor: Actor,
  details: { medicine: MedicineRecord; fromName: string; toName: string },
): Promise<void> {
  const label = `${details.medicine.name} from ${details.fromName}`
  const targetName = details.toName
  const sourceRef = doc(db, 'stock', item.id)
  const merge = findMergeTarget(allStock, item, targetWarehouseId)
  await runTransaction(db, async (tx) => {
    const sourceSnap = await tx.get(sourceRef)
    if (!sourceSnap.exists()) throw new TransferProblem('This batch no longer exists.')
    const cartons = Number(sourceSnap.data().cartons) || 0
    if (cartons <= 0 || cartons !== item.cartons) {
      throw new TransferProblem('The quantity of this batch changed. Review it and try again.')
    }
    let targetCartons = 0
    const mergeRef = merge ? doc(db, 'stock', merge.id) : null
    if (mergeRef) {
      const mergeSnap = await tx.get(mergeRef)
      if (!mergeSnap.exists()) throw new TransferProblem('The target batch no longer exists. Review and try again.')
      targetCartons = Number(mergeSnap.data().cartons) || 0
      if (targetCartons + cartons > 100000) throw new TransferProblem('The target batch would become too large.')
    }

    tx.delete(sourceRef)
    if (mergeRef) {
      tx.update(mergeRef, { cartons: targetCartons + cartons })
    } else {
      tx.set(doc(stockRef), {
        warehouseId: targetWarehouseId,
        medicineId: item.medicineId,
        cartons,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
      })
    }
    const history = newHistory(actor, 'stock_transferred', `Moved batch ${item.batchNo}: ${cartons} cartons (${label}) to ${targetName}`)
    tx.set(history.ref, history.data)
    // Recorded so the SDG impact page can show how much near-expiry stock was moved.
    tx.set(doc(collection(db, 'transfers')), {
      medicineId: item.medicineId,
      medicineName: details.medicine.name,
      cartons,
      units: cartons * details.medicine.unitsPerCarton,
      daysLeft: daysUntil(item.expiryDate),
      fromName: details.fromName,
      toName: details.toName,
      createdBy: actor.uid,
      createdAt: serverTimestamp(),
    })
  })
}

// Demo helper: fills about 30% of each warehouse room with made-up batches.
export async function addSampleStock(
  warehouses: WarehouseRecord[],
  medicines: MedicineRecord[],
  adminUid: string,
): Promise<number> {
  const expiryDays = [40, 180, 365, 90]
  const batch = writeBatch(db)
  let count = 0

  warehouses.forEach((warehouse, wIndex) => {
    if (warehouse.lengthCm === null || warehouse.widthCm === null || warehouse.heightCm === null) return
    const roomVolume = warehouse.lengthCm * warehouse.widthCm * warehouse.heightCm
    medicines.forEach((medicine, mIndex) => {
      const cartonVolume = medicine.cartonLengthCm * medicine.cartonWidthCm * medicine.cartonHeightCm
      if (cartonVolume <= 0) return
      const cartons = Math.max(1, Math.min(400, Math.floor((roomVolume * 0.3) / medicines.length / cartonVolume)))
      batch.set(doc(stockRef), {
        warehouseId: warehouse.id,
        medicineId: medicine.id,
        cartons,
        batchNo: `B${wIndex + 1}-${mIndex + 1}`,
        expiryDate: dateInDays(expiryDays[(wIndex + mIndex) % expiryDays.length]),
        createdBy: adminUid,
        createdAt: serverTimestamp(),
      })
      count += 1
    })
  })

  if (count > 0) await batch.commit()
  return count
}
