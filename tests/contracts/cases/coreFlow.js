// Shared cases for the order and shift flow. driver: { reset(), as(key), at(date), sessionGet(), openShift, getShiftStatus,
// getClosePreview, closeShift, reopenShift, listCatalog, createOrder, finishOrder, cancelOrder, listShiftOrders }
// keys: operator (Carlos), operator2 (Laura), admin, otherOperator (business B), blockedOperator.
// Run by the mock driver (root npm test) and the API driver (npm run test:api).
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const AFTER_END = new Date('2026-10-30T12:00:00Z')
const KEY = '2026-10-29_unico'
const wash = (extra) => ({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro', ...extra })

export default function coreFlowCases(d) {
  const start = async (who = 'operator') => { await d.reset(); await d.as(who); await d.openShift({ openingCash: 50000 }) }
  const fresh = async (who) => { await d.reset(); await d.as(who) } // reset leaves the clock at DAY1

  test('order before the shift is opened -> shift_not_open', async () => {
    await fresh('operator')
    await assert.rejects(() => d.createOrder(wash()), code('shift_not_open'))
    assert.equal((await d.getShiftStatus()).current.state, 'not_opened')
  })

  test('operator listCatalog has only active items', async () => {
    await fresh('operator')
    const c = await d.listCatalog()
    assert.deepEqual(c.categories.map((x) => x.id).sort(), ['cat-125', 'cat-200', 'cat-200p'])
    assert.deepEqual(c.washTypes.map((x) => x.id).sort(), ['basica', 'full'])
    assert.deepEqual(c.washers.map((x) => x.id).sort(), ['juan', 'pedro'])
    assert.equal(c.prices.length, 6)
    assert.ok([...c.categories, ...c.washTypes, ...c.washers].every((x) => x.active))
  })

  test('create freezes server values even if the body sends others', async () => {
    await start()
    const o = await d.createOrder(wash({ listPrice: 1, commissionBp: 0, finalPrice: 1 }))
    assert.equal(o.listPrice, 25000)
    assert.equal(o.commissionBp, 4000)
    assert.equal(o.commissionAmount, 10000)
    assert.equal(o.categoryName, 'De 126 a 200 cc')
    assert.equal(o.washerName, 'Pedro')
    assert.equal(o.ccMin, 126)
    assert.equal(o.ccMax, 200)
  })

  test('same id twice -> one order, same id returned', async () => {
    await start()
    const input = wash()
    const a = await d.createOrder(input)
    const b = await d.createOrder(input)
    assert.equal(a.id, input.id)
    assert.equal(b.id, a.id)
    assert.equal((await d.listShiftOrders()).length, 1)
  })

  test('bad id, cc outside the category, unknown washer', async () => {
    await start()
    await assert.rejects(() => d.createOrder(wash({ id: 'nope' })), code('validation'))
    await assert.rejects(() => d.createOrder(wash({ cc: 300 })), code('validation'))
    await assert.rejects(() => d.createOrder(wash({ washerId: 'nope' })), code('not_found'))
  })

  test('courtesy: finalPrice 0, commission kept on list price, reason required', async () => {
    await start()
    await assert.rejects(() => d.createOrder(wash({ isCourtesy: true, courtesyReason: '' })), code('validation'))
    const o = await d.createOrder(wash({ isCourtesy: true, courtesyReason: 'amigo' }))
    assert.equal(o.finalPrice, 0)
    assert.equal(o.commissionAmount, 10000)
  })

  test('admin cannot create; admin cancels an in_progress order', async () => {
    await start()
    const o = await d.createOrder(wash())
    await d.as('admin')
    await assert.rejects(() => d.createOrder(wash({ plate: 'XYZ98' })), code('forbidden'))
    assert.equal((await d.cancelOrder(o.id, { reason: 'error de registro' })).status, 'cancelled')
  })

  test('finish twice -> invalid_state; cancel a done order -> invalid_state', async () => {
    await start()
    const o = await d.createOrder(wash())
    assert.equal((await d.finishOrder(o.id, { paymentMethod: 'cash' })).status, 'done')
    await assert.rejects(() => d.finishOrder(o.id, { paymentMethod: 'cash' }), code('invalid_state'))
    await assert.rejects(() => d.cancelOrder(o.id, { reason: 'x' }), code('invalid_state'))
  })

  test('close before the end or with an in_progress order -> invalid_state', async () => {
    await start()
    await assert.rejects(() => d.closeShift(KEY, { countedCash: 0 }), code('invalid_state'))
    await d.createOrder(wash())
    await d.at(AFTER_END)
    await d.as('operator2')
    await assert.rejects(() => d.closeShift(KEY, { countedCash: 0 }), code('invalid_state'))
    await assert.rejects(() => d.closeShift(KEY, { countedCash: -1 }), code('validation'))
  })

  test('Laura closes Carlos shift: expected 75000, difference -1000; then shift_closed; preview is blind', async () => {
    await start()
    const [a, b, c] = [wash(), wash({ plate: 'XYZ98' }), wash({ plate: 'QWE45' })]
    for (const x of [a, b, c]) await d.createOrder(x)
    assert.equal('expectedCash' in (await d.getClosePreview(KEY)), false)
    await d.finishOrder(a.id, { paymentMethod: 'cash' })
    await d.finishOrder(b.id, { paymentMethod: 'qr' })
    await d.cancelOrder(c.id, { reason: 'cliente se fue' })
    await d.at(AFTER_END)
    await d.as('operator2')
    const close = await d.closeShift(KEY, { countedCash: 74000 })
    assert.equal(close.expectedCash, 75000)
    assert.equal(close.difference, -1000)
    assert.equal(close.by, (await d.sessionGet()).uid)
    await d.as('operator')
    await assert.rejects(() => d.finishOrder(a.id, { paymentMethod: 'cash' }), code('shift_closed'))
    await assert.rejects(() => d.cancelOrder(a.id, { reason: 'x' }), code('shift_closed'))
    await d.as('admin')
    await assert.rejects(() => d.cancelOrder(a.id, { reason: 'x' }), code('shift_closed'))
  })

  test('reopen: blank reason -> validation, not closed -> invalid_state; second close has difference 0', async () => {
    await start()
    const a = await d.createOrder(wash())
    await d.finishOrder(a.id, { paymentMethod: 'cash' })
    await d.at(AFTER_END)
    assert.equal((await d.closeShift(KEY, { countedCash: 74000 })).difference, -1000)
    await assert.rejects(() => d.reopenShift(KEY, { reason: '  ' }), code('validation'))
    await assert.rejects(() => d.reopenShift('2026-10-28_unico', { reason: 'x' }), code('invalid_state'))
    await d.reopenShift(KEY, { reason: 'recount' })
    assert.equal((await d.closeShift(KEY, { countedCash: 75000 })).difference, 0)
  })

  test('an unclosed ended instance is listed and the next one opens', async () => {
    await start()
    await d.at(AFTER_END)
    const status = await d.getShiftStatus()
    assert.deepEqual(status.unclosed.map((u) => u.shiftKey), [KEY])
    await d.openShift({ openingCash: 10000 })
    const after = await d.getShiftStatus()
    assert.equal(after.current.shiftKey, '2026-10-30_unico')
    assert.equal(after.current.state, 'open')
  })

  test('lists: Laura does not see Carlos orders; Carlos sees his in_progress one of the earlier instance', async () => {
    await start()
    const stuck = await d.createOrder(wash())
    await d.as('operator2')
    assert.deepEqual(await d.listShiftOrders(), [])
    await d.as('operator')
    await d.at(AFTER_END)
    assert.deepEqual((await d.listShiftOrders()).map((o) => o.id), [stuck.id])
  })

  test('tenant and block: other business gets not_found; blocked business gets business_blocked', async () => {
    await start()
    const o = await d.createOrder(wash())
    await d.as('otherOperator')
    await assert.rejects(() => d.finishOrder(o.id, { paymentMethod: 'cash' }), code('not_found'))
    await d.as('blockedOperator')
    await assert.rejects(() => d.createOrder(wash()), code('business_blocked'))
  })
}
