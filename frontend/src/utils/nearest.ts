import type { StockEntry, Warehouse } from '../data/demoInventory'

// Straight-line distance between two GPS points, in kilometres (haversine formula).
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface WarehouseOption {
  warehouse: Warehouse
  units: number
  expiresInDays: number
  distance: number
}

export interface FulfilmentPlan {
  // every warehouse that has the medicine, nearest first
  options: WarehouseOption[]
  // nearest single warehouse that can supply the whole quantity (if any)
  singleSource: WarehouseOption | null
  // when no single warehouse is enough: take from the nearest ones in turn
  split: Array<{ option: WarehouseOption; take: number }>
  shortfall: number // units that no warehouse can supply
}

export function planFulfilment(
  warehouses: Warehouse[],
  stock: StockEntry[],
  medicineId: string,
  quantity: number,
  fromLat: number,
  fromLng: number,
): FulfilmentPlan {
  const options: WarehouseOption[] = []

  for (const entry of stock) {
    if (entry.medicineId !== medicineId || entry.units <= 0) continue
    const warehouse = warehouses.find((item) => item.id === entry.warehouseId)
    if (!warehouse) continue
    options.push({
      warehouse,
      units: entry.units,
      expiresInDays: entry.expiresInDays,
      distance: distanceKm(fromLat, fromLng, warehouse.lat, warehouse.lng),
    })
  }

  options.sort((a, b) => a.distance - b.distance)

  const singleSource = options.find((option) => option.units >= quantity) ?? null

  const split: FulfilmentPlan['split'] = []
  let remaining = quantity
  if (!singleSource) {
    for (const option of options) {
      if (remaining <= 0) break
      const take = Math.min(option.units, remaining)
      split.push({ option, take })
      remaining -= take
    }
  }

  return { options, singleSource, split, shortfall: Math.max(0, remaining) }
}
