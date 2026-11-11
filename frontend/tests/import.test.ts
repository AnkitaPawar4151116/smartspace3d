// Run from the frontend folder (Node 22+):  node --test --experimental-strip-types tests/
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCsv } from '../src/utils/csv.ts'
import { MEDICINE_TEMPLATE, STOCK_TEMPLATE, parseDate, parseMedicineRows, parseStockRows } from '../src/utils/importParse.ts'

test('csv: quotes, commas inside quotes, CRLF, BOM', () => {
  const rows = parseCsv('﻿Name,Note\r\n"Para, 500",ok\r\n"He said ""hi""",x\r\n')
  assert.deepEqual(rows, [['Name', 'Note'], ['Para, 500', 'ok'], ['He said "hi"', 'x']])
})

test('csv: semicolon files are detected', () => {
  assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']])
})

test('the medicine template imports cleanly', () => {
  const { rows, fatal } = parseMedicineRows(parseCsv(MEDICINE_TEMPLATE), [])
  assert.equal(fatal, null)
  assert.equal(rows.length, 2)
  assert.ok(rows.every((row) => row.data && row.errors.length === 0))
  assert.equal(rows[1].data?.fragile, true)
  assert.equal(rows[1].data?.thisSideUp, true)
})

test('medicine rows: errors are explained and bad rows are not importable', () => {
  const sheet = [
    ['Medicine', 'Units per carton', 'Length', 'Width', 'Height', 'Weight'],
    ['Good', 10, 40, 30, 20, 5],
    ['', 10, 40, 30, 20, 5],
    ['No size', 10, '', 30, 20, 5],
    ['Fraction units', 10.5, 40, 30, 20, 5],
    ['Too big', 10, 5000, 30, 20, 5],
  ]
  const { rows } = parseMedicineRows(sheet, [])
  assert.equal(rows[0].data?.maxStack, 4) // blank optional column -> default
  assert.ok(rows[1].errors[0].includes('name'))
  assert.ok(rows[2].errors.some((e) => e.includes('length')))
  assert.ok(rows[3].errors.some((e) => e.includes('whole number')))
  assert.ok(rows[4].errors.some((e) => e.includes('between')))
  assert.ok(rows.slice(1).every((row) => row.data === null))
})

test('medicine rows: duplicates (existing or inside the file) are skipped', () => {
  const sheet = [
    ['Medicine name', 'Units per carton', 'Length', 'Width', 'Height', 'Weight'],
    ['Aspirin', 10, 40, 30, 20, 5],
    ['aspirin ', 10, 40, 30, 20, 5],
    ['Existing One', 10, 40, 30, 20, 5],
  ]
  const { rows } = parseMedicineRows(sheet, ['existing one'])
  assert.ok(rows[0].data)
  assert.equal(rows[1].skipped, 'Already in the catalogue')
  assert.equal(rows[2].skipped, 'Already in the catalogue')
})

test('a missing required column stops the import with a clear message', () => {
  const { fatal } = parseMedicineRows([['Medicine name', 'Units per carton'], ['A', 1]], [])
  assert.ok(fatal?.includes('Carton length'))
})

test('dates: ISO, DD/MM/YYYY, Excel Date, and invalid ones', () => {
  assert.equal(parseDate('2027-03-31'), '2027-03-31')
  assert.equal(parseDate('31/03/2027'), '2027-03-31')
  assert.equal(parseDate('1-2-2027'), '2027-02-01')
  assert.equal(parseDate(new Date(Date.UTC(2027, 2, 31))), '2027-03-31')
  assert.equal(parseDate('31/02/2027'), null)
  assert.equal(parseDate('soon'), null)
})

test('stock rows: names are matched, unknown names and duplicates are reported', () => {
  const warehouses = [{ id: 'w1', name: 'Pune Central Store' }]
  const medicines = [{ id: 'm1', name: 'Paracetamol 500 mg (tablets)' }, { id: 'm2', name: 'Insulin Vials' }]
  const existing = [{ warehouseId: 'w1', medicineId: 'm2', batchNo: 'B2026-052' }]
  const { rows, fatal } = parseStockRows(parseCsv(STOCK_TEMPLATE), warehouses, medicines, existing)
  assert.equal(fatal, null)
  assert.deepEqual(rows[0].data, { warehouseId: 'w1', medicineId: 'm1', cartons: 120, batchNo: 'B2026-041', expiryDate: '2027-03-31' })
  assert.equal(rows[1].skipped, 'This batch already exists')

  const bad = parseStockRows(
    [['Warehouse', 'Medicine', 'Cartons', 'Batch', 'Expiry'], ['Nowhere', 'Insulin Vials', 5, 'X', '2027-01-01'], ['Pune Central Store', 'Unknown', 5, 'X', 'never']],
    warehouses, medicines, [],
  )
  assert.ok(bad.rows[0].errors[0].includes('Unknown warehouse'))
  assert.ok(bad.rows[1].errors.some((e) => e.includes('Unknown medicine')))
  assert.ok(bad.rows[1].errors.some((e) => e.includes('Expiry')))
})
