import type { MedicineRecord } from '../types/medicine'
import type { StockRecord } from '../types/stock'
import { daysUntil } from './expiry.ts'
import type { WarehouseRecord } from '../types/warehouse'
import type { PackBatch, PackRoom } from './packing.ts'

// Turns the stock saved for ONE warehouse into the batches the packing engine needs.
export function buildBatches(
  stock: StockRecord[],
  medicines: MedicineRecord[],
  warehouseId: string,
  today: Date = new Date(),
): PackBatch[] {
  const byId = new Map(medicines.map((item) => [item.id, item]))
  const batches: PackBatch[] = []
  for (const item of stock) {
    if (item.warehouseId !== warehouseId) continue
    const medicine = byId.get(item.medicineId)
    if (!medicine) continue
    batches.push({
      id: item.id,
      medicineId: medicine.id,
      label: medicine.name,
      batchNo: item.batchNo,
      expiryDate: item.expiryDate,
      expiryDays: daysUntil(item.expiryDate, today),
      cartons: item.cartons,
      lengthCm: medicine.cartonLengthCm,
      widthCm: medicine.cartonWidthCm,
      heightCm: medicine.cartonHeightCm,
      maxStack: medicine.maxStack,
      fragile: medicine.fragile,
      thisSideUp: medicine.thisSideUp,
    })
  }
  return batches
}

// The room a warehouse record describes (with racks when shelf levels are 2 or more). Null if no size is set.
export function roomOf(warehouse: WarehouseRecord): PackRoom | null {
  if (warehouse.lengthCm === null || warehouse.widthCm === null || warehouse.heightCm === null) return null
  const room: PackRoom = { lengthCm: warehouse.lengthCm, widthCm: warehouse.widthCm, heightCm: warehouse.heightCm }
  if (warehouse.shelfLevels >= 2) room.racks = { levels: warehouse.shelfLevels, depthCm: warehouse.rackDepthCm, aisleCm: warehouse.aisleCm }
  return room
}
