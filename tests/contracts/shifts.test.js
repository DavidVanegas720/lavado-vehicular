import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, resetMock, setMockNow } from '../../src/mocks/session.js'
import { getShiftStatus, openShift, closeShift, reopenShift } from '../../src/services/shifts.js'
import { createOrder, finishOrder, cancelOrder } from '../../src/services/orders.js'
import { listShiftEvents } from '../../src/mocks/shifts.js'

const DAY1 = new Date('2026-10-29T15:00:00Z') // 10:00 Bogota, shift 2026-10-29_unico, ends 06:00 next day
const AFTER_END = new Date('2026-10-30T12:00:00Z')
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c
const KEY = '2026-10-29_unico'

beforeEach(() => { resetMock(); setMockNow(DAY1) })

test('order before the shift is opened -> shift_not_open', async () => {
  await signIn('carlos')
  await assert.rejects(async () => createOrder(wash), code('shift_not_open'))
  assert.equal((await getShiftStatus()).current.state, 'not_opened')
})

test('open twice -> invalid_state; bad base -> validation', async () => {
  await signIn('carlos')
  await assert.rejects(async () => openShift({ openingCash: -1 }), code('validation'))
  await assert.rejects(async () => openShift({ openingCash: 1.5 }), code('validation'))
  await openShift({ openingCash: 50000 })
  assert.equal((await getShiftStatus()).current.state, 'open')
  await signIn('laura')
  await assert.rejects(async () => openShift({ openingCash: 0 }), code('invalid_state'))
})

test('admin and superadmin get forbidden on open, close and reopen', async () => {
  for (const who of ['ana', 'david']) {
    await signIn(who)
    await assert.rejects(async () => openShift({ openingCash: 0 }), code('forbidden'))
    await assert.rejects(async () => closeShift(KEY, { countedCash: 0 }), code('forbidden'))
    await assert.rejects(async () => reopenShift(KEY, { reason: 'x' }), code('forbidden'))
  }
})

test('close before endsAt or with an in_progress order of another operator -> invalid_state', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 0 })
  await assert.rejects(async () => closeShift(KEY, { countedCash: 0 }), code('invalid_state'))
  await createOrder(wash)
  setMockNow(AFTER_END)
  await signIn('laura')
  await assert.rejects(async () => closeShift(KEY, { countedCash: 0 }), code('invalid_state'))
  await assert.rejects(async () => closeShift(KEY, { countedCash: -1 }), code('validation'))
})

test('Laura closes Carlos shift: expected 75.000, difference -1.000; then shift_closed', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 50000 })
  const a = await createOrder(wash)
  const b = await createOrder({ ...wash, plate: 'XYZ98' })
  const c = await createOrder({ ...wash, plate: 'QWE45' })
  await finishOrder(a.id, { paymentMethod: 'cash' })
  await finishOrder(b.id, { paymentMethod: 'qr' })
  await cancelOrder(c.id, { reason: 'cliente se fue' })
  setMockNow(AFTER_END)
  await signIn('laura')
  await closeShift(KEY, { countedCash: 74000 })
  const close = (await listShiftEvents()).at(-1)
  assert.equal(close.expectedCash, 75000)
  assert.equal(close.difference, -1000)
  assert.equal(close.by, 'laura')
  assert.equal(close.totals.sales, 50000)
  assert.equal((await getShiftStatus()).unclosed.length, 0)
  await signIn('carlos')
  await assert.rejects(async () => finishOrder(a.id, { paymentMethod: 'cash' }), code('shift_closed'))
  await assert.rejects(async () => cancelOrder(a.id, { reason: 'x' }), code('shift_closed'))
  await signIn('ana')
  await assert.rejects(async () => cancelOrder(a.id, { reason: 'x' }), code('shift_closed'))
})

test('reopen: reason required; close again keeps both closes', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 50000 })
  const a = await createOrder(wash)
  await finishOrder(a.id, { paymentMethod: 'cash' })
  setMockNow(AFTER_END)
  await closeShift(KEY, { countedCash: 74000 })
  assert.equal((await listShiftEvents()).at(-1).difference, -1000)
  await assert.rejects(async () => reopenShift(KEY, { reason: '  ' }), code('validation'))
  await assert.rejects(async () => reopenShift('2026-10-28_unico', { reason: 'x' }), code('invalid_state'))
  await reopenShift(KEY, { reason: 'recount' })
  await signIn('ana')
  await assert.rejects(async () => cancelOrder(a.id, { reason: 'bad wash' }), code('invalid_state'))
  await signIn('carlos')
  await closeShift(KEY, { countedCash: 75000 })
  const closes = (await listShiftEvents()).filter((e) => e.type === 'close')
  assert.equal(closes.length, 2)
  assert.equal(closes[1].expectedCash, 75000)
  assert.equal(closes[1].difference, 0)
  assert.equal(closes[1].totals.sales, 25000)
})

test('an unclosed ended instance does not block opening the next', async () => {
  await signIn('carlos')
  await openShift({ openingCash: 0 })
  setMockNow(AFTER_END)
  const status = await getShiftStatus()
  assert.equal(status.unclosed.length, 1)
  assert.equal(status.unclosed[0].shiftKey, KEY)
  await openShift({ openingCash: 10000 })
  assert.equal((await getShiftStatus()).current.shiftKey, '2026-10-30_unico')
  assert.equal((await getShiftStatus()).current.state, 'open')
})
