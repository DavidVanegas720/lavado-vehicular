import test from 'node:test'
import assert from 'node:assert/strict'
import { commissionAmount, formatPercent, parsePercent } from '../../src/domain/commission.js'

test('commission is on the list price', () => {
  assert.equal(commissionAmount(25000, 4000), 10000)
  assert.equal(commissionAmount(25000, 5000), 12500)
})
test('commission rounds half up', () => {
  assert.equal(commissionAmount(1, 5000), 1) // 0.5
  assert.equal(commissionAmount(1, 4999), 0)
  assert.equal(commissionAmount(3, 5000), 2) // 1.5
})
test('commission throws TypeError on bad input', () => {
  assert.throws(() => commissionAmount(1.5, 4000), TypeError)
  assert.throws(() => commissionAmount(1000, 40.5), TypeError)
  assert.throws(() => commissionAmount(-1, 4000), TypeError)
  assert.throws(() => commissionAmount(1000, -1), TypeError)
  assert.throws(() => commissionAmount('1000', 4000), TypeError)
})
test('formatPercent shows es-CO percent', () => {
  assert.match(formatPercent(4000), /^40\s?%$/)
  assert.match(formatPercent(4050), /^40,5\s?%$/)
  assert.match(formatPercent(10000), /^100\s?%$/)
})

test('parsePercent reads basis points', () => {
  assert.equal(parsePercent('40'), 4000)
  assert.equal(parsePercent('40,5'), 4050)
  assert.equal(parsePercent('40,25'), 4025)
  assert.equal(parsePercent('0'), 0)
  assert.equal(parsePercent('100'), 10000)
})
test('parsePercent rejects bad input with null', () => {
  for (const t of ['40.5', '101', '100,5', '40,123', '', ' ', '-1', 'abc']) assert.equal(parsePercent(t), null, t)
})
