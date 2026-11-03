// @ts-check

/** @typedef {{ id: string, name: string, startHour: number, endHour: number }} Shift */

const HOUR = 3600000
const BOGOTA_OFFSET = 5 * HOUR
const pad = (/** @type {number} */ n) => String(n).padStart(2, '0')

/**
 * Throws TypeError unless the shifts tile the 24 hours with no gap or overlap.
 * @param {Shift[]} shifts
 * @returns {void}
 */
export function assertShifts(shifts) {
  if (!Array.isArray(shifts) || shifts.length === 0) throw new TypeError('shifts must be a non-empty array')
  if (new Set(shifts.map((s) => s.id)).size !== shifts.length) throw new TypeError('duplicate shift id')
  if (new Set(shifts.map((s) => s.startHour)).size !== shifts.length) throw new TypeError('duplicate shift start')
  for (const s of shifts) {
    for (const h of [s.startHour, s.endHour]) {
      if (!Number.isInteger(h) || h < 0 || h > 23) throw new TypeError('shift hours must be integers 0-23')
    }
  }
  const sorted = [...shifts].sort((a, b) => a.startHour - b.startHour)
  sorted.forEach((s, i) => {
    if (s.endHour !== sorted[(i + 1) % sorted.length].startHour) throw new TypeError('shifts must tile 24 hours')
  })
}

/**
 * Bogota calendar date of an instant, 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
export function bogotaDate(date) {
  return new Date(date.getTime() - BOGOTA_OFFSET).toISOString().slice(0, 10)
}

/**
 * The one shift/day function. businessDate is the Bogota date the shift instance STARTED.
 * shortcut: fixed UTC-5, Colombia has had no DST since 1993; switch to Intl if that changes
 * @param {Date} date
 * @param {Shift[]} shifts
 * @returns {{ shiftId: string, shiftName: string, businessDate: string, shiftKey: string, endsAt: Date }}
 */
export function shiftOf(date, shifts) {
  assertShifts(shifts)
  const local = new Date(date.getTime() - BOGOTA_OFFSET)
  const h = local.getUTCHours()
  const shift = shifts.find((s) =>
    s.startHour < s.endHour ? h >= s.startHour && h < s.endHour : h >= s.startHour || h < s.endHour,
  )
  if (!shift) throw new TypeError('no shift covers this hour')
  const startedToday = h >= shift.startHour
  const startDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (startedToday ? 0 : 1))
  const businessDate = bogotaDate(new Date(startDay + BOGOTA_OFFSET))
  const length = ((shift.endHour - shift.startHour + 24) % 24 || 24) * HOUR
  const endsAt = new Date(startDay + shift.startHour * HOUR + BOGOTA_OFFSET + length)
  return { shiftId: shift.id, shiftName: shift.name, businessDate, shiftKey: `${businessDate}_${shift.id}`, endsAt }
}

/**
 * Monday-start ISO week of a 'YYYY-MM-DD' string -> 'YYYY-Www'.
 * @param {string} businessDate
 * @returns {string}
 */
export function isoWeek(businessDate) {
  const [y, m, d] = businessDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)) // Thursday of this week
  const year = t.getUTCFullYear()
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7)
  return `${year}-W${pad(week)}`
}

/**
 * 'YYYY-MM' of a 'YYYY-MM-DD' string.
 * @param {string} businessDate
 * @returns {string}
 */
export function month(businessDate) {
  return businessDate.slice(0, 7)
}

/**
 * State of a shift instance from the latest event with that key.
 * @param {{ shiftKey: string, type: 'open' | 'close' | 'reopen' }[]} events insertion order
 * @param {string} shiftKey
 * @returns {'not_opened' | 'open' | 'closed'}
 */
export function shiftState(events, shiftKey) {
  const last = events.filter((e) => e.shiftKey === shiftKey).at(-1)
  if (!last) return 'not_opened'
  return last.type === 'close' ? 'closed' : 'open'
}
