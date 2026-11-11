// Turns the rows of a spreadsheet into validated medicines / stock batches.
// Pure functions (no React, no Firebase) so they are easy to test.
import type { MedicineInput } from '../types/medicine.ts'
import type { StockInput } from '../types/stock.ts'
import { isValidIsoDate } from './expiry.ts'

export type Cell = string | number | boolean | Date | null | undefined

export interface ParsedRow<T> {
  line: number // row number in the sheet (header = 1)
  label: string
  data: T | null // null when the row has errors or is skipped
  errors: string[]
  skipped: string | null // reason, e.g. "already exists"
}

export const MAX_ROWS = 2000

// ---- helpers ----

const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

const HEADERS = {
  name: ['name', 'medicine', 'medicinename', 'product', 'productname', 'item', 'itemname'],
  units: ['unitspercarton', 'units', 'unitsperbox', 'qtypercarton', 'packsizeunits'],
  length: ['cartonlengthcm', 'lengthcm', 'length', 'l'],
  width: ['cartonwidthcm', 'widthcm', 'width', 'w'],
  height: ['cartonheightcm', 'heightcm', 'height', 'h'],
  weight: ['cartonweightkg', 'weightkg', 'weight'],
  stack: ['maxstack', 'maxcartonsstackedhigh', 'maxcartonsstacked', 'stack', 'stacklimit'],
  fragile: ['fragile'],
  reorder: ['reorderlevel', 'reorderlevelcartons', 'minstock', 'minimumstock', 'lowstocklevel'],
  upright: ['thissideup', 'upright', 'keepupright'],
  warehouse: ['warehouse', 'warehousename', 'store', 'location'],
  medicine: ['medicine', 'medicinename', 'product', 'productname', 'name', 'item'],
  cartons: ['cartons', 'numberofcartons', 'quantity', 'qty', 'cartonqty'],
  batch: ['batchno', 'batchnumber', 'batch', 'lot', 'lotno'],
  expiry: ['expirydate', 'expiry', 'expdate', 'exp', 'expiration', 'expirationdate'],
}

type HeaderName = keyof typeof HEADERS

// Finds which column holds each field, by header name.
function mapColumns(header: Cell[], names: HeaderName[]): Partial<Record<HeaderName, number>> {
  const found: Partial<Record<HeaderName, number>> = {}
  const taken = new Set<number>()
  for (const name of names) {
    const index = header.findIndex((cell, i) => !taken.has(i) && HEADERS[name].includes(key(String(cell ?? ''))))
    if (index >= 0) {
      found[name] = index
      taken.add(index)
    }
  }
  return found
}

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return isoOf(cell)
  return String(cell).trim()
}

function isoOf(date: Date): string {
  // read-excel-file returns date cells as UTC midnight, so read the UTC calendar day.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function numberOf(cell: Cell): number {
  if (typeof cell === 'number') return cell
  const raw = text(cell).replace(/,/g, '')
  return raw === '' ? NaN : Number(raw)
}

function yesNo(cell: Cell): boolean | null {
  const value = text(cell).toLowerCase()
  if (value === '') return false
  if (['yes', 'y', 'true', '1'].includes(value)) return true
  if (['no', 'n', 'false', '0'].includes(value)) return false
  return null
}

// Accepts 2027-03-31, 31/03/2027, 31-03-2027, or an Excel date.
export function parseDate(cell: Cell): string | null {
  if (cell instanceof Date) return isoOf(cell)
  const value = text(cell)
  if (isValidIsoDate(value)) return value
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value)
  if (match) {
    const iso = `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    if (isValidIsoDate(iso)) return iso
  }
  return null
}

function checkNumber(errors: string[], value: number, label: string, min: number, max: number, whole = false) {
  if (Number.isNaN(value)) errors.push(`${label} is missing or not a number`)
  else if (whole && !Number.isInteger(value)) errors.push(`${label} must be a whole number`)
  else if (value < min || value > max) errors.push(`${label} must be between ${min} and ${max}`)
}

function missingColumns(map: Partial<Record<HeaderName, number>>, required: HeaderName[], names: Record<string, string>) {
  return required.filter((item) => map[item] === undefined).map((item) => names[item])
}

// ---- medicines ----

export function parseMedicineRows(
  rows: Cell[][],
  existingNames: string[],
): { rows: ParsedRow<MedicineInput>[]; fatal: string | null } {
  if (rows.length < 2) return { rows: [], fatal: 'The file has no data rows.' }
  if (rows.length - 1 > MAX_ROWS) return { rows: [], fatal: `Too many rows (maximum ${MAX_ROWS} per file).` }

  const map = mapColumns(rows[0], ['name', 'units', 'length', 'width', 'height', 'weight', 'stack', 'fragile', 'upright', 'reorder'])
  const missing = missingColumns(map, ['name', 'units', 'length', 'width', 'height', 'weight'], {
    name: 'Medicine name', units: 'Units per carton', length: 'Carton length (cm)',
    width: 'Carton width (cm)', height: 'Carton height (cm)', weight: 'Carton weight (kg)',
  })
  if (missing.length > 0) return { rows: [], fatal: `Missing column(s): ${missing.join(', ')}.` }

  const seen = new Set(existingNames.map((item) => item.trim().toLowerCase()))
  const result: ParsedRow<MedicineInput>[] = []

  rows.slice(1).forEach((row, index) => {
    const at = (name: HeaderName) => (map[name] === undefined ? undefined : row[map[name] as number])
    const name = text(at('name'))
    const errors: string[] = []
    if (!name) errors.push('Medicine name is missing')
    else if (name.length > 100) errors.push('Medicine name is longer than 100 characters')

    const units = numberOf(at('units'))
    const length = numberOf(at('length'))
    const width = numberOf(at('width'))
    const height = numberOf(at('height'))
    const weight = numberOf(at('weight'))
    checkNumber(errors, units, 'Units per carton', 1, 1_000_000, true)
    checkNumber(errors, length, 'Carton length', 1, 1000)
    checkNumber(errors, width, 'Carton width', 1, 1000)
    checkNumber(errors, height, 'Carton height', 1, 1000)
    checkNumber(errors, weight, 'Carton weight', 0.01, 2000)

    // Optional columns: blank means 4 high, not fragile, may be turned.
    const stackCell = at('stack')
    const stack = text(stackCell) === '' ? 4 : numberOf(stackCell)
    checkNumber(errors, stack, 'Max stack', 1, 100, true)
    const reorderCell = at('reorder')
    const reorder = text(reorderCell) === '' ? 0 : numberOf(reorderCell)
    checkNumber(errors, reorder, 'Reorder level', 0, 1_000_000, true)
    const fragile = yesNo(at('fragile'))
    const upright = yesNo(at('upright'))
    if (fragile === null) errors.push('Fragile must be yes or no')
    if (upright === null) errors.push('This side up must be yes or no')

    let skipped: string | null = null
    if (errors.length === 0) {
      if (seen.has(name.toLowerCase())) skipped = 'Already in the catalogue'
      else seen.add(name.toLowerCase())
    }

    result.push({
      line: index + 2,
      label: name || '(no name)',
      errors,
      skipped,
      data:
        errors.length === 0 && !skipped
          ? {
              name, unitsPerCarton: units, cartonLengthCm: length, cartonWidthCm: width, cartonHeightCm: height,
              cartonWeightKg: weight, maxStack: stack, fragile: fragile === true, thisSideUp: upright === true, reorderLevelCartons: reorder,
            }
          : null,
    })
  })
  return { rows: result, fatal: null }
}

// ---- stock ----

export interface NamedItem {
  id: string
  name: string
}

export interface ExistingBatch {
  warehouseId: string
  medicineId: string
  batchNo: string
}

export function parseStockRows(
  rows: Cell[][],
  warehouses: NamedItem[],
  medicines: NamedItem[],
  existing: ExistingBatch[],
): { rows: ParsedRow<StockInput>[]; fatal: string | null } {
  if (rows.length < 2) return { rows: [], fatal: 'The file has no data rows.' }
  if (rows.length - 1 > MAX_ROWS) return { rows: [], fatal: `Too many rows (maximum ${MAX_ROWS} per file).` }

  const map = mapColumns(rows[0], ['warehouse', 'medicine', 'cartons', 'batch', 'expiry'])
  const missing = missingColumns(map, ['warehouse', 'medicine', 'cartons', 'batch', 'expiry'], {
    warehouse: 'Warehouse', medicine: 'Medicine', cartons: 'Cartons', batch: 'Batch number', expiry: 'Expiry date',
  })
  if (missing.length > 0) return { rows: [], fatal: `Missing column(s): ${missing.join(', ')}.` }

  const warehouseByName = new Map(warehouses.map((item) => [item.name.trim().toLowerCase(), item.id]))
  const medicineByName = new Map(medicines.map((item) => [item.name.trim().toLowerCase(), item.id]))
  const seen = new Set(existing.map((item) => `${item.warehouseId}|${item.medicineId}|${item.batchNo.toLowerCase()}`))
  const result: ParsedRow<StockInput>[] = []

  rows.slice(1).forEach((row, index) => {
    const at = (name: HeaderName) => row[map[name] as number]
    const warehouseName = text(at('warehouse'))
    const medicineName = text(at('medicine'))
    const batchNo = text(at('batch'))
    const errors: string[] = []

    const warehouseId = warehouseByName.get(warehouseName.toLowerCase())
    const medicineId = medicineByName.get(medicineName.toLowerCase())
    if (!warehouseName) errors.push('Warehouse is missing')
    else if (!warehouseId) errors.push(`Unknown warehouse “${warehouseName}”`)
    if (!medicineName) errors.push('Medicine is missing')
    else if (!medicineId) errors.push(`Unknown medicine “${medicineName}” (import medicines first)`)

    const cartons = numberOf(at('cartons'))
    checkNumber(errors, cartons, 'Cartons', 1, 100000, true)
    if (!batchNo) errors.push('Batch number is missing')
    else if (batchNo.length > 40) errors.push('Batch number is longer than 40 characters')
    const expiry = parseDate(at('expiry'))
    if (!expiry) errors.push('Expiry date is missing or not a valid date (use YYYY-MM-DD or DD/MM/YYYY)')

    let skipped: string | null = null
    if (errors.length === 0 && warehouseId && medicineId) {
      const id = `${warehouseId}|${medicineId}|${batchNo.toLowerCase()}`
      if (seen.has(id)) skipped = 'This batch already exists'
      else seen.add(id)
    }

    result.push({
      line: index + 2,
      label: `${medicineName || '?'} · ${batchNo || '?'}`,
      errors,
      skipped,
      data:
        errors.length === 0 && !skipped && warehouseId && medicineId && expiry
          ? { warehouseId, medicineId, cartons, batchNo, expiryDate: expiry }
          : null,
    })
  })
  return { rows: result, fatal: null }
}

// ---- downloadable templates (CSV opens in Excel) ----

export const MEDICINE_TEMPLATE =
  'Medicine name,Units per carton,Carton length (cm),Carton width (cm),Carton height (cm),Carton weight (kg),Max stack,Fragile,This side up,Reorder level (cartons)\n' +
  'Paracetamol 500 mg (tablets),100,40,30,25,8,6,no,no,60\n' +
  'Insulin Vials,200,35,25,25,9,3,yes,yes,20\n'

export const STOCK_TEMPLATE =
  'Warehouse,Medicine,Cartons,Batch number,Expiry date\n' +
  'Pune Central Store,Paracetamol 500 mg (tablets),120,B2026-041,2027-03-31\n' +
  'Pune Central Store,Insulin Vials,20,B2026-052,31/12/2026\n'
