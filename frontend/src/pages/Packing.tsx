import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { PackingScene } from '../components/packing/PackingScene'
import { getDataErrorMessage } from '../services/dataErrors'
import { subscribeMedicines } from '../services/medicineService'
import { subscribeStock } from '../services/stockService'
import { subscribeWarehouses } from '../services/warehouseService'
import type { MedicineRecord } from '../types/medicine'
import type { StockRecord } from '../types/stock'
import type { WarehouseRecord } from '../types/warehouse'
import { formatRoomSize } from '../utils/dimensions'
import { expiryText } from '../utils/expiry'
import { packWarehouse } from '../utils/packing'
import type { PackBatch, Placement } from '../utils/packing'
import { buildBatches, roomOf } from '../utils/packingInput'

type ColorMode = 'medicine' | 'expiry'

const MEDICINE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b']
const EXPIRY_COLORS = { soon: '#ef4444', warning: '#f59e0b', ok: '#10b981' }

function expiryColor(days: number): string {
  return days <= 30 ? EXPIRY_COLORS.soon : days <= 90 ? EXPIRY_COLORS.warning : EXPIRY_COLORS.ok
}

export function Packing() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([])
  const [medicines, setMedicines] = useState<MedicineRecord[]>([])
  const [stock, setStock] = useState<StockRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [chosenId, setChosenId] = useState('')
  const [colorMode, setColorMode] = useState<ColorMode>('medicine')
  const [hover, setHover] = useState<Placement | null>(null)

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
        setLoading(false)
      }, onError),
    ]
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [])

  const withSize = useMemo(
    () => warehouses.filter((item) => item.lengthCm !== null && item.widthCm !== null && item.heightCm !== null),
    [warehouses],
  )
  const selected = useMemo(
    () => withSize.find((item) => item.id === chosenId) ?? withSize[0] ?? null,
    [withSize, chosenId],
  )

  // The packing is calculated here, in the browser, whenever the stock changes.
  const { batches, result } = useMemo(() => {
    const packRoomSpec = selected ? roomOf(selected) : null
    if (!selected || !packRoomSpec) {
      return { batches: [] as PackBatch[], result: null }
    }
    const list = buildBatches(stock, medicines, selected.id)
    return { batches: list, result: packWarehouse(packRoomSpec, list) }
  }, [selected, stock, medicines])

  const batchById = useMemo(() => new Map(batches.map((item) => [item.id, item])), [batches])
  const medicineColor = useMemo(
    () => new Map(medicines.map((item, index) => [item.id, MEDICINE_COLORS[index % MEDICINE_COLORS.length]])),
    [medicines],
  )

  const colorOf = useCallback(
    (placement: Placement) => {
      const batch = batchById.get(placement.batchId)
      if (!batch) return '#94a3b8'
      return colorMode === 'expiry' ? expiryColor(batch.expiryDays) : (medicineColor.get(batch.medicineId) ?? '#94a3b8')
    },
    [batchById, colorMode, medicineColor],
  )

  const hoverBatch = hover ? batchById.get(hover.batchId) : undefined
  const room = selected ? roomOf(selected) : null

  const placedByBatch = new Map<string, number>()
  result?.placements.forEach((p) => placedByBatch.set(p.batchId, (placedByBatch.get(p.batchId) ?? 0) + 1))

  return (
    <AppShell>
      <div className="page-head">
        <h1>3D packing view</h1>
        <p>See how the stock of a warehouse fits inside its room. Drag to rotate, scroll to zoom, hover a carton for details.</p>
      </div>

      {loadError && <div className="alert alert-error" role="alert">Could not load data: {loadError}</div>}

      {loading ? (
        <p className="warehouse-meta" role="status">Loading…</p>
      ) : !selected || !room || !result ? (
        <div className="empty-state">
          <p>No warehouse with a room size yet. Add or edit a warehouse and set its length, width and height.</p>
        </div>
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <div className="field inline-field">
                <label htmlFor="pk-warehouse">Warehouse</label>
                <select id="pk-warehouse" className="input" value={selected.id} onChange={(event) => setChosenId(event.target.value)}>
                  {withSize.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <fieldset className="mode-toggle">
                <legend className="sr-only">Colour cartons by</legend>
                <label className={colorMode === 'medicine' ? 'mode selected' : 'mode'}>
                  <input type="radio" name="mode" checked={colorMode === 'medicine'} onChange={() => setColorMode('medicine')} />
                  By medicine
                </label>
                <label className={colorMode === 'expiry' ? 'mode selected' : 'mode'}>
                  <input type="radio" name="mode" checked={colorMode === 'expiry'} onChange={() => setColorMode('expiry')} />
                  By expiry
                </label>
              </fieldset>
            </div>

            <div className="stat-grid">
              <div className="stat">
                <span className="stat-value">{result.utilizationPct.toFixed(1)}%</span>
                <span className="stat-label">of the room is used</span>
              </div>
              <div className="stat">
                <span className="stat-value">{result.cartonsPlaced.toLocaleString()} / {result.cartonsTotal.toLocaleString()}</span>
                <span className="stat-label">cartons placed</span>
              </div>
              <div className="stat">
                <span className="stat-value">{formatRoomSize(selected.lengthCm, selected.widthCm, selected.heightCm)}</span>
                <span className="stat-label">
                  room size · {selected.shelfLevels >= 2 ? `racks, ${selected.shelfLevels} shelf levels` : 'floor stacking'}
                </span>
              </div>
            </div>

            {result.unplaced.length > 0 && (
              <div className="alert alert-error" role="alert">
                <strong>{result.unplaced.reduce((sum, item) => sum + item.count, 0).toLocaleString()} cartons do not fit:</strong>{' '}
                {result.unplaced.map((item) => `${item.count} × ${item.label} (${item.reason})`).join('; ')}
              </div>
            )}

            {batches.length === 0 ? (
              <div className="empty-state">
                <p>This warehouse has no stock yet. Add stock batches to see them packed.</p>
              </div>
            ) : (
              <div className="scene-box" aria-label="3D view of the warehouse with cartons">
                <PackingScene room={room} placements={result.placements} colorOf={colorOf} onHover={setHover} rackLayout={result.rackLayout} />
                <div className="hover-card" aria-live="polite">
                  {hover && hoverBatch ? (
                    <>
                      <strong>{hoverBatch.label}</strong>
                      <span>Batch {hoverBatch.batchNo}</span>
                      <span>Expires {hoverBatch.expiryDate} ({expiryText(hoverBatch.expiryDays)})</span>
                      <span>Carton {hover.dx} × {hover.dy} × {hover.dz} cm, {hover.z === 0 ? 'on the floor' : `${hover.z} cm up`}</span>
                    </>
                  ) : (
                    <span>Hover a carton for details</span>
                  )}
                </div>
              </div>
            )}
          </section>

          {batches.length > 0 && (
            <section className="panel" aria-labelledby="legend-heading">
              <h2 id="legend-heading">Legend and batches</h2>
              {colorMode === 'expiry' ? (
                <ul className="legend">
                  <li><span className="legend-dot" style={{ background: EXPIRY_COLORS.soon }} />Expires within 30 days or expired</li>
                  <li><span className="legend-dot" style={{ background: EXPIRY_COLORS.warning }} />31 to 90 days</li>
                  <li><span className="legend-dot" style={{ background: EXPIRY_COLORS.ok }} />More than 90 days</li>
                </ul>
              ) : (
                <ul className="legend">
                  {medicines
                    .filter((item) => batches.some((batch) => batch.medicineId === item.id))
                    .map((item) => (
                      <li key={item.id}>
                        <span className="legend-dot" style={{ background: medicineColor.get(item.id) }} />
                        {item.name}
                      </li>
                    ))}
                </ul>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <caption className="sr-only">Batches in this warehouse, earliest expiry first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Medicine</th>
                      <th scope="col">Batch</th>
                      <th scope="col">Expiry</th>
                      <th scope="col">Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...batches].sort((a, b) => a.expiryDays - b.expiryDays).map((batch) => (
                      <tr key={batch.id}>
                        <td className="cell-strong">{batch.label}</td>
                        <td>{batch.batchNo}</td>
                        <td>{batch.expiryDate} <span className={batch.expiryDays <= 30 ? 'badge badge-danger' : batch.expiryDays <= 90 ? 'badge badge-warn' : 'badge'}>{expiryText(batch.expiryDays)}</span></td>
                        <td>{(placedByBatch.get(batch.id) ?? 0).toLocaleString()} / {batch.cartons.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="map-hint">
                Packing is a heuristic: it finds a good arrangement, not a guaranteed best one. Earlier expiry is placed
                nearer the door, fragile cartons go on top, and stack limits and "this side up" are respected.
              </p>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
