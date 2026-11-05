// Shared cases for the P5 car business. driver: { reset(), as(key), openShift, createOrder, finishOrder, createCategory,
// createWashType, getPlateHistory }. Keys: operator (Carlos, motorcycle only), otherOperator (Beto, B: motorcycle and car),
// admin (A), otherAdmin (B).
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const car = () => ({ id: randomUUID(), plate: 'ABC123', vehicleType: 'car', categoryId: 'p-auto', washTypeId: 'p-general', washerId: 'p-lavador' })

export default function carCases(d) {
  test('Beto registers a car order: cc null, car price; it shows in the plate history', async () => {
    await d.reset(); await d.as('otherOperator')
    await d.openShift({ openingCash: 0 })
    const o = await d.createOrder(car())
    assert.equal(o.plate, 'ABC123')
    assert.equal(o.cc, null)
    assert.equal(o.vehicleType, 'car')
    assert.equal(o.listPrice, 25000)
    await d.as('otherAdmin')
    assert.equal((await d.getPlateHistory('ABC123')).counts.all, 1)
  })

  test('a car plate in motorcycle format -> validation', async () => {
    await d.reset(); await d.as('otherOperator')
    await d.openShift({ openingCash: 0 })
    await assert.rejects(() => d.createOrder({ ...car(), plate: 'ABC12D' }), code('validation'))
  })

  test('Carlos (motorcycle only) cannot order a car', async () => {
    await d.reset(); await d.as('operator')
    await d.openShift({ openingCash: 0 })
    await assert.rejects(() => d.createOrder(car()), code('forbidden'))
  })

  test('Medallo admin cannot create car catalog items', async () => {
    await d.reset(); await d.as('admin')
    await assert.rejects(() => d.createCategory({ name: 'Auto', vehicleType: 'car' }), code('forbidden'))
    await assert.rejects(() => d.createWashType({ name: 'Auto', vehicleType: 'car' }), code('forbidden'))
  })

  test('a car category never overlaps motorcycle categories', async () => {
    await d.reset(); await d.as('otherAdmin')
    const c = await d.createCategory({ name: 'Sedán', vehicleType: 'car', minCc: 0, maxCc: 2000, prices: { 'p-general': 20000 } })
    assert.equal(c.vehicleType, 'car')
    assert.equal(c.minCc, undefined)
  })
}
