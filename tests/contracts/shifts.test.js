import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { getShiftStatus, openShift, closeShift, reopenShift } from '../../src/services/shifts.js'
import { createOrder, finishOrder, cancelOrder } from '../../src/services/orders.js'
import { listShiftEvents } from '../../src/mocks/shifts.js'

const DAY1 = new Date('2026-10-29T15:00:00Z') // 10:00 Bogota, shift 2026-10-29_unico, ends 06:00 next day
const AFTER_END = new Date('2026-10-30T12:00:00Z')
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_unico'

beforeEach(() => { resetMock(); setMockNow(DAY1) })

test('order before the shift is opened -> shift_not_open', () => {
  signIn('carlos')
  assert.throws(() => createOrder(wash), code('shift_not_open'))
  assert.equal(getShiftStatus().current.state, 'not_opened')
})

test('open twice -> invalid_state; bad base -> validation', () => {
  signIn('carlos')
  assert.throws(() => openShift({ openingCash: -1 }), code('validation'))
  assert.throws(() => openShift({ openingCash: 1.5 }), code('validation'))
  openShift({ openingCash: 50000 })
  assert.equal(getShiftStatus().current.state, 'open')
  signIn('laura')
  assert.throws(() => openShift({ openingCash: 0 }), code('invalid_state'))
})

test('admin and superadmin get forbidden on open, close and reopen', () => {
  for (const who of ['ana', 'david']) {
    signIn(who)
    assert.throws(() => openShift({ openingCash: 0 }), code('forbidden'))
    assert.throws(() => closeShift(KEY, { countedCash: 0 }), code('forbidden'))
    assert.throws(() => reopenShift(KEY, { reason: 'x' }), code('forbidden'))
  }
})

test('close before endsAt or with an in_progress order of another operator -> invalid_state', () => {
  signIn('carlos')
  openShift({ openingCash: 0 })
  assert.throws(() => closeShift(KEY, { countedCash: 0 }), code('invalid_state'))
  createOrder(wash)
  setMockNow(AFTER_END)
  signIn('laura')
  assert.throws(() => closeShift(KEY, { countedCash: 0 }), code('invalid_state'))
  assert.throws(() => closeShift(KEY, { countedCash: -1 }), code('validation'))
})

test('Laura closes Carlos shift: expected 75.000, difference -1.000; then shift_closed', () => {
  signIn('carlos')
  openShift({ openingCash: 50000 })
  const a = createOrder(wash)
  const b = createOrder({ ...wash, plate: 'XYZ98' })
  const c = createOrder({ ...wash, plate: 'QWE45' })
  finishOrder(a.id, { paymentMethod: 'cash' })
  finishOrder(b.id, { paymentMethod: 'qr' })
  cancelOrder(c.id, { reason: 'cliente se fue' })
  setMockNow(AFTER_END)
  signIn('laura')
  closeShift(KEY, { countedCash: 74000 })
  const close = listShiftEvents().at(-1)
  assert.equal(close.expectedCash, 75000)
  assert.equal(close.difference, -1000)
  assert.equal(close.by, 'laura')
  assert.equal(close.totals.sales, 50000)
  assert.equal(getShiftStatus().unclosed.length, 0)
  signIn('carlos')
  assert.throws(() => finishOrder(a.id, { paymentMethod: 'cash' }), code('shift_closed'))
  assert.throws(() => cancelOrder(a.id, { reason: 'x' }), code('shift_closed'))
  signIn('ana')
  assert.throws(() => cancelOrder(a.id, { reason: 'x' }), code('shift_closed'))
})

test('reopen: reason required; close again keeps both closes', () => {
  signIn('carlos')
  openShift({ openingCash: 50000 })
  const a = createOrder(wash)
  finishOrder(a.id, { paymentMethod: 'cash' })
  setMockNow(AFTER_END)
  closeShift(KEY, { countedCash: 74000 })
  assert.equal(listShiftEvents().at(-1).difference, -1000)
  assert.throws(() => reopenShift(KEY, { reason: '  ' }), code('validation'))
  assert.throws(() => reopenShift('2026-10-28_unico', { reason: 'x' }), code('invalid_state'))
  reopenShift(KEY, { reason: 'recount' })
  signIn('ana')
  assert.throws(() => cancelOrder(a.id, { reason: 'bad wash' }), code('invalid_state'))
  signIn('carlos')
  closeShift(KEY, { countedCash: 75000 })
  const closes = listShiftEvents().filter((e) => e.type === 'close')
  assert.equal(closes.length, 2)
  assert.equal(closes[1].expectedCash, 75000)
  assert.equal(closes[1].difference, 0)
  assert.equal(closes[1].totals.sales, 25000)
})

test('an unclosed ended instance does not block opening the next', () => {
  signIn('carlos')
  openShift({ openingCash: 0 })
  setMockNow(AFTER_END)
  const status = getShiftStatus()
  assert.equal(status.unclosed.length, 1)
  assert.equal(status.unclosed[0].shiftKey, KEY)
  openShift({ openingCash: 10000 })
  assert.equal(getShiftStatus().current.shiftKey, '2026-10-30_unico')
  assert.equal(getShiftStatus().current.state, 'open')
})
