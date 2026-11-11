import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AppShell } from '../components/AppShell'
import { TextField } from '../components/auth/TextField'
import { LocationPicker } from '../components/map/LocationPicker'
import type { LatLng } from '../components/map/LocationPicker'
import { WarehouseMap } from '../components/map/WarehouseMap'
import { useAuth } from '../hooks/useAuth'
import { getDataErrorMessage } from '../services/dataErrors'
import {
  addSampleWarehouses,
  addWarehouse,
  removeWarehouse,
  subscribeWarehouses,
  updateWarehouse,
} from '../services/warehouseService'
import type { WarehouseRecord } from '../types/warehouse'
import { formatRoomSize, roomVolumeM3 } from '../utils/dimensions'
import { validateNumberInRange } from '../utils/validation'

interface FormErrors {
  name: string
  city: string
  position: string
  length: string
  width: string
  height: string
  shelves: string
  depth: string
  aisle: string
}

const noErrors: FormErrors = { name: '', city: '', position: '', length: '', width: '', height: '', shelves: '', depth: '', aisle: '' }

// Room sizes are typed in centimetres (1 m = 100 cm).
const MIN_CM = 100
const MAX_CM = 50000

export function Warehouses() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'

  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [lengthCm, setLengthCm] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [shelfLevels, setShelfLevels] = useState('1')
  const [rackDepthCm, setRackDepthCm] = useState('100')
  const [aisleCm, setAisleCm] = useState('150')
  const [position, setPosition] = useState<LatLng | null>(null)
  const [errors, setErrors] = useState<FormErrors>(noErrors)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  // When set, the form edits this warehouse instead of adding a new one.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pickerStart, setPickerStart] = useState<LatLng | null>(null)

  const [actionError, setActionError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  // Live list from Firestore. The listener is removed when leaving the page.
  useEffect(() => {
    const unsubscribe = subscribeWarehouses(
      (list) => {
        setWarehouses(list)
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

  function resetForm() {
    setName('')
    setCity('')
    setLengthCm('')
    setWidthCm('')
    setHeightCm('')
    setShelfLevels('1')
    setRackDepthCm('100')
    setAisleCm('150')
    setPosition(null)
    setPickerStart(null)
    setEditingId(null)
    setErrors(noErrors)
    setFormError('')
  }

  function startEditing(item: WarehouseRecord) {
    setEditingId(item.id)
    setName(item.name)
    setCity(item.city)
    setLengthCm(item.lengthCm === null ? '' : String(item.lengthCm))
    setWidthCm(item.widthCm === null ? '' : String(item.widthCm))
    setHeightCm(item.heightCm === null ? '' : String(item.heightCm))
    setShelfLevels(String(item.shelfLevels))
    setRackDepthCm(String(item.rackDepthCm))
    setAisleCm(String(item.aisleCm))
    const point = { lat: item.lat, lng: item.lng }
    setPosition(point)
    setPickerStart(point)
    setErrors(noErrors)
    setFormError('')
    setFormSuccess('')
    document.getElementById('add-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving || !user) return

    const nextErrors: FormErrors = {
      name: !name.trim() ? 'Enter the warehouse name.' : name.trim().length > 80 ? 'Use 80 characters or fewer.' : '',
      city: !city.trim() ? 'Enter the city.' : city.trim().length > 60 ? 'Use 60 characters or fewer.' : '',
      position: position ? '' : 'Pick the location on the map.',
      length: validateNumberInRange(lengthCm, 'room length', MIN_CM, MAX_CM) ?? '',
      width: validateNumberInRange(widthCm, 'room width', MIN_CM, MAX_CM) ?? '',
      height: validateNumberInRange(heightCm, 'room height', MIN_CM, MAX_CM) ?? '',
      shelves: validateNumberInRange(shelfLevels, 'shelf levels', 1, 10, true) ?? '',
      depth: validateNumberInRange(rackDepthCm, 'rack depth', 30, 500) ?? '',
      aisle: validateNumberInRange(aisleCm, 'aisle width', 50, 1000) ?? '',
    }
    setErrors(nextErrors)
    setFormError('')
    setFormSuccess('')
    if (Object.values(nextErrors).some(Boolean) || !position) return

    const input = {
      name,
      city,
      lat: position.lat,
      lng: position.lng,
      lengthCm: Number(lengthCm),
      widthCm: Number(widthCm),
      heightCm: Number(heightCm),
      shelfLevels: Number(shelfLevels),
      rackDepthCm: Number(rackDepthCm),
      aisleCm: Number(aisleCm),
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateWarehouse(editingId, input)
        setFormSuccess(`“${name.trim()}” was updated.`)
      } else {
        await addWarehouse(input, user.uid)
        setFormSuccess(`“${name.trim()}” was added.`)
      }
      resetForm()
    } catch (error) {
      setFormError(getDataErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: WarehouseRecord) {
    if (deletingId) return
    if (!window.confirm(`Remove “${item.name}”?`)) return
    setActionError('')
    setDeletingId(item.id)
    try {
      await removeWarehouse(item.id)
      if (editingId === item.id) resetForm()
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
      await addSampleWarehouses(user.uid)
    } catch (error) {
      setActionError(getDataErrorMessage(error))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <AppShell>
      <div className="page-head">
        <h1>Warehouses</h1>
        <p>
          {isAdmin
            ? 'Add warehouses with their room size and a pin on the map. The room size is used later to pack medicine cartons in 3D.'
            : 'Warehouse locations and room sizes. Only admins can add or edit warehouses.'}
        </p>
      </div>

      {listError && (
        <div className="alert alert-error" role="alert">
          Could not load warehouses: {listError}
        </div>
      )}

      <section className="panel" aria-labelledby="map-heading">
        <h2 id="map-heading">Map</h2>
        <WarehouseMap warehouses={warehouses} />
      </section>

      {isAdmin && (
        <section className="panel" aria-labelledby="add-heading">
          <h2 id="add-heading">{editingId ? 'Edit warehouse' : 'Add a warehouse'}</h2>

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

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <TextField
                id="wh-name"
                label="Warehouse name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Pune Central Store"
                error={errors.name}
                disabled={saving}
              />
              <TextField
                id="wh-city"
                label="City"
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="e.g. Pune"
                error={errors.city}
                disabled={saving}
              />
            </div>

            <div className="form-grid-3">
              <TextField
                id="wh-length"
                label="Room length (cm)"
                type="number"
                inputMode="decimal"
                min={MIN_CM}
                step="any"
                value={lengthCm}
                onChange={(event) => setLengthCm(event.target.value)}
                placeholder="e.g. 1500"
                error={errors.length}
                disabled={saving}
              />
              <TextField
                id="wh-width"
                label="Room width (cm)"
                type="number"
                inputMode="decimal"
                min={MIN_CM}
                step="any"
                value={widthCm}
                onChange={(event) => setWidthCm(event.target.value)}
                placeholder="e.g. 1000"
                error={errors.width}
                disabled={saving}
              />
              <TextField
                id="wh-height"
                label="Room height (cm)"
                type="number"
                inputMode="decimal"
                min={MIN_CM}
                step="any"
                value={heightCm}
                onChange={(event) => setHeightCm(event.target.value)}
                placeholder="e.g. 400"
                error={errors.height}
                disabled={saving}
              />
            </div>
            <p className="map-hint size-hint">
              {formatRoomSize(Number(lengthCm) || null, Number(widthCm) || null, Number(heightCm) || null)
                ? `Room size: ${formatRoomSize(Number(lengthCm) || null, Number(widthCm) || null, Number(heightCm) || null)}`
                : '100 cm = 1 metre. For example 1500 × 1000 × 400 cm is a 15 × 10 × 4 m room.'}
            </p>

            <div className="form-grid-3">
              <TextField
                id="wh-shelves"
                label="Shelf levels (1 = floor stacking)"
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                step={1}
                value={shelfLevels}
                onChange={(event) => setShelfLevels(event.target.value)}
                error={errors.shelves}
                disabled={saving}
              />
              <TextField
                id="wh-depth"
                label="Rack depth (cm)"
                type="number"
                inputMode="decimal"
                step="any"
                value={rackDepthCm}
                onChange={(event) => setRackDepthCm(event.target.value)}
                error={errors.depth}
                disabled={saving}
              />
              <TextField
                id="wh-aisle"
                label="Aisle width (cm)"
                type="number"
                inputMode="decimal"
                step="any"
                value={aisleCm}
                onChange={(event) => setAisleCm(event.target.value)}
                error={errors.aisle}
                disabled={saving}
              />
            </div>
            <p className="map-hint size-hint">
              With 2 or more shelf levels, cartons are placed on racks (rows of shelves with walking aisles). Rack depth and aisle width only matter then.
            </p>

            <div className="field">
              <span className="map-label">
                <strong>Location</strong>
              </span>
              <LocationPicker
                key={editingId ?? 'new'}
                value={position}
                onChange={setPosition}
                disabled={saving}
                startCenter={pickerStart}
              />
              {errors.position && (
                <p className="field-error" role="alert">
                  {errors.position}
                </p>
              )}
            </div>

            <div className="inline-actions">
              <button type="submit" className="btn btn-primary btn-inline" disabled={saving}>
                {saving ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : editingId ? (
                  'Save Changes'
                ) : (
                  'Add Warehouse'
                )}
              </button>
              {editingId && (
                <button type="button" className="btn btn-outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="panel" aria-labelledby="list-heading">
        <h2 id="list-heading">All warehouses ({warehouses.length})</h2>

        {actionError && (
          <div className="alert alert-error" role="alert">
            {actionError}
          </div>
        )}

        {listLoading ? (
          <p className="warehouse-meta" role="status">Loading warehouses…</p>
        ) : warehouses.length === 0 ? (
          <div className="empty-state">
            <p>No warehouses yet.</p>
            {isAdmin && (
              <button type="button" className="btn btn-outline btn-inline" onClick={handleSeed} disabled={seeding}>
                {seeding ? 'Adding…' : 'Add 5 sample warehouses'}
              </button>
            )}
          </div>
        ) : (
          <ul className="warehouse-list">
            {warehouses.map((item) => {
              const size = formatRoomSize(item.lengthCm, item.widthCm, item.heightCm)
              const volume = roomVolumeM3(item.lengthCm, item.widthCm, item.heightCm)
              return (
                <li key={item.id} className="warehouse-item">
                  <div>
                    <div className="warehouse-name">{item.name}</div>
                    <div className="warehouse-meta">
                      {item.city} · {size ? `${size} (${Math.round(volume ?? 0).toLocaleString()} m³)` : 'room size not set'}
                    </div>
                    <div className="warehouse-meta">
                      {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-inline btn-sm"
                        onClick={() => startEditing(item)}
                        disabled={saving}
                        aria-label={`Edit ${item.name}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger-outline"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        aria-label={`Remove ${item.name}`}
                      >
                        {deletingId === item.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
