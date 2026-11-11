// One medicine and the carton it is shipped in. Sizes in centimetres, weight in kg.
export interface MedicineRecord {
  id: string
  name: string
  unitsPerCarton: number
  cartonLengthCm: number
  cartonWidthCm: number
  cartonHeightCm: number
  cartonWeightKg: number
  // how many cartons may be stacked on top of each other
  maxStack: number
  // fragile cartons are kept on top of the stack
  fragile: boolean
  // true = may not be laid on its side (kept upright)
  thisSideUp: boolean
  // Warn when usable stock (all warehouses together) drops below this many cartons. 0 = no warning.
  reorderLevelCartons: number
}

export type MedicineInput = Omit<MedicineRecord, 'id'>
