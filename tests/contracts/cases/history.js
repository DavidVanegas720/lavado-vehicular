// Shared cases for the P4 plate history. driver: { reset(), as(key), at(date), openShift, createOrder, finishOrder, cancelOrder,
// getPlateHistory }. Keys: operator, admin. Never relies on equal createdAt order (each wash moves the clock).
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const wash = (extra) => ({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro', ...extra })
// Thu 29 Oct (W44), Mon 26 Oct (W44), Sun 25 Oct (W43), Wed 30 Sep (other month)
const days = ['2026-09-30', '2026-10-25', '2026-10-26', '2026-10-29']

export default function historyCases(d) {
  async function washOn(day, extra) {
    await d.at(new Date(`${day}T15:00:00Z`))
    await d.as('operator')
    await d.openShift({ openingCash: 0 })
    return await d.createOrder(wash(extra))
  }

  test('counts for day, Monday week, month and all time; vehicle totals', async () => {
    await d.reset()
    for (const day of days) await washOn(day)
    await d.as('admin')
    const h = await d.getPlateHistory('abc-12d')
    assert.deepEqual(h.counts, { day: 1, week: 2, month: 3, all: 4 })
    assert.equal(h.orders.length, 4)
    assert.equal(h.orders[0].businessDate, '2026-10-29')
    assert.equal(h.vehicle.totalWashes, 4)
    assert.equal(h.vehicle.lastCc, 150)
    assert.equal(h.vehicle.plateSpecial, false)
  })

  test('special plate found with plateSpecial true; unknown plate has null vehicle', async () => {
    await d.reset()
    await washOn('2026-10-29', { plate: 'CD1234', plateSpecial: true })
    await d.as('admin')
    const h = await d.getPlateHistory('cd 1234')
    assert.equal(h.vehicle.plateSpecial, true)
    assert.equal(h.counts.all, 1)
    assert.deepEqual((await d.getPlateHistory('ZZZ99')).vehicle, null)
  })

  test('operator is forbidden', async () => {
    await d.reset()
    await washOn('2026-10-29')
    await assert.rejects(() => d.getPlateHistory('ABC12D'), code('forbidden'))
  })

  test('cancel before the wash is excluded; totalWashes never decrements', async () => {
    await d.reset()
    const a = await washOn('2026-10-29')
    const b = await d.createOrder(wash())
    await d.cancelOrder(a.id, { reason: 'error' })
    await d.finishOrder(b.id, { paymentMethod: 'cash' })
    await d.as('admin')
    await assert.rejects(() => d.cancelOrder(b.id, { reason: 'reclamo' }), code('invalid_state'))
    const h = await d.getPlateHistory('ABC12D')
    assert.equal(h.counts.all, 1)
    assert.equal(h.orders.length, 2)
    assert.equal(h.vehicle.totalWashes, 2)
  })
}
