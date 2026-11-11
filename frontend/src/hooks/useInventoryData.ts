import { useEffect, useState } from 'react'
import { getDataErrorMessage } from '../services/dataErrors'
import { subscribeMedicines } from '../services/medicineService'
import { subscribeStock } from '../services/stockService'
import { subscribeWarehouses } from '../services/warehouseService'
import type { MedicineRecord } from '../types/medicine'
import type { StockRecord } from '../types/stock'
import type { WarehouseRecord } from '../types/warehouse'

// Live warehouses + medicines + stock in one place. Listeners are removed on unmount.
export function useInventoryData() {
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>([])
  const [medicines, setMedicines] = useState<MedicineRecord[]>([])
  const [stock, setStock] = useState<StockRecord[]>([])
  const [ready, setReady] = useState({ warehouses: false, medicines: false, stock: false })
  const [error, setError] = useState('')

  useEffect(() => {
    const onError = (err: unknown) => setError(getDataErrorMessage(err))
    const unsubscribes = [
      subscribeWarehouses((list) => {
        setWarehouses(list)
        setReady((value) => ({ ...value, warehouses: true }))
      }, onError),
      subscribeMedicines((list) => {
        setMedicines(list)
        setReady((value) => ({ ...value, medicines: true }))
      }, onError),
      subscribeStock((list) => {
        setStock(list)
        setReady((value) => ({ ...value, stock: true }))
      }, onError),
    ]
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [])

  const loading = !error && !(ready.warehouses && ready.medicines && ready.stock)
  return { warehouses, medicines, stock, loading, error }
}
