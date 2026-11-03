import test from 'node:test'
import assert from 'node:assert/strict'
import { suggestCategory, findOverlap } from '../../src/domain/displacement.js'

const cats = [
  { id: 'a', name: 'Hasta 125 cc', minCc: 0, maxCc: 125 },
  { id: 'b', name: 'De 126 a 200 cc', minCc: 126, maxCc: 200 },
  { id: 'c', name: 'Más de 200 cc', minCc: 201, maxCc: 2000 },
]

test('suggests the category covering the cc', () => {
  assert.equal(suggestCategory(150, cats)?.id, 'b')
  assert.equal(suggestCategory(125, cats)?.id, 'a')
  assert.equal(suggestCategory(126, cats)?.id, 'b')
  assert.equal(suggestCategory(2000, cats)?.id, 'c')
})
test('returns null when nothing covers the cc', () => {
  assert.equal(suggestCategory(5000, cats), null)
  assert.equal(suggestCategory(0, cats), null)
  assert.equal(suggestCategory(150.5, cats), null)
})

const r = (id, minCc, maxCc, o = {}) => ({ id, name: id, minCc, maxCc, active: true, vehicleType: 'motorcycle', ...o })

test('findOverlap: touching ranges overlap, adjacent ones do not', () => {
  assert.equal(findOverlap(r('x', 125, 200), [r('a', 0, 125)])?.id, 'a')
  assert.equal(findOverlap(r('x', 126, 200), [r('a', 0, 125)]), null)
})
test('findOverlap: ignores itself, inactive and non-motorcycle categories', () => {
  assert.equal(findOverlap(r('a', 0, 125), [r('a', 0, 125)]), null)
  assert.equal(findOverlap(r('x', 0, 125), [r('a', 0, 125, { active: false })]), null)
  assert.equal(findOverlap(r('x', 0, 125), [r('a', 0, 125, { vehicleType: 'car' })]), null)
})
