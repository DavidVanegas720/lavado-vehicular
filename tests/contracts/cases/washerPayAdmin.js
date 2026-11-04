// Shared cases for the P4 admin washer pay: balances, ledger, outside payments, corrections, cash flow.
// driver: { reset(), as(key), at(date), openShift, getShiftStatus, getClosePreview, createOrder, finishOrder, recordTillPayment,
// listWasherBalances, getWasherLedger, recordOutsidePayment, recordCorrection, getCashFlow, updateWasher, setWasherActive }.
// Keys: operator, admin. Single seed shift "unico".
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_unico'
const outside = (amount, extra) => ({ id: randomUUID(), washerId: 'pedro', amount, ...extra })
const correction = (amount, reason, extra) => ({ id: randomUUID(), washerId: 'pedro', amount, reason, ...extra })
const MONTH = { periodType: 'monthly', businessDate: '2026-10-29' }

export default function washerPayAdminCases(d) {
  /** Pedro earns 10000 (40% of 25000, cash); 4000 paid at the till. Back as admin. */
  async function seed() {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 50000 })
    const o = await d.createOrder({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })
    await d.finishOrder(o.id, { paymentMethod: 'cash' })
    await d.recordTillPayment(KEY, { id: randomUUID(), washerId: 'pedro', amount: 4000, period: 'current' })
    await d.as('admin')
  }
  const pedro = async () => (await d.listWasherBalances()).find((w) => w.washerId === 'pedro')

  test('balances: earned, paid and owed per washer and period', async () => {
    await seed()
    const p = await pedro()
    assert.equal(p.balanceOwed, 6000)
    assert.deepEqual(p.current, { periodKey: '2026-10-Q2', earned: 10000, paid: 4000 })
    assert.deepEqual(p.previous, { periodKey: '2026-10-Q1', earned: 0, paid: 0 })
    const ledger = await d.getWasherLedger('pedro')
    assert.deepEqual(ledger.periods.map(({ periodKey, earned, paid }) => ({ periodKey, earned, paid })), [{ periodKey: '2026-10-Q2', earned: 10000, paid: 4000 }])
    assert.equal(ledger.entries.length, 1)
  })

  test('changing frequency leaves the balance unchanged', async () => {
    await seed()
    await d.updateWasher('pedro', { payFrequency: 'weekly' })
    const w = await pedro()
    assert.equal(w.balanceOwed, 6000)
    assert.equal(w.current.earned, 10000) // week of Oct 26-Nov 1 holds the same order
    assert.equal(w.current.paid, 0) // the payment keeps its biweekly periodKey
  })

  test('correction -5000 moves the balance by 5000 and is not a close', async () => {
    await seed()
    const c = await d.recordCorrection(correction(-5000, ' ajuste '))
    assert.equal(c.source, 'correction')
    assert.equal(c.reason, 'ajuste')
    assert.equal((await pedro()).balanceOwed, 11000)
    assert.equal((await d.getCashFlow(MONTH)).corrections, -5000)
    await d.as('operator')
    assert.deepEqual((await d.getClosePreview(KEY)).tillPayments, [{ washerName: 'Pedro', amount: 4000 }])
    await d.as('admin')
    await assert.rejects(() => d.recordCorrection(correction(0, 'x')), code('validation'))
    await assert.rejects(() => d.recordCorrection(correction(1, '  ')), code('validation'))
    await assert.rejects(() => d.recordCorrection(correction(1, 'x', { id: 'nope' })), code('validation'))
  })

  test('cash flow splits till and outside', async () => {
    await seed()
    const p = await d.recordOutsidePayment(outside(2000, { period: 'current', note: 'transferencia' }))
    assert.equal(p.source, 'outside')
    assert.equal(p.shiftKey, null)
    const f = await d.getCashFlow(MONTH)
    assert.deepEqual(f.in, { cash: 25000, qr: 0, total: 25000 })
    assert.deepEqual(f.out, { till: 4000, outside: 2000, total: 6000 })
    assert.equal(f.owed, 4000)
  })

  test('outside payment and correction: same id replays one entry; bad id -> validation', async () => {
    await seed()
    const pay = outside(2000, { period: 'current' })
    const a = await d.recordOutsidePayment(pay)
    const b = await d.recordOutsidePayment(pay)
    assert.equal(a.id, pay.id)
    assert.equal(b.id, pay.id)
    assert.equal((await d.getWasherLedger('pedro')).entries.length, 2) // till + one outside
    assert.equal((await pedro()).balanceOwed, 4000)
    const fix = correction(-5000, 'ajuste')
    await d.recordCorrection(fix)
    await d.recordCorrection(fix)
    assert.equal((await pedro()).balanceOwed, 9000)
    await assert.rejects(() => d.recordOutsidePayment(outside(1, { id: 'nope' })), code('validation'))
  })

  test('outside payment above the balance, unknown washer, operators', async () => {
    await seed()
    await assert.rejects(() => d.recordOutsidePayment(outside(6001)), code('validation'))
    await assert.rejects(() => d.getWasherLedger('nadie'), code('not_found'))
    await assert.rejects(() => d.recordCorrection(correction(1, 'x', { washerId: 'nadie' })), code('not_found'))
    await d.as('operator')
    await assert.rejects(() => d.listWasherBalances(), code('forbidden'))
    await assert.rejects(() => d.getWasherLedger('pedro'), code('forbidden'))
    await assert.rejects(() => d.recordOutsidePayment(outside(1)), code('forbidden'))
    await assert.rejects(() => d.recordCorrection(correction(1, 'x')), code('forbidden'))
    await assert.rejects(() => d.getCashFlow(MONTH), code('forbidden'))
  })

  test('deactivated washer keeps showing and can be paid; daily default is current', async () => {
    await seed()
    await d.setWasherActive('pedro', false)
    assert.equal((await pedro()).active, false)
    assert.equal((await d.recordOutsidePayment(outside(1000))).periodKey, '2026-10-Q1')
    await d.updateWasher('pedro', { payFrequency: 'daily' })
    assert.equal((await d.recordOutsidePayment(outside(1000))).periodKey, '2026-10-29')
  })

  test('getShiftStatus gives the running shift\'s businessDate at 02:00', async () => {
    await seed()
    await d.at(new Date('2026-10-30T07:00:00Z')) // 02:00 Bogota, shift 6->6 started 2026-10-29
    await d.as('operator')
    assert.equal((await d.getShiftStatus()).current.businessDate, '2026-10-29')
  })
}
