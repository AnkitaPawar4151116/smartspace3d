import assert from 'node:assert/strict'
import test from 'node:test'
import { checkLines, linesFromPlan } from '../src/utils/orders.ts'
import { planLookup } from '../src/utils/lookup.ts'

const wh = (id: string, lat: number) => ({ id, name: id, city: id, lat, lng: 0, lengthCm: 1000, widthCm: 1000, heightCm: 300 })
const med = { id: 'm', name: 'M', unitsPerCarton: 100, cartonLengthCm: 30, cartonWidthCm: 20, cartonHeightCm: 20, cartonWeightKg: 5, maxStack: 4, fragile: false, thisSideUp: false }
const today = new Date(Date.UTC(2026, 0, 1, 12))

test('plan with enough stock becomes lines with stock ids, earliest expiry first', () => {
  const stock = [
    { id: 's1', warehouseId: 'A', medicineId: 'm', cartons: 3, batchNo: 'late', expiryDate: '2027-06-01' },
    { id: 's2', warehouseId: 'A', medicineId: 'm', cartons: 3, batchNo: 'soon', expiryDate: '2026-03-01' },
  ]
  const plan = planLookup({ warehouses: [wh('A', 0)], stock, medicine: med, units: 500, fromLat: 0, fromLng: 0, today })
  const lines = linesFromPlan(plan)
  assert.deepEqual(lines?.map((l) => [l.stockId, l.cartons]), [['s2', 3], ['s1', 2]])
})

test('a shortfall cannot become an order', () => {
  const stock = [{ id: 's1', warehouseId: 'A', medicineId: 'm', cartons: 2, batchNo: 'x', expiryDate: '2027-01-01' }]
  const plan = planLookup({ warehouses: [wh('A', 0)], stock, medicine: med, units: 1000, fromLat: 0, fromLng: 0, today })
  assert.equal(linesFromPlan(plan), null)
})

test('split across warehouses gives lines from both', () => {
  const stock = [
    { id: 's1', warehouseId: 'A', medicineId: 'm', cartons: 4, batchNo: 'a', expiryDate: '2027-01-01' },
    { id: 's2', warehouseId: 'B', medicineId: 'm', cartons: 4, batchNo: 'b', expiryDate: '2027-01-01' },
  ]
  const plan = planLookup({ warehouses: [wh('A', 0), wh('B', 1)], stock, medicine: med, units: 600, fromLat: 0, fromLng: 0, today })
  assert.deepEqual(linesFromPlan(plan)?.map((l) => [l.warehouseId, l.cartons]), [['A', 4], ['B', 2]])
})

test('checkLines reduces stock and reports zero', () => {
  const r = checkLines(new Map([['s1', 5]]), [{ stockId: 's1', warehouseId: 'A', batchNo: 'x', cartons: 5 }])
  assert.deepEqual(r, { ok: true, changes: [{ stockId: 's1', before: 5, after: 0 }] })
})

test('checkLines refuses to go below zero or use a missing batch', () => {
  const line = { stockId: 's1', warehouseId: 'A', batchNo: 'x', cartons: 5 }
  assert.equal(checkLines(new Map([['s1', 4]]), [line]).ok, false)
  assert.equal(checkLines(new Map(), [line]).ok, false)
  assert.equal(checkLines(new Map([['s1', 4]]), []).ok, false)
})

test('checkLines adds up two lines on the same batch', () => {
  const l = { stockId: 's1', warehouseId: 'A', batchNo: 'x', cartons: 3 }
  assert.equal(checkLines(new Map([['s1', 5]]), [l, l]).ok, false)
})
