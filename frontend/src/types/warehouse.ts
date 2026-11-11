export interface WarehouseRecord {
  id: string
  name: string
  city: string
  lat: number
  lng: number
  // Room size in centimetres. null for warehouses saved before sizes existed.
  lengthCm: number | null
  widthCm: number | null
  heightCm: number | null
  // Shelving: 1 = cartons are stacked on the floor; 2 or more = racks with that many shelf levels.
  shelfLevels: number
  rackDepthCm: number // depth of one rack (front to back)
  aisleCm: number // walking aisle between racks (and next to the door)
}

export interface WarehouseInput {
  name: string
  city: string
  lat: number
  lng: number
  lengthCm: number
  widthCm: number
  heightCm: number
  shelfLevels: number
  rackDepthCm: number
  aisleCm: number
}
