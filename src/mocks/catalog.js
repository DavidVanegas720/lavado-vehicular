import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { PAY_FREQUENCIES, missingPrices } from '../domain/catalog.js'
import { findOverlap } from '../domain/displacement.js'

const READERS = ['admin', 'operator']
const ADMIN = ['admin']

/** Operators see only active items (D2.7); prices only for pairs they can order. */
function visible(role, c, key) {
  if (role === 'admin') return c[key]
  if (key !== 'prices') return c[key].filter((x) => x.active)
  const on = (list, id) => list.some((x) => x.id === id && x.active)
  return c.prices.filter((p) => on(c.categories, p.categoryId) && on(c.washTypes, p.washTypeId))
}

/** Active-only catalog for createOrder. */
export const activeSnapshot = (c) => Object.fromEntries(Object.keys(c).map((k) => [k, visible('operator', c, k)]))

const read = (key) => async () => {
  const { user, business, db } = authorize(READERS)
  return structuredClone(visible(user.role, db.catalogs[business.id], key))
}

export const listCategories = read('categories')
export const listWashTypes = read('washTypes')
export const listWashers = read('washers')
export const listPrices = read('prices')

const name = (v) => {
  const n = typeof v === 'string' ? v.trim() : ''
  if (n.length < 1 || n.length > 60) throw coded('validation')
  return n
}
const int = (v, min, max = Infinity) => {
  if (!Number.isInteger(v) || v < min || v > max) throw coded('validation')
  return v
}
const enabled = (business, vt = 'motorcycle') => {
  if (!business.enabledVehicleTypes.includes(vt)) throw coded('forbidden')
  return vt
}
const range = (minCc, maxCc) => {
  int(minCc, 0)
  int(maxCc, minCc)
}
const frequency = (f) => {
  if (!Object.hasOwn(PAY_FREQUENCIES, f)) throw coded('validation')
  return f
}
const bool = (v) => {
  if (typeof v !== 'boolean') throw coded('validation')
  return v
}
const find = (list, id) => list.find((x) => x.id === id) ?? (() => { throw coded('not_found') })()

/** Throws price_missing when an active pair has no price; called before anything is written. */
const complete = (c, cats, types, prices) => {
  if (missingPrices(cats, types, prices).length) throw coded('price_missing')
}
const noOverlap = (cat, cats) => {
  if (findOverlap(cat, cats)) throw coded('cc_overlap')
}
/** `{ otherId: price }` -> price rows; every id must exist in `others`. */
const priceRows = (map, others, make) =>
  Object.entries(map ?? {}).map(([id, price]) => {
    find(others, id)
    return { ...make(id), price: int(price, 1) }
  })

export async function createCategory({ name: n, minCc, maxCc, prices, vehicleType } = {}) {
  const { business, db } = authorize(ADMIN)
  const c = db.catalogs[business.id]
  const vt = enabled(business, vehicleType)
  // cars have no cc fields and no overlap rule
  const cat = { id: `c${db.nextId}`, name: name(n), active: true, vehicleType: vt, ...(vt === 'car' ? {} : { minCc, maxCc }) }
  if (vt === 'motorcycle') {
    range(minCc, maxCc)
    noOverlap(cat, c.categories)
  }
  const rows = priceRows(prices, c.washTypes.filter((w) => w.vehicleType === vt), (washTypeId) => ({ categoryId: cat.id, washTypeId }))
  complete(c, [...c.categories, cat], c.washTypes, [...c.prices, ...rows])
  db.nextId++
  c.categories.push(cat)
  c.prices.push(...rows)
  return structuredClone(cat)
}

export async function updateCategory(id, { name: n, minCc, maxCc } = {}) {
  const { business, db } = authorize(ADMIN)
  const c = db.catalogs[business.id]
  const cat = find(c.categories, id)
  if (cat.vehicleType === 'car') {
    cat.name = name(n)
    return structuredClone(cat)
  }
  const next = { ...cat, name: name(n), minCc, maxCc }
  range(minCc, maxCc)
  if (cat.active) noOverlap(next, c.categories)
  Object.assign(cat, next)
  return structuredClone(cat)
}

export async function setCategoryActive(id, active) {
  const { business, db } = authorize(ADMIN)
  const c = db.catalogs[business.id]
  const cat = find(c.categories, id)
  if (bool(active)) {
    if (cat.vehicleType === 'motorcycle') noOverlap(cat, c.categories)
    complete(c, c.categories.map((x) => (x === cat ? { ...x, active } : x)), c.washTypes, c.prices)
  }
  cat.active = active
  return structuredClone(cat)
}

export async function createWashType({ name: n, prices, vehicleType } = {}) {
  const { business, db } = authorize(ADMIN)
  const c = db.catalogs[business.id]
  const type = { id: `t${db.nextId}`, name: name(n), active: true, vehicleType: enabled(business, vehicleType) }
  const rows = priceRows(prices, c.categories.filter((x) => x.vehicleType === type.vehicleType), (categoryId) => ({ categoryId, washTypeId: type.id }))
  complete(c, c.categories, [...c.washTypes, type], [...c.prices, ...rows])
  db.nextId++
  c.washTypes.push(type)
  c.prices.push(...rows)
  return structuredClone(type)
}

export async function updateWashType(id, { name: n } = {}) {
  const { business, db } = authorize(ADMIN)
  const type = find(db.catalogs[business.id].washTypes, id)
  type.name = name(n)
  return structuredClone(type)
}

export async function setWashTypeActive(id, active) {
  const { business, db } = authorize(ADMIN)
  const c = db.catalogs[business.id]
  const type = find(c.washTypes, id)
  if (bool(active)) complete(c, c.categories, c.washTypes.map((x) => (x === type ? { ...x, active } : x)), c.prices)
  type.active = active
  return structuredClone(type)
}

/** Works on inactive items too, so the admin can price before reactivating. */
export async function setPrice(categoryId, washTypeId, price) {
  const { business, db } = authorize(ADMIN)
  const c = db.catalogs[business.id]
  find(c.categories, categoryId)
  find(c.washTypes, washTypeId)
  int(price, 1)
  const row = c.prices.find((p) => p.categoryId === categoryId && p.washTypeId === washTypeId)
  if (row) row.price = price
  else c.prices.push({ categoryId, washTypeId, price })
  return { categoryId, washTypeId, price }
}

export async function createWasher({ name: n, commissionBp, payFrequency = 'biweekly' } = {}) {
  const { business, db } = authorize(ADMIN)
  const washer = {
    id: `w${db.nextId}`,
    name: name(n),
    commissionBp: int(commissionBp, 0, 10000),
    payFrequency: frequency(payFrequency),
    active: true,
    commissionHistory: [],
    payFrequencyHistory: [],
  }
  db.nextId++
  db.catalogs[business.id].washers.push(washer)
  return structuredClone(washer)
}

/** Omitted fields stay unchanged. A changed bp or frequency appends a history row; orders are never touched. */
export async function updateWasher(id, patch = {}) {
  const { user, business, db } = authorize(ADMIN)
  const washer = find(db.catalogs[business.id].washers, id)
  const next = { name: name(patch.name ?? washer.name), commissionBp: int(patch.commissionBp ?? washer.commissionBp, 0, 10000), payFrequency: frequency(patch.payFrequency ?? washer.payFrequency) }
  const row = { effectiveFrom: now(), changedBy: user.uid }
  if (next.commissionBp !== washer.commissionBp) washer.commissionHistory.push({ commissionBp: next.commissionBp, ...row })
  if (next.payFrequency !== washer.payFrequency) washer.payFrequencyHistory.push({ payFrequency: next.payFrequency, ...row })
  Object.assign(washer, next)
  return structuredClone(washer)
}

export const setWasherCommissionBp = async (id, bp) => updateWasher(id, { commissionBp: bp })

export async function setWasherActive(id, active) {
  const { business, db } = authorize(ADMIN)
  const washer = find(db.catalogs[business.id].washers, id)
  washer.active = bool(active)
  return structuredClone(washer)
}
