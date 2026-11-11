// Pure order logic: turn a lookup plan into stock lines, and check them against current stock.
import type { OrderLine } from '../types/order.ts'
import type { LookupPlan } from './lookup.ts'

// The batches an order would take. Null when the plan cannot cover the whole order.
export function linesFromPlan(plan: LookupPlan): OrderLine[] | null {
  if (plan.shortfallCartons > 0) return null
  const draws = plan.singleSource ? [plan.singleSource] : plan.split
  const lines = draws.flatMap((draw) =>
    draw.batches.map((batch) => ({
      stockId: batch.stockId,
      warehouseId: draw.option.warehouse.id,
      batchNo: batch.batchNo,
      cartons: batch.cartons,
    })),
  )
  return lines.length > 0 ? lines : null
}

export interface StockChange {
  stockId: string
  before: number
  after: number
}

export type LineCheck = { ok: true; changes: StockChange[] } | { ok: false; error: string }

// `current` maps stock id -> cartons right now. Never lets a batch go below zero.
export function checkLines(current: Map<string, number>, lines: OrderLine[]): LineCheck {
  if (lines.length === 0) return { ok: false, error: 'The order has no batches to take stock from.' }
  const need = new Map<string, { cartons: number; batchNo: string }>()
  for (const line of lines) {
    if (!Number.isInteger(line.cartons) || line.cartons <= 0) return { ok: false, error: `Batch ${line.batchNo} has an invalid quantity.` }
    const entry = need.get(line.stockId) ?? { cartons: 0, batchNo: line.batchNo }
    entry.cartons += line.cartons
    need.set(line.stockId, entry)
  }
  const changes: StockChange[] = []
  for (const [stockId, entry] of need) {
    const before = current.get(stockId)
    if (before === undefined) return { ok: false, error: `Batch ${entry.batchNo} no longer exists. Review the order again.` }
    if (before < entry.cartons) return { ok: false, error: `Batch ${entry.batchNo} now has only ${before} cartons (needed ${entry.cartons}). Review the order again.` }
    changes.push({ stockId, before, after: before - entry.cartons })
  }
  return { ok: true, changes }
}
