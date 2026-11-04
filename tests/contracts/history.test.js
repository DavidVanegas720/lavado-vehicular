import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift } from '../../src/mocks/shifts.js'
import { createOrder, cancelOrder, finishOrder } from '../../src/mocks/orders.js'
import { getPlateHistory } from '../../src/mocks/history.js'

const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c
// Thu 29 Oct (W44), Mon 26 Oct (W44), Sun 25 Oct (W43), Wed 30 Sep (other month)
const days = ['2026-09-30', '2026-10-25', '2026-10-26', '2026-10-29']

async function washOn(day, input = wash) {
  setMockNow(new Date(`${day}T15:00:00Z`))
  await signIn('carlos')
  await openShift({ openingCash: 0 })
  return await createOrder(input)
}

beforeEach(() => resetMock())

test('counts for day, Monday week, month and all time; vehicle totals', async () => {
  for (const d of days) await washOn(d)
  await signIn('ana')
  const h = await getPlateHistory('abc-12d')
  assert.deepEqual(h.counts, { day: 1, week: 2, month: 3, all: 4 })
  assert.equal(h.orders.length, 4)
  assert.equal(h.orders[0].businessDate, '2026-10-29')
  assert.equal(h.vehicle.totalWashes, 4)
  assert.equal(h.vehicle.lastCc, 150)
  assert.equal(h.vehicle.plateSpecial, false)
})

test('special plate found with plateSpecial true; unknown plate has null vehicle', async () => {
  await washOn('2026-10-29', { ...wash, plate: 'CD1234', plateSpecial: true })
  await signIn('ana')
  const h = await getPlateHistory('cd 1234')
  assert.equal(h.vehicle.plateSpecial, true)
  assert.equal(h.counts.all, 1)
  assert.deepEqual((await getPlateHistory('ZZZ99')).vehicle, null)
})

test('operator is forbidden', async () => {
  await washOn('2026-10-29')
  await assert.rejects(async () => getPlateHistory('ABC12D'), code('forbidden'))
})

test('cancel before the wash is excluded; totalWashes never decrements', async () => {
  const a = await washOn('2026-10-29')
  const b = await createOrder(wash)
  await cancelOrder(a.id, { reason: 'error' })
  await finishOrder(b.id, { paymentMethod: 'cash' })
  await signIn('ana')
  await assert.rejects(async () => cancelOrder(b.id, { reason: 'reclamo' }), code('invalid_state'))
  const h = await getPlateHistory('ABC12D')
  assert.equal(h.counts.all, 1)
  assert.equal(h.orders.length, 2)
  assert.equal(h.vehicle.totalWashes, 2)
})
