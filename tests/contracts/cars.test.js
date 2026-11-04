import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift } from '../../src/mocks/shifts.js'
import { createOrder } from '../../src/mocks/orders.js'
import * as cat from '../../src/mocks/catalog.js'

const code = (c) => (e) => e.code === c
const car = { plate: 'ABC123', vehicleType: 'car', categoryId: 'p-auto', washTypeId: 'p-general', washerId: 'p-lavador' }

beforeEach(async () => {
  resetMock((db) => db.users.push({ id: 'pa', name: 'Admin Prueba', role: 'admin', businessId: 'prueba', active: true }))
  setMockNow(new Date('2026-10-29T15:00:00Z'))
})

test('Beto registers a car order: cc null, car price', async () => {
  await signIn('beto')
  await openShift({ openingCash: 0 })
  const o = await createOrder(car)
  assert.equal(o.plate, 'ABC123')
  assert.equal(o.cc, null)
  assert.equal(o.vehicleType, 'car')
  assert.equal(o.listPrice, 25000)
})

test('Carlos (motorcycle only) cannot order a car', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 0 })
  await assert.rejects(async () => createOrder(car), code('forbidden'))
})

test('Medallo admin cannot create car catalog items', async () => {
  await signIn('ana')
  await assert.rejects(async () => cat.createCategory({ name: 'Auto', vehicleType: 'car' }), code('forbidden'))
  await assert.rejects(async () => cat.createWashType({ name: 'Auto', vehicleType: 'car' }), code('forbidden'))
})

test('a car category never overlaps motorcycle categories', async () => {
  await signIn('pa')
  const c = await cat.createCategory({ name: 'Sedán', vehicleType: 'car', minCc: 0, maxCc: 2000, prices: { 'p-general': 20000 } })
  assert.equal(c.vehicleType, 'car')
  assert.equal(c.minCc, undefined)
})
