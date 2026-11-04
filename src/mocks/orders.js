import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { activeSnapshot } from './catalog.js'
import { stateOf } from './shifts.js'
import { shiftOf } from '../domain/shift.js'
import { buildOrder, finishFields, cancelFields } from '../domain/order.js'

const OPERATOR = ['operator']
export const CLIENT_ID = /^[0-9a-f-]{36}$/ // same rule as the API (C7)
const ACTORS = ['admin', 'operator']

export async function createOrder(input) {
  const { user, business, db } = authorize(OPERATOR)
  const id = input?.id
  if (id !== undefined && !(typeof id === 'string' && CLIENT_ID.test(id))) throw coded('validation')
  const prior = id && db.orders.find((o) => o.id === id && o.businessId === business.id)
  if (prior) {
    if (prior.createdBy !== user.uid) throw coded('invalid_state')
    return structuredClone(prior) // replay of the same create: no second order
  }
  if (!business.enabledVehicleTypes.includes(input?.vehicleType ?? 'motorcycle')) throw coded('forbidden')
  const order = buildOrder(input ?? {}, activeSnapshot(db.catalogs[business.id]), user, now(), business.shifts)
  if (stateOf(db, business.id, order.shiftKey) !== 'open') throw coded('shift_not_open')
  const saved = { ...order, id: id ?? `o${db.nextId++}`, businessId: business.id }
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

export const finishOrder = async (orderId, input) => transition(orderId, input, finishFields)
export const cancelOrder = async (orderId, input) => transition(orderId, input, cancelFields)

export async function listShiftOrders() {
  const { user, business, db } = authorize(OPERATOR)
  const key = shiftOf(now(), business.shifts).shiftKey
  const mine = db.orders.filter((o) => o.businessId === business.id && o.createdBy === user.uid)
  const visible = mine.filter(
    (o) => o.shiftKey === key || (o.status === 'in_progress' && stateOf(db, business.id, o.shiftKey) !== 'closed'),
  )
  // reverse first so equal timestamps keep newest-created first
  return structuredClone(visible.reverse().sort((a, b) => b.createdAt - a.createdAt))
}
