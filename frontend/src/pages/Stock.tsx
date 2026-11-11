import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { TextField } from '../components/auth/TextField'
import { useAuth } from '../hooks/useAuth'
import { getDataErrorMessage } from '../services/dataErrors'
import { subscribeMedicines } from '../services/medicineService'
import { addSampleStock, addStock, removeStock, subscribeStock, updateStock } from '../services/stockService'
import { subscribeWarehouses } from '../services/warehouseService'
import type { MedicineRecord } from '../types/medicine'
import type { StockRecord } from '../types/stock'
import type { WarehouseRecord } from '../types/warehouse'
import { downloadCsv, todayStamp, toCsv } from '../utils/csvExport'
import { daysUntil, expiryText, isValidIsoDate } from '../utils/expiry'
import { validateNumberInRange } from '../utils/validation'

interface FormErrors {
  warehouse: string
  medicine: string
  cartons: string
  batchNo: string
  expiry: string
}

const noErrors: FormErrors = { warehouse: '', medicine: '', cartons: '', batchNo: '', expiry: '' }

export function Stock() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([])
  const [medicines, setMedicines] = useState<MedicineRecord[]>([])
  const [stock, setStock] = useState<StockRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [filterId, setFilterId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [medicineId, setMedicineId] = useState('')
  const [cartons, setCartons] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [expiry, setExpiry] = useState('')
  const [errors, setErrors] = useState<FormErrors>(noErrors)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [editing, setEditing] = useState<StockRecord | null>(null)

  // Three live lists. All listeners are removed when leaving the page.
  useEffect(() => {
    const onError = (error: unknown) => {
      setLoadError(getDataErrorMessage(error))
      setLoading(false)
    }
    const unsubscribes = [
      subscribeWarehouses(setWarehouses, onError),
      subscribeMedicines(setMedicines, onError),
      subscribeStock((list) => {
        setStock(list)
        setLoadError('')
        setLoading(false)
      }, onError),
    ]
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [])

  const warehouseName = useMemo(() => new Map(warehouses.map((item) => [item.id, item.name])), [warehouses])
  const medicineById = useMemo(() => new Map(medicines.map((item) => [item.id, item])), [medicines])
  const labelFor = (item: { medicineId: string; warehouseId: string }) =>
    `${medicineById.get(item.medicineId)?.name ?? 'Removed medicine'} at ${warehouseName.get(item.warehouseId) ?? 'removed warehouse'}`
  const shown = filterId ? stock.filter((item) => item.warehouseId === filterId) : stock

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !user) return

    const nextErrors: FormErrors = {
      warehouse: editing || warehouseId ? '' : 'Choose a warehouse.',
      medicine: editing || medicineId ? '' : 'Choose a medicine.',
      cartons: validateNumberInRange(cartons, 'number of cartons', 1, 100000, true) ?? '',
      batchNo: !batchNo.trim() ? 'Enter the batch number.' : batchNo.trim().length > 40 ? 'Use 40 characters or fewer.' : '',
      expiry: !expiry ? 'Choose the expiry date.' : isValidIsoDate(expiry) ? '' : 'Enter a valid date.',
    }
    setErrors(nextErrors)
    setFormError('')
    setFormSuccess('')
    if (Object.values(nextErrors).some(Boolean)) return

    setSaving(true)
    try {
      const actor = { uid: user.uid, email: user.email ?? '' }
      if (editing) {
        await updateStock(editing, { cartons: Number(cartons), batchNo, expiryDate: expiry }, actor, labelFor(editing))
        setEditing(null)
      } else {
        await addStock({ warehouseId, medicineId, cartons: Number(cartons), batchNo, expiryDate: expiry }, actor, labelFor({ warehouseId, medicineId }))
      }
      setFormSuccess(`Batch “${batchNo.trim()}” was ${editing ? 'updated' : 'added'}.`)
      setCartons('')
      setBatchNo('')
      setExpiry('')
    } catch (error) {
      setFormError(getDataErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(item: StockRecord) {
    setEditing(item)
    setWarehouseId(item.warehouseId)
    setMedicineId(item.medicineId)
    setCartons(String(item.cartons))
    setBatchNo(item.batchNo)
    setExpiry(item.expiryDate)
    setErrors(noErrors)
    setFormError('')
    setFormSuccess('')
    document.getElementById('stock-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditing(null)
    setCartons('')
    setBatchNo('')
    setExpiry('')
    setErrors(noErrors)
  }

  async function handleRemove(item: StockRecord) {
    if (busyId || !window.confirm(`Remove batch “${item.batchNo}”?`)) return
    setActionError('')
    setBusyId(item.id)
    try {
      await removeStock(item, { uid: user?.uid ?? '', email: user?.email ?? '' }, labelFor(item))
    } catch (error) {
      setActionError(getDataErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  function exportStock() {
    downloadCsv(
      `stock-${todayStamp()}.csv`,
      toCsv(
        ['Warehouse', 'Medicine', 'Batch', 'Cartons', 'Units', 'Expiry date', 'Days left'],
        shown.map((item) => {
          const medicine = medicineById.get(item.medicineId)
          return [
            warehouseName.get(item.warehouseId) ?? 'Removed warehouse',
            medicine?.name ?? 'Removed medicine',
            item.batchNo,
            item.cartons,
            medicine ? item.cartons * medicine.unitsPerCarton : null,
            item.expiryDate,
            daysUntil(item.expiryDate),
          ]
        }),
      ),
    )
  }

  async function handleSeed() {
    if (seeding || !user) return
    setActionError('')
    setSeeding(true)
    try {
      const added = await addSampleStock(warehouses, medicines, user.uid)
      if (added === 0) setActionError('Add warehouses (with room sizes) and medicines first.')
    } catch (error) {
      setActionError(getDataErrorMessage(error))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <h1>Stock batches</h1>
        <p>
          {isAdmin
            ? 'Record how many cartons of each medicine a warehouse holds, with batch number and expiry date.'
            : 'Medicine stock in every warehouse, with expiry dates.'}
        </p>
      </div>

      {loadError && (
        <div className="alert alert-error" role="alert">
          Could not load data: {loadError}
        </div>
      )}

      {isAdmin && (
        <section className="panel" aria-labelledby="add-stock-heading">
          <h2 id="add-stock-heading">{editing ? 'Edit a batch' : 'Add a batch'}</h2>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          {formSuccess && <div className="alert alert-success" role="status">{formSuccess}</div>}

          <form id="stock-form" onSubmit={handleSubmit} noValidate>
            {editing && <p className="warehouse-meta">Editing {labelFor(editing)}. The warehouse and medicine cannot be changed: remove the batch and add a new one for that.</p>}
            <div className="form-grid">
              <div className="field">
                <label htmlFor="st-warehouse">Warehouse</label>
                <select
                  id="st-warehouse"
                  className={errors.warehouse ? 'input input-invalid' : 'input'}
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  disabled={saving || editing !== null}
                >
                  <option value="">Choose a warehouse…</option>
                  {warehouses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                {errors.warehouse && <p className="field-error" role="alert">{errors.warehouse}</p>}
              </div>
              <div className="field">
                <label htmlFor="st-medicine">Medicine</label>
                <select
                  id="st-medicine"
                  className={errors.medicine ? 'input input-invalid' : 'input'}
                  value={medicineId}
                  onChange={(event) => setMedicineId(event.target.value)}
                  disabled={saving || editing !== null}
                >
                  <option value="">Choose a medicine…</option>
                  {medicines.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                {errors.medicine && <p className="field-error" role="alert">{errors.medicine}</p>}
              </div>
            </div>

            <div className="form-grid-3">
              <TextField
                id="st-cartons"
                label="Number of cartons"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={cartons}
                onChange={(event) => setCartons(event.target.value)}
                placeholder="e.g. 120"
                error={errors.cartons}
                disabled={saving}
              />
              <TextField
                id="st-batch"
                label="Batch number"
                type="text"
                value={batchNo}
                onChange={(event) => setBatchNo(event.target.value)}
                placeholder="e.g. B2026-041"
                error={errors.batchNo}
                disabled={saving}
              />
              <TextField
                id="st-expiry"
                label="Expiry date"
                type="date"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                error={errors.expiry}
                disabled={saving}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-inline" disabled={saving}>
              {saving ? (<><span className="spinner" aria-hidden="true" />Saving…</>) : editing ? 'Save changes' : 'Add Batch'}
            </button>
            {editing && (
              <button type="button" className="btn btn-outline btn-inline" onClick={cancelEdit} disabled={saving}>
                Cancel edit
              </button>
            )}
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="stock-list-heading">
        <div className="panel-head">
          <h2 id="stock-list-heading">All batches ({shown.length})</h2>
          {shown.length > 0 && <button type="button" className="btn btn-outline btn-sm csv-btn" onClick={exportStock}>Download CSV</button>}
          <div className="field inline-field">
            <label htmlFor="st-filter">Show</label>
            <select id="st-filter" className="input" value={filterId} onChange={(event) => setFilterId(event.target.value)}>
              <option value="">All warehouses</option>
              {warehouses.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}

        {loading ? (
          <p className="warehouse-meta" role="status">Loading stock…</p>
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <p>No stock batches yet.</p>
            {isAdmin && (
              <button type="button" className="btn btn-outline btn-inline" onClick={handleSeed} disabled={seeding}>
                {seeding ? 'Adding…' : 'Add sample stock'}
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Stock batches, earliest expiry first</caption>
              <thead>
                <tr>
                  <th scope="col">Warehouse</th>
                  <th scope="col">Medicine</th>
                  <th scope="col">Batch</th>
                  <th scope="col">Cartons</th>
                  <th scope="col">Units</th>
                  <th scope="col">Expiry</th>
                  {isAdmin && <th scope="col"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const medicine = medicineById.get(item.medicineId)
                  const days = daysUntil(item.expiryDate)
                  return (
                    <tr key={item.id}>
                      <td>{warehouseName.get(item.warehouseId) ?? 'Removed warehouse'}</td>
                      <td className="cell-strong">{medicine?.name ?? 'Removed medicine'}</td>
                      <td>{item.batchNo}</td>
                      <td>{item.cartons.toLocaleString()}</td>
                      <td>{medicine ? (item.cartons * medicine.unitsPerCarton).toLocaleString() : '—'}</td>
                      <td>
                        {item.expiryDate}{' '}
                        <span className={days <= 30 ? 'badge badge-danger' : days <= 90 ? 'badge badge-warn' : 'badge'}>
                          {expiryText(days)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="row-actions">
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(item)} aria-label={`Edit batch ${item.batchNo}`}>
                            Edit
                          </button>{' '}
                          <button
                            type="button"
                            className="btn btn-danger-outline"
                            onClick={() => handleRemove(item)}
                            disabled={busyId === item.id}
                            aria-label={`Remove batch ${item.batchNo}`}
                          >
                            {busyId === item.id ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}
