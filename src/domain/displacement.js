// @ts-check

/**
 * @typedef {{ id: string, name: string, minCc: number, maxCc: number }} Category inclusive range
 */

/**
 * Suggested category for an engine size, or null when none covers it.
 * @param {number} cc positive integer
 * @param {Category[]} categories
 * @returns {Category | null}
 */
export function suggestCategory(cc, categories) {
  if (!Number.isInteger(cc) || cc <= 0) return null
  return categories.find((c) => cc >= c.minCc && cc <= c.maxCc) ?? null
}

/**
 * First OTHER active motorcycle category whose inclusive range intersects the given one, or null.
 * @param {Category & { id: string }} category
 * @param {(Category & { active: boolean, vehicleType: string })[]} categories
 * @returns {Category | null}
 */
export function findOverlap(category, categories) {
  return (
    categories.find(
      (c) =>
        c.id !== category.id &&
        c.active &&
        c.vehicleType === 'motorcycle' &&
        c.minCc <= category.maxCc &&
        category.minCc <= c.maxCc,
    ) ?? null
  )
}
