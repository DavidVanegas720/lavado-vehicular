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

/** One instance: courtesy, before-wash cancel, two refunds (washerPaid true/false), an order at 01:00. */
function seedInstance() {
  signIn('carlos')
  openShift({ openingCash: 100000 })
  const done = (o, paymentMethod) => finishOrder(o.id, { paymentMethod })
  const o1 = createOrder(wash); done(o1, 'cash') // pedro 40% of 25000 = 10000
  const o2 = createOrder({ ...wash, plate: 'XYZ98', washerId: 'juan', isCourtesy: true, courtesyReason: 'amigo' }); done(o2, 'qr') // juan 12500 on list price
  const o3 = createOrder({ ...wash, plate: 'QWE45' }); cancelOrder(o3.id, { reason: 'se fue' })
  const o4 = createOrder({ ...wash, plate: 'RTY67' }); done(o4, 'cash')
  const o5 = createOrder({ ...wash, plate: 'UIO12', washerId: 'juan' }); done(o5, 'cash')
  signIn('ana')
  cancelOrder(o4.id, { reason: 'mal lavado', washerPaid: true })
  cancelOrder(o5.id, { reason: 'mal lavado', washerPaid: false })
  setMockNow(AFTER_MIDNIGHT)
  signIn('carlos')
  const o6 = createOrder({ ...wash, plate: 'ASD34', washerId: 'juan', washTypeId: 'basica' }); done(o6, 'qr') // 18000 -> juan 9000
  return { o1, o6 }
}

test('totals per washer, method, refunds and owner share; order at 01:00 stays in the 18->12 instance', () => {
  const { o6 } = seedInstance()
  assert.equal(o6.shiftKey, KEY)
  setMockNow(AFTER_END)
  signIn('laura')
  const close = closeShift(KEY, { countedCash: 70000 })
  const t = close.totals
  assert.deepEqual(t.salesByMethod, { cash: 75000, qr: 18000 })
  assert.equal(t.sales, 93000)
  assert.equal(t.refundsCount, 2)
  assert.equal(t.refundsAmount, 50000)
  assert.deepEqual(t.refundsByMethod, { cash: 50000, qr: 0 })
  assert.deepEqual(t.washerPay, { pedro: { name: 'Pedro', amount: 20000 }, juan: { name: 'Juan', amount: 21500 } })
  assert.equal(t.ownerShare, 1500)
  assert.equal(close.expectedCash, 125000) // 100000 + 75000 paid cash sales - 50000 same-shift refunds
  assert.equal(close.difference, -55000)
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

test('admin refund on a closed instance -> shift_closed; works after an operator reopens', () => {
  const { o1 } = seedInstance()
  setMockNow(AFTER_END)
  signIn('laura')
  closeShift(KEY, { countedCash: 75000 })
  assert.equal(getShiftStatus().recentClosed[0].shiftKey, KEY)
  signIn('ana')
  assert.throws(() => cancelOrder(o1.id, { reason: 'x', washerPaid: true }), code('shift_closed'))
  signIn('laura')
  reopenShift(KEY, { reason: 'devolucion pendiente' })
  assert.equal(getShiftStatus().recentClosed.length, 0)
  signIn('ana')
  assert.throws(() => cancelOrder(o1.id, { reason: 'x', washerPaid: true }), code('shift_not_open')) // cash needs the current till open
  signIn('laura')
  openShift({ openingCash: 0 })
  signIn('ana')
  assert.equal(cancelOrder(o1.id, { reason: 'x', washerPaid: true }).status, 'cancelled')
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

test('a cash refund in a later instance leaves the current till', () => {
  signIn('carlos')
  openShift({ openingCash: 100000 })
  const o = createOrder(wash)
  finishOrder(o.id, { paymentMethod: 'cash' })
  setMockNow(AFTER_END) // instance 2026-10-30_A
  signIn('ana')
  assert.throws(() => cancelOrder(o.id, { reason: 'x', washerPaid: false }), code('shift_not_open'))
  signIn('carlos')
  openShift({ openingCash: 30000 })
  signIn('ana')
  assert.equal(cancelOrder(o.id, { reason: 'x', washerPaid: false }).refundShiftKey, '2026-10-30_A')
  signIn('carlos')
  const b = closeShift(KEY, { countedCash: 125000 })
  assert.equal(b.expectedCash, 125000) // the sale's cash came in B and B never changes
  assert.equal(b.difference, 0)
  setMockNow(new Date('2026-10-30T23:30:00Z'))
  assert.equal(closeShift('2026-10-30_A', { countedCash: 5000 }).expectedCash, 5000) // 30000 - 25000
})

test('close preview: a sale refunded in the next instance stays in its instance', () => {
  const D3 = '2026-11-03_unico', D4 = '2026-11-04_unico'
  resetMock() // seed business: one 06->06 shift
  setMockNow(new Date('2026-11-03T15:00:00Z'))
  signIn('carlos')
  openShift({ openingCash: 0 })
  const o = createOrder(wash)
  finishOrder(o.id, { paymentMethod: 'cash' })
  setMockNow(new Date('2026-11-04T15:00:00Z'))
  openShift({ openingCash: 0 })
  signIn('ana')
  assert.equal(cancelOrder(o.id, { reason: 'x', washerPaid: false }).refundShiftKey, D4)
  signIn('carlos')
  const p3 = getClosePreview(D3)
  assert.deepEqual(p3.salesByMethod, { cash: 25000, qr: 0 })
  assert.equal(p3.refundsCount, 0)
  assert.equal(p3.refundsAmount, 0)
  const p4 = getClosePreview(D4)
  assert.deepEqual(p4.salesByMethod, { cash: 0, qr: 0 })
  assert.equal(p4.refundsCount, 1)
  assert.equal(p4.refundsAmount, 25000)
  assert.deepEqual(p4.refundsByMethod, { cash: 25000, qr: 0 })
  const c3 = closeShift(D3, { countedCash: 25000 })
  assert.equal(c3.expectedCash, 25000)
  assert.equal(c3.difference, 0)
  assert.equal(c3.totals.salesByMethod.cash, 25000)
  assert.equal(c3.totals.refundsCount, 0)
  setMockNow(new Date('2026-11-05T12:00:00Z'))
  const c4 = closeShift(D4, { countedCash: 0 })
  assert.equal(c4.expectedCash, -25000)
  assert.equal(c4.difference, 25000)
  assert.equal(c4.totals.refundsCount, 1)
})
