import { useMemo, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { useInventoryData } from '../hooks/useInventoryData'
import { getDataErrorMessage } from '../services/dataErrors'
import { TransferProblem, transferBatch } from '../services/stockService'
import type { AtRiskBatch, TransferSuggestion } from '../utils/alerts'
import { RISK_LABEL, findAtRisk, suggestTransfers, summarizeRisk } from '../utils/alerts'
import type { Risk } from '../utils/alerts'
import { downloadCsv, todayStamp, toCsv } from '../utils/csvExport'
import { expiryText } from '../utils/expiry'
import { findLowStock } from '../utils/lowStock'

const RISKS: Risk[] = ['expired', 'd30', 'd60', 'd90']
const BADGE: Record<Risk, string> = { expired: 'badge badge-danger', d30: 'badge badge-danger', d60: 'badge badge-warn', d90: 'badge badge-warn' }

export function Alerts() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'
  const { warehouses, medicines, stock, loading, error } = useInventoryData()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [actionDone, setActionDone] = useState('')

  async function handleMove(item: AtRiskBatch, suggestion: TransferSuggestion) {
    if (busyId || !user) return
    const text = `Move all ${item.stock.cartons} cartons of batch ${item.stock.batchNo} (${item.medicine.name}) from ${item.warehouse.name} to ${suggestion.warehouse.name}?`
    if (!window.confirm(text)) return
    setActionError('')
    setActionDone('')
    setBusyId(item.stock.id)
    try {
      await transferBatch(
        item.stock,
        suggestion.warehouse.id,
        stock,
        { uid: user.uid, email: user.email ?? '' },
        { medicine: item.medicine, fromName: item.warehouse.name, toName: suggestion.warehouse.name },
      )
      setActionDone(`Batch ${item.stock.batchNo} was moved to ${suggestion.warehouse.name}.`)
    } catch (err) {
      setActionError(err instanceof TransferProblem ? err.message : getDataErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const atRisk = useMemo(() => findAtRisk(stock, medicines, warehouses), [stock, medicines, warehouses])
  const summary = useMemo(() => summarizeRisk(atRisk), [atRisk])
  // The packing engine decides which warehouse really has room for each batch.
  const suggestions = useMemo(() => suggestTransfers(atRisk, stock, medicines, warehouses), [atRisk, stock, medicines, warehouses])

  const lowStock = useMemo(() => findLowStock(medicines, stock), [medicines, stock])

  function exportAtRisk() {
    downloadCsv(
      `expiry-alerts-${todayStamp()}.csv`,
      toCsv(
        ['Warehouse', 'Medicine', 'Batch', 'Cartons', 'Units', 'Expiry date', 'Days left', 'Risk', 'Suggested warehouse'],
        atRisk.map((item) => [
          item.warehouse.name,
          item.medicine.name,
          item.stock.batchNo,
          item.stock.cartons,
          item.units,
          item.stock.expiryDate,
          item.expiryDays,
          RISK_LABEL[item.risk],
          suggestions.get(item.stock.id)?.warehouse.name ?? '',
        ]),
      ),
    )
  }

  function exportLowStock() {
    downloadCsv(
      `low-stock-${todayStamp()}.csv`,
      toCsv(
        ['Medicine', 'Usable cartons', 'Low-stock level (cartons)', 'Short by (cartons)', 'Usable units'],
        lowStock.map((item) => [item.medicine.name, item.usableCartons, item.levelCartons, item.shortfallCartons, item.usableUnits]),
      ),
    )
  }

  const totalCartons = RISKS.reduce((sum, risk) => sum + summary[risk].cartons, 0)

  return (
    <AppShell>
      <div className="page-head">
        <h1>Waste alerts</h1>
        <p>Batches that are expired or will expire within 90 days. Use them first, or move them to a warehouse that has room, so they are not wasted (SDG 12).</p>
      </div>

      {error && <div className="alert alert-error" role="alert">Could not load data: {error}</div>}
      {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}
      {actionDone && <div className="alert alert-success" role="status">{actionDone}</div>}

      {loading ? (
        <p className="warehouse-meta" role="status">Loading…</p>
      ) : atRisk.length === 0 ? (
        <div className="empty-state"><p>No batches are expired or close to expiry. Nothing needs attention.</p></div>
      ) : (
        <>
          <div className="stat-grid">
            {RISKS.map((risk) => (
              <div key={risk} className={risk === 'expired' || risk === 'd30' ? 'stat stat-danger' : 'stat stat-warn'}>
                <span className="stat-value">{summary[risk].cartons.toLocaleString()}</span>
                <span className="stat-label">
                  cartons · {RISK_LABEL[risk].toLowerCase()} ({summary[risk].batches} batch{summary[risk].batches === 1 ? '' : 'es'}, {summary[risk].units.toLocaleString()} units)
                </span>
              </div>
            ))}
          </div>

          <section className="panel" aria-labelledby="risk-heading">
            <div className="panel-head">
              <h2 id="risk-heading">At-risk batches ({atRisk.length}, {totalCartons.toLocaleString()} cartons)</h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={exportAtRisk}>Download CSV</button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <caption className="sr-only">Batches expired or expiring within 90 days, most urgent first</caption>
                <thead>
                  <tr>
                    <th scope="col">Warehouse</th>
                    <th scope="col">Medicine</th>
                    <th scope="col">Batch</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Expiry</th>
                    <th scope="col">Suggested action</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((item) => {
                    const suggestion = suggestions.get(item.stock.id)
                    return (
                      <tr key={item.stock.id}>
                        <td>{item.warehouse.name}</td>
                        <td className="cell-strong">{item.medicine.name}</td>
                        <td>{item.stock.batchNo}</td>
                        <td>{item.stock.cartons.toLocaleString()} cartons ({item.units.toLocaleString()} units)</td>
                        <td>
                          {item.stock.expiryDate} <span className={BADGE[item.risk]}>{expiryText(item.expiryDays)}</span>
                        </td>
                        <td className="wrap-cell">
                          {item.risk === 'expired' ? (
                            'Remove from stock and dispose of it safely.'
                          ) : (
                            <>
                              Dispatch this batch first.{' '}
                              {suggestion === undefined
                                ? ''
                                : suggestion
                                  ? (
                                    <>
                                      It can be moved to <strong>{suggestion.warehouse.name}</strong> ({Math.round(suggestion.distanceKm)} km away), which has room.
                                      {isAdmin && (
                                        <>
                                          {' '}
                                          <button
                                            type="button"
                                            className="btn btn-outline btn-sm"
                                            disabled={busyId === item.stock.id}
                                            onClick={() => handleMove(item, suggestion)}
                                          >
                                            {busyId === item.stock.id ? 'Moving…' : 'Move now'}
                                          </button>
                                        </>
                                      )}
                                    </>
                                  )
                                  : 'No other warehouse has room for all of it.'}
                            </>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="map-hint">
              “Has room” comes from the 3D packing engine, using each room size and carton size. Transfers are suggestions only: the system does not
              know demand or transport cost. Transfer suggestions are calculated for the 15 most urgent batches.
            </p>
          </section>
        </>
      )}

      {!loading && (
        <section className="panel" aria-labelledby="low-heading">
          <div className="panel-head">
            <h2 id="low-heading">Low stock ({lowStock.length})</h2>
            {lowStock.length > 0 && <button type="button" className="btn btn-outline btn-sm" onClick={exportLowStock}>Download CSV</button>}
          </div>
          {lowStock.length === 0 ? (
            <p className="warehouse-meta">No medicine is below its low-stock level. Set a level on the Medicines page to get warnings (expired stock is not counted).</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <caption className="sr-only">Medicines below their low-stock level, emptiest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Medicine</th>
                    <th scope="col">Usable stock</th>
                    <th scope="col">Low-stock level</th>
                    <th scope="col">Short by</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((item) => (
                    <tr key={item.medicine.id}>
                      <td className="cell-strong">
                        {item.medicine.name} {item.out && <span className="badge badge-danger">Out of stock</span>}
                      </td>
                      <td>{item.usableCartons.toLocaleString()} cartons ({item.usableUnits.toLocaleString()} units)</td>
                      <td>{item.levelCartons.toLocaleString()} cartons</td>
                      <td>{item.shortfallCartons.toLocaleString()} cartons</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="map-hint">Counted across all warehouses together. Restock these before they run out.</p>
        </section>
      )}
    </AppShell>
  )
}
