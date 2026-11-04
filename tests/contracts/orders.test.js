import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, signOut, resetMock, setMockNow } from '../../src/mocks/session.js'
import { openShift, closeShift, getShiftStatus, reopenShift } from '../../src/mocks/shifts.js'
import { createOrder, finishOrder, cancelOrder, listShiftOrders } from '../../src/mocks/orders.js'
import { listCategories, listWashers } from '../../src/mocks/catalog.js'

const DAY1 = new Date('2026-10-29T15:00:00Z')
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const code = (c) => (e) => e.code === c

beforeEach(async () => {
  resetMock()
  setMockNow(DAY1)
  await signIn('carlos')
  await openShift({ openingCash: 50000 })
})

test('150 cc example: Full 25.000, Pedro 40% -> commission 10.000, frozen names, shift stamps', async () => {
  const o = await createOrder(wash)
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

test('courtesy: reason required (1-200); finalPrice 0, commission kept', async () => {
  await assert.rejects(async () => createOrder({ ...wash, isCourtesy: true }), code('validation'))
  await assert.rejects(async () => createOrder({ ...wash, isCourtesy: true, courtesyReason: 'x'.repeat(201) }), code('validation'))
  const ok = await createOrder({ ...wash, isCourtesy: true, courtesyReason: 'x'.repeat(200) })
  assert.equal(ok.finalPrice, 0)
  assert.equal(ok.commissionAmount, 10000)
  assert.equal((await createOrder({ ...wash, plate: 'XYZ98', isCourtesy: true, courtesyReason: ' frecuente ' })).courtesyReason, 'frecuente')
})

test('plates and cc: special plate only with flag; cc without category rejected', async () => {
  await assert.rejects(async () => createOrder({ ...wash, plate: 'CD1234' }), code('validation'))
  assert.equal((await createOrder({ ...wash, plate: 'CD1234', plateSpecial: true })).plateSpecial, true)
  assert.equal((await createOrder({ ...wash, plate: 'ABC12' })).plate, 'ABC12')
  await assert.rejects(async () => createOrder({ ...wash, plate: 'ABC123' }), code('validation'))
  await assert.rejects(async () => createOrder({ ...wash, cc: 5000 }), code('validation'))
  await assert.rejects(async () => createOrder({ ...wash, washerId: 'nope' }), code('not_found'))
})

test('finish sets done and payment; second finish and bad payment fail', async () => {
  const o = await createOrder(wash)
  await assert.rejects(async () => finishOrder(o.id, { paymentMethod: 'card' }), code('validation'))
  const done = await finishOrder(o.id, { paymentMethod: 'qr' })
  assert.equal(done.status, 'done')
  assert.equal(done.paymentMethod, 'qr')
  assert.equal(done.doneBy, 'carlos')
  await assert.rejects(async () => finishOrder(o.id, { paymentMethod: 'cash' }), code('invalid_state'))
})

test('cancel before the wash: reason required; a done order is final', async () => {
  const a = await createOrder(wash)
  await assert.rejects(async () => cancelOrder(a.id, { reason: '' }), code('validation'))
  const c = await cancelOrder(a.id, { reason: 'cliente se fue' })
  assert.equal(c.status, 'cancelled')
  assert.equal('isRefund' in c, false)
  assert.equal('commissionPaid' in c, false)
  await assert.rejects(async () => cancelOrder(a.id, { reason: 'otra vez' }), code('invalid_state'))
  const b = await createOrder({ ...wash, plate: 'XYZ98' })
  await finishOrder(b.id, { paymentMethod: 'cash' })
  await assert.rejects(async () => cancelOrder(b.id, { reason: 'x' }), code('invalid_state'))
})

test('admin cannot cancel a done order', async () => {
  const a = await createOrder(wash)
  const b = await createOrder({ ...wash, plate: 'XYZ98' })
  await finishOrder(a.id, { paymentMethod: 'cash' })
  await finishOrder(b.id, { paymentMethod: 'qr' })
  await signIn('ana')
  await assert.rejects(async () => cancelOrder(a.id, { reason: 'mal lavado' }), code('invalid_state'))
  await assert.rejects(async () => cancelOrder(b.id, { reason: 'mal lavado' }), code('invalid_state'))
  await signIn('carlos')
  const st = Object.fromEntries((await listShiftOrders()).map((o) => [o.id, o.status]))
  assert.deepEqual([st[a.id], st[b.id]], ['done', 'done'])
})

test('another operator cannot finish or cancel an order they did not create', async () => {
  const o = await createOrder(wash)
  await signIn('laura')
  await assert.rejects(async () => finishOrder(o.id, { paymentMethod: 'cash' }), code('forbidden'))
  await assert.rejects(async () => cancelOrder(o.id, { reason: 'x' }), code('forbidden'))
})

test('listShiftOrders: own orders only, newest first; admin forbidden', async () => {
  const a = await createOrder(wash)
  const b = await createOrder({ ...wash, plate: 'XYZ98' })
  await signIn('laura')
  const l = await createOrder({ ...wash, plate: 'LAU12' })
  assert.deepEqual((await listShiftOrders()).map((o) => o.id), [l.id])
  await signIn('carlos')
  assert.deepEqual((await listShiftOrders()).map((o) => o.id), [b.id, a.id])
  await signIn('ana')
  await assert.rejects(async () => listShiftOrders(), code('forbidden'))
  await assert.rejects(async () => createOrder(wash), code('forbidden'))
  await signIn('david')
  await assert.rejects(async () => listShiftOrders(), code('forbidden'))
})

test('previous shift: own in_progress order still listed, own done one is not', async () => {
  const stuck = await createOrder(wash)
  const paid = await createOrder({ ...wash, plate: 'XYZ98' })
  await finishOrder(paid.id, { paymentMethod: 'cash' })
  setMockNow(new Date('2026-10-30T15:00:00Z'))
  assert.equal((await getShiftStatus()).unclosed.length, 1)
  assert.deepEqual((await listShiftOrders()).map((o) => o.id), [stuck.id])
  await finishOrder(stuck.id, { paymentMethod: 'qr' }) // still possible after endsAt
  assert.equal((await listShiftOrders()).length, 0)
})

test('tenant isolation: Beto gets not_found on Medallo orders and sees Prueba catalog', async () => {
  const o = await createOrder(wash)
  await signIn('beto')
  await assert.rejects(async () => finishOrder(o.id, { paymentMethod: 'cash' }), code('not_found'))
  await assert.rejects(async () => cancelOrder(o.id, { reason: 'x' }), code('not_found'))
  assert.deepEqual(await listShiftOrders(), [])
  assert.equal((await listCategories())[0].id, 'p-todas')
  await assert.rejects(async () => createOrder(wash), code('not_found')) // Medallo ids do not exist in his catalog
})

test('blocked business: business_blocked on every function', async () => {
  await signIn('bloqueado')
  const calls = [
    () => getShiftStatus(), () => openShift({ openingCash: 0 }), () => closeShift('k', { countedCash: 0 }),
    () => reopenShift('k', { reason: 'x' }), () => createOrder(wash), () => finishOrder('o1', {}),
    () => cancelOrder('o1', {}), () => listShiftOrders(), () => listCategories(), () => listWashers(),
  ]
  for (const call of calls) await assert.rejects(call, code('business_blocked'))
})

test('signed out -> unauthenticated', async () => {
  await signOut()
  await assert.rejects(async () => listShiftOrders(), code('unauthenticated'))
  await assert.rejects(async () => createOrder(wash), code('unauthenticated'))
  await assert.rejects(async () => signIn('nadie'), code('not_found'))
})
