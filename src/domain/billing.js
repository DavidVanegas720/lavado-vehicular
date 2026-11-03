// @ts-check

/**
 * Add n calendar months to 'YYYY-MM-DD', clamped to the month end.
 * @param {string} date
 * @param {number} n
 * @returns {string}
 */
export function addMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10)
}

/**
 * Split businesses into overdue (paidUntil < today) and expiring (today <= paidUntil <= today + windowDays),
 * each sorted by nearest paidUntil. today is a Bogota calendar date.
 * @template {{ billing: { paidUntil: string } }} B
 * @param {B[]} businesses
 * @param {string} today 'YYYY-MM-DD'
 * @param {number} windowDays
 * @returns {{ overdue: B[], expiring: B[] }}
 */
export function billingAlerts(businesses, today, windowDays) {
  const t = new Date(today + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + windowDays)
  const limit = t.toISOString().slice(0, 10)
  const byDue = (/** @type {B} */ a, /** @type {B} */ b) => (a.billing.paidUntil < b.billing.paidUntil ? -1 : a.billing.paidUntil > b.billing.paidUntil ? 1 : 0)
  return {
    overdue: businesses.filter((b) => b.billing.paidUntil < today).sort(byDue),
    expiring: businesses.filter((b) => b.billing.paidUntil >= today && b.billing.paidUntil <= limit).sort(byDue),
  }
}
