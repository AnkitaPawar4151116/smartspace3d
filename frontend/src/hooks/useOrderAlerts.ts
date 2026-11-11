import { useContext } from 'react'
import { OrderAlertsContext } from '../contexts/order-alerts-context'

export function useOrderAlerts() {
  return useContext(OrderAlertsContext)
}
