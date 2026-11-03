import test from 'node:test'
import assert from 'node:assert/strict'
import { PAY_FREQUENCIES, missingPrices } from '../../src/domain/catalog.js'

const cat = (id, o = {}) => ({ id, vehicleType: 'motorcycle', active: true, ...o })
const price = (categoryId, washTypeId) => ({ categoryId, washTypeId, price: 1000 })

test('PAY_FREQUENCIES is frozen with the four labels', () => {
  assert.ok(Object.isFrozen(PAY_FREQUENCIES))
  assert.deepEqual(Object.values(PAY_FREQUENCIES), ['Diario', 'Semanal', 'Quincenal', 'Mensual'])
})
test('missingPrices: complete grid gives none', () => {
  assert.deepEqual(missingPrices([cat('a')], [cat('w')], [price('a', 'w')]), [])
})
test('missingPrices: reports the one missing pair', () => {
  assert.deepEqual(missingPrices([cat('a'), cat('b')], [cat('w')], [price('a', 'w')]), [
    { categoryId: 'b', washTypeId: 'w' },
  ])
})
test('missingPrices: inactive items are ignored', () => {
  assert.deepEqual(missingPrices([cat('a', { active: false })], [cat('w')], []), [])
  assert.deepEqual(missingPrices([cat('a')], [cat('w', { active: false })], []), [])
})
test('missingPrices: other vehicleType is ignored', () => {
  assert.deepEqual(missingPrices([cat('a')], [cat('w', { vehicleType: 'car' })], []), [])
})
