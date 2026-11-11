import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyRisk, findAtRisk, suggestTransfers, summarizeRisk } from '../src/utils/alerts.ts'
import { computeDashboard } from '../src/utils/dashboardStats.ts'

const today = new Date(2026, 5, 1)
const wh = (id: string, lng: number, l = 1000, w = 1000, h = 400) => ({ id, name: id, city: id, lat: 0, lng, lengthCm: l, widthCm: w, heightCm: h })
const med = { id: 'm', name: 'Med', unitsPerCarton: 10, cartonLengthCm: 40, cartonWidthCm: 30, cartonHeightCm: 20, cartonWeightKg: 5, maxStack: 4, fragile: false, thisSideUp: false }
const st = (id: string, warehouseId: string, cartons: number, expiryDate: string) => ({ id, warehouseId, medicineId: 'm', cartons, batchNo: id, expiryDate })

test('risk bands', () => {
  assert.equal(classifyRisk(-1), 'expired')
  assert.equal(classifyRisk(0), 'd30')
  assert.equal(classifyRisk(30), 'd30')
  assert.equal(classifyRisk(31), 'd60')
  assert.equal(classifyRisk(61), 'd90')
  assert.equal(classifyRisk(90), 'd90')
  assert.equal(classifyRisk(91), null)
})

test('at-risk batches are listed most urgent first and summarised', () => {
  const stock = [st('late', 'A', 5, '2027-06-01'), st('b', 'A', 2, '2026-06-20'), st('gone', 'A', 3, '2026-05-01'), st('c', 'A', 4, '2026-08-01')]
  const list = findAtRisk(stock, [med], [wh('A', 0)], today)
  assert.deepEqual(list.map((x) => x.stock.id), ['gone', 'b', 'c'])
  const s = summarizeRisk(list)
  assert.equal(s.expired.cartons, 3)
  assert.equal(s.d30.units, 20)
  assert.equal(s.d90.batches, 1)
})

test('a transfer goes to the nearest warehouse that really has room', () => {
  // B is nearest but its tiny room is already full; C has room.
  const warehouses = [wh('A', 0), wh('B', 1, 80, 60, 20), wh('C', 2)]
  const stock = [st('risky', 'A', 10, '2026-06-10'), st('fillB', 'B', 4, '2027-01-01')]
  const atRisk = findAtRisk(stock, [med], warehouses, today)
  const suggestion = suggestTransfers(atRisk, stock, [med], warehouses, today).get('risky')
  assert.equal(suggestion?.warehouse.id, 'C')
})

test('no suggestion when nobody has room; expired batches get none', () => {
  const warehouses = [wh('A', 0), wh('B', 1, 80, 60, 20)]
  const stock = [st('risky', 'A', 10, '2026-06-10'), st('old', 'A', 1, '2026-01-01')]
  const atRisk = findAtRisk(stock, [med], warehouses, today)
  const map = suggestTransfers(atRisk, stock, [med], warehouses, today)
  assert.equal(map.get('risky'), null)
  assert.equal(map.has('old'), false)
})

test('dashboard numbers', () => {
  const warehouses = [wh('A', 0), { ...wh('B', 1), lengthCm: null, widthCm: null, heightCm: null }]
  const stock = [st('x', 'A', 10, '2026-06-10'), st('y', 'A', 5, '2027-06-10'), st('z', 'B', 2, '2026-01-01')]
  const d = computeDashboard(warehouses, [med], stock, today)
  assert.equal(d.totalCartons, 17)
  assert.equal(d.totalUnits, 170)
  assert.deepEqual(d.expiry, { expired: 2, d30: 10, d90: 0, ok: 5 })
  assert.equal(d.atRiskBatches, 2)
  assert.equal(d.perWarehouse[1].utilizationPct, null)
  assert.ok((d.averageUtilizationPct ?? 0) > 0)
})
