import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { useAuth } from '../hooks/useAuth'
import { getDataErrorMessage } from '../services/dataErrors'
import { subscribeHistory } from '../services/historyService'
import type { HistoryRecord } from '../types/order'

const ACTION_TEXT: Record<string, string> = {
  stock_added: 'Stock added',
  stock_edited: 'Stock edited',
  stock_removed: 'Stock removed',
  stock_transferred: 'Stock moved',
  medicine_edited: 'Medicine edited',
  medicine_removed: 'Medicine removed',
  order_approved: 'Order approved',
  order_rejected: 'Order rejected',
}

export function History() {
  const { role } = useAuth()
  const [list, setList] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (role !== 'admin') return
    return subscribeHistory(
      (items) => {
        setList(items)
        setError('')
        setLoading(false)
      },
      (err) => {
        setError(getDataErrorMessage(err))
        setLoading(false)
      },
    )
  }, [role])

  return (
    <AppShell>
      <div className="page-head">
        <h1>History</h1>
        <p>The latest 150 changes to stock, medicines and orders: who did what, and when.</p>
      </div>
      {role !== 'admin' ? (
        <div className="alert alert-error" role="alert">Only admins can see the history.</div>
      ) : (
        <>
          {error && <div className="alert alert-error" role="alert">Could not load history: {error}</div>}
          {loading ? (
            <p className="warehouse-meta" role="status">Loading…</p>
          ) : list.length === 0 ? (
            <div className="empty-state"><p>No changes recorded yet.</p></div>
          ) : (
            <section className="panel">
              <div className="table-wrap">
                <table className="data-table">
                  <caption className="sr-only">Recent changes, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Who</th>
                      <th scope="col">Action</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item) => (
                      <tr key={item.id}>
                        <td>{item.createdAtMs === null ? 'just now' : new Date(item.createdAtMs).toLocaleString()}</td>
                        <td>{item.actorEmail}</td>
                        <td><span className="badge">{ACTION_TEXT[item.action] ?? item.action}</span></td>
                        <td className="wrap-cell">{item.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </AppShell>
  )
}
