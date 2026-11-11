import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { subscribeOrders } from '../services/orderService'
import type { OrderRecord, OrderStatus } from '../types/order'
import { OrderAlertsContext } from './order-alerts-context'
import type { OrderAlerts } from './order-alerts-context'

interface Toast {
  id: number
  text: string
}

type Permission = OrderAlerts['desktopAlerts']

function readPermission(): Permission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

function seenKey(uid: string) {
  return `smartspace-seen-orders-${uid}`
}

function readSeen(uid: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(seenKey(uid)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function writeSeen(uid: string, ids: Set<string>) {
  try {
    localStorage.setItem(seenKey(uid), JSON.stringify([...ids].slice(-500)))
  } catch {
    // storage may be blocked; the badge then simply stays until the next visit
  }
}

// One live order listener for the whole app. Tells admins about new requests and
// users about decisions, with a menu badge, a pop-up message and (if allowed) a desktop notification.
export function OrderAlertsProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth()
  const { pathname } = useLocation()
  const uid = user?.uid ?? ''
  const isAdmin = role === 'admin'

  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [permission, setPermission] = useState<Permission>(readPermission)
  const previous = useRef<Map<string, OrderStatus> | null>(null)

  const notify = useCallback((text: string) => {
    setToast({ id: Date.now(), text })
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      try {
        new Notification('SmartSpace', { body: text })
      } catch {
        // some browsers only allow notifications from a service worker; the in-page message still shows
      }
    }
  }, [])

  // Live listener (only when signed in with a role).
  useEffect(() => {
    previous.current = null
    if (!uid || !role) return
    const stop = subscribeOrders(
      { uid, admin: isAdmin },
      (list) => {
        setOrders(list)
        const before = previous.current
        previous.current = new Map(list.map((order) => [order.id, order.status]))
        if (before === null) return // first load: show the badge only, no pop-up
        for (const order of list) {
          const was = before.get(order.id)
          if (isAdmin && was === undefined && order.status === 'pending') {
            notify(`New request: ${order.units.toLocaleString()} units of ${order.medicineName} from ${order.userEmail}`)
          } else if (!isAdmin && was === 'pending' && (order.status === 'approved' || order.status === 'rejected')) {
            notify(`Your order for ${order.medicineName} was ${order.status}.`)
          }
        }
      },
      () => {
        // errors are shown on the Orders page itself
      },
    )
    return stop
  }, [uid, role, isAdmin, notify])

  // Opening the Orders page marks decisions as seen (users only). This only writes to storage.
  useEffect(() => {
    if (!uid || isAdmin || pathname !== '/orders' || orders.length === 0) return
    const next = readSeen(uid)
    orders.forEach((order) => order.status !== 'pending' && next.add(order.id))
    writeSeen(uid, next)
  }, [uid, isAdmin, pathname, orders])

  // Auto-hide the pop-up.
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 9000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const badge = useMemo(() => {
    if (!uid || !role) return 0
    if (isAdmin) return orders.filter((order) => order.status === 'pending').length
    if (pathname === '/orders') return 0
    const seen = readSeen(uid)
    return orders.filter((order) => order.status !== 'pending' && order.status !== 'cancelled' && !seen.has(order.id)).length
  }, [uid, role, isAdmin, orders, pathname])

  const enableDesktopAlerts = useCallback(() => {
    if (typeof Notification === 'undefined') return
    void Notification.requestPermission().then(setPermission)
  }, [])

  const value = useMemo<OrderAlerts>(
    () => ({ badge, desktopAlerts: permission, enableDesktopAlerts }),
    [badge, permission, enableDesktopAlerts],
  )

  return (
    <OrderAlertsContext.Provider value={value}>
      {children}
      {toast && uid && (
        <div className="toast" role="status" aria-live="polite" key={toast.id}>
          <span>{toast.text}</span>
          <Link to="/orders" onClick={() => setToast(null)}>View</Link>
          <button type="button" className="toast-close" onClick={() => setToast(null)} aria-label="Dismiss message">×</button>
        </div>
      )}
    </OrderAlertsContext.Provider>
  )
}
