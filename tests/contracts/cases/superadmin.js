// Shared cases for the P6 superadmin business management. driver: { reset(), as(key), at(date), idOf(key), businessIdOf(k),
// signInWith(email, password), sessionGet, openShift, createOrder, listShiftOrders, listOperators, listCatalog, listBusinesses,
// createBusiness, updateBusiness, recordBillingPayment, listBillingPayments, setBusinessBlocked, setAlertWindowDays }.
// Keys: operator (Carlos, A), otherOperator (B), admin (A), superadmin. Businesses: A, B, C (blocked).
// Clock DAY1 = 2026-10-29; A paidUntil 2026-11-01, C 2026-10-01.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const code = (c) => (e) => e.code === c
const wash = (extra) => ({ id: randomUUID(), plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro', ...extra })
const two = [{ id: null, name: 'Día', startHour: 6, endHour: 18 }, { id: null, name: 'Noche', startHour: 18, endHour: 6 }]
const edit = (b, shifts) => ({ name: b.name, enabledVehicleTypes: b.enabledVehicleTypes, monthlyFee: b.billing.monthlyFee, shifts })
const NEW = { name: 'Nuevo', enabledVehicleTypes: ['motorcycle'], monthlyFee: 1000, paidUntil: '2026-11-30', adminName: 'Jefe', adminEmail: 'jefe@test.local', adminPassword: 'clave-segura-1' }
const pay = (extra) => ({ id: randomUUID(), amount: 15000000, periodMonth: '2026-11', method: 'cash', note: '', paidUntil: '2026-12-01', ...extra })

export default function superadminCases(d) {
  const A = () => d.businessIdOf('A')
  const find = async (id) => (await d.listBusinesses()).businesses.find((b) => b.id === id)

  test('expiring is listed and leaves after a payment with a later paidUntil; overdue is before today', async () => {
    await d.reset(); await d.as('superadmin')
    let r = await d.listBusinesses()
    assert.deepEqual(r.alerts, { overdue: [d.businessIdOf('C')], expiring: [A()] })
    assert.equal(r.alertWindowDays, 5)
    await d.recordBillingPayment(A(), pay())
    r = await d.listBusinesses()
    assert.deepEqual(r.alerts.expiring, [])
    assert.equal((await find(A())).billing.lastPaymentAt !== null, true)
    assert.equal((await d.listBillingPayments(A()))[0].recordedBy, d.idOf('superadmin'))
  })

  test('a billing payment id sent twice is stored once and replays the first result; a bad id -> validation', async () => {
    await d.reset(); await d.as('superadmin')
    const input = pay()
    const first = await d.recordBillingPayment(A(), input)
    assert.equal(first.id, input.id)
    assert.deepEqual(await d.recordBillingPayment(A(), input), first)
    assert.equal((await d.listBillingPayments(A())).length, 1)
    await assert.rejects(() => d.recordBillingPayment(A(), pay({ id: 'nope' })), code('validation'))
    assert.equal((await d.listBillingPayments(A())).length, 1)
  })

  test('blocking: business_blocked for its users, unblock restores with data intact', async () => {
    await d.reset(); await d.as('operator'); await d.openShift({ openingCash: 0 }); await d.createOrder(wash())
    await d.as('superadmin')
    await assert.rejects(() => d.setBusinessBlocked(A(), { blocked: true, reason: '' }), code('validation'))
    assert.equal((await find(A())).status, 'active')
    await d.as('operator'); assert.equal((await d.sessionGet()).businessBlocked, false)
    await d.as('superadmin')
    await d.setBusinessBlocked(A(), { blocked: true, reason: 'Sin pago' })
    await d.as('operator')
    assert.equal((await d.sessionGet()).businessBlocked, true)
    await assert.rejects(() => d.listShiftOrders(), code('business_blocked'))
    await d.as('admin')
    await assert.rejects(() => d.listOperators(), code('business_blocked'))
    await d.as('otherOperator'); await assert.doesNotReject(() => d.listShiftOrders())
    await d.as('superadmin')
    await d.setBusinessBlocked(A(), { blocked: false })
    await d.as('operator')
    assert.equal((await d.sessionGet()).businessBlocked, false)
    assert.equal((await d.listShiftOrders()).length, 1)
  })

  test('admin and operator are forbidden on all 7 superadmin functions', async () => {
    await d.reset(); await d.as('superadmin')
    const b = await find(A())
    for (const who of ['admin', 'operator']) {
      await d.as(who)
      for (const call of [
        () => d.listBusinesses(),
        () => d.createBusiness({}),
        () => d.updateBusiness(A(), edit(b, b.shifts)),
        () => d.recordBillingPayment(A(), {}),
        () => d.listBillingPayments(A()),
        () => d.setBusinessBlocked(A(), { blocked: false }),
        () => d.setAlertWindowDays(7),
      ]) await assert.rejects(call, code('forbidden'))
    }
  })

  test('admin session has exactly the 7 session fields, no billing', async () => {
    await d.reset(); await d.as('admin')
    assert.deepEqual(Object.keys(await d.sessionGet()).sort(),
      ['businessBlocked', 'businessId', 'businessName', 'enabledVehicleTypes', 'name', 'role', 'uid'])
  })

  test('shifts with a gap -> validation; valid list changes only new orders', async () => {
    await d.reset(); await d.as('superadmin')
    const b = await find(A())
    await assert.rejects(() => d.updateBusiness(A(), edit(b, [{ id: 'unico', name: 'Único', startHour: 6, endHour: 12 }])), code('validation'))
    await d.as('operator'); await d.openShift({ openingCash: 0 }); const old = await d.createOrder(wash())
    await d.as('superadmin')
    const saved = await d.updateBusiness(A(), edit(b, two))
    assert.ok(saved.shifts.every((s) => s.id))
    await d.at(new Date('2026-10-29T15:30:00Z'))
    await d.as('operator'); await d.openShift({ openingCash: 0 }); await d.createOrder(wash({ plate: 'XYZ98A' }))
    const orders = await d.listShiftOrders()
    assert.equal(orders.find((o) => o.id === old.id).shiftId, 'unico')
    assert.equal(orders.find((o) => o.id !== old.id).shiftName, 'Día')
  })

  test('a sent shift id must already belong to the business, once', async () => {
    await d.reset(); await d.as('superadmin')
    const b = await find(A())
    const row = (id, startHour, endHour) => ({ id, name: 'T', startHour, endHour })
    await assert.rejects(() => d.updateBusiness(A(), edit(b, [row('ajeno', 6, 6)])), code('validation'))
    await assert.rejects(() => d.updateBusiness(A(), edit(b, [row('unico', 6, 18), row('unico', 18, 6)])), code('validation'))
    const kept = await d.updateBusiness(A(), edit(b, [row('unico', 6, 18), row(null, 18, 6)]))
    assert.equal(kept.shifts[0].id, 'unico')
    assert.ok(kept.shifts[1].id && !kept.shifts[1].id.includes('_'))
  })

  test('createBusiness makes placeholder shift, empty catalog and a login for the admin; types need one', async () => {
    await d.reset(); await d.as('superadmin')
    const nb = await d.createBusiness(NEW)
    assert.equal(nb.shifts[0].id, 'unico')
    await d.signInWith('jefe@test.local', 'clave-segura-1')
    const s = await d.sessionGet()
    assert.equal(s.role, 'admin')
    assert.equal(s.businessId, nb.id)
    const c = await d.listCatalog()
    assert.deepEqual([c.categories, c.washTypes, c.washers], [[], [], []])
    await d.as('superadmin')
    await assert.rejects(() => d.createBusiness({ ...NEW, adminEmail: 'JEFE@test.local' }), code('email_taken'))
    for (const bad of [{ adminEmail: 'nope' }, { adminPassword: '1234567' }, { enabledVehicleTypes: [] }])
      await assert.rejects(() => d.createBusiness({ ...NEW, adminEmail: 'otro@test.local', ...bad }), code('validation'))
    await assert.rejects(() => d.updateBusiness(nb.id, edit({ ...nb, enabledVehicleTypes: [] }, nb.shifts)), code('validation'))
  })

  test('setAlertWindowDays bounds', async () => {
    await d.reset(); await d.as('superadmin')
    for (const n of [0, 61, 1.5, '5']) await assert.rejects(() => d.setAlertWindowDays(n), code('validation'))
    await d.setAlertWindowDays(60)
    assert.equal((await d.listBusinesses()).alertWindowDays, 60)
  })
}
