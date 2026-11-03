import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import {
  getShiftStatus, openShift, closeShift, reopenShift, getClosePreview, listShiftInstances, getShiftInstance,
} from '../../src/services/shifts.js'
import { createOrder, finishOrder, cancelOrder } from '../../src/services/orders.js'

const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_B'
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const OPEN_AT = new Date('2026-10-29T23:30:00Z') // 18:30 Bogota, shift B 18->12
const AFTER_MIDNIGHT = new Date('2026-10-30T06:00:00Z') // 01:00 Bogota, same instance
const AFTER_END = new Date('2026-10-30T17:30:00Z') // 12:30 Bogota

beforeEach(() => {
  resetMock((db) => {
    db.businesses[0].shifts = [
      { id: 'A', name: 'Turno A', startHour: 12, endHour: 18 },
      { id: 'B', name: 'Turno B', startHour: 18, endHour: 12 },
    ]
  })
  setMockNow(OPEN_AT)
})

/** One instance: courtesy, before-wash cancel, an order at 01:00. */
function seedInstance() {
  signIn('carlos')
  openShift({ openingCash: 100000 })
  const done = (o, paymentMethod) => finishOrder(o.id, { paymentMethod })
  const o1 = createOrder(wash); done(o1, 'cash') // pedro 40% of 25000 = 10000
  const o2 = createOrder({ ...wash, plate: 'XYZ98', washerId: 'juan', isCourtesy: true, courtesyReason: 'amigo' }); done(o2, 'qr') // juan 12500 on list price
  const o3 = createOrder({ ...wash, plate: 'QWE45' }); cancelOrder(o3.id, { reason: 'se fue' })
  const o4 = createOrder({ ...wash, plate: 'RTY67' }); done(o4, 'cash')
  const o5 = createOrder({ ...wash, plate: 'UIO12', washerId: 'juan' }); done(o5, 'cash')
  setMockNow(AFTER_MIDNIGHT)
  signIn('carlos')
  const o6 = createOrder({ ...wash, plate: 'ASD34', washerId: 'juan', washTypeId: 'basica' }); done(o6, 'qr') // 18000 -> juan 9000
  return { o1, o6 }
}

test('totals per washer, method and owner share; order at 01:00 stays in the 18->12 instance', () => {
  const { o6 } = seedInstance()
  assert.equal(o6.shiftKey, KEY)
  setMockNow(AFTER_END)
  signIn('laura')
  const close = closeShift(KEY, { countedCash: 170000 })
  const t = close.totals
  assert.deepEqual(t.salesByMethod, { cash: 75000, qr: 18000 })
  assert.equal(t.sales, 93000)
  assert.deepEqual(t.washerPay, { pedro: { name: 'Pedro', amount: 20000 }, juan: { name: 'Juan', amount: 34000 } })
  assert.equal(t.ownerShare, 39000)
  assert.equal(close.expectedCash, 175000)
  assert.equal(close.difference, -5000)
})

test('preview is blind and lists unfinished orders with the creator name', () => {
  signIn('carlos')
  openShift({ openingCash: 5000 })
  const a = createOrder(wash)
  const p = getClosePreview(KEY)
  assert.equal(p.openingCash, 5000)
  assert.equal(p.expectedCash, undefined)
  assert.deepEqual(p.tillPayments, [])
  assert.deepEqual(p.unfinished, [{ id: a.id, plate: 'ABC12D', createdByName: 'Carlos' }])
  assert.throws(() => getClosePreview('2026-10-28_B'), code('invalid_state'))
})

test('a done order is final on a closed and a reopened instance', () => {
  const { o1 } = seedInstance()
  setMockNow(AFTER_END)
  signIn('laura')
  closeShift(KEY, { countedCash: 175000 })
  assert.equal(getShiftStatus().recentClosed[0].shiftKey, KEY)
  signIn('ana')
  assert.throws(() => cancelOrder(o1.id, { reason: 'x' }), code('shift_closed'))
  signIn('laura')
  reopenShift(KEY, { reason: 'recount' })
  assert.equal(getShiftStatus().recentClosed.length, 0)
  signIn('ana')
  assert.throws(() => cancelOrder(o1.id, { reason: 'x' }), code('invalid_state'))
})

test('admin reads: instances newest first with lateMs, detail with names', () => {
  seedInstance()
  setMockNow(AFTER_END)
  signIn('laura')
  closeShift(KEY, { countedCash: 75000 })
  openShift({ openingCash: 0 }) // 12:30 Bogota -> shift A of Oct 30
  signIn('ana')
  const list = listShiftInstances()
  assert.deepEqual(list.map((i) => [i.shiftKey, i.state]), [['2026-10-30_A', 'open'], [KEY, 'closed']])
  assert.equal(list[0].businessDate, '2026-10-30')
  assert.equal(list[1].lateMs, 0)
  setMockNow(new Date('2026-10-30T20:00:00Z')) // 15:00 Bogota, A ends 18:00 Bogota (23:00Z)
  assert.equal(listShiftInstances()[0].lateMs, 0)
  setMockNow(new Date('2026-10-31T00:00:00Z'))
  assert.equal(listShiftInstances()[0].lateMs, 3600000)
  const d = getShiftInstance(KEY)
  assert.deepEqual(d.events.map((e) => [e.type, e.byName]), [['open', 'Carlos'], ['close', 'Laura']])
  assert.equal(d.latestClose.totals.sales, 93000)
  assert.equal(d.orders.length, 6)
  assert.ok(d.orders.every((o) => o.createdByName === 'Carlos'))
  assert.throws(() => getShiftInstance('nope'), code('not_found'))
})

test('operators forbidden on admin reads; admin and superadmin forbidden on operator calls', () => {
  signIn('carlos')
  assert.throws(() => listShiftInstances(), code('forbidden'))
  assert.throws(() => getShiftInstance(KEY), code('forbidden'))
  for (const who of ['ana', 'david']) {
    signIn(who)
    assert.throws(() => openShift({ openingCash: 0 }), code('forbidden'))
    assert.throws(() => closeShift(KEY, { countedCash: 0 }), code('forbidden'))
    assert.throws(() => reopenShift(KEY, { reason: 'x' }), code('forbidden'))
    assert.throws(() => getClosePreview(KEY), code('forbidden'))
  }
  assert.throws(() => listShiftInstances(), code('forbidden')) // superadmin is not admin
})

