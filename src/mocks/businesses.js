import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { assertShifts, bogotaDate } from '../domain/shift.js'
import { billingAlerts } from '../domain/billing.js'
import { CLIENT_ID } from './orders.js'
import { EMAIL } from './operators.js'

const SUPER = ['superadmin']
const TYPES = ['motorcycle', 'car']
const text = (v, max) => {
  const n = typeof v === 'string' ? v.trim() : ''
  if (n.length < 1 || n.length > max) throw coded('validation')
  return n
}
const date = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw coded('validation')
  return v
}
const money = (v, min) => {
  if (!Number.isInteger(v) || v < min) throw coded('validation')
  return v
}
const types = (v) => {
  if (!Array.isArray(v) || v.length < 1 || v.some((t) => !TYPES.includes(t)) || new Set(v).size !== v.length) throw coded('validation')
  return [...v]
}
const find = (db, id) => db.businesses.find((b) => b.id === id) ?? (() => { throw coded('not_found') })()
const out = (b) => structuredClone(b)

export async function listBusinesses() {
  const { db } = authorize(SUPER)
  const alerts = billingAlerts(db.businesses, bogotaDate(now()), db.platform.alertWindowDays)
  return {
    businesses: db.businesses.map(out),
    alerts: { overdue: alerts.overdue.map((b) => b.id), expiring: alerts.expiring.map((b) => b.id) },
    alertWindowDays: db.platform.alertWindowDays,
  }
}

export async function createBusiness({ name, enabledVehicleTypes, monthlyFee, paidUntil, adminName, adminEmail, adminPassword } = {}) {
  const { db } = authorize(SUPER)
  const business = {
    id: `b${db.nextId}`, name: text(name, 60), enabledVehicleTypes: types(enabledVehicleTypes),
    status: 'active', blockedAt: null, blockedReason: null,
    billing: { monthlyFee: money(monthlyFee, 0), paidUntil: date(paidUntil), lastPaymentAt: null },
    // placeholder: real shift hours pending David (00-master §6)
    shifts: [{ id: 'unico', name: 'Turno único', startHour: 6, endHour: 6 }],
  }
  const admin = { id: `u${db.nextId + 1}`, name: text(adminName, 60), role: 'admin', businessId: business.id, active: true, email: '' }
  // same checks as operators (E6); the mock keeps no password
  admin.email = typeof adminEmail === 'string' ? adminEmail.trim().toLowerCase() : ''
  if (!EMAIL.test(admin.email) || admin.email.length > 254) throw coded('validation')
  if (typeof adminPassword !== 'string' || adminPassword.length < 12 || adminPassword.length > 128) throw coded('validation')
  if (db.users.some((u) => u.email === admin.email)) throw coded('email_taken') // Auth emails are global
  db.nextId += 2
  db.businesses.push(business)
  db.users.push(admin)
  db.catalogs[business.id] = { categories: [], washTypes: [], washers: [], prices: [] }
  return out(business)
}

export async function updateBusiness(id, { name, enabledVehicleTypes, monthlyFee, shifts } = {}) {
  const { db } = authorize(SUPER)
  const business = find(db, id)
  const n = text(name, 60), t = types(enabledVehicleTypes), fee = money(monthlyFee, 0)
  if (!Array.isArray(shifts)) throw coded('validation')
  const rows = shifts.map((s) => ({ ...s, id: s.id ?? null, name: text(s.name, 40) }))
  // F7: a sent id must be one of the business's own, no repeats
  const sent = rows.map((r) => r.id).filter((x) => x !== null)
  if (new Set(sent).size !== sent.length || sent.some((x) => !business.shifts.some((s) => s.id === x))) throw coded('validation')
  let next = db.nextId
  for (const r of rows) r.id ??= `s${next++}`
  try { assertShifts(rows) } catch { throw coded('validation') }
  db.nextId = next
  Object.assign(business, { name: n, enabledVehicleTypes: t, shifts: rows })
  business.billing.monthlyFee = fee
  return out(business)
}

export async function recordBillingPayment(id, { id: payId, amount, periodMonth, method, note, paidUntil } = {}) {
  const { db, user } = authorize(SUPER)
  const business = find(db, id)
  if (payId !== undefined) {
    if (!(typeof payId === 'string' && CLIENT_ID.test(payId))) throw coded('validation')
    const prior = db.billingPayments.find((p) => p.id === payId && p.businessId === id)
    if (prior) {
      if (prior.recordedBy !== user.uid) throw coded('invalid_state')
      return { ...prior } // replay: no second payment
    }
  }
  if (typeof periodMonth !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodMonth)) throw coded('validation')
  const payment = {
    id: payId ?? `bp${db.nextId++}`, businessId: id, amount: money(amount, 1), periodMonth, method: text(method, 30),
    note: note ? text(note, 200) : '', paidUntil: date(paidUntil), recordedBy: user.uid, createdAt: now().toISOString(),
  }
  db.billingPayments.push(payment)
  business.billing.paidUntil = payment.paidUntil
  business.billing.lastPaymentAt = payment.createdAt
  return { ...payment }
}

export async function listBillingPayments(id) {
  const { db } = authorize(SUPER)
  find(db, id)
  return db.billingPayments.filter((p) => p.businessId === id).map((p) => ({ ...p }))
}

export async function setBusinessBlocked(id, { blocked, reason } = {}) {
  const { db } = authorize(SUPER)
  const business = find(db, id)
  if (typeof blocked !== 'boolean') throw coded('validation')
  const why = blocked ? text(reason, 200) : null // validate before writing: a failed block changes nothing
  business.status = blocked ? 'blocked' : 'active'
  business.blockedAt = blocked ? now().toISOString() : null
  business.blockedReason = why
  return out(business)
}

export async function setAlertWindowDays(n) {
  const { db } = authorize(SUPER)
  if (!Number.isInteger(n) || n < 1 || n > 60) throw coded('validation')
  db.platform.alertWindowDays = n
  return n
}
