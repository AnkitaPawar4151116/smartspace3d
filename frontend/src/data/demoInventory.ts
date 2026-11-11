// DEMO DATA ONLY. These warehouses and stock numbers are made up so the home page
// can show how the finder works. Later this will come from your real database.

export interface Warehouse {
  id: string
  name: string
  city: string
  lat: number
  lng: number
}

export interface Medicine {
  id: string
  name: string
}

export interface StockEntry {
  warehouseId: string
  medicineId: string
  units: number
  // days until the batch expires (used to flag "use first" stock)
  expiresInDays: number
}

export interface City {
  name: string
  lat: number
  lng: number
}

export const warehouses: Warehouse[] = [
  { id: 'w-pune', name: 'Pune Central Store', city: 'Pune', lat: 18.5204, lng: 73.8567 },
  { id: 'w-mumbai', name: 'Mumbai Port Depot', city: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { id: 'w-nashik', name: 'Nashik District Store', city: 'Nashik', lat: 19.9975, lng: 73.7898 },
  { id: 'w-nagpur', name: 'Nagpur Regional Hub', city: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { id: 'w-hyd', name: 'Hyderabad South Hub', city: 'Hyderabad', lat: 17.385, lng: 78.4867 },
]

export const medicines: Medicine[] = [
  { id: 'm-para', name: 'Paracetamol 500 mg (tablets)' },
  { id: 'm-ors', name: 'ORS Sachets' },
  { id: 'm-amox', name: 'Amoxicillin 500 mg (capsules)' },
  { id: 'm-insulin', name: 'Insulin Vials' },
]

// Made-up room sizes (cm) for the 5 sample warehouses, used by the "Add sample warehouses" button.
export const sampleRoomSizesCm: Record<string, { lengthCm: number; widthCm: number; heightCm: number }> = {
  'w-pune': { lengthCm: 1500, widthCm: 1000, heightCm: 400 },
  'w-mumbai': { lengthCm: 2400, widthCm: 1500, heightCm: 500 },
  'w-nashik': { lengthCm: 1200, widthCm: 800, heightCm: 350 },
  'w-nagpur': { lengthCm: 3000, widthCm: 2000, heightCm: 600 },
  'w-hyd': { lengthCm: 2000, widthCm: 1400, heightCm: 500 },
}

// Made-up carton specs for the "Add sample medicines" button (not real product data).
export const sampleCartonSpecs = [
  { name: 'Paracetamol 500 mg (tablets)', unitsPerCarton: 100, cartonLengthCm: 40, cartonWidthCm: 30, cartonHeightCm: 25, cartonWeightKg: 8, maxStack: 8, fragile: false, thisSideUp: false, reorderLevelCartons: 60 },
  { name: 'ORS Sachets', unitsPerCarton: 500, cartonLengthCm: 50, cartonWidthCm: 35, cartonHeightCm: 30, cartonWeightKg: 12, maxStack: 6, fragile: false, thisSideUp: false, reorderLevelCartons: 40 },
  { name: 'Amoxicillin 500 mg (capsules)', unitsPerCarton: 120, cartonLengthCm: 40, cartonWidthCm: 30, cartonHeightCm: 20, cartonWeightKg: 6, maxStack: 8, fragile: false, thisSideUp: false, reorderLevelCartons: 60 },
  { name: 'Insulin Vials', unitsPerCarton: 200, cartonLengthCm: 35, cartonWidthCm: 25, cartonHeightCm: 25, cartonWeightKg: 9, maxStack: 3, fragile: true, thisSideUp: true, reorderLevelCartons: 20 },
]

export const cities: City[] = [
  { name: 'Pune', lat: 18.5204, lng: 73.8567 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { name: 'Nashik', lat: 19.9975, lng: 73.7898 },
  { name: 'Kolhapur', lat: 16.705, lng: 74.2433 },
  { name: 'Nagpur', lat: 21.1458, lng: 79.0882 },
  { name: 'Hyderabad', lat: 17.385, lng: 78.4867 },
]

export const stock: StockEntry[] = [
  { warehouseId: 'w-pune', medicineId: 'm-para', units: 300, expiresInDays: 400 },
  { warehouseId: 'w-mumbai', medicineId: 'm-para', units: 900, expiresInDays: 45 },
  { warehouseId: 'w-nashik', medicineId: 'm-para', units: 450, expiresInDays: 300 },
  { warehouseId: 'w-nagpur', medicineId: 'm-para', units: 2500, expiresInDays: 500 },
  { warehouseId: 'w-hyd', medicineId: 'm-para', units: 1800, expiresInDays: 220 },

  { warehouseId: 'w-pune', medicineId: 'm-ors', units: 0, expiresInDays: 0 },
  { warehouseId: 'w-mumbai', medicineId: 'm-ors', units: 1500, expiresInDays: 120 },
  { warehouseId: 'w-nashik', medicineId: 'm-ors', units: 700, expiresInDays: 50 },
  { warehouseId: 'w-nagpur', medicineId: 'm-ors', units: 400, expiresInDays: 365 },
  { warehouseId: 'w-hyd', medicineId: 'm-ors', units: 2200, expiresInDays: 300 },

  { warehouseId: 'w-pune', medicineId: 'm-amox', units: 150, expiresInDays: 200 },
  { warehouseId: 'w-mumbai', medicineId: 'm-amox', units: 600, expiresInDays: 180 },
  { warehouseId: 'w-nashik', medicineId: 'm-amox', units: 0, expiresInDays: 0 },
  { warehouseId: 'w-nagpur', medicineId: 'm-amox', units: 300, expiresInDays: 90 },
  { warehouseId: 'w-hyd', medicineId: 'm-amox', units: 500, expiresInDays: 400 },

  { warehouseId: 'w-pune', medicineId: 'm-insulin', units: 40, expiresInDays: 150 },
  { warehouseId: 'w-mumbai', medicineId: 'm-insulin', units: 200, expiresInDays: 200 },
  { warehouseId: 'w-nashik', medicineId: 'm-insulin', units: 25, expiresInDays: 60 },
  { warehouseId: 'w-nagpur', medicineId: 'm-insulin', units: 0, expiresInDays: 0 },
  { warehouseId: 'w-hyd', medicineId: 'm-insulin', units: 120, expiresInDays: 250 },
]
