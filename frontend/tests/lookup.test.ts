import assert from 'node:assert/strict'
import { test } from 'node:test'
import { planLookup } from '../src/utils/lookup.ts'

const wh = (id: string, lat: number, lng: number) => ({ id, name: id, city: id, lat, lng, lengthCm: 1000, widthCm: 1000, heightCm: 400 })
// user stands at (0,0); A is nearest, then B, then C
const warehouses = [wh('C', 0, 3), wh('A', 0, 1), wh('B', 0, 2)]
const medicine = { id: 'm', name: 'Med', unitsPerCarton: 100, cartonLengthCm: 40, cartonWidthCm: 30, cartonHeightCm: 20, cartonWeightKg: 5, maxStack: 4, fragile: false, thisSideUp: false }
const today = new Date(2026, 5, 1)
const st = (id: string, warehouseId: string, cartons: number, expiryDate: string) => ({ id, warehouseId, medicineId: 'm', cartons, batchNo: id, expiryDate })
const plan = (units: number, stock: ReturnType<typeof st>[]) => planLookup({ warehouses, stock, medicine, units, fromLat: 0, fromLng: 0, today })

test('units are converted to whole cartons (rounded up)', () => {
  assert.equal(plan(1200, []).cartonsNeeded, 12)
  assert.equal(plan(1201, []).cartonsNeeded, 13)
})

test('the nearest warehouse is used when it has enough', () => {
  const r = plan(1200, [st('a', 'A', 20, '2027-01-01'), st('b', 'B', 50, '2027-01-01')])
  assert.equal(r.singleSource?.option.warehouse.id, 'A')
  assert.equal(r.nearestHasEnough, true)
})

test('when the nearest is short, the next nearest that can cover it is chosen', () => {
  const r = plan(1200, [st('a', 'A', 5, '2027-01-01'), st('b', 'B', 12, '2027-01-01'), st('c', 'C', 99, '2027-01-01')])
  assert.equal(r.singleSource?.option.warehouse.id, 'B')
  assert.equal(r.nearestHasEnough, false)
  assert.equal(r.split.length, 0)
})

test('when nobody can cover it alone, the order is split nearest-first and the shortfall is shown', () => {
  const r = plan(1200, [st('a', 'A', 5, '2027-01-01'), st('b', 'B', 4, '2027-01-01'), st('c', 'C', 1, '2027-01-01')])
  assert.equal(r.singleSource, null)
  assert.deepEqual(r.split.map((d) => [d.option.warehouse.id, d.cartons]), [['A', 5], ['B', 4], ['C', 1]])
  assert.equal(r.shortfallCartons, 2)
  assert.equal(r.shortfallUnits, 200)
})

test('expired stock is never offered', () => {
  const r = plan(100, [st('a', 'A', 50, '2026-05-01'), st('b', 'B', 3, '2027-01-01')])
  assert.equal(r.singleSource?.option.warehouse.id, 'B')
  assert.equal(r.expiredCartons, 50)
})

test('inside a warehouse the earliest expiry is used first', () => {
  const r = plan(500, [st('late', 'A', 10, '2028-01-01'), st('soon', 'A', 3, '2026-07-01')])
  assert.deepEqual(r.singleSource?.batches.map((b) => [b.batchNo, b.cartons]), [['soon', 3], ['late', 2]])
})
