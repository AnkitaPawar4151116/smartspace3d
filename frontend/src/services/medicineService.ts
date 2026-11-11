import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import type { Unsubscribe } from 'firebase/firestore'
import { sampleCartonSpecs } from '../data/demoInventory'
import { db } from '../db'
import type { MedicineInput, MedicineRecord } from '../types/medicine'
import { newHistory } from './historyService'
import type { Actor } from './historyService'

const medicinesRef = collection(db, 'medicines')

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

// Live list of the medicine catalogue.
export function subscribeMedicines(
  onData: (list: MedicineRecord[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    query(medicinesRef, orderBy('name')),
    (snapshot) => {
      onData(
        snapshot.docs.map((item) => {
          const data = item.data()
          return {
            id: item.id,
            name: String(data.name ?? ''),
            unitsPerCarton: numberOr(data.unitsPerCarton, 1),
            cartonLengthCm: numberOr(data.cartonLengthCm, 0),
            cartonWidthCm: numberOr(data.cartonWidthCm, 0),
            cartonHeightCm: numberOr(data.cartonHeightCm, 0),
            cartonWeightKg: numberOr(data.cartonWeightKg, 0),
            maxStack: numberOr(data.maxStack, 1),
            fragile: data.fragile === true,
            thisSideUp: data.thisSideUp === true,
            reorderLevelCartons: numberOr(data.reorderLevelCartons, 0),
          }
        }),
      )
    },
    onError,
  )
}

export async function addMedicine(input: MedicineInput, adminUid: string): Promise<void> {
  await addDoc(medicinesRef, {
    name: input.name.trim(),
    unitsPerCarton: input.unitsPerCarton,
    cartonLengthCm: input.cartonLengthCm,
    cartonWidthCm: input.cartonWidthCm,
    cartonHeightCm: input.cartonHeightCm,
    cartonWeightKg: input.cartonWeightKg,
    maxStack: input.maxStack,
    fragile: input.fragile,
    thisSideUp: input.thisSideUp,
    reorderLevelCartons: input.reorderLevelCartons,
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  })
}

export async function updateMedicine(id: string, input: MedicineInput, actor: Actor): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, 'medicines', id), {
    name: input.name.trim(),
    unitsPerCarton: input.unitsPerCarton,
    cartonLengthCm: input.cartonLengthCm,
    cartonWidthCm: input.cartonWidthCm,
    cartonHeightCm: input.cartonHeightCm,
    cartonWeightKg: input.cartonWeightKg,
    maxStack: input.maxStack,
    fragile: input.fragile,
    thisSideUp: input.thisSideUp,
    reorderLevelCartons: input.reorderLevelCartons,
  })
  const history = newHistory(actor, 'medicine_edited', `Edited medicine ${input.name.trim()}`)
  batch.set(history.ref, history.data)
  await batch.commit()
}

export async function removeMedicine(medicine: MedicineRecord, actor: Actor): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'medicines', medicine.id))
  const history = newHistory(actor, 'medicine_removed', `Removed medicine ${medicine.name}`)
  batch.set(history.ref, history.data)
  await batch.commit()
}

// Adds 4 sample medicines with made-up carton sizes, handy for a demo.
export async function addSampleMedicines(adminUid: string): Promise<void> {
  const batch = writeBatch(db)
  for (const spec of sampleCartonSpecs) {
    batch.set(doc(medicinesRef), { ...spec, reorderLevelCartons: spec.reorderLevelCartons ?? 0, createdBy: adminUid, createdAt: serverTimestamp() })
  }
  await batch.commit()
}
