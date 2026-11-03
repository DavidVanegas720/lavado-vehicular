import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { payPeriodOf, earnedOf } from '../domain/washerPay.js'

const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0)

export function getCashFlow({ periodType, businessDate } = {}) {
  const { business, db } = authorize(['admin'])
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate ?? '')) throw coded('validation')
  const period = payPeriodOf(businessDate, periodType) // throws validation on a bad periodType
  const inside = (d) => d >= period.start && d <= period.end
  const orders = db.orders.filter((o) => o.businessId === business.id)
  const entries = db.washerPayments.filter((p) => p.businessId === business.id)
  const done = orders.filter((o) => (o.status === 'done' || o.isRefund) && inside(o.businessDate))
  const sales = { cash: 0, qr: 0 }
  for (const o of done) sales[o.paymentMethod] += o.finalPrice
  // the sale stays on its day; the refund shows on the day it was made
  const refunds = sum(orders.filter((o) => o.isRefund && inside(o.refundBusinessDate)), (o) => o.refundAmount)
  const paid = (source) => sum(entries.filter((p) => p.type === 'payment' && p.source === source && inside(p.businessDate)), (p) => p.amount)
  const till = paid('till')
  const outside = paid('outside')
  const corrections = sum(entries.filter((p) => p.type === 'correction' && inside(p.businessDate)), (p) => p.amount)
  const owed = sum(orders.filter((o) => o.businessDate <= period.end), earnedOf) - sum(entries.filter((p) => p.businessDate <= period.end), (p) => p.amount)
  return structuredClone({
    period, in: { ...sales, total: sales.cash + sales.qr }, out: { refunds, till, outside, total: refunds + till + outside },
    corrections, owed,
  })
}
