import test from 'node:test'
import assert from 'node:assert/strict'
import { payPeriodOf, previousPeriodOf, earnedOf, balanceOwed } from '../../src/domain/washerPay.js'

test('daily is the date itself', () => {
  assert.deepEqual(payPeriodOf('2026-10-15', 'daily'), { periodKey: '2026-10-15', start: '2026-10-15', end: '2026-10-15' })
})
test('weekly runs Monday to Sunday; a Sunday belongs to the week of its Monday', () => {
  const w = payPeriodOf('2026-10-18', 'weekly') // Sunday
  assert.deepEqual([w.start, w.end], ['2026-10-12', '2026-10-18'])
  assert.equal(w.periodKey, payPeriodOf('2026-10-12', 'weekly').periodKey)
  assert.equal(payPeriodOf('2026-10-19', 'weekly').start, '2026-10-19')
})
test('biweekly halves: 15 -> Q1, 16 and 31 -> Q2, February ends on 28', () => {
  assert.deepEqual(payPeriodOf('2026-10-15', 'biweekly'), { periodKey: '2026-10-Q1', start: '2026-10-01', end: '2026-10-15' })
  assert.deepEqual(payPeriodOf('2026-10-16', 'biweekly'), { periodKey: '2026-10-Q2', start: '2026-10-16', end: '2026-10-31' })
  assert.equal(payPeriodOf('2026-10-31', 'biweekly').periodKey, '2026-10-Q2')
  assert.deepEqual(payPeriodOf('2027-02-28', 'biweekly'), { periodKey: '2027-02-Q2', start: '2027-02-16', end: '2027-02-28' })
})
test('monthly is the calendar month', () => {
  assert.deepEqual(payPeriodOf('2028-02-10', 'monthly'), { periodKey: '2028-02', start: '2028-02-01', end: '2028-02-29' })
})
test('invalid frequency throws', () => {
  assert.throws(() => payPeriodOf('2026-10-15', 'yearly'), /payFrequency/)
})
test('previousPeriodOf steps back across months and years', () => {
  assert.equal(previousPeriodOf('2026-10-16', 'biweekly').periodKey, '2026-10-Q1')
  assert.equal(previousPeriodOf('2026-10-01', 'biweekly').periodKey, '2026-09-Q2')
  assert.equal(previousPeriodOf('2027-01-05', 'monthly').periodKey, '2026-12')
  assert.equal(previousPeriodOf('2026-10-19', 'weekly').end, '2026-10-18')
  assert.equal(previousPeriodOf('2026-10-15', 'daily').periodKey, '2026-10-14')
})
test('an order at 01:00 on Oct 16 in the shift of Oct 15 is earned in 2026-10-Q1', () => {
  const o = { businessDate: '2026-10-15', status: 'done', commissionAmount: 10000 }
  assert.equal(payPeriodOf(o.businessDate, 'biweekly').periodKey, '2026-10-Q1')
})
test('earnedOf: done, cancelled, in_progress', () => {
  assert.equal(earnedOf({ status: 'done', commissionAmount: 10000, commissionPaid: 0 }), 10000)
  assert.equal(earnedOf({ status: 'cancelled', commissionAmount: 10000, commissionPaid: 10000 }), 10000)
  assert.equal(earnedOf({ status: 'cancelled', commissionAmount: 10000, commissionPaid: 0 }), 0)
  assert.equal(earnedOf({ status: 'in_progress', commissionAmount: 10000 }), 0)
})
test('balanceOwed = earned - payments - signed corrections, per washer', () => {
  const orders = [
    { washerId: 'p', status: 'done', commissionAmount: 10000 },
    { washerId: 'p', status: 'done', commissionAmount: 20000 },
    { washerId: 'q', status: 'done', commissionAmount: 99000 },
  ]
  const entries = [
    { washerId: 'p', amount: 12000 },
    { washerId: 'p', amount: -5000 }, // correction
    { washerId: 'q', amount: 1000 },
  ]
  assert.equal(balanceOwed(orders, entries, 'p'), 30000 - 12000 + 5000)
  assert.equal(balanceOwed([], [], 'p'), 0)
})
