// Numbers for the SDG impact page. Pure logic. Everything is counted from this system's own data.
import type { MedicineRecord } from '../types/medicine.ts'
import type { OrderRecord, TransferRecord } from '../types/order.ts'
import type { StockRecord } from '../types/stock.ts'
import { daysUntil } from './expiry.ts'
import { findLowStock } from './lowStock.ts'

export interface ImpactInput {
  warehouseCount: number
  rackWarehouses: number
  averageUtilizationPct: number | null
  medicines: MedicineRecord[]
  stock: StockRecord[]
  orders: OrderRecord[] | null // null = the viewer may not see orders (not an admin)
  transfers: TransferRecord[]
  today?: Date
}

export interface Impact {
  sdg3: {
    medicinesTracked: number
    warehouses: number
    usableUnits: number
    lowStockMedicines: number
    approvedOrders: number | null
    deliveredUnits: number | null
    pendingOrders: number | null
  }
  sdg12: {
    totalCartons: number
    expiredCartons: number
    expiredUnits: number
    wasteRatePct: number
    atRiskCartons: number // expires within 90 days
    atRiskUnits: number
    transfers: number
    rescuedCartons: number // moved while still usable and within 90 days of expiry
    rescuedUnits: number
  }
  sdg9: {
    warehouses: number
    rackWarehouses: number
    averageUtilizationPct: number | null
  }
}

export function computeImpact(input: ImpactInput): Impact {
  const today = input.today ?? new Date()
  const unitsPer = new Map(input.medicines.map((medicine) => [medicine.id, medicine.unitsPerCarton]))

  let usableUnits = 0
  let totalCartons = 0
  let expiredCartons = 0
  let expiredUnits = 0
  let atRiskCartons = 0
  let atRiskUnits = 0
  for (const item of input.stock) {
    const units = (unitsPer.get(item.medicineId) ?? 0) * item.cartons
    totalCartons += item.cartons
    const days = daysUntil(item.expiryDate, today)
    if (days < 0) {
      expiredCartons += item.cartons
      expiredUnits += units
    } else {
      usableUnits += units
      if (days <= 90) {
        atRiskCartons += item.cartons
        atRiskUnits += units
      }
    }
  }

  const rescued = input.transfers.filter((transfer) => transfer.daysLeft >= 0 && transfer.daysLeft <= 90)
  const approved = input.orders?.filter((order) => order.status === 'approved') ?? null

  return {
    sdg3: {
      medicinesTracked: input.medicines.length,
      warehouses: input.warehouseCount,
      usableUnits,
      lowStockMedicines: findLowStock(input.medicines, input.stock, today).length,
      approvedOrders: approved ? approved.length : null,
      deliveredUnits: approved ? approved.reduce((sum, order) => sum + order.units, 0) : null,
      pendingOrders: input.orders ? input.orders.filter((order) => order.status === 'pending').length : null,
    },
    sdg12: {
      totalCartons,
      expiredCartons,
      expiredUnits,
      wasteRatePct: totalCartons > 0 ? (expiredCartons / totalCartons) * 100 : 0,
      atRiskCartons,
      atRiskUnits,
      transfers: input.transfers.length,
      rescuedCartons: rescued.reduce((sum, transfer) => sum + transfer.cartons, 0),
      rescuedUnits: rescued.reduce((sum, transfer) => sum + transfer.units, 0),
    },
    sdg9: {
      warehouses: input.warehouseCount,
      rackWarehouses: input.rackWarehouses,
      averageUtilizationPct: input.averageUtilizationPct,
    },
  }
}
