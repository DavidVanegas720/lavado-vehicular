// shortcut: mock state lives in memory and resets on reload; replaced by Firebase in P9-P10
// placeholder: real shift hours pending David (00-master §6)
const SHIFTS = [{ id: 'unico', name: 'Turno único', startHour: 6, endHour: 6 }]

const item = (x) => ({ ...x, active: true })
const type = (x) => ({ ...item(x), vehicleType: 'motorcycle' })
const car = (x) => ({ ...item(x), vehicleType: 'car' })
const washer = (x) => ({ ...item(x), payFrequency: 'biweekly', commissionHistory: [], payFrequencyHistory: [] })

/** Fresh mock database. Every call returns independent objects. */
export function createSeed(today = new Date()) {
  const day = (n) => new Date(today.getTime() - 5 * 3600000 + n * 86400000).toISOString().slice(0, 10) // Bogota date + n days
  const b = (id, name, enabledVehicleTypes, status, paidUntil) => ({
    id, name, enabledVehicleTypes, status, blockedAt: null, blockedReason: null,
    billing: { monthlyFee: 150000, paidUntil, lastPaymentAt: null }, shifts: structuredClone(SHIFTS),
  })
  const blocked = { ...b('bloqueado', 'Negocio Bloqueado', ['motorcycle'], 'blocked', day(-10)), blockedAt: today.toISOString(), blockedReason: 'Falta de pago' }
  return {
    platform: { alertWindowDays: 5 },
    billingPayments: [],
    businesses: [
      b('medallo', 'Medallo Bikes', ['motorcycle'], 'active', day(3)),
      b('prueba', 'Lavadero Prueba', ['motorcycle', 'car'], 'active', day(400)),
      blocked,
    ],
    users: [
      { id: 'carlos', name: 'Carlos', role: 'operator', businessId: 'medallo', active: true },
      { id: 'ana', name: 'Ana', role: 'admin', businessId: 'medallo', active: true },
      { id: 'laura', name: 'Laura', role: 'operator', businessId: 'medallo', active: true },
      { id: 'beto', name: 'Beto', role: 'operator', businessId: 'prueba', active: true },
      { id: 'bloqueado', name: 'Bloqueado', role: 'operator', businessId: 'bloqueado', active: true },
      { id: 'david', name: 'David', role: 'superadmin', businessId: null, active: true },
    ],
    catalogs: {
      medallo: {
        categories: [
          type({ id: 'cat-125', name: 'Hasta 125 cc', minCc: 0, maxCc: 125 }),
          type({ id: 'cat-200', name: 'De 126 a 200 cc', minCc: 126, maxCc: 200 }),
          type({ id: 'cat-200p', name: 'Más de 200 cc', minCc: 201, maxCc: 2000 }),
        ],
        washTypes: [
          type({ id: 'basica', name: 'Básica' }),
          type({ id: 'full', name: 'Full' }),
        ],
        washers: [
          washer({ id: 'pedro', name: 'Pedro', commissionBp: 4000 }),
          washer({ id: 'juan', name: 'Juan', commissionBp: 5000 }),
        ],
        prices: [
          { categoryId: 'cat-125', washTypeId: 'basica', price: 15000 },
          { categoryId: 'cat-125', washTypeId: 'full', price: 20000 },
          { categoryId: 'cat-200', washTypeId: 'basica', price: 18000 },
          { categoryId: 'cat-200', washTypeId: 'full', price: 25000 },
          { categoryId: 'cat-200p', washTypeId: 'basica', price: 22000 },
          { categoryId: 'cat-200p', washTypeId: 'full', price: 30000 },
        ],
      },
      prueba: {
        categories: [
          type({ id: 'p-todas', name: 'Todas', minCc: 0, maxCc: 2000 }),
          car({ id: 'p-auto', name: 'Automóvil' }),
          car({ id: 'p-camioneta', name: 'Camioneta' }),
        ],
        washTypes: [type({ id: 'p-basica', name: 'Básica' }), car({ id: 'p-general', name: 'Lavado general' })],
        washers: [washer({ id: 'p-lavador', name: 'Lavador Prueba', commissionBp: 4000 })],
        prices: [
          { categoryId: 'p-todas', washTypeId: 'p-basica', price: 10000 },
          { categoryId: 'p-auto', washTypeId: 'p-general', price: 25000 },
          { categoryId: 'p-camioneta', washTypeId: 'p-general', price: 35000 },
        ],
      },
      bloqueado: { categories: [], washTypes: [], washers: [], prices: [] },
    },
    orders: [],
    vehicles: {}, // vehicles[businessId][plate]
    shiftEvents: [],
    washerPayments: [],
    nextId: 1,
  }
}
