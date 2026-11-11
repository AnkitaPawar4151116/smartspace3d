import { createContext } from 'react'

export interface OrderAlerts {
  // number shown on the "Orders" menu item (admin: waiting requests; user: new decisions)
  badge: number
  // admin only: ask the browser for permission to show desktop notifications
  desktopAlerts: 'unsupported' | 'default' | 'granted' | 'denied'
  enableDesktopAlerts: () => void
}

export const OrderAlertsContext = createContext<OrderAlerts>({
  badge: 0,
  desktopAlerts: 'unsupported',
  enableDesktopAlerts: () => {},
})
