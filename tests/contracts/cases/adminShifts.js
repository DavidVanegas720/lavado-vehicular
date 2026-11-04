// Shared cases for the admin shift reads (P3). driver: { reset(), as(key), at(date), openShift, closeShift, reopenShift,
// getClosePreview, createOrder, finishOrder, cancelOrder, recordTillPayment, listShiftInstances, getShiftInstance }.
// Keys: operator (Carlos), operator2 (Laura), admin, superadmin. Single seed shift "unico" (06:00 to 06:00).
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_unico'
const AFTER_MIDNIGHT = new Date('2026-10-30T06:00:00Z') // 01:00 Bogota, same instance
const AFTER_END = new Date('2026-10-30T12:00:00Z') // 07:00 Bogota, the instance ended at 06:00
const wash = (extra) => ({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro', ...extra })

export default function adminShiftCases(d) {
  /** One instance: courtesy, before-wash cancel, an order at 01:00. Sales 93000 (cash 75000, qr 18000). */
  async function seedInstance() {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 100000 })
    const done = (o, paymentMethod) => d.finishOrder(o.id, { paymentMethod })
    await done(await d.createOrder(wash()), 'cash')
    await done(await d.createOrder(wash({ plate: 'XYZ98', washerId: 'juan', isCourtesy: true, courtesyReason: 'amigo' })), 'qr')
    const cancelled = await d.createOrder(wash({ plate: 'QWE45' }))
    await d.cancelOrder(cancelled.id, { reason: 'se fue' })
    await done(await d.createOrder(wash({ plate: 'RTY67' })), 'cash')
    await done(await d.createOrder(wash({ plate: 'UIO12', washerId: 'juan' })), 'cash')
    await d.at(AFTER_MIDNIGHT)
    await done(await d.createOrder(wash({ plate: 'ASD34', washerId: 'juan', washTypeId: 'basica' })), 'qr')
  }

  test('admin reads: instances newest first with lateMs, detail with names', async () => {
    await seedInstance()
    await d.at(AFTER_END)
    await d.as('operator2')
    await d.closeShift(KEY, { countedCash: 75000 })
    await d.reopenShift(KEY, { reason: 'recount' })
    await d.closeShift(KEY, { countedCash: 175000 })
    await d.openShift({ openingCash: 0 }) // 07:00 Bogota -> instance of Oct 30
    await d.as('admin')
    const list = await d.listShiftInstances()
    assert.deepEqual(list.map((i) => [i.shiftKey, i.state]), [['2026-10-30_unico', 'open'], [KEY, 'closed']])
    assert.equal(list[0].businessDate, '2026-10-30')
    assert.equal(list[1].lateMs, 0)
    await d.at(new Date('2026-10-31T11:00:00Z')) // exactly the end of the Oct 30 instance (06:00 Bogota)
    assert.equal((await d.listShiftInstances())[0].lateMs, 0)
    await d.at(new Date('2026-10-31T12:00:00Z'))
    assert.equal((await d.listShiftInstances())[0].lateMs, 3600000)
    const detail = await d.getShiftInstance(KEY)
    assert.deepEqual(detail.events.map((e) => [e.type, e.byName]), [['open', 'Carlos'], ['close', 'Laura'], ['reopen', 'Laura'], ['close', 'Laura']])
    assert.equal(detail.latestClose.totals.sales, 93000)
    assert.equal(detail.latestClose.countedCash, 175000)
    assert.equal(detail.orders.length, 6)
    assert.ok(detail.orders.every((o) => o.createdByName === 'Carlos'))
    await assert.rejects(() => d.getShiftInstance('nope'), code('not_found'))
  })

  test('closing shows totals per washer, method and owner share; order at 01:00 stays in the instance', async () => {
    await seedInstance()
    await d.at(AFTER_END)
    await d.as('operator2')
    const close = await d.closeShift(KEY, { countedCash: 170000 })
    const t = close.totals
    assert.deepEqual(t.salesByMethod, { cash: 75000, qr: 18000 })
    assert.equal(t.sales, 93000)
    assert.deepEqual(t.washerPay, { pedro: { name: 'Pedro', amount: 20000 }, juan: { name: 'Juan', amount: 34000 } })
    assert.equal(t.ownerShare, 39000)
    assert.equal(close.expectedCash, 175000)
    assert.equal(close.difference, -5000)
  })

  test('till payment is listed by the close preview and the admin instance detail', async () => {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 50000 })
    const o = await d.createOrder(wash())
    await d.finishOrder(o.id, { paymentMethod: 'cash' })
    const p = await d.recordTillPayment(KEY, { id: randomUUID(), washerId: 'pedro', amount: 10000, period: 'current', note: 'x' })
    assert.equal(p.source, 'till')
    assert.equal(p.businessDate, '2026-10-29')
    assert.equal(p.periodKey, '2026-10-Q2')
    assert.deepEqual((await d.getClosePreview(KEY)).tillPayments, [{ washerName: 'Pedro', amount: 10000 }])
    await d.at(AFTER_END)
    assert.equal((await d.closeShift(KEY, { countedCash: 65000 })).expectedCash, 65000) // 50000 + 25000 - 10000
    await d.as('admin')
    assert.deepEqual((await d.getShiftInstance(KEY)).tillPayments, [{ washerName: 'Pedro', amount: 10000 }])
  })

  test('operators forbidden on admin reads; admin and superadmin forbidden on operator calls', async () => {
    await d.reset(); await d.as('operator')
    await assert.rejects(() => d.listShiftInstances(), code('forbidden'))
    await assert.rejects(() => d.getShiftInstance(KEY), code('forbidden'))
    for (const who of ['admin', 'superadmin']) {
      await d.as(who)
      await assert.rejects(() => d.openShift({ openingCash: 0 }), code('forbidden'))
      await assert.rejects(() => d.closeShift(KEY, { countedCash: 0 }), code('forbidden'))
      await assert.rejects(() => d.reopenShift(KEY, { reason: 'x' }), code('forbidden'))
      await assert.rejects(() => d.getClosePreview(KEY), code('forbidden'))
    }
    await assert.rejects(() => d.listShiftInstances(), code('forbidden')) // superadmin is not admin
  })
}
