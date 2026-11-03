// @ts-check
import { assertPesos } from './money.js'

/**
 * Commission on the LIST price, in pesos, half up in integer math. bp = basis points (4000 = 40 %).
 * @param {number} listPrice
 * @param {number} bp
 * @returns {number}
 */
export function commissionAmount(listPrice, bp) {
  assertPesos(listPrice, 'listPrice')
  assertPesos(bp, 'bp')
  return Math.floor((listPrice * bp + 5000) / 10000)
}

const pct = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 2 })

/**
 * Display only: 4050 -> "40,5 %".
 * @param {number} bp
 * @returns {string}
 */
export function formatPercent(bp) {
  return pct.format(bp / 10000).replace('%', ' %')
}

/**
 * Typed percent to basis points: "40" -> 4000, "40,25" -> 4025. 0-100, comma and at most two decimals; else null.
 * @param {string} text
 * @returns {number | null}
 */
export function parsePercent(text) {
  const m = /^(\d{1,3})(?:,(\d{1,2}))?$/.exec(String(text).trim())
  if (!m) return null
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0') || 0)
  return bp <= 10000 ? bp : null
}
