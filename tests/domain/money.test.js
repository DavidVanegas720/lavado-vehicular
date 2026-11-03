import test from 'node:test'
import assert from 'node:assert/strict'
import { formatCOP, parsePesos, assertPesos } from '../../src/domain/money.js'

test('parsePesos reads typed pesos', () => {
  assert.equal(parsePesos('$ 50.000'), 50000)
  assert.equal(parsePesos('0'), 0)
  assert.equal(parsePesos('1.000.000'), 1000000)
  assert.equal(parsePesos('50000'), 50000)
})
test('parsePesos rejects commas, decimals, negatives and empty', () => {
  for (const t of ['50,5', '-1', '', 'abc', '$', '25.00', '1.5', '150.000.0', '.500']) assert.equal(parsePesos(t), null)
})
test('formatCOP formats integers and rejects decimals', () => {
  assert.match(formatCOP(25000), /^\$\s?25\.000$/)
  assert.throws(() => formatCOP(1.5), TypeError)
})
test('assertPesos rejects negatives and decimals', () => {
  assert.throws(() => assertPesos(-1), TypeError)
  assert.throws(() => assertPesos(1.5), TypeError)
  assert.equal(assertPesos(0), 0)
})
