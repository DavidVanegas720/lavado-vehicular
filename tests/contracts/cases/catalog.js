// Shared cases for the P2 catalog (admin writes, operator view). driver: { reset(), as(key), at(date), openShift, listCatalog,
// createOrder, setPrice, createCategory, updateCategory, setCategoryActive, createWashType, updateWashType, setWashTypeActive,
// createWasher, updateWasher, setWasherActive, idOf(key) }. Keys: operator, admin.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const wash = (extra) => ({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro', ...extra })
const ids = (list) => list.map((x) => x.id)

export default function catalogCases(d) {
  const admin = async () => { await d.reset(); await d.as('admin') }
  const snapshot = async () => { const c = await d.listCatalog(); return JSON.stringify([c.categories, c.washTypes, c.prices]) }

  test('price change affects only later orders', async () => {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 0 })
    const first = await d.createOrder(wash())
    await d.as('admin')
    await d.setPrice('cat-200', 'full', 28000)
    await d.as('operator')
    const second = await d.createOrder(wash({ plate: 'XYZ98' }))
    assert.equal(first.listPrice, 25000)
    assert.equal(second.listPrice, 28000)
  })

  test('new washer is biweekly; frequency change adds a history row and changes no order', async () => {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 0 })
    const order = await d.createOrder(wash())
    await d.as('admin')
    const w = await d.createWasher({ name: ' Nuevo ', commissionBp: 3000 })
    assert.equal(w.name, 'Nuevo')
    assert.equal(w.payFrequency, 'biweekly')
    assert.deepEqual(w.payFrequencyHistory, [])
    const u = await d.updateWasher(w.id, { payFrequency: 'weekly' })
    assert.equal(u.payFrequencyHistory.length, 1)
    assert.equal(u.payFrequencyHistory[0].payFrequency, 'weekly')
    assert.equal(u.payFrequencyHistory[0].changedBy, await d.idOf('admin'))
    assert.equal(u.commissionHistory.length, 0)
    await d.updateWasher('pedro', { commissionBp: 5000 })
    assert.equal((await d.listCatalog()).washers.find((x) => x.id === 'pedro').commissionHistory.length, 1)
    await d.as('operator')
    assert.equal((await d.createOrder(wash({ plate: 'XYZ98' }))).commissionAmount, 12500)
    assert.equal(order.commissionAmount, 10000)
  })

  test('validation', async () => {
    await admin()
    const bad = [
      () => d.createWasher({ name: '  ', commissionBp: 1 }),
      () => d.createWasher({ name: 'x'.repeat(61), commissionBp: 1 }),
      () => d.createWasher({ name: 'x', commissionBp: 10001 }),
      () => d.createWasher({ name: 'x', commissionBp: 1, payFrequency: 'yearly' }),
      () => d.createCategory({ name: 'x', minCc: 300, maxCc: 250, prices: {} }),
      () => d.createCategory({ name: 'x', minCc: 1.5, maxCc: 250, prices: {} }),
      () => d.setPrice('cat-125', 'full', 0),
      () => d.setPrice('cat-125', 'full', 10.5),
      () => d.createWashType({ name: 'x', prices: { 'cat-125': 0 } }),
    ]
    for (const f of bad) await assert.rejects(f, code('validation'))
    await assert.rejects(() => d.setPrice('nope', 'full', 5), code('not_found'))
  })

  test('cc overlap rejected on create, edit and reactivate', async () => {
    await admin()
    const prices = { basica: 1000, full: 2000 }
    await assert.rejects(() => d.createCategory({ name: 'x', minCc: 125, maxCc: 130, prices }), code('cc_overlap'))
    await assert.rejects(() => d.updateCategory('cat-125', { name: 'x', minCc: 0, maxCc: 126 }), code('cc_overlap'))
    await d.updateCategory('cat-125', { name: 'Hasta 100', minCc: 0, maxCc: 100 })
    await d.setCategoryActive('cat-125', false)
    const mid = await d.createCategory({ name: 'Medio', minCc: 0, maxCc: 125, prices })
    await assert.rejects(() => d.setCategoryActive('cat-125', true), code('cc_overlap'))
    await d.setCategoryActive(mid.id, false)
    await d.setCategoryActive('cat-125', true)
    await assert.rejects(() => d.setCategoryActive(mid.id, true), code('cc_overlap'))
  })

  test('no write leaves an active pair unpriced', async () => {
    await admin()
    const before = await snapshot()
    await assert.rejects(() => d.createCategory({ name: 'x', minCc: 3000, maxCc: 4000, prices: { basica: 1000 } }), code('price_missing'))
    await assert.rejects(() => d.createWashType({ name: 'x', prices: { 'cat-125': 1000 } }), code('price_missing'))
    assert.equal(await snapshot(), before)
    // an inactive wash type created complete, then a new category makes it need a price only once reactivated
    const t = await d.createWashType({ name: 'Cera', prices: { 'cat-125': 1, 'cat-200': 1, 'cat-200p': 1 } })
    await d.setWashTypeActive(t.id, false)
    await d.createCategory({ name: 'Grande', minCc: 2001, maxCc: 3000, prices: { basica: 1, full: 1 } })
    await assert.rejects(() => d.setWashTypeActive(t.id, true), code('price_missing'))
    assert.equal((await d.listCatalog()).washTypes.find((x) => x.id === t.id).active, false)
    await d.setPrice((await d.listCatalog()).categories.find((c) => c.name === 'Grande').id, t.id, 500)
    assert.equal((await d.setWashTypeActive(t.id, true)).active, true)
  })

  test('deactivated item is hidden from operators and not orderable; admin sees and reactivates', async () => {
    await admin()
    await d.setWashTypeActive('full', false)
    await d.setWasherActive('juan', false)
    assert.ok(ids((await d.listCatalog()).washTypes).includes('full'))
    await d.as('operator')
    await d.openShift({ openingCash: 0 })
    const c = await d.listCatalog()
    assert.deepEqual(ids(c.washTypes), ['basica'])
    assert.deepEqual(ids(c.washers), ['pedro'])
    assert.ok(c.prices.every((p) => p.washTypeId === 'basica'))
    await assert.rejects(() => d.createOrder(wash()), code('not_found'))
    await assert.rejects(() => d.createOrder(wash({ washTypeId: 'basica', washerId: 'juan' })), code('not_found'))
    await d.as('admin')
    await d.setWashTypeActive('full', true)
    await d.as('operator')
    assert.equal((await d.createOrder(wash())).washTypeName, 'Full')
  })

  test('operators are forbidden on every catalog write', async () => {
    await d.reset(); await d.as('operator')
    const writes = [
      () => d.createCategory({ name: 'x', minCc: 5000, maxCc: 6000, prices: {} }),
      () => d.updateCategory('cat-125', { name: 'x', minCc: 0, maxCc: 125 }),
      () => d.setCategoryActive('cat-125', false),
      () => d.createWashType({ name: 'x', prices: {} }),
      () => d.updateWashType('full', { name: 'x' }),
      () => d.setWashTypeActive('full', false),
      () => d.setPrice('cat-125', 'full', 5),
      () => d.createWasher({ name: 'x', commissionBp: 1 }),
      () => d.updateWasher('pedro', { name: 'x' }),
      () => d.setWasherActive('pedro', false),
      () => d.updateWasher('pedro', { commissionBp: 1 }),
    ]
    for (const w of writes) await assert.rejects(w, code('forbidden'))
  })
}
