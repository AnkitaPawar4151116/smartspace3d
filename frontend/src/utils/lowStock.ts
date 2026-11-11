// Medicines whose usable stock (all warehouses together, not expired) is below their low-stock level.
import type { MedicineRecord } from '../types/medicine.ts'
import type { StockRecord } from '../types/stock.ts'
import { daysUntil } from './expiry.ts'

export interface LowStockItem {
  medicine: MedicineRecord
  usableCartons: number
  levelCartons: number
  shortfallCartons: number
  usableUnits: number
  out: boolean // nothing usable left
}

export function findLowStock(medicines: MedicineRecord[], stock: StockRecord[], today: Date = new Date()): LowStockItem[] {
  const usable = new Map<string, number>()
  for (const item of stock) {
    if (item.cartons > 0 && daysUntil(item.expiryDate, today) >= 0) {
      usable.set(item.medicineId, (usable.get(item.medicineId) ?? 0) + item.cartons)
    }
  }
  const list: LowStockItem[] = []
  for (const medicine of medicines) {
    const level = medicine.reorderLevelCartons ?? 0
    if (level <= 0) continue
    const cartons = usable.get(medicine.id) ?? 0
    if (cartons >= level) continue
    list.push({
      medicine,
      usableCartons: cartons,
      levelCartons: level,
      shortfallCartons: level - cartons,
      usableUnits: cartons * medicine.unitsPerCarton,
      out: cartons === 0,
    })
  }
  // emptiest first (relative to the level)
  list.sort((a, b) => a.usableCartons / a.levelCartons - b.usableCartons / b.levelCartons)
  return list
}
