// @ts-check
import { assertPesos } from './money.js'
import { commissionAmount } from './commission.js'
import { parsePlate } from './plate.js'
import { suggestCategory } from './displacement.js'
import { shiftOf, isoWeek, month } from './shift.js'

/** @typedef {'cash' | 'qr'} PaymentMethod */
/** @typedef {{ uid: string, role: 'superadmin' | 'admin' | 'operator' }} User */
/** @typedef {Record<string, any>} Order */

/** Payment methods with their Spanish labels. */
export const PAYMENT_METHODS = Object.freeze({ cash: 'Efectivo', qr: 'QR' })

/**
 * @param {string} code
 * @param {string} message
 */
function coded(code, message) {
  return Object.assign(new Error(message), { code })
}

/** @param {unknown} raw */
function reason(raw) {
  const r = typeof raw === 'string' ? raw.trim() : ''
  if (r.length < 1 || r.length > 200) throw coded('validation', 'Reason must be 1-200 characters')
  return r
}

/**
 * Builds the frozen order at reception. Prices and names are copied from the catalog snapshot.
 * catalogSnapshot: { categories: [{ id, name, vehicleType, minCc, maxCc }], washTypes: [{ id, name, vehicleType }],
 *   washers: [{ id, name, commissionBp }], prices: [{ categoryId, washTypeId, price }] }
 * @param {{ plate: string, plateSpecial?: boolean, vehicleType?: 'car' | 'motorcycle', cc?: number, categoryId: string, washTypeId: string,
 *   washerId: string, isCourtesy?: boolean, courtesyReason?: string }} input
 * @param {{ categories: any[], washTypes: any[], washers: any[], prices: any[] }} catalogSnapshot
 * @param {User} user
 * @param {Date} now
 * @param {import('./shift.js').Shift[]} shifts
 * @returns {Order}
 */
export function buildOrder(input, catalogSnapshot, user, now, shifts) {
  const vehicleType = input.vehicleType ?? 'motorcycle'
  const plate = parsePlate(input.plate, vehicleType, !!input.plateSpecial)
  if (!plate) throw coded('validation', 'Invalid plate')
  const isCar = vehicleType === 'car'
  if (!isCar && !suggestCategory(input.cc, catalogSnapshot.categories.filter((c) => c.vehicleType === vehicleType)))
    throw coded('validation', 'No category covers that cc')
  const category = catalogSnapshot.categories.find((c) => c.id === input.categoryId && c.vehicleType === vehicleType)
  const washType = catalogSnapshot.washTypes.find((w) => w.id === input.washTypeId && w.vehicleType === vehicleType)
  const washer = catalogSnapshot.washers.find((w) => w.id === input.washerId)
  if (!category || !washType || !washer) throw coded('not_found', 'Catalog item not found')
  if (!isCar && !(input.cc >= category.minCc && input.cc <= category.maxCc)) throw coded('validation', 'cc outside category')
  const entry = catalogSnapshot.prices.find((p) => p.categoryId === category.id && p.washTypeId === washType.id)
  if (!entry) throw coded('not_found', 'Price not found')
  const listPrice = assertPesos(entry.price, 'listPrice')
  const isCourtesy = !!input.isCourtesy
  const courtesyReason = isCourtesy ? reason(input.courtesyReason) : null
  const stamp = shiftOf(now, shifts)
  return {
    ...plate,
    vehicleType,
    cc: isCar ? null : input.cc,
    ccMin: isCar ? null : category.minCc,
    ccMax: isCar ? null : category.maxCc,
    categoryId: category.id,
    categoryName: category.name,
    washTypeId: washType.id,
    washTypeName: washType.name,
    listPrice,
    isCourtesy,
    courtesyReason,
    finalPrice: isCourtesy ? 0 : listPrice,
    washerId: washer.id,
    washerName: washer.name,
    commissionBp: washer.commissionBp,
    commissionAmount: commissionAmount(listPrice, washer.commissionBp),
    status: 'in_progress',
    paymentMethod: null,
    createdBy: user.uid,
    createdAt: now,
    shiftId: stamp.shiftId,
    shiftName: stamp.shiftName,
    shiftKey: stamp.shiftKey,
    businessDate: stamp.businessDate,
    isoWeek: isoWeek(stamp.businessDate),
    month: month(stamp.businessDate),
  }
}

/** Creator operator or admin. @param {Order} order @param {User} user */
function canActOn(order, user) {
  return user.role === 'admin' || (user.role === 'operator' && order.createdBy === user.uid)
}

/**
 * Fields to merge when the wash is done.
 * @param {Order} order
 * @param {{ paymentMethod: PaymentMethod }} input
 * @param {User} user
 * @param {Date} now
 * @returns {Order}
 */
export function finishFields(order, input, user, now) {
  if (!canActOn(order, user)) throw coded('forbidden', 'Not allowed')
  if (order.status !== 'in_progress') throw coded('invalid_state', 'Order is not in progress')
  if (!Object.hasOwn(PAYMENT_METHODS, input?.paymentMethod)) throw coded('validation', 'Invalid payment method')
  return { status: 'done', doneAt: now, doneBy: user.uid, paymentMethod: input.paymentMethod }
}

/**
 * Fields to merge on cancel. Before the wash: no commission. After it: a refund, admin only.
 * @param {Order} order
 * @param {{ reason: string, washerPaid?: boolean }} input
 * @param {User} user
 * @param {Date} now
 * @returns {Order}
 */
export function cancelFields(order, input, user, now) {
  const refund = order.status === 'done'
  if (refund ? user.role !== 'admin' : !canActOn(order, user)) throw coded('forbidden', 'Not allowed')
  if (order.status !== 'in_progress' && !refund) throw coded('invalid_state', 'Order cannot be cancelled')
  if (refund && order.finalPrice === 0) throw coded('invalid_state', 'A courtesy has nothing to refund')
  const cancelReason = reason(input?.reason)
  if (refund && typeof input.washerPaid !== 'boolean') throw coded('validation', 'washerPaid must be a boolean')
  const washerPaid = refund && input.washerPaid === true
  return {
    status: 'cancelled',
    cancelledAt: now,
    cancelledBy: user.uid,
    cancelReason,
    isRefund: refund,
    refundAmount: refund ? order.finalPrice : 0,
    washerPaid,
    commissionPaid: washerPaid ? order.commissionAmount : 0,
  }
}

/**
 * Totals of one shift instance X. Sales: X's own orders that were paid (done or later refunded), so a refunded sale stays
 * a sale of its own instance. Refunds: those made during X (any method, any order's instance). Washer pay: X's own orders.
 * @param {Order[]} orders the instance's own orders
 * @param {Order[]} [refunds] refunds made during this instance
 */
export function shiftTotals(orders, refunds = []) {
  const salesByMethod = { cash: 0, qr: 0 }
  /** @type {Record<string, { name: string, amount: number }>} */
  const washerPay = {}
  const refundsByMethod = { cash: 0, qr: 0 }
  let unfinishedCount = 0
  for (const o of orders) {
    assertPesos(o.finalPrice, 'finalPrice')
    let pay = 0
    if (o.status === 'done' || o.isRefund) salesByMethod[/** @type {PaymentMethod} */ (o.paymentMethod)] += o.finalPrice
    if (o.status === 'done') pay = o.commissionAmount
    else if (o.status === 'cancelled') pay = o.commissionPaid
    else unfinishedCount++
    assertPesos(pay, 'commission')
    if (o.status !== 'in_progress') {
      washerPay[o.washerId] ??= { name: o.washerName, amount: 0 }
      washerPay[o.washerId].amount += pay
    }
  }
  for (const r of refunds) refundsByMethod[/** @type {PaymentMethod} */ (r.paymentMethod)] += assertPesos(r.refundAmount, 'refundAmount')
  const refundsAmount = refundsByMethod.cash + refundsByMethod.qr
  const sales = salesByMethod.cash + salesByMethod.qr
  const paid = Object.values(washerPay).reduce((s, w) => s + w.amount, 0)
  return {
    salesByMethod,
    sales,
    refundsCount: refunds.length,
    refundsAmount,
    refundsByMethod,
    washerPay,
    ownerShare: sales - refundsAmount - paid,
    unfinishedCount,
  }
}

/**
 * Cash that should be in the till: base + paid cash sales (done or refunded) - refunds made during this
 * instance (any method; only cash leaves the till) - washer payments from the till.
 * @param {number} openingCash
 * @param {Order[]} orders the instance's own orders
 * @param {{ amount: number }[]} [tillPayments] till payments of the same shift instance
 * @param {Order[]} [refunds] refunds made during this instance (any method; only cash leaves the till)
 * @returns {number}
 */
export function expectedCash(openingCash, orders, tillPayments = [], refunds = []) {
  let total = assertPesos(openingCash, 'openingCash')
  for (const o of orders) {
    if (o.paymentMethod === 'cash' && (o.status === 'done' || o.isRefund)) total += assertPesos(o.finalPrice, 'finalPrice')
  }
  for (const o of refunds) if (o.paymentMethod === 'cash') total -= assertPesos(o.refundAmount, 'refundAmount')
  for (const p of tillPayments) total -= assertPesos(p.amount, 'amount')
  return total
}
