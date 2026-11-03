import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift } from '../../src/services/shifts.js'
import { createOrder } from '../../src/services/orders.js'
import * as cat from '../../src/services/catalog.js'

const code = (c) => (e) => e.code === c
const car = { plate: 'ABC123', vehicleType: 'car', categoryId: 'p-auto', washTypeId: 'p-general', washerId: 'p-lavador' }

beforeEach(() => {
  resetMock((db) => db.users.push({ id: 'pa', name: 'Admin Prueba', role: 'admin', businessId: 'prueba', active: true }))
  setMockNow(new Date('2026-10-29T15:00:00Z'))
})

test('Beto registers a car order: cc null, car price', () => {
  signIn('beto')
  openShift({ openingCash: 0 })
  const o = createOrder(car)
  assert.equal(o.plate, 'ABC123')
  assert.equal(o.cc, null)
  assert.equal(o.vehicleType, 'car')
  assert.equal(o.listPrice, 25000)
})

test('Carlos (motorcycle only) cannot order a car', () => {
  signIn('carlos')
  openShift({ openingCash: 0 })
  assert.throws(() => createOrder(car), code('forbidden'))
})

test('Medallo admin cannot create car catalog items', () => {
  signIn('ana')
  assert.throws(() => cat.createCategory({ name: 'Auto', vehicleType: 'car' }), code('forbidden'))
  assert.throws(() => cat.createWashType({ name: 'Auto', vehicleType: 'car' }), code('forbidden'))
})

test('a car category never overlaps motorcycle categories', () => {
  signIn('pa')
  const c = cat.createCategory({ name: 'Sedán', vehicleType: 'car', minCc: 0, maxCc: 2000, prices: { 'p-general': 20000 } })
  assert.equal(c.vehicleType, 'car')
  assert.equal(c.minCc, undefined)
})
