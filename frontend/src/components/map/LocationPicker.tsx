import { useState } from 'react'
import type { FormEvent } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { searchPlace } from '../../services/geocode'
import { markerPin } from './leafletIcon'

export interface LatLng {
  lat: number
  lng: number
}

interface LocationPickerProps {
  value: LatLng | null
  onChange: (position: LatLng) => void
  disabled?: boolean
  // when editing: open the map already zoomed to this point
  startCenter?: LatLng | null
}

const INDIA_CENTER: [number, number] = [20.5937, 78.9629]

// Click anywhere on the map to place the pin.
function ClickToPlace({ onPick, disabled }: { onPick: (position: LatLng) => void; disabled?: boolean }) {
  useMapEvents({
    click(event) {
      if (!disabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng })
    },
  })
  return null
}

// Moves the map when a search finds a place.
function MoveTo({ target }: { target: (LatLng & { zoom: number }) | null }) {
  const map = useMap()
  if (target) map.setView([target.lat, target.lng], target.zoom)
  return null
}

export function LocationPicker({ value, onChange, disabled, startCenter }: LocationPickerProps) {
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchMessage, setSearchMessage] = useState('')
  const [moveTarget, setMoveTarget] = useState<(LatLng & { zoom: number }) | null>(null)

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = searchText.trim()
    if (!text || searching) return

    setSearching(true)
    setSearchMessage('')
    try {
      const place = await searchPlace(text)
      if (!place) {
        setSearchMessage('No place found. Try a different name, or click the map.')
      } else {
        setMoveTarget({ lat: place.lat, lng: place.lng, zoom: 13 })
        onChange({ lat: place.lat, lng: place.lng })
        setSearchMessage(`Found: ${place.label}`)
      }
    } catch {
      setSearchMessage('Search is unavailable right now. You can still click the map.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div>
      <form className="map-search" onSubmit={handleSearch} role="search">
        <input
          className="input"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search a place, e.g. Pune"
          aria-label="Search for a place"
          disabled={disabled}
        />
        <button type="submit" className="btn btn-outline" disabled={disabled || searching || !searchText.trim()}>
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="map-box">
        <MapContainer
          center={startCenter ? [startCenter.lat, startCenter.lng] : INDIA_CENTER}
          zoom={startCenter ? 11 : 5}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={onChange} disabled={disabled} />
          <MoveTo target={moveTarget} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={markerPin}
              draggable={!disabled}
              eventHandlers={{
                dragend(event) {
                  const point = event.target.getLatLng()
                  onChange({ lat: point.lat, lng: point.lng })
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <p className="map-hint" aria-live="polite">
        {value ? (
          <>
            Selected: <strong>{value.lat.toFixed(4)}, {value.lng.toFixed(4)}</strong>. Drag the pin or click to adjust.
          </>
        ) : (
          'Click the map to drop a pin on the warehouse location.'
        )}
        {searchMessage && <> {searchMessage}</>}
      </p>
    </div>
  )
}
