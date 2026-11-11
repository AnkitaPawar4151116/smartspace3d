import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { WarehouseRecord } from '../../types/warehouse'
import { markerPin } from './leafletIcon'

const INDIA_CENTER: [number, number] = [20.5937, 78.9629]

// Zooms the map so every warehouse is visible.
function FitAll({ warehouses }: { warehouses: WarehouseRecord[] }) {
  const map = useMap()
  useEffect(() => {
    if (warehouses.length === 0) return
    const bounds = latLngBounds(warehouses.map((item) => [item.lat, item.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 })
  }, [map, warehouses])
  return null
}

// Read-only map showing all warehouses.
export function WarehouseMap({ warehouses }: { warehouses: WarehouseRecord[] }) {
  return (
    <div className="map-box">
      <MapContainer center={INDIA_CENTER} zoom={5} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitAll warehouses={warehouses} />
        {warehouses.map((item) => (
          <Marker key={item.id} position={[item.lat, item.lng]} icon={markerPin}>
            <Popup>
              <strong>{item.name}</strong>
              <br />
              {item.city}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
