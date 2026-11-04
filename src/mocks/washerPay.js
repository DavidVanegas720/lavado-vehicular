import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { shiftOf, shiftState } from '../domain/shift.js'
import { payPeriodOf, previousPeriodOf, earnedOf, balanceOwed } from '../domain/washerPay.js'

const OPERATOR = ['operator']

/** Till payments of one instance as { washerName, amount } (shared by the shift reads). */
export const tillPaymentsOf = (db, businessId, shiftKey) =>
  db.washerPayments
    .filter((p) => p.businessId === businessId && p.source === 'till' && p.shiftKey === shiftKey)
    .map((p) => ({ washerName: p.washerName, amount: p.amount }))

const ordersOf = (db, businessId) => db.orders.filter((o) => o.businessId === businessId)
const paymentsOf = (db, businessId) => db.washerPayments.filter((p) => p.businessId === businessId)

export async function listTillPayables() {
  const { business, db } = authorize(OPERATOR)
  const today = shiftOf(now(), business.shifts).businessDate
  const orders = ordersOf(db, business.id)
  const entries = paymentsOf(db, business.id)
  return structuredClone(
    db.catalogs[business.id].washers.filter((w) => w.active).map((w) => {
      const { periodKey } = payPeriodOf(today, w.payFrequency)
      const current = orders.filter((o) => o.washerId === w.id && payPeriodOf(o.businessDate, w.payFrequency).periodKey === periodKey)
      return {
        washerId: w.id, name: w.name, payFrequency: w.payFrequency,
        balanceOwed: balanceOwed(orders, entries, w.id),
        currentEarned: current.reduce((sum, o) => sum + earnedOf(o), 0),
      }
    }),
  )
}

export async function recordTillPayment(shiftKey, input) {
  const { user, business, db } = authorize(OPERATOR)
  const state = shiftState(db.shiftEvents.filter((e) => e.businessId === business.id), shiftKey)
  if (state === 'not_opened') throw coded('shift_not_open')
  if (state === 'closed') throw coded('shift_closed')
  const washer = db.catalogs[business.id].washers.find((w) => w.id === input?.washerId && w.active)
  if (!washer) throw coded('not_found')
  const businessDate = shiftKey.split('_')[0]
  const period = input.period ?? (washer.payFrequency === 'daily' ? 'current' : 'previous')
  if (period !== 'previous' && period !== 'current') throw coded('validation')
  const owed = balanceOwed(ordersOf(db, business.id), paymentsOf(db, business.id), washer.id)
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > owed) throw coded('validation')
  const { periodKey } = (period === 'current' ? payPeriodOf : previousPeriodOf)(businessDate, washer.payFrequency)
  const payment = {
    businessId: business.id, type: 'payment', washerId: washer.id, washerName: washer.name,
    payFrequency: washer.payFrequency, periodKey, amount: input.amount, source: 'till', shiftKey,
    businessDate, paidAt: now(), recordedBy: user.uid, note: typeof input.note === 'string' ? input.note.trim() : '',
  }
  db.washerPayments.push(payment)
  return structuredClone(payment)
}

const ADMIN = ['admin']
const paidIn = (entries, washerId, periodKey) =>
  entries.filter((p) => p.washerId === washerId && p.type === 'payment' && p.periodKey === periodKey).reduce((s, p) => s + p.amount, 0)
const earnedIn = (orders, washerId, period) =>
  orders.filter((o) => o.washerId === washerId && o.businessDate >= period.start && o.businessDate <= period.end).reduce((s, o) => s + earnedOf(o), 0)

export async function listWasherBalances() {
  const { business, db } = authorize(ADMIN)
  const today = shiftOf(now(), business.shifts).businessDate
  const orders = ordersOf(db, business.id)
  const entries = paymentsOf(db, business.id)
  return structuredClone(
    db.catalogs[business.id].washers.map((w) => {
      const side = (p) => ({ periodKey: p.periodKey, earned: earnedIn(orders, w.id, p), paid: paidIn(entries, w.id, p.periodKey) })
      return {
        washerId: w.id, name: w.name, active: w.active, payFrequency: w.payFrequency, balanceOwed: balanceOwed(orders, entries, w.id),
        current: side(payPeriodOf(today, w.payFrequency)), previous: side(previousPeriodOf(today, w.payFrequency)),
      }
    }),
  )
}

export async function getWasherLedger(washerId) {
  const { business, db } = authorize(ADMIN)
  const washer = db.catalogs[business.id].washers.find((w) => w.id === washerId)
  if (!washer) throw coded('not_found')
  const orders = ordersOf(db, business.id).filter((o) => o.washerId === washerId)
  const entries = paymentsOf(db, business.id).filter((p) => p.washerId === washerId)
  const periods = new Map()
  for (const o of orders) {
    const p = payPeriodOf(o.businessDate, washer.payFrequency)
    periods.set(p.periodKey, { ...p, earned: 0, paid: 0 })
  }
  for (const p of periods.values()) {
    p.earned = earnedIn(orders, washerId, p)
    p.paid = paidIn(entries, washerId, p.periodKey)
  }
  return structuredClone({
    periods: [...periods.values()].sort((a, b) => b.start.localeCompare(a.start)),
    entries: [...entries].sort((a, b) => b.paidAt - a.paidAt),
  })
}

export async function recordOutsidePayment(input) {
  const { user, business, db } = authorize(ADMIN)
  const washer = db.catalogs[business.id].washers.find((w) => w.id === input?.washerId)
  if (!washer) throw coded('validation')
  const period = input.period ?? (washer.payFrequency === 'daily' ? 'current' : 'previous')
  if (period !== 'previous' && period !== 'current') throw coded('validation')
  const owed = balanceOwed(ordersOf(db, business.id), paymentsOf(db, business.id), washer.id)
  if (!Number.isInteger(input.amount) || input.amount < 1 || input.amount > owed) throw coded('validation') // PD-4 cap
  const businessDate = shiftOf(now(), business.shifts).businessDate
  const { periodKey } = (period === 'current' ? payPeriodOf : previousPeriodOf)(businessDate, washer.payFrequency)
  const payment = {
    businessId: business.id, type: 'payment', washerId: washer.id, washerName: washer.name,
    payFrequency: washer.payFrequency, periodKey, amount: input.amount, source: 'outside', shiftKey: null,
    businessDate, paidAt: now(), recordedBy: user.uid, note: typeof input.note === 'string' ? input.note.trim() : '',
  }
  db.washerPayments.push(payment)
  return structuredClone(payment)
}

export async function recordCorrection(input) {
  const { user, business, db } = authorize(ADMIN)
  const washer = db.catalogs[business.id].washers.find((w) => w.id === input?.washerId)
  if (!washer) throw coded('not_found')
  if (!Number.isInteger(input.amount) || input.amount === 0) throw coded('validation')
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < 1 || reason.length > 200) throw coded('validation')
  const entry = {
    businessId: business.id, type: 'correction', washerId: washer.id, washerName: washer.name,
    payFrequency: washer.payFrequency, periodKey: null, amount: input.amount, source: 'correction', shiftKey: null,
    businessDate: shiftOf(now(), business.shifts).businessDate, paidAt: now(), recordedBy: user.uid, reason,
  }
  db.washerPayments.push(entry)
  return structuredClone(entry)
}
