export interface PlaceResult {
  lat: number
  lng: number
  label: string
}

// Looks up a place name with OpenStreetMap's free Nominatim service.
// Called only when the person presses Search (their usage policy forbids autocomplete / heavy use).
export async function searchPlace(text: string): Promise<PlaceResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(text)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error('Search failed')
  const results: unknown = await response.json()
  if (!Array.isArray(results) || results.length === 0) return null

  const first = results[0] as { lat?: string; lon?: string; display_name?: string }
  const lat = Number(first.lat)
  const lng = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng, label: first.display_name ?? text }
}
