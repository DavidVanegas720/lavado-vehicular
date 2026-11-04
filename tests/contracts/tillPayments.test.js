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

beforeEach(async () => {
  resetMock((db) => {
    db.businesses[0].shifts = [
      { id: 'A', name: 'Turno A', startHour: 12, endHour: 18 },
      { id: 'B', name: 'Turno B', startHour: 18, endHour: 12 },
    ]
  })
  setMockNow(OPEN_AT)
})

/** Base 50000, one 25000 cash sale by pedro (commission 10000). */
async function seed() {
  await signIn('carlos')
  await openShift({ openingCash: 50000 })
  const o = await createOrder({ plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })
  await finishOrder(o.id, { paymentMethod: 'cash' })
}

test('till payment lowers expected cash; preview and instance list it', async () => {
  await seed()
  assert.equal((await listTillPayables()).find((w) => w.washerId === 'pedro').balanceOwed, 10000)
  const p = await recordTillPayment(KEY, { washerId: 'pedro', amount: 10000, period: 'current', note: 'x' })
  assert.equal(p.source, 'till')
  assert.equal(p.businessDate, '2026-10-29')
  assert.equal(p.periodKey, '2026-10-Q2')
  assert.deepEqual((await getClosePreview(KEY)).tillPayments, [{ washerName: 'Pedro', amount: 10000 }])
  assert.equal((await listTillPayables()).find((w) => w.washerId === 'pedro').balanceOwed, 0)
  setMockNow(AFTER_END)
  assert.equal((await closeShift(KEY, { countedCash: 65000 })).expectedCash, 65000) // 50000 + 25000 - 10000
  await signIn('ana')
  assert.deepEqual((await getShiftInstance(KEY)).tillPayments, [{ washerName: 'Pedro', amount: 10000 }])
})

test('plan example: 20000 payment with base 50000 and 25000 cash sales -> expected 55000', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 50000 })
  // juan 50% of 25000 would be 12500; pay 20000 needs a balance, so earn it with two sales
  for (const plate of ['AAA11A', 'BBB22B']) {
    const o = await createOrder({ plate, cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'juan' })
    await finishOrder(o.id, { paymentMethod: plate === 'AAA11A' ? 'cash' : 'qr' })
  }
  await recordTillPayment(KEY, { washerId: 'juan', amount: 20000 })
  setMockNow(AFTER_END)
  assert.equal((await closeShift(KEY, { countedCash: 55000 })).expectedCash, 55000)
})

test('validation, forbidden, shift_not_open, shift_closed', async () => {
  await signIn('carlos')
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 1 }), code('shift_not_open'))
  await seed()
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 10001 }), code('validation'))
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 0 }), code('validation'))
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 100, period: 'next' }), code('validation'))
  await signIn('ana')
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 100 }), code('forbidden'))
  await assert.rejects(async () => listTillPayables(), code('forbidden'))
  setMockNow(AFTER_END)
  await signIn('carlos')
  await closeShift(KEY, { countedCash: 75000 })
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 100 }), code('shift_closed'))
})

test('a washer deactivated after load -> not_found', async () => {
  await seed()
  await signIn('ana')
  await setWasherActive('pedro', false)
  await signIn('carlos')
  await assert.rejects(async () => recordTillPayment(KEY, { washerId: 'pedro', amount: 100 }), code('not_found'))
})
