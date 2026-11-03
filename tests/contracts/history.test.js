import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift } from '../../src/services/shifts.js'
import { createOrder, cancelOrder, finishOrder } from '../../src/services/orders.js'
import { getPlateHistory } from '../../src/services/history.js'

const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c
// Thu 29 Oct (W44), Mon 26 Oct (W44), Sun 25 Oct (W43), Wed 30 Sep (other month)
const days = ['2026-09-30', '2026-10-25', '2026-10-26', '2026-10-29']

function washOn(day, input = wash) {
  setMockNow(new Date(`${day}T15:00:00Z`))
  signIn('carlos')
  openShift({ openingCash: 0 })
  return createOrder(input)
}

beforeEach(() => resetMock())

test('counts for day, Monday week, month and all time; vehicle totals', () => {
  days.forEach((d) => washOn(d))
  signIn('ana')
  const h = getPlateHistory('abc-12d')
  assert.deepEqual(h.counts, { day: 1, week: 2, month: 3, all: 4 })
  assert.equal(h.orders.length, 4)
  assert.equal(h.orders[0].businessDate, '2026-10-29')
  assert.equal(h.vehicle.totalWashes, 4)
  assert.equal(h.vehicle.lastCc, 150)
  assert.equal(h.vehicle.plateSpecial, false)
})

test('special plate found with plateSpecial true; unknown plate has null vehicle', () => {
  washOn('2026-10-29', { ...wash, plate: 'CD1234', plateSpecial: true })
  signIn('ana')
  const h = getPlateHistory('cd 1234')
  assert.equal(h.vehicle.plateSpecial, true)
  assert.equal(h.counts.all, 1)
  assert.deepEqual(getPlateHistory('ZZZ99').vehicle, null)
})

test('operator is forbidden', () => {
  washOn('2026-10-29')
  assert.throws(() => getPlateHistory('ABC12D'), code('forbidden'))
})

test('cancel before the wash is excluded; refund still counts; totalWashes never decrements', () => {
  const a = washOn('2026-10-29')
  const b = createOrder(wash)
  cancelOrder(a.id, { reason: 'error' })
  finishOrder(b.id, { paymentMethod: 'cash' })
  signIn('ana')
  cancelOrder(b.id, { reason: 'reclamo', washerPaid: false })
  const h = getPlateHistory('ABC12D')
  assert.equal(h.counts.all, 1)
  assert.equal(h.orders.length, 2)
  assert.equal(h.vehicle.totalWashes, 2)
})
