import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, signOut, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift, closeShift, getShiftStatus, reopenShift } from '../../src/services/shifts.js'
import { createOrder, finishOrder, cancelOrder, listShiftOrders } from '../../src/services/orders.js'
import { listCategories, listWashers, setWasherCommissionBp } from '../../src/services/catalog.js'

const DAY1 = new Date('2026-10-29T15:00:00Z')
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c

beforeEach(() => {
  resetMock()
  setMockNow(DAY1)
  signIn('carlos')
  openShift({ openingCash: 50000 })
})

test('150 cc example: Full 25.000, Pedro 40% -> commission 10.000, frozen names, shift stamps', () => {
  const o = createOrder(wash)
  assert.equal(o.status, 'in_progress')
  assert.equal(o.categoryName, 'De 126 a 200 cc')
  assert.equal(o.listPrice, 25000)
  assert.equal(o.finalPrice, 25000)
  assert.equal(o.commissionAmount, 10000)
  assert.equal(o.createdBy, 'carlos')
  assert.equal(o.shiftKey, '2026-10-29_unico')
  assert.equal(o.businessDate, '2026-10-29')
  assert.equal(o.isoWeek, '2026-W44')
  assert.equal(o.month, '2026-10')
})

test('Pedro 40% -> 50% affects only later orders', () => {
  const first = createOrder(wash)
  signIn('ana')
  setWasherCommissionBp('pedro', 5000)
  assert.throws(() => setWasherCommissionBp('pedro', 10001), code('validation'))
  assert.equal(listWashers().find((w) => w.id === 'pedro').commissionBp, 5000)
  signIn('carlos')
  const second = createOrder({ ...wash, plate: 'XYZ98' })
  assert.equal(second.commissionAmount, 12500)
  assert.equal(second.commissionBp, 5000)
  const old = listShiftOrders().find((o) => o.id === first.id)
  assert.equal(old.commissionAmount, 10000)
  assert.equal(old.commissionBp, 4000)
  assert.throws(() => setWasherCommissionBp('pedro', 3000), code('forbidden'))
})

test('courtesy: reason required (1-200); finalPrice 0, commission kept', () => {
  assert.throws(() => createOrder({ ...wash, isCourtesy: true }), code('validation'))
  assert.throws(() => createOrder({ ...wash, isCourtesy: true, courtesyReason: 'x'.repeat(201) }), code('validation'))
  const ok = createOrder({ ...wash, isCourtesy: true, courtesyReason: 'x'.repeat(200) })
  assert.equal(ok.finalPrice, 0)
  assert.equal(ok.commissionAmount, 10000)
  assert.equal(createOrder({ ...wash, plate: 'XYZ98', isCourtesy: true, courtesyReason: ' frecuente ' }).courtesyReason, 'frecuente')
})

test('plates and cc: special plate only with flag; cc without category rejected', () => {
  assert.throws(() => createOrder({ ...wash, plate: 'CD1234' }), code('validation'))
  assert.equal(createOrder({ ...wash, plate: 'CD1234', plateSpecial: true }).plateSpecial, true)
  assert.equal(createOrder({ ...wash, plate: 'ABC12' }).plate, 'ABC12')
  assert.throws(() => createOrder({ ...wash, plate: 'ABC123' }), code('validation'))
  assert.throws(() => createOrder({ ...wash, cc: 5000 }), code('validation'))
  assert.throws(() => createOrder({ ...wash, washerId: 'nope' }), code('not_found'))
})

test('finish sets done and payment; second finish and bad payment fail', () => {
  const o = createOrder(wash)
  assert.throws(() => finishOrder(o.id, { paymentMethod: 'card' }), code('validation'))
  const done = finishOrder(o.id, { paymentMethod: 'qr' })
  assert.equal(done.status, 'done')
  assert.equal(done.paymentMethod, 'qr')
  assert.equal(done.doneBy, 'carlos')
  assert.throws(() => finishOrder(o.id, { paymentMethod: 'cash' }), code('invalid_state'))
})

test('cancel before the wash: reason required, commissionPaid 0; operator cannot cancel a done one', () => {
  const a = createOrder(wash)
  assert.throws(() => cancelOrder(a.id, { reason: '' }), code('validation'))
  const c = cancelOrder(a.id, { reason: 'cliente se fue' })
  assert.equal(c.status, 'cancelled')
  assert.equal(c.isRefund, false)
  assert.equal(c.commissionPaid, 0)
  assert.throws(() => cancelOrder(a.id, { reason: 'otra vez' }), code('invalid_state'))
  const b = createOrder({ ...wash, plate: 'XYZ98' })
  finishOrder(b.id, { paymentMethod: 'cash' })
  assert.throws(() => cancelOrder(b.id, { reason: 'x', washerPaid: true }), code('forbidden'))
})

test('admin refund of a done order: washerPaid true pays commission, false does not', () => {
  const a = createOrder(wash)
  const b = createOrder({ ...wash, plate: 'XYZ98' })
  finishOrder(a.id, { paymentMethod: 'cash' })
  finishOrder(b.id, { paymentMethod: 'cash' })
  signIn('ana')
  assert.throws(() => cancelOrder(a.id, { reason: 'mal lavado' }), code('validation'))
  const ra = cancelOrder(a.id, { reason: 'mal lavado', washerPaid: true })
  assert.equal(ra.isRefund, true)
  assert.equal(ra.refundAmount, 25000)
  assert.equal(ra.commissionPaid, 10000)
  assert.equal(cancelOrder(b.id, { reason: 'mal lavado', washerPaid: false }).commissionPaid, 0)
})

test('another operator cannot finish or cancel an order they did not create', () => {
  const o = createOrder(wash)
  signIn('laura')
  assert.throws(() => finishOrder(o.id, { paymentMethod: 'cash' }), code('forbidden'))
  assert.throws(() => cancelOrder(o.id, { reason: 'x' }), code('forbidden'))
})

test('listShiftOrders: own orders only, newest first; admin forbidden', () => {
  const a = createOrder(wash)
  const b = createOrder({ ...wash, plate: 'XYZ98' })
  signIn('laura')
  const l = createOrder({ ...wash, plate: 'LAU12' })
  assert.deepEqual(listShiftOrders().map((o) => o.id), [l.id])
  signIn('carlos')
  assert.deepEqual(listShiftOrders().map((o) => o.id), [b.id, a.id])
  signIn('ana')
  assert.throws(() => listShiftOrders(), code('forbidden'))
  assert.throws(() => createOrder(wash), code('forbidden'))
  signIn('david')
  assert.throws(() => listShiftOrders(), code('forbidden'))
})

test('previous shift: own in_progress order still listed, own done one is not', () => {
  const stuck = createOrder(wash)
  const paid = createOrder({ ...wash, plate: 'XYZ98' })
  finishOrder(paid.id, { paymentMethod: 'cash' })
  setMockNow(new Date('2026-10-30T15:00:00Z'))
  assert.equal(getShiftStatus().unclosed.length, 1)
  assert.deepEqual(listShiftOrders().map((o) => o.id), [stuck.id])
  finishOrder(stuck.id, { paymentMethod: 'qr' }) // still possible after endsAt
  assert.equal(listShiftOrders().length, 0)
})

test('tenant isolation: Beto gets not_found on Medallo orders and sees Prueba catalog', () => {
  const o = createOrder(wash)
  signIn('beto')
  assert.throws(() => finishOrder(o.id, { paymentMethod: 'cash' }), code('not_found'))
  assert.throws(() => cancelOrder(o.id, { reason: 'x' }), code('not_found'))
  assert.deepEqual(listShiftOrders(), [])
  assert.equal(listCategories()[0].id, 'p-todas')
  assert.throws(() => createOrder(wash), code('not_found')) // Medallo ids do not exist in his catalog
})

test('blocked business: business_blocked on every function', () => {
  signIn('bloqueado')
  const calls = [
    () => getShiftStatus(), () => openShift({ openingCash: 0 }), () => closeShift('k', { countedCash: 0 }),
    () => reopenShift('k', { reason: 'x' }), () => createOrder(wash), () => finishOrder('o1', {}),
    () => cancelOrder('o1', {}), () => listShiftOrders(), () => listCategories(), () => listWashers(),
  ]
  for (const call of calls) assert.throws(call, code('business_blocked'))
})

test('signed out -> unauthenticated', () => {
  signOut()
  assert.throws(() => listShiftOrders(), code('unauthenticated'))
  assert.throws(() => createOrder(wash), code('unauthenticated'))
  assert.throws(() => signIn('nadie'), code('not_found'))
})
