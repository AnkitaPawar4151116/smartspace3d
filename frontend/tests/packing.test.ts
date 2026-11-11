// Tests for the packing engine. Run from the frontend folder (Node 22 or newer):
//   node --test --experimental-strip-types tests/packing.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { packRoom } from '../src/utils/packing.ts'
import type { PackBatch, PackResult } from '../src/utils/packing.ts'

function batch(overrides: Partial<PackBatch> = {}): PackBatch {
  return {
    id: 'b1',
    medicineId: 'm1',
    label: 'Test medicine',
    batchNo: 'B1',
    expiryDate: '2030-01-01',
    expiryDays: 365,
    cartons: 10,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 25,
    maxStack: 4,
    fragile: false,
    thisSideUp: false,
    ...overrides,
  }
}

const room = { lengthCm: 400, widthCm: 300, heightCm: 200 }

function overlaps(a: PackResult['placements'][number], b: PackResult['placements'][number]): boolean {
  return (
    a.x < b.x + b.dx && b.x < a.x + a.dx &&
    a.y < b.y + b.dy && b.y < a.y + a.dy &&
    a.z < b.z + b.dz && b.z < a.z + a.dz
  )
}

test('a single carton is placed inside the room', () => {
  const result = packRoom(room, [batch({ cartons: 1 })])
  assert.equal(result.cartonsPlaced, 1)
  assert.equal(result.unplaced.length, 0)
})

test('no carton leaves the room and no two cartons overlap', () => {
  const result = packRoom(room, [
    batch({ id: 'a', cartons: 60, expiryDays: 30 }),
    batch({ id: 'b', cartons: 40, lengthCm: 50, widthCm: 35, heightCm: 30, expiryDays: 90 }),
    batch({ id: 'c', cartons: 12, fragile: true, thisSideUp: true, maxStack: 3, expiryDays: 60 }),
  ])
  for (const p of result.placements) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.z >= 0)
    assert.ok(p.x + p.dx <= room.lengthCm && p.y + p.dy <= room.widthCm && p.z + p.dz <= room.heightCm)
  }
  for (let i = 0; i < result.placements.length; i++) {
    for (let j = i + 1; j < result.placements.length; j++) {
      assert.equal(overlaps(result.placements[i], result.placements[j]), false)
    }
  }
})

test('the stack limit is respected', () => {
  const result = packRoom(room, [batch({ cartons: 30, maxStack: 3, thisSideUp: true })])
  const heights = new Map<string, number>()
  for (const p of result.placements) {
    const key = `${p.x},${p.y}`
    heights.set(key, (heights.get(key) ?? 0) + 1)
  }
  assert.ok(Math.max(...heights.values()) <= 3)
})

test('"this side up" cartons keep their height', () => {
  const result = packRoom(room, [batch({ cartons: 8, thisSideUp: true })])
  assert.ok(result.placements.every((p) => p.dz === 25))
})

test('a carton bigger than the room is reported, not placed', () => {
  const result = packRoom(room, [batch({ lengthCm: 900, widthCm: 900, heightCm: 900, cartons: 2 })])
  assert.equal(result.cartonsPlaced, 0)
  assert.equal(result.unplaced[0].count, 2)
})

test('placed + not placed equals the total', () => {
  const small = { lengthCm: 100, widthCm: 100, heightCm: 60 }
  const result = packRoom(small, [batch({ cartons: 50 })])
  const notPlaced = result.unplaced.reduce((sum, item) => sum + item.count, 0)
  assert.ok(notPlaced > 0)
  assert.equal(result.cartonsPlaced + notPlaced, 50)
})

test('earliest expiry is placed nearer the door (smaller y)', () => {
  const result = packRoom(room, [
    batch({ id: 'late', cartons: 40, expiryDays: 300 }),
    batch({ id: 'soon', cartons: 40, expiryDays: 20 }),
  ])
  const minY = (id: string) => Math.min(...result.placements.filter((p) => p.batchId === id).map((p) => p.y))
  assert.ok(minY('soon') <= minY('late'))
  assert.equal(minY('soon'), 0)
})

test('fragile cartons end up on top of a stack, never under another carton', () => {
  const result = packRoom(room, [
    batch({ id: 'solid', cartons: 6, maxStack: 4, thisSideUp: true }),
    batch({ id: 'glass', cartons: 2, fragile: true, thisSideUp: true, maxStack: 4 }),
  ])
  assert.equal(result.unplaced.length, 0)
  const fragile = result.placements.filter((p) => p.batchId === 'glass')
  assert.ok(fragile.every((p) => p.z > 0))
  for (const f of fragile) {
    const above = result.placements.filter((p) => p.batchId === 'solid' && p.x === f.x && p.y === f.y && p.z > f.z)
    assert.equal(above.length, 0)
  }
})

test('utilisation is between 0 and 100 percent', () => {
  const result = packRoom(room, [batch({ cartons: 100 })])
  assert.ok(result.utilizationPct > 0 && result.utilizationPct <= 100)
})
