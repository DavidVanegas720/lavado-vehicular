// @ts-check

/**
 * Throws TypeError unless n is a non-negative safe integer (pesos).
 * @param {unknown} n
 * @param {string} [what]
 * @returns {number}
 */
export function assertPesos(n, what = 'amount') {
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) {
    throw new TypeError(`${what} must be a non-negative integer of pesos`)
  }
  return n
}

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

/**
 * Display only: "$ 25.000". Throws TypeError on a non-integer (negatives allowed, e.g. a cash difference).
 * @param {number} n
 * @returns {string}
 */
export function formatCOP(n) {
  if (!Number.isSafeInteger(n)) throw new TypeError('formatCOP needs an integer')
  return cop.format(n)
}

/**
 * Reads typed pesos ("$ 50.000"): strips "$" and spaces; dots only as thousands groups ("50.000"). Integer >= 0 or null.
 * @param {string} text
 * @returns {number | null}
 */
export function parsePesos(text) {
  if (typeof text !== 'string') return null
  const t = text.replace(/[$\s]/g, '')
  if (!/^\d+$|^\d{1,3}(\.\d{3})+$/.test(t)) return null
  const n = Number(t.replace(/\./g, ''))
  return Number.isSafeInteger(n) ? n : null
}
