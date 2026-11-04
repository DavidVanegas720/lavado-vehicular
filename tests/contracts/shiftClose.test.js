import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import {
  getShiftStatus, openShift, closeShift, reopenShift, getClosePreview,
} from '../../src/mocks/shifts.js'
import { createOrder, finishOrder, cancelOrder } from '../../src/mocks/orders.js'

const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_B'
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const OPEN_AT = new Date('2026-10-29T23:30:00Z') // 18:30 Bogota, shift B 18->12
const AFTER_MIDNIGHT = new Date('2026-10-30T06:00:00Z') // 01:00 Bogota, same instance
const AFTER_END = new Date('2026-10-30T17:30:00Z') // 12:30 Bogota

beforeEach(async () => {
  resetMock((db) => {
    db.businesses[0].shifts = [
      { id: 'A', name: 'Turno A', startHour: 12, endHour: 18 },
      { id: 'B', name: 'Turno B', startHour: 18, endHour: 12 },
    ]
  })
  setMockNow(OPEN_AT)
})

/** One instance: courtesy, before-wash cancel, an order at 01:00. */
async function seedInstance() {
  await signIn('carlos')
  await openShift({ openingCash: 100000 })
  const done = async (o, paymentMethod) => await finishOrder(o.id, { paymentMethod })
  const o1 = await createOrder(wash); await done(o1, 'cash') // pedro 40% of 25000 = 10000
  const o2 = await createOrder({ ...wash, plate: 'XYZ98', washerId: 'juan', isCourtesy: true, courtesyReason: 'amigo' }); await done(o2, 'qr') // juan 12500 on list price
  const o3 = await createOrder({ ...wash, plate: 'QWE45' }); await cancelOrder(o3.id, { reason: 'se fue' })
  const o4 = await createOrder({ ...wash, plate: 'RTY67' }); await done(o4, 'cash')
  const o5 = await createOrder({ ...wash, plate: 'UIO12', washerId: 'juan' }); await done(o5, 'cash')
  setMockNow(AFTER_MIDNIGHT)
  await signIn('carlos')
  const o6 = await createOrder({ ...wash, plate: 'ASD34', washerId: 'juan', washTypeId: 'basica' }); await done(o6, 'qr') // 18000 -> juan 9000
  return { o1, o6 }
}

test('preview is blind and lists unfinished orders with the creator name', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 5000 })
  const a = await createOrder(wash)
  const p = await getClosePreview(KEY)
  assert.equal(p.openingCash, 5000)
  assert.equal(p.expectedCash, undefined)
  assert.deepEqual(p.tillPayments, [])
  assert.deepEqual(p.unfinished, [{ id: a.id, plate: 'ABC12D', createdByName: 'Carlos' }])
  await assert.rejects(async () => getClosePreview('2026-10-28_B'), code('invalid_state'))
})

test('a done order is final on a closed and a reopened instance', async () => {
  const { o1 } = await seedInstance()
  setMockNow(AFTER_END)
  await signIn('laura')
  await closeShift(KEY, { countedCash: 175000 })
  assert.equal((await getShiftStatus()).recentClosed[0].shiftKey, KEY)
  await signIn('ana')
  await assert.rejects(async () => cancelOrder(o1.id, { reason: 'x' }), code('shift_closed'))
  await signIn('laura')
  await reopenShift(KEY, { reason: 'recount' })
  assert.equal((await getShiftStatus()).recentClosed.length, 0)
  await signIn('ana')
  await assert.rejects(async () => cancelOrder(o1.id, { reason: 'x' }), code('invalid_state'))
})
