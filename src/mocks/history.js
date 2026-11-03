import { authorize, now } from './session.js'
import { coded } from './errors.js'
import { shiftOf, isoWeek, month } from '../domain/shift.js'
import { parsePlate } from '../domain/plate.js'

const ADMIN = ['admin']

export function getPlateHistory(rawPlate) {
  const { business, db } = authorize(ADMIN)
  const parsed = parsePlate(rawPlate, 'motorcycle', true)
  if (!parsed) throw coded('validation')
  const { businessDate } = shiftOf(now(), business.shifts)
  const week = isoWeek(businessDate)
  const mon = month(businessDate)
  // reverse first so equal timestamps keep newest-created first
  const orders = db.orders
    .filter((o) => o.businessId === business.id && o.plate === parsed.plate)
    .reverse()
    .sort((a, b) => b.createdAt - a.createdAt)
  const counted = orders.filter((o) => o.status !== 'cancelled') // PD-7
  const counts = {
    day: counted.filter((o) => o.businessDate === businessDate).length,
    week: counted.filter((o) => o.isoWeek === week).length,
    month: counted.filter((o) => o.month === mon).length,
    all: counted.length,
  }
  return structuredClone({ vehicle: db.vehicles[business.id]?.[parsed.plate] ?? null, counts, orders })
}
