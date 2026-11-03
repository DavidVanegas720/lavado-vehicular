import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOrder, finishFields, cancelFields, shiftTotals, expectedCash, PAYMENT_METHODS } from '../../src/domain/order.js'

const shifts = [{ id: 'u', name: 'Turno único', startHour: 6, endHour: 6 }]
const catalog = {
  categories: [
    { id: 'c1', name: 'Hasta 125 cc', vehicleType: 'motorcycle', minCc: 0, maxCc: 125 },
    { id: 'c2', name: 'De 126 a 200 cc', vehicleType: 'motorcycle', minCc: 126, maxCc: 200 },
    { id: 'c3', name: 'De 201 a 2000 cc', vehicleType: 'motorcycle', minCc: 201, maxCc: 2000 },
    { id: 'k1', name: 'Automóvil', vehicleType: 'car' },
  ],
  washTypes: [{ id: 'w1', name: 'Full', vehicleType: 'motorcycle' }, { id: 'w2', name: 'General', vehicleType: 'car' }],
  washers: [{ id: 'p', name: 'Pedro', commissionBp: 4000 }],
  prices: [{ categoryId: 'c2', washTypeId: 'w1', price: 25000 }, { categoryId: 'k1', washTypeId: 'w2', price: 40000 }],
}
const carlos = { uid: 'carlos', role: 'operator' }
const laura = { uid: 'laura', role: 'operator' }
const ana = { uid: 'ana', role: 'admin' }
const now = new Date('2026-10-29T15:00:00-05:00')
const input = { plate: 'abc-12d', cc: 150, categoryId: 'c2', washTypeId: 'w1', washerId: 'p' }
const code = (c) => (e) => e.code === c

test('buildOrder freezes names, prices and commission', () => {
  const o = buildOrder(input, catalog, carlos, now, shifts)
  assert.equal(o.plate, 'ABC12D')
  assert.equal(o.categoryName, 'De 126 a 200 cc')
  assert.equal(o.washerName, 'Pedro')
  assert.equal(o.listPrice, 25000)
  assert.equal(o.finalPrice, 25000)
  assert.equal(o.commissionBp, 4000)
  assert.equal(o.commissionAmount, 10000)
  assert.equal(o.status, 'in_progress')
  assert.equal(o.ccMin, 126)
  assert.equal(o.ccMax, 200)
  const car = buildOrder({ plate: 'ABC123', vehicleType: 'car', categoryId: 'k1', washTypeId: 'w2', washerId: 'p' }, catalog, carlos, now, shifts)
  assert.equal(car.ccMin, null)
  assert.equal(car.ccMax, null)
  assert.equal(o.paymentMethod, null)
  assert.equal(o.shiftKey, '2026-10-29_u')
  assert.equal(o.isoWeek, '2026-W44')
  assert.equal(o.month, '2026-10')
})
test('buildOrder rejects a category that does not cover the cc', () => {
  assert.throws(() => buildOrder({ ...input, cc: 1500 }, catalog, carlos, now, shifts), code('validation'))
})
test('courtesy charges 0 and keeps the commission', () => {
  const o = buildOrder({ ...input, isCourtesy: true, courtesyReason: ' cliente frecuente ' }, catalog, carlos, now, shifts)
  assert.equal(o.finalPrice, 0)
  assert.equal(o.commissionAmount, 10000)
  assert.equal(o.courtesyReason, 'cliente frecuente')
})
test('courtesy reason is 1-200 chars', () => {
  for (const r of ['', '  ', undefined, 'x'.repeat(201)]) {
    assert.throws(() => buildOrder({ ...input, isCourtesy: true, courtesyReason: r }, catalog, carlos, now, shifts), code('validation'))
  }
  buildOrder({ ...input, isCourtesy: true, courtesyReason: 'x'.repeat(200) }, catalog, carlos, now, shifts)
})
test('buildOrder rejects bad plate, cc and missing catalog items', () => {
  assert.throws(() => buildOrder({ ...input, plate: 'ABC123' }, catalog, carlos, now, shifts), code('validation'))
  assert.throws(() => buildOrder({ ...input, cc: 5000 }, catalog, carlos, now, shifts), code('validation'))
  assert.throws(() => buildOrder({ ...input, washerId: 'zz' }, catalog, carlos, now, shifts), code('not_found'))
  assert.throws(() => buildOrder({ ...input, cc: 100, categoryId: 'c1' }, catalog, carlos, now, shifts), code('not_found'))
})
test('car order takes no cc and a car plate', () => {
  const car = { plate: 'abc123', vehicleType: 'car', categoryId: 'k1', washTypeId: 'w2', washerId: 'p' }
  const o = buildOrder(car, catalog, carlos, now, shifts)
  assert.equal(o.vehicleType, 'car')
  assert.equal(o.cc, null)
  assert.equal(o.listPrice, 40000)
  assert.equal(buildOrder(input, catalog, carlos, now, shifts).vehicleType, 'motorcycle')
  assert.throws(() => buildOrder({ ...car, plate: 'ABC12D' }, catalog, carlos, now, shifts), code('validation'))
  assert.throws(() => buildOrder({ ...car, categoryId: 'c2' }, catalog, carlos, now, shifts), code('not_found'))
  assert.throws(() => buildOrder({ ...input, categoryId: 'k1' }, catalog, carlos, now, shifts), code('not_found'))
})

const base = () => buildOrder(input, catalog, carlos, now, shifts)
const later = new Date(now.getTime() + 3600000)

test('finishFields marks done with payment', () => {
  assert.deepEqual(finishFields(base(), { paymentMethod: 'qr' }, carlos, later), {
    status: 'done', doneAt: later, doneBy: 'carlos', paymentMethod: 'qr',
  })
  assert.equal(PAYMENT_METHODS.cash, 'Efectivo')
})
test('finishFields enforces creator, state and method', () => {
  assert.throws(() => finishFields(base(), { paymentMethod: 'cash' }, laura, later), code('forbidden'))
  finishFields(base(), { paymentMethod: 'cash' }, ana, later)
  assert.throws(() => finishFields({ ...base(), status: 'done' }, { paymentMethod: 'cash' }, carlos, later), code('invalid_state'))
  assert.throws(() => finishFields(base(), { paymentMethod: 'card' }, carlos, later), code('validation'))
})
test('cancel before the wash pays nothing', () => {
  const f = cancelFields(base(), { reason: ' error ', washerPaid: true }, carlos, later)
  assert.deepEqual(f, {
    status: 'cancelled', cancelledAt: later, cancelledBy: 'carlos', cancelReason: 'error',
    isRefund: false, refundAmount: 0, washerPaid: false, commissionPaid: 0,
  })
  assert.throws(() => cancelFields(base(), { reason: '' }, carlos, later), code('validation'))
  assert.throws(() => cancelFields(base(), { reason: 'x' }, laura, later), code('forbidden'))
})
test('cancel after the wash is an admin refund', () => {
  const done = { ...base(), status: 'done', paymentMethod: 'cash' }
  const paid = cancelFields(done, { reason: 'x', washerPaid: true }, ana, later)
  assert.equal(paid.isRefund, true)
  assert.equal(paid.refundAmount, 25000)
  assert.equal(paid.commissionPaid, 10000)
  const unpaid = cancelFields(done, { reason: 'x', washerPaid: false }, ana, later)
  assert.equal(unpaid.washerPaid, false)
  assert.equal(unpaid.commissionPaid, 0)
  assert.throws(() => cancelFields(done, { reason: 'x', washerPaid: true }, carlos, later), code('forbidden'))
  assert.throws(() => cancelFields(done, { reason: 'x' }, ana, later), code('validation'))
  assert.throws(() => cancelFields({ ...done, isCourtesy: true, finalPrice: 0 }, { reason: 'x', washerPaid: true }, ana, later), code('invalid_state'))
  assert.throws(() => cancelFields({ ...done, status: 'cancelled' }, { reason: 'x' }, ana, later), code('invalid_state'))
})

const mk = (over) => ({ ...base(), ...over })
const orders = () => {
  const done = (o) => mk({ status: 'done', ...o })
  const refund = (washerPaid) => {
    const d = done({ paymentMethod: 'cash' })
    return { ...d, ...cancelFields(d, { reason: 'x', washerPaid }, ana, later) }
  }
  return [
    done({ paymentMethod: 'cash' }),
    done({ paymentMethod: 'qr' }),
    done({ paymentMethod: 'cash', isCourtesy: true, finalPrice: 0 }),
    { ...mk({}), ...cancelFields(base(), { reason: 'x' }, carlos, later) },
    refund(true),
    refund(false),
    mk({}),
  ]
}

test('shiftTotals sums sales, refunds, washer pay and owner share', () => {
  const t = shiftTotals(orders(), orders().filter((o) => o.isRefund))
  assert.deepEqual(t.salesByMethod, { cash: 75000, qr: 25000 })
  assert.equal(t.sales, 100000)
  assert.equal(t.refundsCount, 2)
  assert.equal(t.refundsAmount, 50000)
  assert.deepEqual(t.refundsByMethod, { cash: 50000, qr: 0 })
  assert.equal(t.washerPay.p.amount, 30000 + 10000) // 3 done + 1 paid refund
  assert.equal(t.washerPay.p.name, 'Pedro')
  assert.equal(t.ownerShare, 10000)
  assert.equal(t.unfinishedCount, 1)
})
test('shiftTotals without refunds made here counts none, and refunded sales stay sales', () => {
  const t = shiftTotals(orders())
  assert.equal(t.refundsCount, 0)
  assert.equal(t.refundsAmount, 0)
  assert.equal(t.salesByMethod.cash, 75000)
})
test('expectedCash ignores qr refunds', () => {
  assert.equal(expectedCash(0, [], [], [{ isRefund: true, paymentMethod: 'qr', refundAmount: 18000 }]), 0)
})
test('expectedCash equals the terms shown by shiftTotals', () => {
  const refunds = orders().filter((o) => o.isRefund)
  const t = shiftTotals(orders(), refunds)
  assert.equal(expectedCash(50000, orders(), [{ amount: 5000 }], refunds), 50000 + t.salesByMethod.cash - t.refundsByMethod.cash - 5000)
  assert.equal(expectedCash(50000, orders(), [{ amount: 5000 }], refunds), 70000)
})
test('expectedCash is base + paid cash sales - refunds from this till - till payments', () => {
  const refunds = orders().filter((o) => o.isRefund)
  assert.equal(expectedCash(50000, orders(), [], refunds), 50000 + 75000 - 50000) // paid cash: 25000 + 0 + 25000 + 25000
  assert.equal(expectedCash(50000, orders()), 125000) // the refunds were paid from another till
  assert.equal(expectedCash(0, []), 0)
  assert.throws(() => expectedCash(1.5, []), TypeError)
})
test('expectedCash subtracts the till washer payments', () => {
  const refunds = orders().filter((o) => o.isRefund)
  assert.equal(expectedCash(50000, orders(), [{ amount: 20000 }, { amount: 5000 }], refunds), 50000 + 75000 - 50000 - 25000)
  assert.equal(expectedCash(50000, [{ status: 'done', paymentMethod: 'cash', finalPrice: 25000 }], [{ amount: 20000 }]), 55000)
  assert.throws(() => expectedCash(0, [], [{ amount: 1.5 }]), TypeError)
})
