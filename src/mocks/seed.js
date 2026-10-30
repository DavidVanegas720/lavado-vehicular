// Seed data for the mock layer. Replaced by the real backend in Part B.
export const businesses = [
  { id: 'biz-moto', name: 'Lavadero Norte (demo)', enabledVehicleTypes: ['motorcycle'], status: 'active' },
  { id: 'biz-mixto', name: 'Lavadero Sur (demo)', enabledVehicleTypes: ['motorcycle', 'car'], status: 'active' },
];

export const users = [
  { id: 'u-superadmin', name: 'David', role: 'superadmin', businessId: null },
  { id: 'u-admin-moto', name: 'Ana Ruiz', role: 'admin', businessId: 'biz-moto' },
  { id: 'u-operator-moto', name: 'Carlos Gómez', role: 'operator', businessId: 'biz-moto' },
  { id: 'u-admin-mixto', name: 'Luis Ortiz', role: 'admin', businessId: 'biz-mixto' },
];

// Motorcycle catalog for biz-moto. Prices are integer pesos.
export const categories = [
  { id: 'cat-125', businessId: 'biz-moto', vehicleType: 'motorcycle', name: 'Hasta 125 cc', ccMin: 1, ccMax: 125, sortOrder: 1, active: true },
  { id: 'cat-200', businessId: 'biz-moto', vehicleType: 'motorcycle', name: 'De 126 a 200 cc', ccMin: 126, ccMax: 200, sortOrder: 2, active: true },
  { id: 'cat-big', businessId: 'biz-moto', vehicleType: 'motorcycle', name: 'Más de 200 cc', ccMin: 201, ccMax: 1000, sortOrder: 3, active: true },
];

export const washTypes = [
  { id: 'wt-basic', businessId: 'biz-moto', name: 'Básica', sortOrder: 1, active: true },
  { id: 'wt-full', businessId: 'biz-moto', name: 'Full', sortOrder: 2, active: true },
];

export const prices = [
  { businessId: 'biz-moto', categoryId: 'cat-125', washTypeId: 'wt-basic', amount: 15000 },
  { businessId: 'biz-moto', categoryId: 'cat-125', washTypeId: 'wt-full', amount: 20000 },
  { businessId: 'biz-moto', categoryId: 'cat-200', washTypeId: 'wt-basic', amount: 18000 },
  { businessId: 'biz-moto', categoryId: 'cat-200', washTypeId: 'wt-full', amount: 25000 },
  { businessId: 'biz-moto', categoryId: 'cat-big', washTypeId: 'wt-basic', amount: 20000 },
  { businessId: 'biz-moto', categoryId: 'cat-big', washTypeId: 'wt-full', amount: 30000 },
];

// commissionBp: 4000 = 40.00%. commissionHistory is audit only.
export const washers = [
  { id: 'w-pedro', businessId: 'biz-moto', name: 'Pedro', commissionBp: 4000, commissionHistory: [], active: true },
  { id: 'w-jorge', businessId: 'biz-moto', name: 'Jorge', commissionBp: 5000, commissionHistory: [], active: true },
];
