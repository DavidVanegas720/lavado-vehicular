import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift } from '../../src/services/shifts.js'
import { createOrder } from '../../src/services/orders.js'
import * as cat from '../../src/services/catalog.js'

const DAY1 = new Date('2026-10-29T15:00:00Z')
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c
const ids = (list) => list.map((x) => x.id)

beforeEach(() => {
  resetMock()
  setMockNow(DAY1)
  signIn('ana')
})

test('price change affects only later orders', () => {
  signIn('carlos')
  openShift({ openingCash: 0 })
  const first = createOrder(wash)
  signIn('ana')
  cat.setPrice('cat-200', 'full', 28000)
  signIn('carlos')
  const second = createOrder({ ...wash, plate: 'XYZ98' })
  assert.equal(first.listPrice, 25000)
  assert.equal(second.listPrice, 28000)
})

test('new washer is biweekly; frequency change adds a history row and changes no order', () => {
  signIn('carlos')
  openShift({ openingCash: 0 })
  const order = createOrder(wash)
  signIn('ana')
  const w = cat.createWasher({ name: ' Nuevo ', commissionBp: 3000 })
  assert.equal(w.name, 'Nuevo')
  assert.equal(w.payFrequency, 'biweekly')
  assert.deepEqual(w.payFrequencyHistory, [])
  const u = cat.updateWasher(w.id, { payFrequency: 'weekly' })
  assert.equal(u.payFrequencyHistory.length, 1)
  assert.equal(u.payFrequencyHistory[0].payFrequency, 'weekly')
  assert.equal(u.payFrequencyHistory[0].changedBy, 'ana')
  assert.equal(u.commissionHistory.length, 0)
  cat.updateWasher('pedro', { commissionBp: 5000 })
  assert.equal(cat.listWashers().find((x) => x.id === 'pedro').commissionHistory.length, 1)
  signIn('carlos')
  assert.equal(createOrder({ ...wash, plate: 'XYZ98' }).commissionAmount, 12500)
  assert.equal(order.commissionAmount, 10000)
})

test('validation', () => {
  const bad = [
    () => cat.createWasher({ name: '  ', commissionBp: 1 }),
    () => cat.createWasher({ name: 'x'.repeat(61), commissionBp: 1 }),
    () => cat.createWasher({ name: 'x', commissionBp: 10001 }),
    () => cat.createWasher({ name: 'x', commissionBp: 1, payFrequency: 'yearly' }),
    () => cat.createCategory({ name: 'x', minCc: 300, maxCc: 250, prices: {} }),
    () => cat.createCategory({ name: 'x', minCc: 1.5, maxCc: 250, prices: {} }),
    () => cat.setPrice('cat-125', 'full', 0),
    () => cat.setPrice('cat-125', 'full', 10.5),
    () => cat.createWashType({ name: 'x', prices: { 'cat-125': 0 } }),
  ]
  for (const f of bad) assert.throws(f, code('validation'))
  assert.throws(() => cat.setPrice('nope', 'full', 5), code('not_found'))
})

test('cc overlap rejected on create, edit and reactivate', () => {
  const prices = { basica: 1000, full: 2000 }
  assert.throws(() => cat.createCategory({ name: 'x', minCc: 125, maxCc: 130, prices }), code('cc_overlap'))
  assert.throws(() => cat.updateCategory('cat-125', { name: 'x', minCc: 0, maxCc: 126 }), code('cc_overlap'))
  cat.updateCategory('cat-125', { name: 'Hasta 100', minCc: 0, maxCc: 100 })
  cat.setCategoryActive('cat-125', false)
  const mid = cat.createCategory({ name: 'Medio', minCc: 0, maxCc: 125, prices })
  assert.throws(() => cat.setCategoryActive('cat-125', true), code('cc_overlap'))
  cat.setCategoryActive(mid.id, false)
  cat.setCategoryActive('cat-125', true)
  assert.throws(() => cat.setCategoryActive(mid.id, true), code('cc_overlap'))
})

test('no write leaves an active pair unpriced', () => {
  const before = JSON.stringify([cat.listCategories(), cat.listWashTypes(), cat.listPrices()])
  assert.throws(() => cat.createCategory({ name: 'x', minCc: 3000, maxCc: 4000, prices: { basica: 1000 } }), code('price_missing'))
  assert.throws(() => cat.createWashType({ name: 'x', prices: { 'cat-125': 1000 } }), code('price_missing'))
  assert.equal(JSON.stringify([cat.listCategories(), cat.listWashTypes(), cat.listPrices()]), before)
  // an inactive wash type created complete, then a new category makes it need a price only once reactivated
  const t = cat.createWashType({ name: 'Cera', prices: { 'cat-125': 1, 'cat-200': 1, 'cat-200p': 1 } })
  cat.setWashTypeActive(t.id, false)
  cat.createCategory({ name: 'Grande', minCc: 2001, maxCc: 3000, prices: { basica: 1, full: 1 } })
  assert.throws(() => cat.setWashTypeActive(t.id, true), code('price_missing'))
  assert.equal(cat.listWashTypes().find((x) => x.id === t.id).active, false)
  cat.setPrice(cat.listCategories().find((c) => c.name === 'Grande').id, t.id, 500)
  assert.equal(cat.setWashTypeActive(t.id, true).active, true)
})

test('deactivated item is hidden from operators and not orderable; admin sees and reactivates', () => {
  cat.setWashTypeActive('full', false)
  cat.setWasherActive('juan', false)
  assert.ok(ids(cat.listWashTypes()).includes('full'))
  signIn('carlos')
  openShift({ openingCash: 0 })
  assert.deepEqual(ids(cat.listWashTypes()), ['basica'])
  assert.deepEqual(ids(cat.listWashers()), ['pedro'])
  assert.ok(cat.listPrices().every((p) => p.washTypeId === 'basica'))
  assert.throws(() => createOrder(wash), code('not_found'))
  assert.throws(() => createOrder({ ...wash, washTypeId: 'basica', washerId: 'juan' }), code('not_found'))
  signIn('ana')
  cat.setWashTypeActive('full', true)
  signIn('carlos')
  assert.equal(createOrder(wash).washTypeName, 'Full')
})

test('operators are forbidden on every catalog write', () => {
  const writes = [
    () => cat.createCategory({ name: 'x', minCc: 5000, maxCc: 6000, prices: {} }),
    () => cat.updateCategory('cat-125', { name: 'x', minCc: 0, maxCc: 125 }),
    () => cat.setCategoryActive('cat-125', false),
    () => cat.createWashType({ name: 'x', prices: {} }),
    () => cat.updateWashType('full', { name: 'x' }),
    () => cat.setWashTypeActive('full', false),
    () => cat.setPrice('cat-125', 'full', 5),
    () => cat.createWasher({ name: 'x', commissionBp: 1 }),
    () => cat.updateWasher('pedro', { name: 'x' }),
    () => cat.setWasherActive('pedro', false),
    () => cat.setWasherCommissionBp('pedro', 1),
  ]
  signIn('carlos')
  for (const w of writes) assert.throws(w, code('forbidden'))
})
