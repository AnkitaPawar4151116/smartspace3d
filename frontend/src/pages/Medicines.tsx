import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { TextField } from '../components/auth/TextField'
import { useAuth } from '../hooks/useAuth'
import { getDataErrorMessage } from '../services/dataErrors'
import {
  addMedicine,
  addSampleMedicines,
  removeMedicine,
  subscribeMedicines,
  updateMedicine,
} from '../services/medicineService'
import type { MedicineRecord } from '../types/medicine'
import { formatCartonSize } from '../utils/dimensions'
import { validateNumberInRange } from '../utils/validation'

interface FormErrors {
  name: string
  units: string
  length: string
  width: string
  height: string
  weight: string
  stack: string
  reorder: string
}

const noErrors: FormErrors = { name: '', units: '', length: '', width: '', height: '', weight: '', stack: '', reorder: '' }

export function Medicines() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'

  const [medicines, setMedicines] = useState<MedicineRecord[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [name, setName] = useState('')
  const [units, setUnits] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [maxStack, setMaxStack] = useState('')
  const [reorder, setReorder] = useState('0')
  const [fragile, setFragile] = useState(false)
  const [thisSideUp, setThisSideUp] = useState(false)
  const [errors, setErrors] = useState<FormErrors>(noErrors)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeMedicines(
      (list) => {
        setMedicines(list)
        setListError('')
        setListLoading(false)
      },
      (error) => {
        setListError(getDataErrorMessage(error))
        setListLoading(false)
      },
    )
    return unsubscribe
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !user) return

    const nextErrors: FormErrors = {
      name: !name.trim() ? 'Enter the medicine name.' : name.trim().length > 100 ? 'Use 100 characters or fewer.' : '',
      units: validateNumberInRange(units, 'units per carton', 1, 1000000, true) ?? '',
      length: validateNumberInRange(lengthCm, 'carton length', 1, 1000) ?? '',
      width: validateNumberInRange(widthCm, 'carton width', 1, 1000) ?? '',
      height: validateNumberInRange(heightCm, 'carton height', 1, 1000) ?? '',
      weight: validateNumberInRange(weightKg, 'carton weight', 0.01, 2000) ?? '',
      stack: validateNumberInRange(maxStack, 'maximum stack height', 1, 100, true) ?? '',
      reorder: validateNumberInRange(reorder, 'low-stock level', 0, 1000000, true) ?? '',
    }
    setErrors(nextErrors)
    setFormError('')
    setFormSuccess('')
    if (Object.values(nextErrors).some(Boolean)) return

    setSaving(true)
    try {
      const input = {
          name,
          unitsPerCarton: Number(units),
          cartonLengthCm: Number(lengthCm),
          cartonWidthCm: Number(widthCm),
          cartonHeightCm: Number(heightCm),
          cartonWeightKg: Number(weightKg),
          maxStack: Number(maxStack),
          fragile,
          thisSideUp,
          reorderLevelCartons: Number(reorder),
        }
      if (editingId) {
        await updateMedicine(editingId, input, { uid: user.uid, email: user.email ?? '' })
        setEditingId(null)
      } else {
        await addMedicine(input, user.uid)
      }
      setFormSuccess(`“${name.trim()}” was ${editingId ? 'updated' : 'added'}.`)
      setName('')
      setUnits('')
      setLengthCm('')
      setWidthCm('')
      setHeightCm('')
      setWeightKg('')
      setMaxStack('')
      setReorder('0')
      setFragile(false)
      setThisSideUp(false)
    } catch (error) {
      setFormError(getDataErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function startEdit(item: MedicineRecord) {
    setEditingId(item.id)
    setName(item.name)
    setUnits(String(item.unitsPerCarton))
    setLengthCm(String(item.cartonLengthCm))
    setWidthCm(String(item.cartonWidthCm))
    setHeightCm(String(item.cartonHeightCm))
    setWeightKg(String(item.cartonWeightKg))
    setMaxStack(String(item.maxStack))
    setReorder(String(item.reorderLevelCartons))
    setFragile(item.fragile)
    setThisSideUp(item.thisSideUp)
    setErrors(noErrors)
    setFormError('')
    setFormSuccess('')
    document.getElementById('medicine-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setName('')
    setUnits('')
    setLengthCm('')
    setWidthCm('')
    setHeightCm('')
    setWeightKg('')
    setMaxStack('')
    setReorder('0')
    setFragile(false)
    setThisSideUp(false)
    setErrors(noErrors)
  }

  async function handleDelete(item: MedicineRecord) {
    if (deletingId) return
    if (!window.confirm(`Remove “${item.name}” from the catalogue?`)) return
    setActionError('')
    setDeletingId(item.id)
    try {
      await removeMedicine(item, { uid: user?.uid ?? '', email: user?.email ?? '' })
    } catch (error) {
      setActionError(getDataErrorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSeed() {
    if (seeding || !user) return
    setActionError('')
    setSeeding(true)
    try {
      await addSampleMedicines(user.uid)
    } catch (error) {
      setActionError(getDataErrorMessage(error))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <h1>Medicine catalogue</h1>
        <p>
          {isAdmin
            ? 'Add each medicine with the size of its carton. These sizes decide how cartons are packed into a warehouse room.'
            : 'Medicines and their carton sizes. Only admins can add or remove medicines.'}
        </p>
      </div>

      {listError && (
        <div className="alert alert-error" role="alert">
          Could not load medicines: {listError}
        </div>
      )}

      {isAdmin && (
        <section className="panel" aria-labelledby="add-med-heading">
          <h2 id="add-med-heading">{editingId ? 'Edit medicine' : 'Add a medicine'}</h2>

          {formError && (
            <div className="alert alert-error" role="alert">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="alert alert-success" role="status">
              {formSuccess}
            </div>
          )}

          <form id="medicine-form" onSubmit={handleSubmit} noValidate>
            {editingId && <p className="warehouse-meta">Editing a medicine. Existing stock keeps pointing at it.</p>}
            <div className="form-grid">
              <TextField
                id="med-name"
                label="Medicine name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Paracetamol 500 mg (tablets)"
                error={errors.name}
                disabled={saving}
              />
              <TextField
                id="med-units"
                label="Units per carton"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={units}
                onChange={(event) => setUnits(event.target.value)}
                placeholder="e.g. 100"
                error={errors.units}
                disabled={saving}
              />
            </div>

            <div className="form-grid-3">
              <TextField
                id="med-length"
                label="Carton length (cm)"
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={lengthCm}
                onChange={(event) => setLengthCm(event.target.value)}
                placeholder="e.g. 40"
                error={errors.length}
                disabled={saving}
              />
              <TextField
                id="med-width"
                label="Carton width (cm)"
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={widthCm}
                onChange={(event) => setWidthCm(event.target.value)}
                placeholder="e.g. 30"
                error={errors.width}
                disabled={saving}
              />
              <TextField
                id="med-height"
                label="Carton height (cm)"
                type="number"
                inputMode="decimal"
                min={1}
                step="any"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                placeholder="e.g. 25"
                error={errors.height}
                disabled={saving}
              />
            </div>

            <div className="form-grid-3">
              <TextField
                id="med-weight"
                label="Carton weight (kg)"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
                placeholder="e.g. 8"
                error={errors.weight}
                disabled={saving}
              />
              <TextField
                id="med-stack"
                label="Max cartons stacked high"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={maxStack}
                onChange={(event) => setMaxStack(event.target.value)}
                placeholder="e.g. 6"
                error={errors.stack}
                disabled={saving}
              />
              <TextField
                id="med-reorder"
                label="Low-stock warning (cartons, 0 = off)"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={reorder}
                onChange={(event) => setReorder(event.target.value)}
                error={errors.reorder}
                disabled={saving}
              />
            </div>

            <div className="check-group">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={fragile}
                  onChange={(event) => setFragile(event.target.checked)}
                  disabled={saving}
                />
                <span>
                  <strong>Fragile</strong>: keep on top of stacks
                </span>
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={thisSideUp}
                  onChange={(event) => setThisSideUp(event.target.checked)}
                  disabled={saving}
                />
                <span>
                  <strong>This side up</strong>: must not be laid on its side
                </span>
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-inline" disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Saving…
                </>
              ) : (
                editingId ? 'Save changes' : 'Add Medicine'
              )}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline btn-inline" onClick={cancelEdit} disabled={saving}>
                Cancel edit
              </button>
            )}
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="med-list-heading">
        <h2 id="med-list-heading">All medicines ({medicines.length})</h2>

        {actionError && (
          <div className="alert alert-error" role="alert">
            {actionError}
          </div>
        )}

        {listLoading ? (
          <p className="warehouse-meta" role="status">Loading medicines…</p>
        ) : medicines.length === 0 ? (
          <div className="empty-state">
            <p>No medicines yet.</p>
            {isAdmin && (
              <button type="button" className="btn btn-outline btn-inline" onClick={handleSeed} disabled={seeding}>
                {seeding ? 'Adding…' : 'Add 4 sample medicines'}
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">Medicines and their carton sizes</caption>
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col">Carton size</th>
                  <th scope="col">Weight</th>
                  <th scope="col">Units / carton</th>
                  <th scope="col">Max stack</th>
                  <th scope="col">Low-stock level</th>
                  <th scope="col">Handling</th>
                  {isAdmin && <th scope="col"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {medicines.map((item) => (
                  <tr key={item.id}>
                    <td className="cell-strong">{item.name}</td>
                    <td>{formatCartonSize(item.cartonLengthCm, item.cartonWidthCm, item.cartonHeightCm)}</td>
                    <td>{item.cartonWeightKg} kg</td>
                    <td>{item.unitsPerCarton.toLocaleString()}</td>
                    <td>{item.maxStack}</td>
                    <td>{item.reorderLevelCartons > 0 ? `${item.reorderLevelCartons.toLocaleString()} cartons` : 'off'}</td>
                    <td>
                      {item.fragile && <span className="badge badge-warn">Fragile</span>}{' '}
                      {item.thisSideUp && <span className="badge">This side up</span>}
                      {!item.fragile && !item.thisSideUp && <span className="warehouse-meta">Normal</span>}
                    </td>
                    {isAdmin && (
                      <td className="row-actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(item)} aria-label={`Edit ${item.name}`}>
                          Edit
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-danger-outline"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          aria-label={`Remove ${item.name}`}
                        >
                          {deletingId === item.id ? 'Removing…' : 'Remove'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}
