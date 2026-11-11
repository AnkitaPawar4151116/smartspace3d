export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

// One stock batch an order takes cartons from.
export interface OrderLine {
  stockId: string
  warehouseId: string
  batchNo: string
  cartons: number
}

export interface OrderRecord {
  id: string
  userId: string
  userEmail: string
  medicineId: string
  medicineName: string
  units: number
  cartons: number
  lat: number
  lng: number
  status: OrderStatus
  note: string // written by the user
  reply: string // written by the admin when rejecting
  lines: OrderLine[] // filled when approved
  createdAtMs: number | null
  decidedAtMs: number | null
}

export interface HistoryRecord {
  id: string
  action: string
  summary: string
  actorEmail: string
  createdAtMs: number | null
}

// A batch moved from one warehouse to another (recorded for the SDG impact numbers).
export interface TransferRecord {
  id: string
  medicineName: string
  cartons: number
  units: number
  daysLeft: number // days to expiry when it was moved
  fromName: string
  toName: string
  createdAtMs: number | null
}
