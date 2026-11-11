import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { TextField } from '../components/auth/TextField'
import { LocationPicker } from '../components/map/LocationPicker'
import type { LatLng } from '../components/map/LocationPicker'
import { useAuth } from '../hooks/useAuth'
import { useInventoryData } from '../hooks/useInventoryData'
import { getDataErrorMessage } from '../services/dataErrors'
import { createOrder } from '../services/orderService'
import { expiryText } from '../utils/expiry'
import { planLookup } from '../utils/lookup'
import type { Draw } from '../utils/lookup'
import { linesFromPlan } from '../utils/orders'

const km = (value: number) => `${Math.round(value).toLocaleString()} km`

function DrawList({ draws }: { draws: Draw[] }) {
  return (
    <ul className="plan-list">
      {draws.map((draw) => (
        <li key={draw.option.warehouse.id}>
          <strong>{draw.units.toLocaleString()} units</strong> ({draw.cartons} cartons) from{' '}
          <strong>{draw.option.warehouse.name}</strong>, {draw.option.warehouse.city}, about {km(draw.option.distanceKm)} away
          <span className="warehouse-meta">
            Take batches: {draw.batches.map((batch) => `${batch.batchNo} (${batch.cartons} cartons, ${expiryText(batch.expiryDays)})`).join('; ')}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function Lookup() {
  const { user } = useAuth()
  const { warehouses, medicines, stock, loading, error } = useInventoryData()
  const [note, setNote] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requested, setRequested] = useState(false)

  const [medicineId, setMedicineId] = useState('')
  const [units, setUnits] = useState('1200')
  const [position, setPosition] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [pickerKey, setPickerKey] = useState(0)

  const medicine = medicines.find((item) => item.id === medicineId) ?? null
  const unitsNumber = Number(units)
  const unitsValid = Number.isInteger(unitsNumber) && unitsNumber > 0 && unitsNumber <= 100_000_000

  const plan = useMemo(() => {
    if (!medicine || !position || !unitsValid) return null
    return planLookup({ warehouses, stock, medicine, units: unitsNumber, fromLat: position.lat, fromLng: position.lng })
  }, [medicine, position, unitsValid, unitsNumber, warehouses, stock])

  const canRequest = plan !== null && linesFromPlan(plan) !== null

  async function handleRequest() {
    if (!plan || !medicine || !position || !user || requesting) return
    setRequesting(true)
    setRequestError('')
    try {
      await createOrder(
        { medicineId: medicine.id, medicineName: medicine.name, units: unitsNumber, cartons: plan.cartonsNeeded, lat: position.lat, lng: position.lng, note },
        { uid: user.uid, email: user.email ?? '' },
      )
      setRequested(true)
      setNote('')
    } catch (err) {
      setRequestError(getDataErrorMessage(err))
    } finally {
      setRequesting(false)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Your browser cannot share its location. Search a place or click the map instead.')
      return
    }
    setLocating(true)
    setLocationMessage('')
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude })
        setPickerKey((key) => key + 1) // reopen the map zoomed on the new point
        setLocating(false)
      },
      () => {
        setLocationMessage('Could not get your location. Search a place or click the map instead.')
        setLocating(false)
      },
      { timeout: 10000 },
    )
  }

  return (
    <AppShell>
      <div className="page-head">
        <h1>Find stock near you</h1>
        <p>Enter a medicine, the quantity you need and your location. If the nearest warehouse is out of stock, you are pointed to the next one.</p>
      </div>

      {error && <div className="alert alert-error" role="alert">Could not load data: {error}</div>}

      <section className="panel">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="lk-medicine">Medicine</label>
            <select id="lk-medicine" className="input" value={medicineId} onChange={(event) => setMedicineId(event.target.value)} disabled={loading}>
              <option value="">{loading ? 'Loading…' : 'Choose a medicine…'}</option>
              {medicines.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <TextField
            id="lk-units"
            label="Quantity needed (units)"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={units}
            onChange={(event) => setUnits(event.target.value)}
            error={units !== '' && !unitsValid ? 'Enter a whole number greater than zero.' : ''}
          />
        </div>

        <div className="field">
          <span className="map-label"><strong>Your location</strong></span>
          <div className="inline-actions locate-row">
            <button type="button" className="btn btn-outline btn-inline btn-sm" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Locating…' : 'Use my current location'}
            </button>
            {locationMessage && <span className="field-error">{locationMessage}</span>}
          </div>
          <LocationPicker key={pickerKey} value={position} onChange={setPosition} startCenter={pickerKey > 0 ? position : null} />
        </div>
      </section>

      {!plan ? (
        <div className="empty-state">
          <p>{!medicine ? 'Choose a medicine' : !unitsValid ? 'Enter a valid quantity' : 'Set your location'} to see where it is available.</p>
        </div>
      ) : (
        <>
          <section className="panel" aria-labelledby="result-heading">
            <h2 id="result-heading">Result</h2>
            <p className="warehouse-meta result-note">
              {unitsNumber.toLocaleString()} units of {medicine?.name} = {plan.cartonsNeeded} cartons ({medicine?.unitsPerCarton} units per carton, rounded up).
            </p>

            {plan.options.length === 0 ? (
              <div className="alert alert-error" role="status">
                No warehouse has usable stock of this medicine{plan.expiredCartons > 0 ? ` (${plan.expiredCartons} expired cartons are not offered)` : ''}.
              </div>
            ) : plan.singleSource ? (
              <div className="alert alert-success" role="status">
                {plan.nearestHasEnough
                  ? <>The nearest warehouse can supply the whole order.</>
                  : <>Your nearest warehouse does not have enough. The closest one that can supply the whole order is below.</>}
                <DrawList draws={[plan.singleSource]} />
              </div>
            ) : (
              <div className="alert alert-warn" role="status">
                No single warehouse has enough, so the order is split across the nearest warehouses:
                <DrawList draws={plan.split} />
                {plan.shortfallCartons > 0 && (
                  <p className="shortfall">
                    All warehouses together are <strong>{plan.shortfallUnits.toLocaleString()} units</strong> ({plan.shortfallCartons} cartons) short. A restock is needed.
                  </p>
                )}
              </div>
            )}
            {plan.options.length > 0 && (
              <div className="request-box">
                {requested ? (
                  <div className="alert alert-success" role="status">
                    Request sent. An admin will review it. <Link to="/orders">See my orders</Link>
                  </div>
                ) : canRequest ? (
                  <>
                    {requestError && <div className="alert alert-error" role="alert">{requestError}</div>}
                    <div className="inline-actions">
                      <input
                        className="input"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={200}
                        placeholder="Note for the admin (optional)"
                        aria-label="Note for the admin"
                      />
                      <button type="button" className="btn btn-primary btn-inline" onClick={handleRequest} disabled={requesting}>
                        {requesting ? 'Sending…' : 'Request this order'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="warehouse-meta">The full quantity is not available, so it cannot be requested yet.</p>
                )}
              </div>
            )}
            {plan.expiredCartons > 0 && plan.options.length > 0 && (
              <p className="warehouse-meta">{plan.expiredCartons} expired cartons were left out.</p>
            )}
          </section>

          {plan.options.length > 0 && (
            <section className="panel" aria-labelledby="all-heading">
              <h2 id="all-heading">All warehouses with this medicine (nearest first)</h2>
              <div className="table-wrap">
                <table className="data-table">
                  <caption className="sr-only">Warehouses holding this medicine, nearest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Warehouse</th>
                      <th scope="col">Distance</th>
                      <th scope="col">Available</th>
                      <th scope="col">Soonest expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.options.map((option, index) => (
                      <tr key={option.warehouse.id}>
                        <td className="cell-strong">
                          {option.warehouse.name}, {option.warehouse.city}
                          {index === 0 && <> <span className="badge badge-success">Nearest</span></>}
                        </td>
                        <td>{km(option.distanceKm)}</td>
                        <td>{option.availableUnits.toLocaleString()} units ({option.availableCartons} cartons)</td>
                        <td>
                          <span className={option.soonestExpiryDays <= 30 ? 'badge badge-danger' : option.soonestExpiryDays <= 90 ? 'badge badge-warn' : 'badge'}>
                            {expiryText(option.soonestExpiryDays)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="map-hint">Distances are straight-line, not road distance. Stock is only taken out when an admin approves your request.</p>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
