import { authorize } from './session.js'
import { coded } from './errors.js'

const ADMIN = ['admin']
const clean = (v) => {
  const n = typeof v === 'string' ? v.trim() : ''
  if (n.length < 1 || n.length > 60) throw coded('validation')
  return n
}
const view = ({ id, name, active, email = null }) => ({ id, name, active, email })
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const own = (db, business, id) =>
  db.users.find((u) => u.id === id && u.role === 'operator' && u.businessId === business.id) ??
  (() => { throw coded('not_found') })()

export async function listOperators() {
  const { business, db } = authorize(ADMIN)
  return db.users.filter((u) => u.role === 'operator' && u.businessId === business.id).map(view)
}

/** Same checks as the API (E6). The mock keeps no password: it only checks the length. */
export async function createOperator({ name, email, password } = {}) {
  const { business, db } = authorize(ADMIN)
  const n = clean(name)
  const mail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (!EMAIL.test(mail) || mail.length > 254) throw coded('validation')
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw coded('validation')
  if (db.users.some((u) => u.email === mail)) throw coded('email_taken') // Auth emails are global, across businesses
  const user = { id: `u${db.nextId}`, name: n, role: 'operator', businessId: business.id, active: true, email: mail }
  db.users.push(user)
  db.nextId++
  return view(user)
}

export async function renameOperator(id, name) {
  const { business, db } = authorize(ADMIN)
  const user = own(db, business, id)
  user.name = clean(name)
  return view(user)
}

export async function setOperatorActive(id, active) {
  const { business, db } = authorize(ADMIN)
  const user = own(db, business, id)
  if (typeof active !== 'boolean') throw coded('validation')
  user.active = active
  return view(user)
}
