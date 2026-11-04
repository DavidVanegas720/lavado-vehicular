import { createSeed } from './seed.js'
import { coded } from './errors.js'

let db = createSeed()
let uid = null
let fixedNow = null

/** Mock clock: tests set it, the app uses the wall clock. */
export const now = () => (fixedNow ? new Date(fixedNow) : new Date())
export const setMockNow = (date) => { fixedNow = date }
export function resetMock(edit) {
  db = createSeed()
  edit?.(db) // tests only: tweak the fresh seed (e.g. two shifts)
  uid = null
  fixedNow = null
}

const publicUser = (u) => ({
  uid: u.id,
  role: u.role,
  name: u.name,
  businessId: u.businessId,
  enabledVehicleTypes: [...(db.businesses.find((b) => b.id === u.businessId)?.enabledVehicleTypes ?? [])],
  businessBlocked: db.businesses.find((b) => b.id === u.businessId)?.status === 'blocked',
  businessName: db.businesses.find((b) => b.id === u.businessId)?.name ?? null,
})

/** Active users for the demo sign-in screen. */
export const listDemoUsers = async () => db.users.filter((u) => u.active).map(publicUser)

/** Demo sign-in by seed user id, no password (Firebase Auth arrives in P8). */
export async function signIn(userId) {
  const user = db.users.find((u) => u.id === userId)
  if (!user) throw coded('not_found')
  if (!user.active) throw coded('forbidden')
  uid = user.id
  return publicUser(user)
}

/** Email sign-in for the shared cases (no password in the mock). Unknown email -> unauthenticated. */
export async function signInWithEmail(email) {
  const user = db.users.find((u) => u.email === email)
  if (!user) throw coded('unauthenticated')
  return signIn(user.id)
}

export const signOut = async () => { uid = null }

export async function getSession() {
  const user = db.users.find((u) => u.id === uid)
  return user ? publicUser(user) : null
}

/**
 * Decision 13 gate for every other mock function: signed in, active, business not blocked, role.
 * Tenant data comes only from the signed-in user's business.
 */
export function authorize(roles) {
  const user = db.users.find((u) => u.id === uid)
  if (!user) throw coded('unauthenticated')
  if (!user.active) throw coded('forbidden')
  const business = db.businesses.find((b) => b.id === user.businessId) ?? null
  if (business?.status === 'blocked') throw coded('business_blocked')
  if (!roles.includes(user.role)) throw coded('forbidden')
  return { user: { uid: user.id, role: user.role }, business, db }
}
