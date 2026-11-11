import assert from 'node:assert/strict'
import test from 'node:test'
import { packRoom, packWarehouse } from '../src/utils/packing.ts'
import type { PackBatch } from '../src/utils/packing.ts'

const batch = (over: Partial<PackBatch> = {}): PackBatch => ({
  id: 'b1', medicineId: 'm', label: 'M', batchNo: 'x', expiryDate: '2027-01-01', expiryDays: 100,
  cartons: 10, lengthCm: 40, widthCm: 30, heightCm: 25, maxStack: 8, fragile: false, thisSideUp: false, ...over,
})

test('without racks packWarehouse equals packRoom', () => {
  const room = { lengthCm: 600, widthCm: 400, heightCm: 300 }
  assert.deepEqual(packWarehouse(room, [batch()]).placements, packRoom(room, [batch()]).placements)
})

test('racks: cartons sit on shelves, inside the rack rows and below the shelf above', () => {
  const room = { lengthCm: 400, widthCm: 500, heightCm: 300, racks: { levels: 3, depthCm: 100, aisleCm: 150 } }
  const r = packWarehouse(room, [batch({ cartons: 200 })])
  assert.ok(r.rackLayout)
  const { stripY0, levelHeightCm, beamCm, depthCm } = r.rackLayout
  for (const p of r.placements) {
    const level = Math.floor(p.z / levelHeightCm)
    assert.ok(level >= 0 && level < 3)
    assert.ok(p.z >= level * levelHeightCm + beamCm)
    assert.ok(p.z + p.dz <= (level + 1) * levelHeightCm)
    assert.ok(stripY0.some((y0) => p.y >= y0 && p.y + p.dy <= y0 + depthCm))
    assert.ok(p.x >= 0 && p.x + p.dx <= room.lengthCm)
  }
})

test('racks: leaves an aisle at the door and reports cartons that do not fit', () => {
  const room = { lengthCm: 200, widthCm: 400, heightCm: 200, racks: { levels: 2, depthCm: 100, aisleCm: 150 } }
  const r = packWarehouse(room, [batch({ cartons: 5000 })])
  assert.ok(r.placements.every((p) => p.y >= 150))
  assert.ok(r.unplaced.length > 0)
  assert.equal(r.cartonsPlaced + r.unplaced.reduce((s, u) => s + u.count, 0), 5000)
})

test('racks: earliest expiry is placed first (nearest the door, lowest shelf)', () => {
  const room = { lengthCm: 300, widthCm: 500, heightCm: 300, racks: { levels: 2, depthCm: 100, aisleCm: 150 } }
  const r = packWarehouse(room, [batch({ id: 'late', expiryDays: 300, cartons: 30 }), batch({ id: 'soon', expiryDays: 20, cartons: 30 })])
  const minY = (id: string) => Math.min(...r.placements.filter((p) => p.batchId === id).map((p) => p.y))
  assert.ok(minY('soon') <= minY('late'))
})

test('racks: a room too narrow for a rack row places nothing and says why', () => {
  const room = { lengthCm: 300, widthCm: 200, heightCm: 300, racks: { levels: 2, depthCm: 100, aisleCm: 150 } }
  const r = packWarehouse(room, [batch()])
  assert.equal(r.cartonsPlaced, 0)
  assert.match(r.unplaced[0].reason, /narrow/)
})
