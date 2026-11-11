import type { StockRecord } from '../types/stock.ts'

// An existing batch at the target warehouse that is the same batch (medicine, batch number, expiry).
export function findMergeTarget(stock: StockRecord[], item: StockRecord, targetWarehouseId: string): StockRecord | null {
  return (
    stock.find(
      (other) =>
        other.id !== item.id &&
        other.warehouseId === targetWarehouseId &&
        other.medicineId === item.medicineId &&
        other.batchNo === item.batchNo &&
        other.expiryDate === item.expiryDate,
    ) ?? null
  )
}
