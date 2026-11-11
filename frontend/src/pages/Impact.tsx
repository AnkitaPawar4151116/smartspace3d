import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { useInventoryData } from '../hooks/useInventoryData'
import { getDataErrorMessage } from '../services/dataErrors'
import { subscribeOrders } from '../services/orderService'
import { subscribeTransfers } from '../services/transferService'
import type { OrderRecord, TransferRecord } from '../types/order'
import { downloadCsv, todayStamp, toCsv } from '../utils/csvExport'
import { computeDashboard } from '../utils/dashboardStats'
import { computeImpact } from '../utils/impact'

interface Metric {
  label: string
  value: string
  note?: string
}

function Goal({ number, color, title, target, metrics, footer }: { number: string; color: string; title: string; target: string; metrics: Metric[]; footer?: ReactNode }) {
  return (
    <article className="sdg-card" style={{ borderTopColor: color }}>
      <div className="sdg-head">
        <span className="sdg-num" style={{ background: color }} aria-hidden="true">{number}</span>
        <div>
          <h2>SDG {number}: {title}</h2>
          <p className="warehouse-meta">{target}</p>
        </div>
      </div>
      <dl className="sdg-metrics">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
            {metric.note && <p className="warehouse-meta">{metric.note}</p>}
          </div>
        ))}
      </dl>
      {footer}
    </article>
  )
}

const num = (value: number) => Math.round(value).toLocaleString()

export function Impact() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const { warehouses, medicines, stock, loading, error } = useInventoryData()
  const [orders, setOrders] = useState<OrderRecord[] | null>(null)
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [extraError, setExtraError] = useState('')

  const uid = user?.uid ?? ''
  useEffect(() => {
    if (!uid) return
    const onError = (err: unknown) => setExtraError(getDataErrorMessage(err))
    const stops = [subscribeTransfers(setTransfers, onError)]
    if (isAdmin) stops.push(subscribeOrders({ uid, admin: true }, setOrders, onError))
    return () => stops.forEach((stop) => stop())
  }, [uid, isAdmin])

  const impact = useMemo(() => {
    const dashboard = computeDashboard(warehouses, medicines, stock)
    return computeImpact({
      warehouseCount: warehouses.length,
      rackWarehouses: warehouses.filter((item) => item.shelfLevels >= 2).length,
      averageUtilizationPct: dashboard.averageUtilizationPct,
      medicines,
      stock,
      orders: isAdmin ? (orders ?? []) : null,
      transfers,
    })
  }, [warehouses, medicines, stock, orders, transfers, isAdmin])

  const { sdg3, sdg12, sdg9 } = impact
  const orderNote = isAdmin ? undefined : 'Order figures are shown to admins only.'

  function exportReport() {
    const rows: (string | number | null)[][] = [
      ['SDG 3', 'Medicines tracked', sdg3.medicinesTracked, ''],
      ['SDG 3', 'Warehouses', sdg3.warehouses, ''],
      ['SDG 3', 'Usable units in stock', Math.round(sdg3.usableUnits), 'not expired'],
      ['SDG 3', 'Medicines below their low-stock level', sdg3.lowStockMedicines, ''],
      ['SDG 3', 'Approved orders', sdg3.approvedOrders, 'admin only'],
      ['SDG 3', 'Units delivered through approved orders', sdg3.deliveredUnits, 'admin only'],
      ['SDG 12', 'Expired cartons in stock (waste)', sdg12.expiredCartons, ''],
      ['SDG 12', 'Expired units in stock', Math.round(sdg12.expiredUnits), ''],
      ['SDG 12', 'Waste rate (% of cartons expired)', Number(sdg12.wasteRatePct.toFixed(2)), ''],
      ['SDG 12', 'Cartons expiring within 90 days', sdg12.atRiskCartons, ''],
      ['SDG 12', 'Transfers made', sdg12.transfers, ''],
      ['SDG 12', 'Cartons moved while within 90 days of expiry', sdg12.rescuedCartons, ''],
      ['SDG 12', 'Units moved while within 90 days of expiry', Math.round(sdg12.rescuedUnits), ''],
      ['SDG 9', 'Warehouses with a mapped location and room size', sdg9.warehouses, ''],
      ['SDG 9', 'Warehouses using racks', sdg9.rackWarehouses, ''],
      ['SDG 9', 'Average room space used (%)', sdg9.averageUtilizationPct === null ? null : Number(sdg9.averageUtilizationPct.toFixed(1)), ''],
    ]
    downloadCsv(`sdg-impact-${todayStamp()}.csv`, toCsv(['Goal', 'Indicator', 'Value', 'Note'], rows))
  }

  return (
    <AppShell>
      <div className="page-head">
        <h1>SDG impact</h1>
        <p>
          How this system supports the Sustainable Development Goals. All numbers are counted from the stock, orders and transfers recorded
          here; they show the system at work, not national statistics.
        </p>
      </div>

      {(error || extraError) && <div className="alert alert-error" role="alert">Could not load data: {error || extraError}</div>}

      {loading ? (
        <p className="warehouse-meta" role="status">Loading…</p>
      ) : (
        <>
          <div className="inline-actions">
            <button type="button" className="btn btn-outline btn-inline btn-sm" onClick={exportReport}>Download report (CSV)</button>
          </div>

          <div className="sdg-grid">
            <Goal
              number="3"
              color="#4C9F38"
              title="Good health and well-being"
              target="Target 3.8: access to safe, effective and affordable essential medicines."
              metrics={[
                { label: 'Usable units in stock', value: num(sdg3.usableUnits), note: `${sdg3.medicinesTracked} medicines across ${sdg3.warehouses} warehouses` },
                { label: 'Medicines running low', value: String(sdg3.lowStockMedicines), note: 'below their low-stock level: a risk to availability' },
                { label: 'Units delivered through approved orders', value: sdg3.deliveredUnits === null ? '—' : num(sdg3.deliveredUnits), note: orderNote ?? `${sdg3.approvedOrders ?? 0} approved, ${sdg3.pendingOrders ?? 0} waiting` },
              ]}
              footer={<p className="map-hint">Find Stock points a user to the nearest warehouse that has the medicine, so a local stock-out does not mean no access.</p>}
            />

            <Goal
              number="12"
              color="#BF8B2E"
              title="Responsible consumption and production"
              target="Target 12.3: reduce losses along the supply chain. Target 12.5: reduce waste."
              metrics={[
                { label: 'Waste rate (expired share of stock)', value: `${sdg12.wasteRatePct.toFixed(1)}%`, note: `${num(sdg12.expiredCartons)} cartons (${num(sdg12.expiredUnits)} units) already expired. Goal: as close to 0% as possible.` },
                { label: 'Expiring within 90 days', value: `${num(sdg12.atRiskCartons)} cartons`, note: `${num(sdg12.atRiskUnits)} units to use or move first` },
                { label: 'Near-expiry stock moved', value: `${num(sdg12.rescuedUnits)} units`, note: `${sdg12.transfers} transfer${sdg12.transfers === 1 ? '' : 's'} made; ${num(sdg12.rescuedCartons)} cartons moved while within 90 days of expiry` },
              ]}
              footer={<p className="map-hint">Orders always take the earliest-expiry batch first (FEFO), and Waste Alerts suggests where to move stock that is about to expire.</p>}
            />

            <Goal
              number="9"
              color="#F36D25"
              title="Industry, innovation and infrastructure"
              target="Target 9.c / 9.4: use technology to make infrastructure more efficient."
              metrics={[
                { label: 'Warehouses on the map', value: String(sdg9.warehouses), note: `${sdg9.rackWarehouses} use racks, the rest floor stacking` },
                { label: 'Average room space used', value: sdg9.averageUtilizationPct === null ? '—' : `${sdg9.averageUtilizationPct.toFixed(1)}%`, note: 'calculated by the 3D packing engine from real room and carton sizes' },
              ]}
              footer={<p className="map-hint">Room and carton dimensions drive a 3D layout, so storage space is planned instead of guessed.</p>}
            />

            <Goal
              number="2"
              color="#DDA63A"
              title="Zero hunger"
              target="Target 2.1 / 12.3: access to food and less food loss."
              metrics={[{ label: 'Food grain (dhanya) module', value: 'Planned', note: 'The same engine (nearest stock, expiry alerts, 3D storage) can be extended to food grain. Not built yet.' }]}
            />
          </div>
        </>
      )}
    </AppShell>
  )
}
