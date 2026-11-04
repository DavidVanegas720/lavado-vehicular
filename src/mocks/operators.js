import { authorize } from './session.js'
import { coded } from './errors.js'

const ADMIN = ['admin']
const clean = (v) => {
  const n = typeof v === 'string' ? v.trim() : ''
  if (n.length < 1 || n.length > 60) throw coded('validation')
  return n
}
const view = ({ id, name, active }) => ({ id, name, active })
const own = (db, business, id) =>
  db.users.find((u) => u.id === id && u.role === 'operator' && u.businessId === business.id) ??
  (() => { throw coded('not_found') })()

export async function listOperators() {
  const { business, db } = authorize(ADMIN)
  return db.users.filter((u) => u.role === 'operator' && u.businessId === business.id).map(view)
}

export async function createOperator({ name } = {}) {
  const { business, db } = authorize(ADMIN)
  const user = { id: `u${db.nextId}`, name: clean(name), role: 'operator', businessId: business.id, active: true }
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
