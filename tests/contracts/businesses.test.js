import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, getSession, resetMock, setMockNow, listDemoUsers } from '../../src/mocks/session.js'
import * as svc from '../../src/services/businesses.js'
import { listCategories } from '../../src/services/catalog.js'
import { listOperators } from '../../src/services/operators.js'
import { openShift } from '../../src/services/shifts.js'
import { createOrder, listShiftOrders } from '../../src/services/orders.js'

const code = (c) => (e) => e.code === c
const NOW = new Date('2026-10-29T15:00:00Z') // Bogota 2026-10-29
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const two = [{ id: 'dia', name: 'Día', startHour: 6, endHour: 18 }, { name: 'Noche', startHour: 18, endHour: 6 }]
const edit = (b, shifts) => ({ name: b.name, enabledVehicleTypes: b.enabledVehicleTypes, monthlyFee: b.billing.monthlyFee, shifts })
const medallo = () => svc.listBusinesses().businesses.find((b) => b.id === 'medallo')

beforeEach(() => { resetMock((db) => { db.businesses[0].billing.paidUntil = '2026-11-01'; db.businesses[2].billing.paidUntil = '2026-10-01' }); setMockNow(NOW); signIn('david') })

test('expiring is listed and leaves after a payment with a later paidUntil; overdue is before today', () => {
  let r = svc.listBusinesses()
  assert.deepEqual(r.alerts, { overdue: ['bloqueado'], expiring: ['medallo'] })
  assert.equal(r.alertWindowDays, 5)
  svc.recordBillingPayment('medallo', { amount: 15000000, periodMonth: '2026-11', method: 'cash', note: '', paidUntil: '2026-12-01' })
  r = svc.listBusinesses()
  assert.deepEqual(r.alerts.expiring, [])
  assert.equal(medallo().billing.lastPaymentAt !== null, true)
  assert.equal(svc.listBillingPayments('medallo')[0].recordedBy, 'david')
})

test('blocking: business_blocked for its users, unblock restores with data intact', () => {
  signIn('carlos'); openShift({ openingCash: 0 }); createOrder(wash)
  signIn('david')
  assert.throws(() => svc.setBusinessBlocked('medallo', { blocked: true, reason: '' }), code('validation'))
  assert.equal(medallo().status, 'active')
  signIn('carlos'); assert.equal(getSession().businessBlocked, false); signIn('david')
  svc.setBusinessBlocked('medallo', { blocked: true, reason: 'Sin pago' })
  signIn('carlos')
  assert.equal(getSession().businessBlocked, true)
  assert.throws(() => listShiftOrders(), code('business_blocked'))
  signIn('ana')
  assert.throws(() => listOperators(), code('business_blocked'))
  signIn('beto'); assert.doesNotThrow(() => listShiftOrders())
  signIn('david')
  svc.setBusinessBlocked('medallo', { blocked: false })
  signIn('carlos')
  assert.equal(getSession().businessBlocked, false)
  assert.equal(listShiftOrders().length, 1)
})

test('admin and operator are forbidden on every superadmin function', () => {
  const b = medallo()
  for (const who of ['ana', 'carlos']) {
    signIn(who)
    for (const call of [
      () => svc.listBusinesses(),
      () => svc.createBusiness({}),
      () => svc.updateBusiness('medallo', edit(b, b.shifts)),
      () => svc.recordBillingPayment('medallo', {}),
      () => svc.listBillingPayments('medallo'),
      () => svc.setBusinessBlocked('medallo', { blocked: false }),
      () => svc.setAlertWindowDays(7),
    ]) assert.throws(call, code('forbidden'))
  }
})

test('shifts with a gap -> validation; valid list changes only new orders', () => {
  const b = medallo()
  assert.throws(() => svc.updateBusiness('medallo', edit(b, [{ id: 'a', name: 'A', startHour: 6, endHour: 12 }])), code('validation'))
  signIn('carlos'); openShift({ openingCash: 0 }); const old = createOrder(wash)
  signIn('david')
  const saved = svc.updateBusiness('medallo', edit(b, two))
  assert.ok(saved.shifts.every((s) => s.id))
  setMockNow(new Date('2026-10-29T15:30:00Z'))
  signIn('carlos'); openShift({ openingCash: 0 }); createOrder({ ...wash, plate: 'XYZ98A' })
  const orders = listShiftOrders()
  assert.equal(orders.find((o) => o.id === old.id).shiftId, 'unico')
  assert.equal(orders.find((o) => o.id !== old.id).shiftId, 'dia')
})

test('createBusiness makes placeholder shift, empty catalog and admin; types need one', () => {
  const nb = svc.createBusiness({ name: 'Nuevo', enabledVehicleTypes: ['motorcycle'], monthlyFee: 1000, paidUntil: '2026-11-30', adminName: 'Jefe' })
  assert.equal(nb.shifts[0].id, 'unico')
  const admins = listDemoUsers().filter((u) => u.businessId === nb.id)
  assert.equal(admins.length, 1)
  assert.equal(admins[0].name, 'Jefe')
  assert.equal(admins[0].role, 'admin')
  signIn(admins[0].uid)
  assert.deepEqual(listCategories(), [])
  signIn('david')
  assert.throws(() => svc.updateBusiness(nb.id, edit({ ...nb, enabledVehicleTypes: [] }, nb.shifts)), code('validation'))
})

test('setAlertWindowDays bounds', () => {
  for (const n of [0, 61, 1.5, '5']) assert.throws(() => svc.setAlertWindowDays(n), code('validation'))
  svc.setAlertWindowDays(60)
  assert.equal(svc.listBusinesses().alertWindowDays, 60)
})
