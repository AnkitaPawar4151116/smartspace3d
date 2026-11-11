// Numbers for the dashboard. Pure logic, no React or Firebase.
import type { MedicineRecord } from '../types/medicine.ts'
import type { StockRecord } from '../types/stock.ts'
import type { WarehouseRecord } from '../types/warehouse.ts'
import { daysUntil } from './expiry.ts'
import { packWarehouse } from './packing.ts'
import { buildBatches, roomOf } from './packingInput.ts'

export interface WarehouseUse {
  id: string
  name: string
  cartons: number
  utilizationPct: number | null // null when the room size is not set
  unplaced: number
}

export interface DashboardStats {
  totalCartons: number
  totalUnits: number
  perWarehouse: WarehouseUse[]
  averageUtilizationPct: number | null
  // cartons by remaining shelf life
  expiry: { expired: number; d30: number; d90: number; ok: number }
  atRiskBatches: number // expired or expiring within 90 days
}

export function computeDashboard(
  warehouses: WarehouseRecord[],
  medicines: MedicineRecord[],
  stock: StockRecord[],
  today: Date = new Date(),
): DashboardStats {
  const unitsPerCarton = new Map(medicines.map((item) => [item.id, item.unitsPerCarton]))
  const expiry = { expired: 0, d30: 0, d90: 0, ok: 0 }
  let totalCartons = 0
  let totalUnits = 0
  let atRiskBatches = 0

  for (const item of stock) {
    const units = unitsPerCarton.get(item.medicineId)
    if (units === undefined) continue
    totalCartons += item.cartons
    totalUnits += item.cartons * units
    const days = daysUntil(item.expiryDate, today)
    if (days < 0) expiry.expired += item.cartons
    else if (days <= 30) expiry.d30 += item.cartons
    else if (days <= 90) expiry.d90 += item.cartons
    else expiry.ok += item.cartons
    if (days <= 90) atRiskBatches += 1
  }

  const perWarehouse: WarehouseUse[] = warehouses.map((warehouse) => {
    const batches = buildBatches(stock, medicines, warehouse.id, today)
    const cartons = batches.reduce((sum, batch) => sum + batch.cartons, 0)
    const room = roomOf(warehouse)
    if (!room) {
      return { id: warehouse.id, name: warehouse.name, cartons, utilizationPct: null, unplaced: 0 }
    }
    const result = packWarehouse(room, batches)
    return {
      id: warehouse.id,
      name: warehouse.name,
      cartons,
      utilizationPct: result.utilizationPct,
      unplaced: result.cartonsTotal - result.cartonsPlaced,
    }
  })

  const measured = perWarehouse.filter((item) => item.utilizationPct !== null)
  const averageUtilizationPct =
    measured.length === 0 ? null : measured.reduce((sum, item) => sum + (item.utilizationPct ?? 0), 0) / measured.length

  return { totalCartons, totalUnits, perWarehouse, averageUtilizationPct, expiry, atRiskBatches }
}
