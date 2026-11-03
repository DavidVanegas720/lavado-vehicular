// @ts-check
import { isoWeek, month } from './shift.js'

/** @typedef {'daily' | 'weekly' | 'biweekly' | 'monthly'} PayFrequency */
/** @typedef {{ periodKey: string, start: string, end: string }} PayPeriod */

/** @param {number} ms UTC ms @returns {string} 'YYYY-MM-DD' */
const iso = (ms) => new Date(ms).toISOString().slice(0, 10)

/**
 * Pay period containing a 'YYYY-MM-DD' businessDate. Weekly: Monday-Sunday; biweekly: days 1-15 and 16-end.
 * @param {string} businessDate
 * @param {PayFrequency} payFrequency
 * @returns {PayPeriod}
 */
export function payPeriodOf(businessDate, payFrequency) {
  const [y, m, d] = businessDate.split('-').map(Number)
  const day = Date.UTC(y, m - 1, d)
  const lastOfMonth = Date.UTC(y, m, 0)
  const ym = businessDate.slice(0, 7)
  switch (payFrequency) {
    case 'daily':
      return { periodKey: businessDate, start: businessDate, end: businessDate }
    case 'weekly': {
      const monday = day - ((new Date(day).getUTCDay() + 6) % 7) * 86400000
      return { periodKey: isoWeek(businessDate), start: iso(monday), end: iso(monday + 6 * 86400000) }
    }
    case 'biweekly':
      return d <= 15
        ? { periodKey: `${ym}-Q1`, start: `${ym}-01`, end: `${ym}-15` }
        : { periodKey: `${ym}-Q2`, start: `${ym}-16`, end: iso(lastOfMonth) }
    case 'monthly':
      return { periodKey: month(businessDate), start: `${ym}-01`, end: iso(lastOfMonth) }
    default:
      throw Object.assign(new Error('Invalid payFrequency'), { code: 'validation' })
  }
}

/**
 * The period right before the one containing businessDate.
 * @param {string} businessDate
 * @param {PayFrequency} payFrequency
 * @returns {PayPeriod}
 */
export function previousPeriodOf(businessDate, payFrequency) {
  const [y, m, d] = payPeriodOf(businessDate, payFrequency).start.split('-').map(Number)
  return payPeriodOf(iso(Date.UTC(y, m - 1, d - 1)), payFrequency)
}

/**
 * Commission earned by one order: done pays commissionAmount, cancelled pays commissionPaid.
 * @param {Record<string, any>} order
 * @returns {number}
 */
export function earnedOf(order) {
  if (order.status === 'done') return order.commissionAmount
  if (order.status === 'cancelled') return order.commissionPaid
  return 0
}

/**
 * Cumulative balance owed to a washer: earned minus payments and corrections (signed amounts).
 * @param {Record<string, any>[]} orders
 * @param {{ washerId: string, amount: number }[]} entries
 * @param {string} washerId
 * @returns {number}
 */
export function balanceOwed(orders, entries, washerId) {
  let total = 0
  for (const o of orders) if (o.washerId === washerId) total += earnedOf(o)
  for (const e of entries) if (e.washerId === washerId) total -= e.amount
  return total
}
