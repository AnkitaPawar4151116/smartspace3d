import assert from 'node:assert/strict'
import test from 'node:test'
import { findMergeTarget } from '../src/utils/transfer.ts'

const base = { id: 's1', warehouseId: 'A', medicineId: 'm', cartons: 5, batchNo: 'B1', expiryDate: '2027-01-01' }

test('finds the same batch at the target warehouse', () => {
  const other = { ...base, id: 's2', warehouseId: 'B', cartons: 9 }
  assert.equal(findMergeTarget([base, other], base, 'B')?.id, 's2')
})

test('different batch number, expiry, medicine or warehouse does not merge', () => {
  const list = [
    { ...base, id: 'a', warehouseId: 'B', batchNo: 'B2' },
    { ...base, id: 'b', warehouseId: 'B', expiryDate: '2027-02-01' },
    { ...base, id: 'c', warehouseId: 'B', medicineId: 'x' },
    { ...base, id: 'd', warehouseId: 'C' },
  ]
  assert.equal(findMergeTarget([base, ...list], base, 'B'), null)
})
