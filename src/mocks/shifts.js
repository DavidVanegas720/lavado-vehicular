import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { shiftOf, shiftState } from '../domain/shift.js'
import { tillPaymentsOf } from './washerPay.js'
import { shiftTotals, expectedCash } from '../domain/order.js'

const OPERATOR = ['operator']
const ADMIN = ['admin']
const events = (db, businessId) => db.shiftEvents.filter((e) => e.businessId === businessId)
const pesos = (n) => Number.isInteger(n) && n >= 0

/** Shift state of one instance of a business. Used by orders.js too. */
export const stateOf = (db, businessId, shiftKey) => shiftState(events(db, businessId), shiftKey)

export async function getShiftStatus() {
  const { business, db } = authorize(['admin', 'operator'])
  const cur = shiftOf(now(), business.shifts)
  const evs = events(db, business.id)
  const unclosed = evs
    .filter((e) => e.type === 'open' && e.endsAt <= now() && shiftState(evs, e.shiftKey) === 'open')
    .map((e) => ({ shiftKey: e.shiftKey, shiftName: e.shiftName, endsAt: e.endsAt }))
  const closedKeys = [...new Set(evs.filter((e) => e.type === 'close').map((e) => e.shiftKey).reverse())]
    .filter((k) => shiftState(evs, k) === 'closed')
    .slice(0, 5)
  const recentClosed = closedKeys.map((k) => {
    const o = evs.findLast((e) => e.shiftKey === k && e.type === 'open')
    return { shiftKey: k, shiftName: o.shiftName, endsAt: o.endsAt }
  })
  return structuredClone({
    recentClosed,
    current: { shiftKey: cur.shiftKey, shiftName: cur.shiftName, businessDate: cur.businessDate, endsAt: cur.endsAt, state: shiftState(evs, cur.shiftKey) },
    unclosed,
  })
}

export async function openShift(input) {
  const { user, business, db } = authorize(OPERATOR)
  if (!pesos(input?.openingCash)) throw coded('validation')
  const cur = shiftOf(now(), business.shifts)
  if (stateOf(db, business.id, cur.shiftKey) !== 'not_opened') throw coded('invalid_state')
  db.shiftEvents.push({
    businessId: business.id, type: 'open', shiftKey: cur.shiftKey, shiftName: cur.shiftName,
    endsAt: cur.endsAt, openingCash: input.openingCash, at: now(), by: user.uid,
  })
}

export async function closeShift(shiftKey, input) {
  const { user, business, db } = authorize(OPERATOR)
  if (!pesos(input?.countedCash)) throw coded('validation')
  const evs = events(db, business.id)
  const opened = evs.findLast((e) => e.shiftKey === shiftKey && e.type === 'open')
  if (!opened || shiftState(evs, shiftKey) !== 'open' || now() < opened.endsAt) throw coded('invalid_state')
  // every operator's orders count, not only the caller's
  const orders = db.orders.filter((o) => o.businessId === business.id && o.shiftKey === shiftKey)
  if (orders.some((o) => o.status === 'in_progress')) throw coded('invalid_state')
  const expected = expectedCash(opened.openingCash, orders, tillPaymentsOf(db, business.id, shiftKey))
  const close = {
    businessId: business.id, type: 'close', shiftKey, countedCash: input.countedCash, expectedCash: expected,
    difference: input.countedCash - expected, totals: structuredClone(shiftTotals(orders)), at: now(), by: user.uid,
  }
  db.shiftEvents.push(close)
  return structuredClone(close)
}

/** Blind preview (no expected cash, D3.6) of an open instance. */
export async function getClosePreview(shiftKey) {
  const { business, db } = authorize(OPERATOR)
  const evs = events(db, business.id)
  const opened = evs.findLast((e) => e.shiftKey === shiftKey && e.type === 'open')
  if (!opened || shiftState(evs, shiftKey) !== 'open') throw coded('invalid_state')
  const orders = db.orders.filter((o) => o.businessId === business.id && o.shiftKey === shiftKey)
  const { salesByMethod } = shiftTotals(orders)
  const name = (id) => db.users.find((u) => u.id === id)?.name ?? id
  return structuredClone({
    shiftKey, shiftName: opened.shiftName, endsAt: opened.endsAt, openingCash: opened.openingCash,
    salesByMethod, tillPayments: tillPaymentsOf(db, business.id, shiftKey),
    unfinished: orders.filter((o) => o.status === 'in_progress').map((o) => ({ id: o.id, plate: o.plate, createdByName: name(o.createdBy) })),
  })
}

/** Admin: every instance that has events, newest first. lateMs = time past endsAt while not closed. */
export async function listShiftInstances() {
  const { business, db } = authorize(ADMIN)
  const evs = events(db, business.id)
  const opens = [...new Map(evs.filter((e) => e.type === 'open').map((e) => [e.shiftKey, e])).values()]
  const list = opens.map((o) => {
    const state = shiftState(evs, o.shiftKey)
    return {
      shiftKey: o.shiftKey, shiftName: o.shiftName, businessDate: o.shiftKey.split('_')[0], state, endsAt: o.endsAt,
      lateMs: state === 'closed' ? 0 : Math.max(0, now() - o.endsAt),
    }
  })
  return structuredClone(list.reverse().sort((a, b) => b.endsAt - a.endsAt))
}

export async function getShiftInstance(shiftKey) {
  const { business, db } = authorize(ADMIN)
  const name = (id) => db.users.find((u) => u.id === id)?.name ?? id
  const evs = events(db, business.id).filter((e) => e.shiftKey === shiftKey)
  if (!evs.length) throw coded('not_found')
  const orders = db.orders.filter((o) => o.businessId === business.id && o.shiftKey === shiftKey)
  return structuredClone({
    events: evs.map((e) => ({ ...e, byName: name(e.by) })),
    latestClose: evs.findLast((e) => e.type === 'close') ?? null,
    orders: orders.map((o) => ({ ...o, createdByName: name(o.createdBy) })),
    tillPayments: tillPaymentsOf(db, business.id, shiftKey),
  })
}

export async function reopenShift(shiftKey, input) {
  const { user, business, db } = authorize(OPERATOR)
  const reason = typeof input?.reason === 'string' ? input.reason.trim() : ''
  if (reason.length < 1 || reason.length > 200) throw coded('validation')
  if (stateOf(db, business.id, shiftKey) !== 'closed') throw coded('invalid_state')
  db.shiftEvents.push({ businessId: business.id, type: 'reopen', shiftKey, reason, at: now(), by: user.uid })
}

/** Test helper: the business's shift events. */
export const listShiftEvents = async () => {
  const { business, db } = authorize(['admin', 'operator'])
  return structuredClone(events(db, business.id))
}
