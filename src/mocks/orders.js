import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { activeSnapshot } from './catalog.js'
import { stateOf } from './shifts.js'
import { shiftOf } from '../domain/shift.js'
import { buildOrder, finishFields, cancelFields } from '../domain/order.js'

const OPERATOR = ['operator']
const ACTORS = ['admin', 'operator']

export function createOrder(input) {
  const { user, business, db } = authorize(OPERATOR)
  if (!business.enabledVehicleTypes.includes(input?.vehicleType ?? 'motorcycle')) throw coded('forbidden')
  const order = buildOrder(input ?? {}, activeSnapshot(db.catalogs[business.id]), user, now(), business.shifts)
  if (stateOf(db, business.id, order.shiftKey) !== 'open') throw coded('shift_not_open')
  const saved = { ...order, id: `o${db.nextId++}`, businessId: business.id }
  db.orders.push(saved)
  const v = ((db.vehicles[business.id] ??= {})[saved.plate] ??= {
    plate: saved.plate, vehicleType: saved.vehicleType, plateSpecial: saved.plateSpecial, totalWashes: 0, firstWashAt: saved.createdAt,
  })
  Object.assign(v, { lastCc: saved.cc, lastWashAt: saved.createdAt, totalWashes: v.totalWashes + 1 })
  return structuredClone(saved)
}

/** Shared by finish and cancel: tenant lookup, then closed-shift check, then the domain transition. */
function transition(orderId, input, fieldsFn) {
  const { user, business, db } = authorize(ACTORS)
  const order = db.orders.find((o) => o.id === orderId && o.businessId === business.id)
  if (!order) throw coded('not_found')
  if (stateOf(db, business.id, order.shiftKey) === 'closed') throw coded('shift_closed')
  Object.assign(order, fieldsFn(order, input, user, now()))
  return structuredClone(order)
}

export const finishOrder = (orderId, input) => transition(orderId, input, finishFields)
export const cancelOrder = (orderId, input) => transition(orderId, input, (o, i, u, n) => {
  const f = cancelFields(o, i, u, n)
  if (!f.isRefund) return f
  const { db, business } = authorize(ACTORS)
  const cur = shiftOf(n, business.shifts)
  // the cash leaves the till of the instance that is current now, which must be open
  if (o.paymentMethod === 'cash' && stateOf(db, business.id, cur.shiftKey) !== 'open') throw coded('shift_not_open')
  return { ...f, refundShiftKey: cur.shiftKey, refundBusinessDate: cur.businessDate }
})

export function listShiftOrders() {
  const { user, business, db } = authorize(OPERATOR)
  const key = shiftOf(now(), business.shifts).shiftKey
  const mine = db.orders.filter((o) => o.businessId === business.id && o.createdBy === user.uid)
  const visible = mine.filter(
    (o) => o.shiftKey === key || (o.status === 'in_progress' && stateOf(db, business.id, o.shiftKey) !== 'closed'),
  )
  // reverse first so equal timestamps keep newest-created first
  return structuredClone(visible.reverse().sort((a, b) => b.createdAt - a.createdAt))
}
