// Shared cases for till payments. Same driver and keys as coreFlow.js, plus listTillPayables and recordTillPayment.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const AFTER_END = new Date('2026-10-30T12:00:00Z')
const KEY = '2026-10-29_unico'
const pay = (amount, extra) => ({ id: randomUUID(), washerId: 'pedro', amount, period: 'current', ...extra })
const pedro = async (d) => (await d.listTillPayables()).find((w) => w.washerId === 'pedro')

export default function tillPayCases(d) {
  /** Base 50000, one 25000 cash sale by Pedro (commission 10000). */
  const seed = async () => {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 50000 })
    const o = await d.createOrder({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' })
    await d.finishOrder(o.id, { paymentMethod: 'cash' })
  }

  test('payables show the balance; pay 4000 twice with one id -> one payment; close expects 71000', async () => {
    await seed()
    assert.equal((await pedro(d)).balanceOwed, 10000)
    const p = pay(4000)
    await d.recordTillPayment(KEY, p)
    await d.recordTillPayment(KEY, p)
    assert.equal((await pedro(d)).balanceOwed, 6000)
    await d.at(AFTER_END)
    assert.equal((await d.closeShift(KEY, { countedCash: 71000 })).expectedCash, 71000) // 50000 + 25000 - 4000
  })

  test('amount over the balance, zero or a bad period -> validation; admin -> forbidden', async () => {
    await seed()
    await assert.rejects(() => d.recordTillPayment(KEY, pay(10001)), code('validation'))
    await assert.rejects(() => d.recordTillPayment(KEY, pay(0)), code('validation'))
    await assert.rejects(() => d.recordTillPayment(KEY, pay(100, { period: 'next' })), code('validation'))
    await d.as('admin')
    await assert.rejects(() => d.recordTillPayment(KEY, pay(100)), code('forbidden'))
    await assert.rejects(() => d.listTillPayables(), code('forbidden'))
  })

  test('shift not opened -> shift_not_open; closed -> shift_closed', async () => {
    await d.reset(); await d.as('operator')
    await assert.rejects(() => d.recordTillPayment(KEY, pay(1)), code('shift_not_open'))
    await seed()
    await d.at(AFTER_END)
    await d.closeShift(KEY, { countedCash: 75000 })
    await assert.rejects(() => d.recordTillPayment(KEY, pay(100)), code('shift_closed'))
  })
}
