import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { useOrderAlerts } from '../hooks/useOrderAlerts'
import { useInventoryData } from '../hooks/useInventoryData'
import { getDataErrorMessage } from '../services/dataErrors'
import { OrderProblem, approveOrder, cancelOrder, rejectOrder, subscribeOrders } from '../services/orderService'
import type { OrderRecord, OrderStatus } from '../types/order'
import { downloadCsv, todayStamp, toCsv } from '../utils/csvExport'
import { planLookup } from '../utils/lookup'
import { linesFromPlan } from '../utils/orders'

const STATUS_BADGE: Record<OrderStatus, string> = {
  pending: 'badge badge-warn',
  approved: 'badge badge-success',
  rejected: 'badge badge-danger',
  cancelled: 'badge',
}
const STATUS_TEXT: Record<OrderStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

const dateText = (ms: number | null) => (ms === null ? 'just now' : new Date(ms).toLocaleString())

export function Orders() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const { warehouses, medicines, stock, error: dataError } = useInventoryData()
  const { desktopAlerts, enableDesktopAlerts } = useOrderAlerts()

  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [reply, setReply] = useState('')

  const uid = user?.uid ?? ''
  useEffect(() => {
    if (!uid) return
    return subscribeOrders(
      { uid, admin: isAdmin },
      (list) => {
        setOrders(list)
        setLoadError('')
        setLoading(false)
      },
      (error) => {
        setLoadError(getDataErrorMessage(error))
        setLoading(false)
      },
    )
  }, [uid, isAdmin])

  const warehouseName = useMemo(() => new Map(warehouses.map((item) => [item.id, item.name])), [warehouses])

  // What approving each pending order would do, from the stock as it is now.
  const plans = useMemo(() => {
    const result = new Map<string, ReturnType<typeof linesFromPlan>>()
    if (!isAdmin) return result
    for (const order of orders) {
      if (order.status !== 'pending') continue
      const medicine = medicines.find((item) => item.id === order.medicineId)
      if (!medicine) {
        result.set(order.id, null)
        continue
      }
      const plan = planLookup({ warehouses, stock, medicine, units: order.units, fromLat: order.lat, fromLng: order.lng })
      result.set(order.id, linesFromPlan(plan))
    }
    return result
  }, [isAdmin, orders, medicines, warehouses, stock])

  const actor = { uid, email: user?.email ?? '' }

  async function run(id: string, action: () => Promise<void>) {
    if (busyId) return
    setActionError('')
    setBusyId(id)
    try {
      await action()
    } catch (error) {
      setActionError(error instanceof OrderProblem ? error.message : getDataErrorMessage(error))
    } finally {
      setBusyId(null)
    }
  }

  function exportOrders() {
    downloadCsv(
      `orders-${todayStamp()}.csv`,
      toCsv(
        ['Date', 'Requested by', 'Medicine', 'Units', 'Cartons', 'Status', 'Taken from'],
        orders.map((order) => [
          order.createdAtMs === null ? '' : new Date(order.createdAtMs).toISOString().slice(0, 10),
          order.userEmail,
          order.medicineName,
          order.units,
          order.cartons,
          STATUS_TEXT[order.status],
          order.lines.map((line) => `${warehouseName.get(line.warehouseId) ?? 'warehouse'} batch ${line.batchNo} x${line.cartons}`).join('; '),
        ]),
      ),
    )
  }

  const pendingCount = orders.filter((order) => order.status === 'pending').length

  return (
    <AppShell>
      <div className="page-head">
        <h1>{isAdmin ? 'Orders' : 'My orders'}</h1>
        <p>
          {isAdmin
            ? 'Approve an order to take the cartons out of stock (earliest expiry first). Approval and the stock change happen together or not at all.'
            : 'Requests you made from Find Stock. An admin approves them; then the stock is reserved for you.'}
        </p>
      </div>

      {isAdmin && desktopAlerts === 'default' && (
        <div className="alert alert-success">
          Get a desktop notification when a new request arrives while this tab is in the background.{' '}
          <button type="button" className="btn btn-outline btn-sm" onClick={enableDesktopAlerts}>Turn on desktop alerts</button>
        </div>
      )}

      {(loadError || dataError) && <div className="alert alert-error" role="alert">Could not load data: {loadError || dataError}</div>}
      {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}

      {loading ? (
        <p className="warehouse-meta" role="status">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="empty-state"><p>No orders yet. Use Find Stock to request medicine.</p></div>
      ) : (
        <section className="panel" aria-labelledby="orders-heading">
          <div className="panel-head">
            <h2 id="orders-heading">{orders.length} order{orders.length === 1 ? '' : 's'}{pendingCount > 0 ? `, ${pendingCount} waiting` : ''}</h2>
            <button type="button" className="btn btn-outline btn-sm" onClick={exportOrders}>Download CSV</button>
          </div>
          <ul className="order-list">
            {orders.map((order) => {
              const lines = plans.get(order.id)
              return (
                <li key={order.id} className="order-card">
                  <div className="order-top">
                    <strong>{order.units.toLocaleString()} units of {order.medicineName}</strong>
                    <span className={STATUS_BADGE[order.status]}>{STATUS_TEXT[order.status]}</span>
                  </div>
                  <p className="warehouse-meta">
                    {order.cartons} cartons · {dateText(order.createdAtMs)}
                    {isAdmin && <> · requested by {order.userEmail}</>}
                  </p>
                  {order.note && <p className="warehouse-meta">Note: {order.note}</p>}
                  {order.status === 'rejected' && order.reply && <p className="warehouse-meta">Admin reply: {order.reply}</p>}

                  {order.status === 'approved' && order.lines.length > 0 && (
                    <p className="warehouse-meta">
                      Collect from: {order.lines.map((line) => `${warehouseName.get(line.warehouseId) ?? 'a warehouse'} (batch ${line.batchNo}, ${line.cartons} cartons)`).join('; ')}
                    </p>
                  )}

                  {order.status === 'pending' && isAdmin && (
                    <>
                      {lines ? (
                        <p className="warehouse-meta">
                          Approving takes: {lines.map((line) => `${line.cartons} cartons of batch ${line.batchNo} from ${warehouseName.get(line.warehouseId) ?? 'a warehouse'}`).join('; ')}.
                        </p>
                      ) : (
                        <p className="field-error">Current stock cannot cover this order (or the medicine was removed). It can only be rejected.</p>
                      )}
                      {rejectingId === order.id ? (
                        <div className="inline-actions">
                          <input
                            className="input"
                            value={reply}
                            onChange={(event) => setReply(event.target.value)}
                            maxLength={200}
                            placeholder="Reason (optional)"
                            aria-label="Reason for rejecting"
                          />
                          <button
                            type="button"
                            className="btn btn-danger-outline"
                            disabled={busyId === order.id}
                            onClick={() => run(order.id, async () => { await rejectOrder(order, reply, actor); setRejectingId(null); setReply('') })}
                          >
                            Confirm reject
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => setRejectingId(null)}>Back</button>
                        </div>
                      ) : (
                        <div className="inline-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-inline btn-sm"
                            disabled={!lines || busyId === order.id}
                            onClick={() => lines && run(order.id, () => approveOrder(order, lines, actor))}
                          >
                            {busyId === order.id ? 'Working…' : 'Approve'}
                          </button>
                          <button type="button" className="btn btn-danger-outline" disabled={busyId === order.id} onClick={() => { setRejectingId(order.id); setReply('') }}>
                            Reject
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {order.status === 'pending' && !isAdmin && (
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={busyId === order.id}
                        onClick={() => window.confirm('Cancel this order?') && run(order.id, () => cancelOrder(order.id))}
                      >
                        Cancel order
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </AppShell>
  )
}
