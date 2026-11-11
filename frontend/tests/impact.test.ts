import assert from 'node:assert/strict'
import test from 'node:test'
import { csvCell, toCsv } from '../src/utils/csvExport.ts'
import { computeImpact } from '../src/utils/impact.ts'
import { findLowStock } from '../src/utils/lowStock.ts'

const today = new Date(Date.UTC(2026, 5, 1, 12))
const med = (id: string, level: number) => ({ id, name: id, unitsPerCarton: 100, cartonLengthCm: 30, cartonWidthCm: 20, cartonHeightCm: 20, cartonWeightKg: 5, maxStack: 4, fragile: false, thisSideUp: false, reorderLevelCartons: level })
const st = (id: string, medicineId: string, cartons: number, expiryDate: string) => ({ id, warehouseId: 'A', medicineId, cartons, batchNo: id, expiryDate })

test('low stock ignores expired cartons and sums warehouses', () => {
  const stock = [st('1', 'a', 30, '2027-01-01'), { ...st('2', 'a', 30, '2027-01-01'), warehouseId: 'B' }, st('3', 'a', 500, '2026-01-01'), st('4', 'b', 10, '2027-01-01')]
  const list = findLowStock([med('a', 50), med('b', 5), med('c', 10), med('d', 0)], stock, today)
  assert.deepEqual(list.map((i) => [i.medicine.id, i.usableCartons, i.out]), [['c', 0, true]])
})

test('low stock lists medicines under their level, emptiest first', () => {
  const list = findLowStock([med('a', 100), med('b', 100), med('c', 10)], [st('1', 'a', 80, '2027-01-01'), st('2', 'b', 20, '2027-01-01')], today)
  assert.deepEqual(list.map((i) => i.medicine.id), ['c', 'b', 'a'])
  assert.equal(list[1].shortfallCartons, 80)
})

test('impact numbers: waste rate, at risk, rescued transfers, orders', () => {
  const stock = [st('1', 'a', 10, '2026-01-01'), st('2', 'a', 20, '2026-07-01'), st('3', 'a', 70, '2027-06-01')]
  const transfers = [
    { id: 't1', medicineName: 'a', cartons: 5, units: 500, daysLeft: 30, fromName: 'A', toName: 'B', createdAtMs: 1 },
    { id: 't2', medicineName: 'a', cartons: 9, units: 900, daysLeft: 200, fromName: 'A', toName: 'B', createdAtMs: 2 },
  ]
  const orders = [
    { id: 'o1', userId: 'u', userEmail: 'e', medicineId: 'a', medicineName: 'a', units: 1200, cartons: 12, lat: 0, lng: 0, status: 'approved', note: '', reply: '', lines: [], createdAtMs: 1, decidedAtMs: 2 },
    { id: 'o2', userId: 'u', userEmail: 'e', medicineId: 'a', medicineName: 'a', units: 100, cartons: 1, lat: 0, lng: 0, status: 'pending', note: '', reply: '', lines: [], createdAtMs: 1, decidedAtMs: null },
  ] as never
  const r = computeImpact({ warehouseCount: 2, rackWarehouses: 1, averageUtilizationPct: 40, medicines: [med('a', 0)], stock, orders, transfers, today })
  assert.equal(r.sdg12.expiredCartons, 10)
  assert.equal(r.sdg12.wasteRatePct, 10)
  assert.equal(r.sdg12.atRiskCartons, 20)
  assert.equal(r.sdg12.rescuedUnits, 500)
  assert.equal(r.sdg3.deliveredUnits, 1200)
  assert.equal(r.sdg3.pendingOrders, 1)
  assert.equal(r.sdg3.usableUnits, 9000)
  const hidden = computeImpact({ warehouseCount: 0, rackWarehouses: 0, averageUtilizationPct: null, medicines: [], stock: [], orders: null, transfers: [], today })
  assert.equal(hidden.sdg3.deliveredUnits, null)
})

test('csv quotes cells and blocks spreadsheet formulas', () => {
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvCell(-5), '-5')
  assert.equal(csvCell(null), '')
  assert.equal(toCsv(['x', 'y'], [['1', 2]]), 'x,y\r\n1,2\r\n')
})
