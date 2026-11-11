// 3D packing of medicine cartons into one warehouse room.
// Pure TypeScript (no React, no Firebase) so it is easy to test and explain.
//
// Coordinates (all in cm):  x = along the room length, y = along the room width,
// z = height. The DOOR is on the wall at y = 0, so a small y means "near the door".
//
// How the heuristic works (a "stack + shelf" method):
//  1. Batches are sorted by expiry date, earliest first.
//  2. Cartons stay upright as entered and may be turned 90° on the floor. They are
//     tipped onto a side only if they do not fit upright (never when "this side up").
//  3. Cartons of one batch are piled into stacks, as high as the stack limit and the
//     room height allow.
//  4. Stacks are placed on the floor row by row, starting at the door. So the earliest
//     expiry ends up closest to the door and is picked first.
//  5. Fragile cartons are handled last: they go on TOP of existing stacks when they
//     fit, otherwise they get their own stacks.
// It is a heuristic: a good arrangement, not a guaranteed best one.

// Racks: rows of shelves along the room length, with walking aisles between them.
export interface RackSpec {
  levels: number // shelf levels per rack (2 or more)
  depthCm: number // depth of one rack
  aisleCm: number // aisle width (also left free next to the door)
}

export interface PackRoom {
  lengthCm: number
  widthCm: number
  heightCm: number
  racks?: RackSpec // when set, use packWarehouse() instead of packRoom()
}

// Where the shelves are, so the 3D view can draw them.
export interface RackLayout {
  stripY0: number[] // y of the front of each rack row
  depthCm: number
  levels: number
  levelHeightCm: number
  beamCm: number
}

export interface PackBatch {
  id: string
  medicineId: string
  label: string // medicine name, for display
  batchNo: string
  expiryDate: string
  expiryDays: number // days until expiry (used for ordering and colours)
  cartons: number
  lengthCm: number
  widthCm: number
  heightCm: number
  maxStack: number
  fragile: boolean
  thisSideUp: boolean
}

// One carton in its final place. (x, y, z) is the corner nearest the origin.
export interface Placement {
  batchId: string
  x: number
  y: number
  z: number
  dx: number // size along x after rotation
  dy: number // size along y after rotation
  dz: number // size along z (height) after rotation
}

export interface Unplaced {
  batchId: string
  label: string
  count: number
  reason: string
}

export interface PackResult {
  placements: Placement[]
  unplaced: Unplaced[]
  cartonsPlaced: number
  cartonsTotal: number
  usedVolumeCm3: number
  roomVolumeCm3: number
  utilizationPct: number // carton volume / room volume * 100
  rackLayout?: RackLayout
}

interface Orientation {
  fl: number // footprint size along x
  fw: number // footprint size along y
  h: number // height
}

interface Stack {
  x: number
  y: number
  fl: number // footprint actually used (after any 90° turn)
  fw: number
  topZ: number
  count: number
  maxStack: number
}

function orientationsOf(batch: PackBatch): Orientation[] {
  const { lengthCm: l, widthCm: w, heightCm: h } = batch
  const upright: Orientation = { fl: l, fw: w, h }
  if (batch.thisSideUp) return [upright]
  return [upright, { fl: l, fw: h, h: w }, { fl: w, fw: h, h: l }]
}

function footprintFits(fl: number, fw: number, boxL: number, boxW: number): boolean {
  return (fl <= boxL && fw <= boxW) || (fw <= boxL && fl <= boxW)
}

// Cartons stay UPRIGHT (the height entered by the admin) and may be turned 90° on the floor.
// They are tipped onto a side only when they do not fit upright, and never when "this side up".
function bestOrientation(batch: PackBatch, room: PackRoom): { o: Orientation; levels: number } | null {
  const [upright, ...tipped] = orientationsOf(batch)
  const candidates = [upright]
  if (tipped.length > 0 && !fits(upright, room)) candidates.push(...tipped)

  let best: { o: Orientation; levels: number; score: number } | null = null
  for (const o of candidates) {
    if (!fits(o, room)) continue
    const levels = Math.max(1, Math.min(batch.maxStack, Math.floor(room.heightCm / o.h)))
    const score = (o.fl * o.fw) / levels // floor area used per carton: smaller is better
    if (!best || score < best.score - 1e-9) best = { o, levels, score }
  }
  return best ? { o: best.o, levels: best.levels } : null
}

function fits(o: Orientation, room: PackRoom): boolean {
  return footprintFits(o.fl, o.fw, room.lengthCm, room.widthCm) && o.h <= room.heightCm
}

// Lays stacks on the floor in rows, starting at the door wall (y = 0).
class FloorPlanner {
  private rows: Array<{ y: number; depth: number; x: number }> = []
  private length: number
  private width: number

  constructor(length: number, width: number) {
    this.length = length
    this.width = width
  }

  place(fl: number, fw: number): { x: number; y: number; a: number; b: number } | null {
    const turns: Array<[number, number]> = fl === fw ? [[fl, fw]] : [[fl, fw], [fw, fl]]
    const last = this.rows[this.rows.length - 1]

    // 1. try to fit in a row that already exists
    for (const row of this.rows) {
      for (const [a, b] of turns) {
        const depthOk = b <= row.depth || (row === last && row.y + b <= this.width)
        if (row.x + a <= this.length && depthOk) {
          const x = row.x
          row.x += a
          row.depth = Math.max(row.depth, b)
          return { x, y: row.y, a, b }
        }
      }
    }

    // 2. otherwise start a new row behind the last one
    const y = last ? last.y + last.depth : 0
    const options = turns.filter(([a, b]) => a <= this.length && y + b <= this.width).sort((p, q) => p[1] - q[1])
    if (options.length === 0) return null
    const [a, b] = options[0]
    this.rows.push({ y, depth: b, x: a })
    return { x: 0, y, a, b }
  }
}

export function packRoom(room: PackRoom, batches: PackBatch[]): PackResult {
  const placements: Placement[] = []
  const unplaced: Unplaced[] = []
  const stacks: Stack[] = []
  const planner = new FloorPlanner(room.lengthCm, room.widthCm)

  const sorted = [...batches].sort((a, b) => a.expiryDays - b.expiryDays)

  // Put cartons of a batch into new stacks on the floor.
  function placeOnFloor(batch: PackBatch, count: number) {
    const best = bestOrientation(batch, room)
    if (!best) {
      unplaced.push({ batchId: batch.id, label: batch.label, count, reason: 'The carton is bigger than the room.' })
      return
    }
    let remaining = count
    while (remaining > 0) {
      const spot = planner.place(best.o.fl, best.o.fw)
      if (!spot) {
        unplaced.push({ batchId: batch.id, label: batch.label, count: remaining, reason: 'No floor space left.' })
        return
      }
      const stack: Stack = { x: spot.x, y: spot.y, fl: spot.a, fw: spot.b, topZ: 0, count: 0, maxStack: batch.maxStack }
      const inThisStack = Math.min(best.levels, remaining)
      for (let i = 0; i < inThisStack; i++) {
        placements.push({ batchId: batch.id, x: spot.x, y: spot.y, z: stack.topZ, dx: spot.a, dy: spot.b, dz: best.o.h })
        stack.topZ += best.o.h
        stack.count += 1
      }
      stacks.push(stack)
      remaining -= inThisStack
    }
  }

  // Put fragile cartons on top of stacks that still have room. Returns how many are left.
  function placeOnTops(batch: PackBatch, count: number): number {
    const options = orientationsOf(batch) // upright first
    let remaining = count
    for (const stack of stacks) {
      while (remaining > 0 && stack.count < Math.min(stack.maxStack, batch.maxStack)) {
        const o = options.find(
          (item) => stack.topZ + item.h <= room.heightCm && footprintFits(item.fl, item.fw, stack.fl, stack.fw),
        )
        if (!o) break
        const straight = o.fl <= stack.fl && o.fw <= stack.fw
        placements.push({
          batchId: batch.id,
          x: stack.x,
          y: stack.y,
          z: stack.topZ,
          dx: straight ? o.fl : o.fw,
          dy: straight ? o.fw : o.fl,
          dz: o.h,
        })
        stack.topZ += o.h
        stack.count += 1
        stack.maxStack = Math.min(stack.maxStack, batch.maxStack)
        remaining -= 1
      }
      if (remaining === 0) break
    }
    return remaining
  }

  for (const batch of sorted) {
    if (!batch.fragile && batch.cartons > 0) placeOnFloor(batch, batch.cartons)
  }
  for (const batch of sorted) {
    if (batch.fragile && batch.cartons > 0) {
      const left = placeOnTops(batch, batch.cartons)
      if (left > 0) placeOnFloor(batch, left)
    }
  }

  const cartonsTotal = batches.reduce((sum, batch) => sum + Math.max(0, batch.cartons), 0)
  const usedVolumeCm3 = placements.reduce((sum, p) => sum + p.dx * p.dy * p.dz, 0)
  const roomVolumeCm3 = room.lengthCm * room.widthCm * room.heightCm

  return {
    placements,
    unplaced,
    cartonsPlaced: placements.length,
    cartonsTotal,
    usedVolumeCm3,
    roomVolumeCm3,
    utilizationPct: roomVolumeCm3 > 0 ? (usedVolumeCm3 / roomVolumeCm3) * 100 : 0,
  }
}

const BEAM_CM = 4 // thickness of a shelf board

// Packs a room that may have racks. Without racks it is the same as packRoom (floor stacking).
// With racks, every shelf level of every rack row is a small room of its own. They are filled
// in order: rack rows nearest the door first, lowest shelf first, earliest expiry first.
export function packWarehouse(room: PackRoom, batches: PackBatch[]): PackResult {
  const racks = room.racks
  if (!racks || racks.levels < 2) return packRoom(room, batches)

  const levelHeight = Math.floor(room.heightCm / racks.levels)
  const clear = levelHeight - BEAM_CM
  const stripCount = Math.floor((room.widthCm - racks.aisleCm) / (racks.depthCm + racks.aisleCm))
  const roomVolumeCm3 = room.lengthCm * room.widthCm * room.heightCm
  const cartonsTotal = batches.reduce((sum, batch) => sum + Math.max(0, batch.cartons), 0)

  const stripY0: number[] = []
  for (let i = 0; i < stripCount; i++) stripY0.push(racks.aisleCm + i * (racks.depthCm + racks.aisleCm))
  const layout: RackLayout = { stripY0, depthCm: racks.depthCm, levels: racks.levels, levelHeightCm: levelHeight, beamCm: BEAM_CM }

  const placements: Placement[] = []
  const left = new Map(batches.map((batch) => [batch.id, Math.max(0, batch.cartons)]))

  if (stripCount >= 1 && clear >= 5) {
    outer: for (const y0 of stripY0) {
      for (let level = 0; level < racks.levels; level++) {
        const open = batches.filter((batch) => (left.get(batch.id) ?? 0) > 0).map((batch) => ({ ...batch, cartons: left.get(batch.id) ?? 0 }))
        if (open.length === 0) break outer
        const part = packRoom({ lengthCm: room.lengthCm, widthCm: racks.depthCm, heightCm: clear }, open)
        for (const p of part.placements) {
          placements.push({ ...p, y: p.y + y0, z: p.z + level * levelHeight + BEAM_CM })
          left.set(p.batchId, (left.get(p.batchId) ?? 0) - 1)
        }
      }
    }
  }

  const reason =
    stripCount < 1 ? 'The room is too narrow for a rack row.' : clear < 5 ? 'The room is too low for this many shelf levels.' : 'No rack space left.'
  const unplaced: Unplaced[] = batches
    .filter((batch) => (left.get(batch.id) ?? 0) > 0)
    .map((batch) => ({ batchId: batch.id, label: batch.label, count: left.get(batch.id) ?? 0, reason }))

  const usedVolumeCm3 = placements.reduce((sum, p) => sum + p.dx * p.dy * p.dz, 0)
  return {
    placements,
    unplaced,
    cartonsPlaced: placements.length,
    cartonsTotal,
    usedVolumeCm3,
    roomVolumeCm3,
    utilizationPct: roomVolumeCm3 > 0 ? (usedVolumeCm3 / roomVolumeCm3) * 100 : 0,
    rackLayout: layout,
  }
}
