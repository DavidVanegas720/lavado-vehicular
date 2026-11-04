import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signIn, getSession, resetMock, setMockNow, listDemoUsers } from '../../src/mocks/session.js'
import * as svc from '../../src/mocks/businesses.js'
import { listCategories } from '../../src/mocks/catalog.js'
import { listOperators } from '../../src/mocks/operators.js'
import { openShift } from '../../src/mocks/shifts.js'
import { createOrder, listShiftOrders } from '../../src/mocks/orders.js'

const code = (c) => (e) => e.code === c
const NOW = new Date('2026-10-29T15:00:00Z') // Bogota 2026-10-29
const wash = { plate: 'ABC12D', cc: 150, categoryId: 'cat-200', washTypeId: 'full', washerId: 'pedro' }
const two = [{ id: 'dia', name: 'Día', startHour: 6, endHour: 18 }, { name: 'Noche', startHour: 18, endHour: 6 }]
const edit = (b, shifts) => ({ name: b.name, enabledVehicleTypes: b.enabledVehicleTypes, monthlyFee: b.billing.monthlyFee, shifts })
const medallo = async () => (await svc.listBusinesses()).businesses.find((b) => b.id === 'medallo')

beforeEach(async () => { resetMock((db) => { db.businesses[0].billing.paidUntil = '2026-11-01'; db.businesses[2].billing.paidUntil = '2026-10-01' }); setMockNow(NOW); await signIn('david') })

test('expiring is listed and leaves after a payment with a later paidUntil; overdue is before today', async () => {
  let r = await svc.listBusinesses()
  assert.deepEqual(r.alerts, { overdue: ['bloqueado'], expiring: ['medallo'] })
  assert.equal(r.alertWindowDays, 5)
  await svc.recordBillingPayment('medallo', { amount: 15000000, periodMonth: '2026-11', method: 'cash', note: '', paidUntil: '2026-12-01' })
  r = await svc.listBusinesses()
  assert.deepEqual(r.alerts.expiring, [])
  assert.equal((await medallo()).billing.lastPaymentAt !== null, true)
  assert.equal((await svc.listBillingPayments('medallo'))[0].recordedBy, 'david')
})

test('blocking: business_blocked for its users, unblock restores with data intact', async () => {
  await signIn('carlos'); await openShift({ openingCash: 0 }); await createOrder(wash)
  await signIn('david')
  await assert.rejects(async () => svc.setBusinessBlocked('medallo', { blocked: true, reason: '' }), code('validation'))
  assert.equal((await medallo()).status, 'active')
  await signIn('carlos'); assert.equal((await getSession()).businessBlocked, false); await signIn('david')
  await svc.setBusinessBlocked('medallo', { blocked: true, reason: 'Sin pago' })
  await signIn('carlos')
  assert.equal((await getSession()).businessBlocked, true)
  await assert.rejects(async () => listShiftOrders(), code('business_blocked'))
  await signIn('ana')
  await assert.rejects(async () => listOperators(), code('business_blocked'))
  await signIn('beto'); await assert.doesNotReject(() => listShiftOrders())
  await signIn('david')
  await svc.setBusinessBlocked('medallo', { blocked: false })
  await signIn('carlos')
  assert.equal((await getSession()).businessBlocked, false)
  assert.equal((await listShiftOrders()).length, 1)
})

test('admin and operator are forbidden on every superadmin function', async () => {
  const b = await medallo()
  for (const who of ['ana', 'carlos']) {
    await signIn(who)
    for (const call of [
      () => svc.listBusinesses(),
      () => svc.createBusiness({}),
      () => svc.updateBusiness('medallo', edit(b, b.shifts)),
      () => svc.recordBillingPayment('medallo', {}),
      () => svc.listBillingPayments('medallo'),
      () => svc.setBusinessBlocked('medallo', { blocked: false }),
      () => svc.setAlertWindowDays(7),
    ]) await assert.rejects(call, code('forbidden'))
  }
})

test('shifts with a gap -> validation; valid list changes only new orders', async () => {
  const b = await medallo()
  await assert.rejects(async () => svc.updateBusiness('medallo', edit(b, [{ id: 'a', name: 'A', startHour: 6, endHour: 12 }])), code('validation'))
  await signIn('carlos'); await openShift({ openingCash: 0 }); const old = await createOrder(wash)
  await signIn('david')
  const saved = await svc.updateBusiness('medallo', edit(b, two))
  assert.ok(saved.shifts.every((s) => s.id))
  setMockNow(new Date('2026-10-29T15:30:00Z'))
  await signIn('carlos'); await openShift({ openingCash: 0 }); await createOrder({ ...wash, plate: 'XYZ98A' })
  const orders = await listShiftOrders()
  assert.equal(orders.find((o) => o.id === old.id).shiftId, 'unico')
  assert.equal(orders.find((o) => o.id !== old.id).shiftId, 'dia')
})

test('createBusiness makes placeholder shift, empty catalog and admin; types need one', async () => {
  const nb = await svc.createBusiness({ name: 'Nuevo', enabledVehicleTypes: ['motorcycle'], monthlyFee: 1000, paidUntil: '2026-11-30', adminName: 'Jefe' })
  assert.equal(nb.shifts[0].id, 'unico')
  const admins = (await listDemoUsers()).filter((u) => u.businessId === nb.id)
  assert.equal(admins.length, 1)
  assert.equal(admins[0].name, 'Jefe')
  assert.equal(admins[0].role, 'admin')
  await signIn(admins[0].uid)
  assert.deepEqual(await listCategories(), [])
  await signIn('david')
  await assert.rejects(async () => svc.updateBusiness(nb.id, edit({ ...nb, enabledVehicleTypes: [] }, nb.shifts)), code('validation'))
})

test('setAlertWindowDays bounds', async () => {
  for (const n of [0, 61, 1.5, '5']) await assert.rejects(async () => svc.setAlertWindowDays(n), code('validation'))
  await svc.setAlertWindowDays(60)
  assert.equal((await svc.listBusinesses()).alertWindowDays, 60)
})
