// One batch of one medicine stored in one warehouse.
export interface StockRecord {
  id: string
  warehouseId: string
  medicineId: string
  cartons: number
  batchNo: string
  expiryDate: string // "YYYY-MM-DD"
}

export type StockInput = Omit<StockRecord, 'id'>
