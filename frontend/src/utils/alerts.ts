// Waste alerts: which batches are close to expiry, and where they could be moved.
// Pure logic, no React or Firebase.
import type { MedicineRecord } from '../types/medicine.ts'
import type { StockRecord } from '../types/stock.ts'
import type { WarehouseRecord } from '../types/warehouse.ts'
import { daysUntil } from './expiry.ts'
import { distanceKm } from './nearest.ts'
import { packWarehouse } from './packing.ts'
import { buildBatches, roomOf } from './packingInput.ts'

export type Risk = 'expired' | 'd30' | 'd60' | 'd90'

export const RISK_LABEL: Record<Risk, string> = {
  expired: 'Expired',
  d30: 'Within 30 days',
  d60: '31 to 60 days',
  d90: '61 to 90 days',
}

export function classifyRisk(days: number): Risk | null {
  if (days < 0) return 'expired'
  if (days <= 30) return 'd30'
  if (days <= 60) return 'd60'
  if (days <= 90) return 'd90'
  return null
}

export interface AtRiskBatch {
  stock: StockRecord
  medicine: MedicineRecord
  warehouse: WarehouseRecord
  expiryDays: number
  risk: Risk
  units: number
}

export interface TransferSuggestion {
  warehouse: WarehouseRecord
  distanceKm: number
}

// All batches expiring within 90 days (or already expired), most urgent first.
export function findAtRisk(
  stock: StockRecord[],
  medicines: MedicineRecord[],
  warehouses: WarehouseRecord[],
  today: Date = new Date(),
): AtRiskBatch[] {
  const medicineById = new Map(medicines.map((item) => [item.id, item]))
  const warehouseById = new Map(warehouses.map((item) => [item.id, item]))
  const list: AtRiskBatch[] = []
  for (const item of stock) {
    const medicine = medicineById.get(item.medicineId)
    const warehouse = warehouseById.get(item.warehouseId)
    if (!medicine || !warehouse || item.cartons <= 0) continue
    const expiryDays = daysUntil(item.expiryDate, today)
    const risk = classifyRisk(expiryDays)
    if (!risk) continue
    list.push({ stock: item, medicine, warehouse, expiryDays, risk, units: item.cartons * medicine.unitsPerCarton })
  }
  return list.sort((a, b) => a.expiryDays - b.expiryDays)
}

export function summarizeRisk(list: AtRiskBatch[]): Record<Risk, { batches: number; cartons: number; units: number }> {
  const summary = {
    expired: { batches: 0, cartons: 0, units: 0 },
    d30: { batches: 0, cartons: 0, units: 0 },
    d60: { batches: 0, cartons: 0, units: 0 },
    d90: { batches: 0, cartons: 0, units: 0 },
  }
  for (const item of list) {
    summary[item.risk].batches += 1
    summary[item.risk].cartons += item.stock.cartons
    summary[item.risk].units += item.units
  }
  return summary
}

// For each batch that is not expired yet: the nearest OTHER warehouse that still has room for all of it.
// "Room" is decided by the real packing engine (so room size, stack limits and fragile rules count).
export function suggestTransfers(
  atRisk: AtRiskBatch[],
  stock: StockRecord[],
  medicines: MedicineRecord[],
  warehouses: WarehouseRecord[],
  today: Date = new Date(),
  limit = 15,
  maxCandidates = 5,
): Map<string, TransferSuggestion | null> {
  const result = new Map<string, TransferSuggestion | null>()
  const placedBefore = new Map<string, number>() // cached: cartons already packed in each warehouse

  for (const item of atRisk.filter((entry) => entry.risk !== 'expired').slice(0, limit)) {
    const candidates = warehouses
      .filter((w) => w.id !== item.warehouse.id && roomOf(w) !== null)
      .map((w) => ({ warehouse: w, distance: distanceKm(item.warehouse.lat, item.warehouse.lng, w.lat, w.lng) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxCandidates)

    let found: TransferSuggestion | null = null
    for (const { warehouse, distance } of candidates) {
      const room = roomOf(warehouse)
      if (!room) continue
      const existing = buildBatches(stock, medicines, warehouse.id, today)
      if (!placedBefore.has(warehouse.id)) placedBefore.set(warehouse.id, packWarehouse(room, existing).cartonsPlaced)
      const moved = buildBatches([{ ...item.stock, warehouseId: warehouse.id }], medicines, warehouse.id, today)
      const after = packWarehouse(room, [...existing, ...moved]).cartonsPlaced
      if (after - (placedBefore.get(warehouse.id) ?? 0) === item.stock.cartons) {
        found = { warehouse, distanceKm: distance }
        break
      }
    }
    result.set(item.stock.id, found)
  }
  return result
}
