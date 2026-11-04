import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift, getClosePreview, getShiftStatus } from '../../src/services/shifts.js'
import { createOrder, finishOrder, cancelOrder } from '../../src/services/orders.js'
import { recordTillPayment, listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection } from '../../src/services/washerPay.js'
import { updateWasher, setWasherActive } from '../../src/services/catalog.js'
import { getCashFlow } from '../../src/services/cashFlow.js'

const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_unico'

beforeEach(async () => {
  resetMock()
  setMockNow(new Date('2026-10-29T15:00:00Z'))
})

/** Pedro earns 10000 (40% of 25000, cash); 4000 paid at the till. Back as admin. */
async function seed() {
  await signIn('carlos')
  await openShift({ openingCash: 50000 })
  const o = await createOrder({ plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })
  await finishOrder(o.id, { paymentMethod: 'cash' })
  await recordTillPayment(KEY, { washerId: 'pedro', amount: 4000, period: 'current' })
  await signIn('ana')
  return o.id
}

test('balances: earned, paid and owed per washer and period', async () => {
  await seed()
  const pedro = (await listWasherBalances()).find((w) => w.washerId === 'pedro')
  assert.equal(pedro.balanceOwed, 6000)
  assert.deepEqual(pedro.current, { periodKey: '2026-10-Q2', earned: 10000, paid: 4000 })
  assert.deepEqual(pedro.previous, { periodKey: '2026-10-Q1', earned: 0, paid: 0 })
  const ledger = await getWasherLedger('pedro')
  assert.deepEqual(ledger.periods.map(({ periodKey, earned, paid }) => ({ periodKey, earned, paid })), [{ periodKey: '2026-10-Q2', earned: 10000, paid: 4000 }])
  assert.equal(ledger.entries.length, 1)
})

test('changing frequency leaves the balance unchanged', async () => {
  await seed()
  await updateWasher('pedro', { payFrequency: 'weekly' })
  const w = (await listWasherBalances()).find((x) => x.washerId === 'pedro')
  assert.equal(w.balanceOwed, 6000)
  assert.equal(w.current.earned, 10000) // week of Oct 26-Nov 1 holds the same order
  assert.equal(w.current.paid, 0) // the payment keeps its biweekly periodKey
})

test('correction -5000 moves the balance by 5000 and is not a close', async () => {
  await seed()
  const c = await recordCorrection({ washerId: 'pedro', amount: -5000, reason: ' ajuste ' })
  assert.equal(c.source, 'correction')
  assert.equal(c.reason, 'ajuste')
  assert.equal((await listWasherBalances()).find((w) => w.washerId === 'pedro').balanceOwed, 11000)
  assert.equal((await getCashFlow({ periodType: 'monthly', businessDate: '2026-10-29' })).corrections, -5000)
  await signIn('carlos')
  assert.deepEqual((await getClosePreview(KEY)).tillPayments, [{ washerName: 'Pedro', amount: 4000 }])
  await signIn('ana')
  await assert.rejects(async () => recordCorrection({ washerId: 'pedro', amount: 0, reason: 'x' }), code('validation'))
  await assert.rejects(async () => recordCorrection({ washerId: 'pedro', amount: 1, reason: '  ' }), code('validation'))
})

test('cash flow splits till and outside', async () => {
  await seed()
  const p = await recordOutsidePayment({ washerId: 'pedro', amount: 2000, period: 'current', note: 'transferencia' })
  assert.equal(p.source, 'outside')
  assert.equal(p.shiftKey, null)
  const f = await getCashFlow({ periodType: 'monthly', businessDate: '2026-10-29' })
  assert.deepEqual(f.in, { cash: 25000, qr: 0, total: 25000 })
  assert.deepEqual(f.out, { till: 4000, outside: 2000, total: 6000 })
  assert.equal(f.owed, 4000)
})

test('outside payment above the balance, unknown washer, operators', async () => {
  await seed()
  await assert.rejects(async () => recordOutsidePayment({ washerId: 'pedro', amount: 6001 }), code('validation'))
  await assert.rejects(async () => getWasherLedger('nadie'), code('not_found'))
  await assert.rejects(async () => recordCorrection({ washerId: 'nadie', amount: 1, reason: 'x' }), code('not_found'))
  await signIn('carlos')
  await assert.rejects(async () => listWasherBalances(), code('forbidden'))
  await assert.rejects(async () => getWasherLedger('pedro'), code('forbidden'))
  await assert.rejects(async () => recordOutsidePayment({ washerId: 'pedro', amount: 1 }), code('forbidden'))
  await assert.rejects(async () => recordCorrection({ washerId: 'pedro', amount: 1, reason: 'x' }), code('forbidden'))
  await assert.rejects(async () => getCashFlow({ periodType: 'monthly', businessDate: '2026-10-29' }), code('forbidden'))
})

test('deactivated washer keeps showing and can be paid; daily default is current', async () => {
  await seed()
  await setWasherActive('pedro', false)
  const w = (await listWasherBalances()).find((x) => x.washerId === 'pedro')
  assert.equal(w.active, false)
  assert.equal((await recordOutsidePayment({ washerId: 'pedro', amount: 1000 })).periodKey, '2026-10-Q1')
  await updateWasher('pedro', { payFrequency: 'daily' })
  assert.equal((await recordOutsidePayment({ washerId: 'pedro', amount: 1000 })).periodKey, '2026-10-29')
})

test('getShiftStatus gives the running shift\'s businessDate at 02:00', async () => {
  await seed()
  setMockNow(new Date('2026-10-30T07:00:00Z')) // 02:00 Bogota, shift 6->6 started 2026-10-29
  assert.equal((await getShiftStatus()).current.businessDate, '2026-10-29')
})
