import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePlate } from '../../src/domain/plate.js'

test('motorcycle plate is normalized', () => {
  assert.deepEqual(parsePlate('abc-12d', 'motorcycle', false), { plate: 'ABC12D', plateSpecial: false })
  assert.deepEqual(parsePlate('ABC12', 'motorcycle', false), { plate: 'ABC12', plateSpecial: false })
})
test('car format is rejected for a motorcycle', () => {
  assert.equal(parsePlate('ABC123', 'motorcycle', false), null)
  assert.deepEqual(parsePlate('ABC123', 'car', false), { plate: 'ABC123', plateSpecial: false })
})
test('special plate needs the flag', () => {
  assert.equal(parsePlate('CD1234', 'motorcycle', false), null)
  assert.deepEqual(parsePlate('CD1234', 'motorcycle', true), { plate: 'CD1234', plateSpecial: true })
})
test('special flag on a standard plate stays standard', () => {
  assert.deepEqual(parsePlate('ABC12D', 'motorcycle', true), { plate: 'ABC12D', plateSpecial: false })
})
test('special plate longer than 10 is rejected', () => {
  assert.equal(parsePlate('A'.repeat(11), 'motorcycle', true), null)
  assert.notEqual(parsePlate('A'.repeat(10), 'motorcycle', true), null)
})
