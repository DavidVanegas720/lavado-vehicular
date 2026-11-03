import test from 'node:test'
import assert from 'node:assert/strict'
import { bogotaDate, assertShifts, shiftOf, isoWeek, month, shiftState } from '../../src/domain/shift.js'

const AB = [
  { id: 'A', name: 'A', startHour: 12, endHour: 18 },
  { id: 'B', name: 'B', startHour: 18, endHour: 12 },
]
const ONE = [{ id: 'u', name: 'U', startHour: 6, endHour: 6 }]
const bogota = (s) => new Date(s + '-05:00')

test('night shift keeps one key across midnight', () => {
  assert.equal(shiftOf(bogota('2026-10-29T23:59:00'), AB).shiftKey, '2026-10-29_B')
  assert.equal(shiftOf(bogota('2026-10-30T00:00:00'), AB).shiftKey, '2026-10-29_B')
  const last = shiftOf(bogota('2026-10-30T11:59:00'), AB)
  assert.equal(last.shiftKey, '2026-10-29_B')
  assert.equal(last.endsAt.toISOString(), bogota('2026-10-30T12:00:00').toISOString())
})
test('next shift starts at its start hour', () => {
  const s = shiftOf(bogota('2026-10-30T12:00:00'), AB)
  assert.equal(s.shiftKey, '2026-10-30_A')
  assert.equal(s.endsAt.toISOString(), bogota('2026-10-30T18:00:00').toISOString())
})
test('a 24 h shift starts at its hour', () => {
  assert.equal(shiftOf(bogota('2026-10-30T05:59:00'), ONE).businessDate, '2026-10-29')
  const s = shiftOf(bogota('2026-10-30T06:00:00'), ONE)
  assert.equal(s.businessDate, '2026-10-30')
  assert.equal(s.endsAt.toISOString(), bogota('2026-10-31T06:00:00').toISOString())
})
test('assertShifts rejects gap, overlap, double tiling, hour 24 and duplicate id', () => {
  const bad = [
    [{ id: 'A', name: 'A', startHour: 6, endHour: 12 }, { id: 'B', name: 'B', startHour: 13, endHour: 6 }],
    [{ id: 'A', name: 'A', startHour: 6, endHour: 14 }, { id: 'B', name: 'B', startHour: 12, endHour: 6 }],
    [{ id: 'A', name: 'A', startHour: 6, endHour: 24 }],
    [{ id: 'A', name: 'A', startHour: 6, endHour: 18 }, { id: 'A', name: 'B', startHour: 18, endHour: 6 }],
    [{ id: 'a', name: 'a', startHour: 6, endHour: 6 }, { id: 'b', name: 'b', startHour: 6, endHour: 6 }],
    [{ id: 'c', name: 'c', startHour: 6, endHour: 6 }, { id: 'a', name: 'a', startHour: 6, endHour: 12 }, { id: 'b', name: 'b', startHour: 12, endHour: 6 }],
    [],
  ]
  for (const s of bad) assert.throws(() => assertShifts(s), TypeError)
  assertShifts(AB)
  assertShifts(ONE)
})
test('isoWeek crosses the year boundary', () => {
  assert.equal(isoWeek('2026-12-31'), '2026-W53')
  assert.equal(isoWeek('2027-01-04'), '2027-W01')
  assert.equal(isoWeek('2026-10-29'), '2026-W44')
})
test('month reads the date string', () => {
  assert.equal(month('2026-10-29'), '2026-10')
})
test('shiftState follows the latest event of the key', () => {
  const k = 'k'
  const ev = (...types) => types.map((type) => ({ shiftKey: k, type }))
  assert.equal(shiftState([], k), 'not_opened')
  assert.equal(shiftState([{ shiftKey: 'x', type: 'open' }], k), 'not_opened')
  assert.equal(shiftState(ev('open'), k), 'open')
  assert.equal(shiftState(ev('open', 'close'), k), 'closed')
  assert.equal(shiftState(ev('open', 'close', 'reopen'), k), 'open')
  assert.equal(shiftState(ev('open', 'close', 'reopen', 'close'), k), 'closed')
})

test('bogotaDate flips at Bogota midnight, not UTC', () => {
  assert.equal(bogotaDate(bogota('2026-10-29T23:59:00')), '2026-10-29')
  assert.equal(bogotaDate(bogota('2026-10-30T00:00:00')), '2026-10-30')
})
