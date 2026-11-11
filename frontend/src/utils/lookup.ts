// "Which warehouse can supply this order?" Pure logic, no React or Firebase.
import type { MedicineRecord } from '../types/medicine.ts'
import type { StockRecord } from '../types/stock.ts'
import type { WarehouseRecord } from '../types/warehouse.ts'
import { daysUntil } from './expiry.ts'
import { distanceKm } from './nearest.ts'

export interface BatchUse {
  stockId: string
  batchNo: string
  expiryDate: string
  expiryDays: number
  cartons: number
}

export interface LookupOption {
  warehouse: WarehouseRecord
  distanceKm: number
  availableCartons: number // not expired
  availableUnits: number
  soonestExpiryDays: number
  batches: BatchUse[] // usable batches, earliest expiry first
}

export interface Draw {
  option: LookupOption
  cartons: number
  units: number
  batches: BatchUse[] // which batches the cartons come from (earliest expiry first)
}

export interface LookupPlan {
  cartonsNeeded: number
  options: LookupOption[] // warehouses holding usable stock, nearest first
  nearestHasEnough: boolean
  singleSource: Draw | null // nearest warehouse that can cover the whole order
  split: Draw[] // used only when no single warehouse can cover it
  shortfallCartons: number
  shortfallUnits: number
  expiredCartons: number // expired stock that was left out
}

// Takes `cartons` from batches, earliest expiry first (FEFO).
function allocate(batches: BatchUse[], cartons: number): BatchUse[] {
  const used: BatchUse[] = []
  let left = cartons
  for (const batch of batches) {
    if (left <= 0) break
    const take = Math.min(batch.cartons, left)
    used.push({ ...batch, cartons: take })
    left -= take
  }
  return used
}

export function planLookup(input: {
  warehouses: WarehouseRecord[]
  stock: StockRecord[]
  medicine: MedicineRecord
  units: number
  fromLat: number
  fromLng: number
  today?: Date
}): LookupPlan {
  const { warehouses, stock, medicine, units, fromLat, fromLng } = input
  const today = input.today ?? new Date()
  const cartonsNeeded = Math.max(1, Math.ceil(units / medicine.unitsPerCarton))

  const options: LookupOption[] = []
  let expiredCartons = 0

  for (const warehouse of warehouses) {
    const batches: BatchUse[] = []
    for (const item of stock) {
      if (item.warehouseId !== warehouse.id || item.medicineId !== medicine.id) continue
      const expiryDays = daysUntil(item.expiryDate, today)
      if (expiryDays < 0) expiredCartons += item.cartons
      else if (item.cartons > 0) batches.push({ stockId: item.id, batchNo: item.batchNo, expiryDate: item.expiryDate, expiryDays, cartons: item.cartons })
    }
    if (batches.length === 0) continue
    batches.sort((a, b) => a.expiryDays - b.expiryDays)
    const availableCartons = batches.reduce((sum, batch) => sum + batch.cartons, 0)
    options.push({
      warehouse,
      distanceKm: distanceKm(fromLat, fromLng, warehouse.lat, warehouse.lng),
      availableCartons,
      availableUnits: availableCartons * medicine.unitsPerCarton,
      soonestExpiryDays: batches[0].expiryDays,
      batches,
    })
  }
  options.sort((a, b) => a.distanceKm - b.distanceKm)

  const drawFrom = (option: LookupOption, cartons: number): Draw => ({
    option,
    cartons,
    units: cartons * medicine.unitsPerCarton,
    batches: allocate(option.batches, cartons),
  })

  const enough = options.find((option) => option.availableCartons >= cartonsNeeded)
  const singleSource = enough ? drawFrom(enough, cartonsNeeded) : null

  const split: Draw[] = []
  let remaining = cartonsNeeded
  if (!singleSource) {
    for (const option of options) {
      if (remaining <= 0) break
      const take = Math.min(option.availableCartons, remaining)
      split.push(drawFrom(option, take))
      remaining -= take
    }
  }
  const shortfallCartons = singleSource ? 0 : Math.max(0, remaining)

  return {
    cartonsNeeded,
    options,
    nearestHasEnough: options.length > 0 && options[0].availableCartons >= cartonsNeeded,
    singleSource,
    split,
    shortfallCartons,
    shortfallUnits: shortfallCartons * medicine.unitsPerCarton,
    expiredCartons,
  }
}
