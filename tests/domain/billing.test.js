import test from 'node:test'
import assert from 'node:assert/strict'
import { billingAlerts, addMonths } from '../../src/domain/billing.js'

const biz = (id, paidUntil) => ({ id, billing: { paidUntil } })
const ids = (l) => l.map((b) => b.id)

test('splits overdue and expiring, sorted by nearest paidUntil', () => {
  const list = [biz('far', '2026-12-01'), biz('e2', '2026-11-03'), biz('o2', '2026-10-29'), biz('e1', '2026-10-31'), biz('o1', '2026-10-01')]
  const r = billingAlerts(list, '2026-10-30', 5)
  assert.deepEqual(ids(r.overdue), ['o1', 'o2'])
  assert.deepEqual(ids(r.expiring), ['e1', 'e2'])
})
test('boundaries: today and today+window are expiring, one day after is not', () => {
  const r = billingAlerts([biz('today', '2026-10-30'), biz('edge', '2026-11-04'), biz('out', '2026-11-05'), biz('yest', '2026-10-29')], '2026-10-30', 5)
  assert.deepEqual(ids(r.expiring), ['today', 'edge'])
  assert.deepEqual(ids(r.overdue), ['yest'])
})
test('addMonths clamps to month end', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2028-02-29', 1), '2028-03-29')
  assert.equal(addMonths('2026-10-31', 1), '2026-11-30')
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
})
