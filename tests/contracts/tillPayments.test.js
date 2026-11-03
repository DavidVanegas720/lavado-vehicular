import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift, closeShift, getClosePreview, getShiftInstance } from '../../src/services/shifts.js'
import { createOrder, finishOrder } from '../../src/services/orders.js'
import { listTillPayables, recordTillPayment } from '../../src/services/washerPay.js'
import { setWasherActive } from '../../src/services/catalog.js'

const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_B'
const OPEN_AT = new Date('2026-10-29T23:30:00Z')
const AFTER_END = new Date('2026-10-30T17:30:00Z')

beforeEach(() => {
  resetMock((db) => {
    db.businesses[0].shifts = [
      { id: 'A', name: 'Turno A', startHour: 12, endHour: 18 },
      { id: 'B', name: 'Turno B', startHour: 18, endHour: 12 },
    ]
  })
  setMockNow(OPEN_AT)
})

/** Base 50000, one 25000 cash sale by pedro (commission 10000). */
function seed() {
  signIn('carlos')
  openShift({ openingCash: 50000 })
  const o = createOrder({ plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })
  finishOrder(o.id, { paymentMethod: 'cash' })
}

test('till payment lowers expected cash; preview and instance list it', () => {
  seed()
  assert.equal(listTillPayables().find((w) => w.washerId === 'pedro').balanceOwed, 10000)
  const p = recordTillPayment(KEY, { washerId: 'pedro', amount: 10000, period: 'current', note: 'x' })
  assert.equal(p.source, 'till')
  assert.equal(p.businessDate, '2026-10-29')
  assert.equal(p.periodKey, '2026-10-Q2')
  assert.deepEqual(getClosePreview(KEY).tillPayments, [{ washerName: 'Pedro', amount: 10000 }])
  assert.equal(listTillPayables().find((w) => w.washerId === 'pedro').balanceOwed, 0)
  setMockNow(AFTER_END)
  assert.equal(closeShift(KEY, { countedCash: 65000 }).expectedCash, 65000) // 50000 + 25000 - 10000
  signIn('ana')
  assert.deepEqual(getShiftInstance(KEY).tillPayments, [{ washerName: 'Pedro', amount: 10000 }])
})

test('plan example: 20000 payment with base 50000 and 25000 cash sales -> expected 55000', () => {
  signIn('carlos')
  openShift({ openingCash: 50000 })
  // juan 50% of 25000 would be 12500; pay 20000 needs a balance, so earn it with two sales
  for (const plate of ['AAA11A', 'BBB22B']) {
    const o = createOrder({ plate, cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'juan' })
    finishOrder(o.id, { paymentMethod: plate === 'AAA11A' ? 'cash' : 'qr' })
  }
  recordTillPayment(KEY, { washerId: 'juan', amount: 20000 })
  setMockNow(AFTER_END)
  assert.equal(closeShift(KEY, { countedCash: 55000 }).expectedCash, 55000)
})

test('validation, forbidden, shift_not_open, shift_closed', () => {
  signIn('carlos')
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 1 }), code('shift_not_open'))
  seed()
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 10001 }), code('validation'))
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 0 }), code('validation'))
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 100, period: 'next' }), code('validation'))
  signIn('ana')
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 100 }), code('forbidden'))
  assert.throws(() => listTillPayables(), code('forbidden'))
  setMockNow(AFTER_END)
  signIn('carlos')
  closeShift(KEY, { countedCash: 75000 })
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 100 }), code('shift_closed'))
})

test('a washer deactivated after load -> not_found', () => {
  seed()
  signIn('ana')
  setWasherActive('pedro', false)
  signIn('carlos')
  assert.throws(() => recordTillPayment(KEY, { washerId: 'pedro', amount: 100 }), code('not_found'))
})
