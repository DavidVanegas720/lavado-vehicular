// @ts-check

/** Washer pay frequency keys and their Spanish labels. */
export const PAY_FREQUENCIES = Object.freeze({
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
})

/**
 * Active category x active wash type pairs of the same vehicleType that have no price.
 * @param {{ id: string, vehicleType: string, active: boolean }[]} categories
 * @param {{ id: string, vehicleType: string, active: boolean }[]} washTypes
 * @param {{ categoryId: string, washTypeId: string }[]} prices
 * @returns {{ categoryId: string, washTypeId: string }[]}
 */
export function missingPrices(categories, washTypes, prices) {
  const priced = new Set(prices.map((p) => `${p.categoryId}|${p.washTypeId}`))
  const out = []
  for (const c of categories) {
    if (!c.active) continue
    for (const w of washTypes) {
      if (w.active && w.vehicleType === c.vehicleType && !priced.has(`${c.id}|${w.id}`)) {
        out.push({ categoryId: c.id, washTypeId: w.id })
      }
    }
  }
  return out
}
