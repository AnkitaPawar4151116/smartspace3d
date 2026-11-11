import { useMemo, useState } from 'react'
import { cities, medicines, stock, warehouses } from '../../data/demoInventory'
import { planFulfilment } from '../../utils/nearest'

const EXPIRY_SOON_DAYS = 60

function formatKm(value: number): string {
  return `${Math.round(value)} km`
}

// Interactive demo: pick a medicine, a quantity and where you are.
// It then shows which warehouse should supply the order.
export function StockFinder() {
  const [medicineId, setMedicineId] = useState(medicines[0].id)
  const [quantity, setQuantity] = useState(1200)
  const [cityName, setCityName] = useState('Pune')

  const plan = useMemo(() => {
    const city = cities.find((item) => item.name === cityName) ?? cities[0]
    return planFulfilment(warehouses, stock, medicineId, quantity, city.lat, city.lng)
  }, [medicineId, quantity, cityName])

  const nearestWarehouseId = plan.options[0]?.warehouse.id
  const validQuantity = Number.isFinite(quantity) && quantity > 0

  return (
    <div className="finder">
      <div className="finder-controls">
        <div className="field">
          <label htmlFor="finder-medicine">Medicine</label>
          <select
            id="finder-medicine"
            className="input"
            value={medicineId}
            onChange={(event) => setMedicineId(event.target.value)}
          >
            {medicines.map((medicine) => (
              <option key={medicine.id} value={medicine.id}>
                {medicine.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="finder-qty">Quantity needed</label>
          <input
            id="finder-qty"
            className="input"
            type="number"
            min={1}
            value={Number.isFinite(quantity) ? quantity : ''}
            onChange={(event) => setQuantity(event.target.valueAsNumber)}
          />
        </div>
        <div className="field">
          <label htmlFor="finder-city">Your location</label>
          <select
            id="finder-city"
            className="input"
            value={cityName}
            onChange={(event) => setCityName(event.target.value)}
          >
            {cities.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!validQuantity ? (
        <p className="finder-note">Enter a quantity greater than zero.</p>
      ) : (
        <>
          <div
            className={
              plan.singleSource ? 'finder-result finder-ok' : plan.shortfall > 0 ? 'finder-result finder-bad' : 'finder-result finder-warn'
            }
            role="status"
          >
            {plan.singleSource ? (
              <>
                <strong>{plan.singleSource.warehouse.name}</strong> ({plan.singleSource.warehouse.city}, about{' '}
                {formatKm(plan.singleSource.distance)} away) has all {quantity.toLocaleString()} units.
                {plan.singleSource.warehouse.id !== nearestWarehouseId && (
                  <> Your nearest store does not have enough, so this is the closest one that does.</>
                )}
              </>
            ) : plan.shortfall > 0 ? (
              <>
                No combination of warehouses can supply {quantity.toLocaleString()} units. The network can provide{' '}
                {(quantity - plan.shortfall).toLocaleString()}; {plan.shortfall.toLocaleString()} units short. Raise a restock request.
              </>
            ) : (
              <>
                No single warehouse has {quantity.toLocaleString()} units, so the order is split across the nearest stores:
                <ul className="split-list">
                  {plan.split.map(({ option, take }) => (
                    <li key={option.warehouse.id}>
                      <strong>{take.toLocaleString()}</strong> from {option.warehouse.name} ({formatKm(option.distance)})
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="finder-table-wrap">
            <table className="finder-table">
              <caption className="sr-only">Warehouses holding this medicine, nearest first</caption>
              <thead>
                <tr>
                  <th scope="col">Warehouse</th>
                  <th scope="col">Distance</th>
                  <th scope="col">In stock</th>
                  <th scope="col">Batch expiry</th>
                </tr>
              </thead>
              <tbody>
                {plan.options.map((option) => (
                  <tr key={option.warehouse.id}>
                    <td>
                      {option.warehouse.name}
                      {option.warehouse.id === nearestWarehouseId && <span className="badge badge-success"> Nearest</span>}
                    </td>
                    <td>{formatKm(option.distance)}</td>
                    <td>{option.units.toLocaleString()}</td>
                    <td>
                      {option.expiresInDays <= EXPIRY_SOON_DAYS ? (
                        <span className="badge badge-warn">{option.expiresInDays} days – use first</span>
                      ) : (
                        `${option.expiresInDays} days`
                      )}
                    </td>
                  </tr>
                ))}
                {plan.options.length === 0 && (
                  <tr>
                    <td colSpan={4}>No warehouse currently holds this medicine.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="finder-note">
        Demo data: warehouses, stock and distances (straight-line) are sample values, not a live inventory.
      </p>
    </div>
  )
}
